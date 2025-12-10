import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import express from "express";
import Razorpay from "razorpay";

import { updateReferralVolumes } from "../lib/referralVolumeLogic.js";
import { protect } from "../middleware/authMiddleware.js";
import Purchase from "../models/Purchase.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import { getSettingValue } from "./universalSettingsRoutes.js";

const router = express.Router();

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("⚠️ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in env");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Minimum Razorpay amount in INR (must match frontend logic)
const RAZORPAY_MIN_AMOUNT = 1;

/**
 * @route   POST /api/payments/create-order
 * @desc    Create Razorpay order for a service (Test mode)
 * @access  Private (logged-in user)
 *
 * Body: { serviceId, amount?, useWallet?, walletToUse?, originalPrice? }
 * - amount (INR) is the amount to charge via Razorpay.
 *   If omitted, defaults to the full service.price.
 */
router.post("/create-order", protect, async (req, res) => {
  try {
    const { serviceId, amount } = req.body || {};

    if (!serviceId) {
      return res.status(400).json({ message: "serviceId is required" });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({ message: "Service not found" });
    }

    const servicePrice = Number(service.price || 0);
    if (!servicePrice || servicePrice <= 0) {
      return res.status(400).json({ message: "Invalid service price" });
    }

    // Use amount from body if provided, otherwise use full service price
    const amountInRupees =
      typeof amount !== "undefined" && amount !== null
        ? Number(amount)
        : servicePrice;

    if (Number.isNaN(amountInRupees)) {
      return res.status(400).json({ message: "Amount must be a number" });
    }

    // Validate: 1 <= amount <= servicePrice
    if (amountInRupees < RAZORPAY_MIN_AMOUNT) {
      return res.status(400).json({
        message: `Amount must be at least ₹${RAZORPAY_MIN_AMOUNT}`,
      });
    }
    if (amountInRupees > servicePrice) {
      return res
        .status(400)
        .json({ message: "Amount cannot exceed service price" });
    }

    // Amount in paise
    const amountInPaise = Math.round(amountInRupees * 100);

    // Make sure receipt is < 40 chars
    const shortServiceId = service._id.toString().slice(-8);
    const shortTimestamp = Date.now().toString().slice(-6);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `svc_${shortServiceId}_${shortTimestamp}`,
    };

    const order = await razorpay.orders.create(options);

    // Optional: send some user details to prefill on frontend
    const userDoc = await User.findById(req.user.id).select(
      "name email phone"
    );

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      serviceId: service._id,
      user: userDoc
        ? {
            name: userDoc.name,
            email: userDoc.email,
            phone: userDoc.phone,
          }
        : null,
    });
  } catch (err) {
    console.error("Error creating Razorpay order:", err);
    // If Razorpay responded with a validation error, bubble it up for easier debugging
    if (err.error) {
      return res.status(400).json({
        message: err.error.description || "Razorpay error",
        details: err.error,
      });
    }
    return res.status(500).json({ message: "Unable to create order" });
  }
});

/**
 * POST /payments/verify
 * Verifies Razorpay payment, records purchase, updates selfVolume
 * and propagates UV up the referral tree with hotposition rules.
 *
 * Also supports partial wallet payment:
 *  Body extra fields:
 *    - useWallet?: boolean
 *    - walletUsed?: number (INR) – amount to deduct from wallet AFTER payment
 *    - originalPrice?: number (INR) – original service price (for reference/log)
 *
 * Device info (required, coming from frontend):
 *    - deviceBrand: string
 *    - deviceModel: string
 *    - deviceImei: string
 */
router.post("/verify", protect, async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      serviceId,
      useWallet,
      walletUsed,
      originalPrice,
      deviceBrand,
      deviceModel,
      deviceImei,
    } = req.body || {};

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !serviceId
    ) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    // device data required as well
    if (!deviceBrand || !deviceModel || !deviceImei) {
      return res
        .status(400)
        .json({ message: "Device brand, model and IMEI are required" });
    }

    // 1. Verify signature using Razorpay secret
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // 2. Get service + user
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const servicePrice = Number(service.price || 0);
    if (!servicePrice || servicePrice <= 0) {
      return res.status(400).json({ message: "Invalid service price" });
    }

    // 3. If partial wallet is used, validate wallet & remember how much to deduct
    let walletToDeduct = 0;
    if (useWallet && walletUsed) {
      const walletUsedNum = Number(walletUsed);
      if (Number.isNaN(walletUsedNum) || walletUsedNum < 0) {
        return res
          .status(400)
          .json({ message: "walletUsed must be a non-negative number" });
      }

      // Check user actually has at least this much in wallet
      if ((user.walletBalance || 0) < walletUsedNum) {
        return res.status(400).json({
          message:
            "Insufficient wallet balance for the requested walletUsed amount",
        });
      }

      walletToDeduct = walletUsedNum;
    }

    // NOTE: At this point Razorpay payment is confirmed as valid.
    // We now treat the service as fully purchased.

    // 4. Create purchase record (including device info)
    const purchase = await Purchase.create({
      userId: user._id,
      serviceId: service._id,
      amountPaid: servicePrice,
      uvEarned: service.uv,
      status: "completed",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      deviceBrand,
      deviceModel,
      deviceImei,
    });

    // 5. If using wallet partially, deduct wallet after successful payment
    if (walletToDeduct > 0) {
      user.walletBalance = Math.max(
        0,
        (user.walletBalance || 0) - walletToDeduct
      );
    }

    // 6. Update user's selfVolume
    const uv = service.uv || 0;
    user.selfVolume = (user.selfVolume || 0) + uv;

    const ACTIVATION_THRESHOLD = await getSettingValue(
      "referralActive_limit",
      5
    );

    // If user crosses threshold and is not yet active:
    if (user.selfVolume >= ACTIVATION_THRESHOLD && !user.referralActive) {
      user.referralActive = true;
      user.at_hotposition = false; // they leave hotposition once activated
    }

    if (!user.hasMadeFirstPurchase) {
      user.hasMadeFirstPurchase = true;
    }

    await user.save();

    // 7. Update upline volumes based on referral tree
    if (user.referredBy) {
      await updateReferralVolumes(user._id, uv);
    }

    return res.json({
      message: "Payment verified & purchase created",
      purchase,
      walletDeducted: walletToDeduct,
      originalPrice: originalPrice ?? servicePrice,
    });
  } catch (err) {
    console.error("Error verifying Razorpay payment:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/payments/pay-with-wallet
 * @desc    Purchase a service using wallet balance only (no Razorpay)
 * @access  Private
 *
 * Body: { serviceId, amount, deviceBrand, deviceModel, deviceImei }
 *  - amount: expected to match service.price (INR)
 */
router.post("/pay-with-wallet", protect, async (req, res) => {
  try {
    const {
      serviceId,
      amount,
      deviceBrand,
      deviceModel,
      deviceImei,
    } = req.body || {};

    if (!serviceId || typeof amount === "undefined") {
      return res
        .status(400)
        .json({ message: "serviceId and amount are required" });
    }

    // device data required
    if (!deviceBrand || !deviceModel || !deviceImei) {
      return res
        .status(400)
        .json({ message: "Device brand, model and IMEI are required" });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({ message: "Service not found" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const servicePrice = Number(service.price || 0);
    if (!servicePrice || servicePrice <= 0) {
      return res.status(400).json({ message: "Invalid service price" });
    }

    const amountNum = Number(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return res
        .status(400)
        .json({ message: "amount must be a positive number" });
    }

    // For now require exact match: wallet purchase must be for full service price
    if (amountNum !== servicePrice) {
      return res.status(400).json({
        message:
          "Wallet payment amount must match the service price for full wallet purchase",
      });
    }

    // Check wallet balance
    if ((user.walletBalance || 0) < amountNum) {
      return res.status(400).json({
        message: "Insufficient wallet balance",
      });
    }

    // Deduct from wallet
    user.walletBalance = Math.max(0, (user.walletBalance || 0) - amountNum);

    // Create purchase record (wallet-only, with device info)
    const purchase = await Purchase.create({
      userId: user._id,
      serviceId: service._id,
      amountPaid: servicePrice,
      uvEarned: service.uv,
      status: "completed",
      deviceBrand,
      deviceModel,
      deviceImei,
      // You can add: paymentMethod: "wallet" in schema later if needed
    });

    // Update UV
    const uv = service.uv || 0;
    user.selfVolume = (user.selfVolume || 0) + uv;

    const ACTIVATION_THRESHOLD = await getSettingValue(
      "referralActive_limit",
      5
    );

    if (user.selfVolume >= ACTIVATION_THRESHOLD && !user.referralActive) {
      user.referralActive = true;
      user.at_hotposition = false;
    }

    if (!user.hasMadeFirstPurchase) {
      user.hasMadeFirstPurchase = true;
    }

    await user.save();

    // Propagate volumes upwards if placed
    if (user.referredBy) {
      await updateReferralVolumes(user._id, uv);
    }

    return res.json({
      message: "Service purchased using wallet balance",
      purchase,
      walletRemaining: user.walletBalance,
    });
  } catch (err) {
    console.error("Error in wallet payment:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
