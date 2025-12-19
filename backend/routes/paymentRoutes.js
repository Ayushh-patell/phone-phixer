// routes/paymentRoutes.js
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
import UserMetricEvent from "../models/UserMetricEvent.js";
import { getSettingValue } from "./universalSettingsRoutes.js";
import UserMonthlyCheckStats from "../models/UserMonthlyCheckStats.js";

function monthStartUTC(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

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

    const amountInRupees =
      typeof amount !== "undefined" && amount !== null
        ? Number(amount)
        : servicePrice;

    if (Number.isNaN(amountInRupees)) {
      return res.status(400).json({ message: "Amount must be a number" });
    }

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

    const amountInPaise = Math.round(amountInRupees * 100);

    const shortServiceId = service._id.toString().slice(-8);
    const shortTimestamp = Date.now().toString().slice(-6);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `svc_${shortServiceId}_${shortTimestamp}`,
    };

    const order = await razorpay.orders.create(options);

    const userDoc = await User.findById(req.user.id).select("name email phone");

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
 * Verifies Razorpay payment, records purchase (or renew), updates selfVolume
 * and propagates UV up the referral tree with hotposition rules.
 *
 * ✅ ALSO logs RSP earned events (time + amount) in UserMetricEvent
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
      isRenew,
      previousPurchaseId,
    } = req.body || {};

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !serviceId
    ) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    if (!deviceBrand || !deviceModel || !deviceImei) {
      return res
        .status(400)
        .json({ message: "Device brand, model and IMEI are required" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

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

    let walletToDeduct = 0;
    if (useWallet && walletUsed) {
      const walletUsedNum = Number(walletUsed);
      if (Number.isNaN(walletUsedNum) || walletUsedNum < 0) {
        return res
          .status(400)
          .json({ message: "walletUsed must be a non-negative number" });
      }

      if ((user.walletBalance || 0) < walletUsedNum) {
        return res.status(400).json({
          message:
            "Insufficient wallet balance for the requested walletUsed amount",
        });
      }

      walletToDeduct = walletUsedNum;
    }

    const uv = Number(service.uv || 0);
    let purchase = null;

    if (isRenew && previousPurchaseId) {
      purchase = await Purchase.findOneAndUpdate(
        {
          _id: previousPurchaseId,
          userId: user._id,
          serviceId: service._id,
        },
        {
          $set: {
            renewedAt: new Date(),
            deviceBrand,
            deviceModel,
            deviceImei,
          },
        },
        { new: true }
      );

      if (!purchase) {
        return res.status(404).json({
          message: "Previous purchase not found for renewal",
        });
      }
    } else {
      purchase = await Purchase.create({
        userId: user._id,
        serviceId: service._id,
        amountPaid: servicePrice,
        uvEarned: uv,
        status: "completed",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        deviceBrand,
        deviceModel,
        deviceImei,
      });
    }

    if (walletToDeduct > 0) {
      user.walletBalance = Math.max(0, (user.walletBalance || 0) - walletToDeduct);
    }

    user.selfVolume = (user.selfVolume || 0) + uv;


    if (isRenew) {
  const rspToAdd = uv * RSP_PER_UV_RENEW;
  user.rsp = (user.rsp || 0) + rspToAdd;
  user.Totalrsp = (user.Totalrsp || 0) + rspToAdd;

  // ✅ monthly RSP created
  const month = monthStartUTC(new Date());
  await UserMonthlyCheckStats.findOneAndUpdate(
    { user: user._id, month },
    { $inc: { rspCreated: rspToAdd } },
    { upsert: true, new: true }
  );
}

    // ✅ RSP earn on renew (with time logging)
    const rspPerUvSetting = await getSettingValue("rsp_to_uv", 120);
    const rspPerUv = Number(rspPerUvSetting);
    const safeRspPerUv = Number.isFinite(rspPerUv) && rspPerUv > 0 ? rspPerUv : 0;

    let rspToAdd = 0;
    if (isRenew && safeRspPerUv > 0 && uv > 0) {
      rspToAdd = uv * safeRspPerUv;
      user.rsp = (user.rsp || 0) + rspToAdd;
      user.Totalrsp = (user.Totalrsp || 0) + rspToAdd;

      // ✅ event log: how much + when (createdAt)
      await UserMetricEvent.create({
        user: user._id,
        eventType: "rsp_earned",
        metrics: {
          rsp: rspToAdd,
          uv,
          rspPerUv: safeRspPerUv,
        },
        refs: {
          serviceId: service._id,
          purchaseId: purchase?._id,
          previousPurchaseId: previousPurchaseId || undefined,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
        },
        meta: {
          method: walletToDeduct > 0 ? "razorpay+wallet" : "razorpay",
          isRenew: true,
          originalPrice: originalPrice ?? servicePrice,
          walletUsed: walletToDeduct || 0,
        },
      });
    }

    const ACTIVATION_THRESHOLD = await getSettingValue("referralActive_limit", 5);

    if (user.selfVolume >= ACTIVATION_THRESHOLD && !user.referralActive) {
      user.referralActive = true;
      user.at_hotposition = false;
    }

    if (!user.hasMadeFirstPurchase) {
      user.hasMadeFirstPurchase = true;
    }

    await user.save();

    if (user.referredBy) {
      await updateReferralVolumes(user._id, uv);
    }

    return res.json({
      message: isRenew
        ? "Payment verified & renewal applied"
        : "Payment verified & purchase created",
      purchase,
      walletDeducted: walletToDeduct,
      originalPrice: originalPrice ?? servicePrice,
      rspAdded: rspToAdd, // ✅ helpful for UI
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
 * ✅ ALSO logs RSP earned events (time + amount) in UserMetricEvent
 */
router.post("/pay-with-wallet", protect, async (req, res) => {
  try {
    const {
      serviceId,
      amount,
      deviceBrand,
      deviceModel,
      deviceImei,
      isRenew,
      previousPurchaseId,
    } = req.body || {};

    if (!serviceId || typeof amount === "undefined") {
      return res.status(400).json({ message: "serviceId and amount are required" });
    }

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
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    if (amountNum !== servicePrice) {
      return res.status(400).json({
        message:
          "Wallet payment amount must match the service price for full wallet purchase",
      });
    }

    if ((user.walletBalance || 0) < amountNum) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    user.walletBalance = Math.max(0, (user.walletBalance || 0) - amountNum);

    const uv = Number(service.uv || 0);
    let purchase = null;

    if (isRenew && previousPurchaseId) {
      purchase = await Purchase.findOneAndUpdate(
        {
          _id: previousPurchaseId,
          userId: user._id,
          serviceId: service._id,
        },
        {
          $set: {
            renewedAt: new Date(),
            deviceBrand,
            deviceModel,
            deviceImei,
          },
        },
        { new: true }
      );

      if (!purchase) {
        return res.status(404).json({
          message: "Previous purchase not found for renewal",
        });
      }
    } else {
      purchase = await Purchase.create({
        userId: user._id,
        serviceId: service._id,
        amountPaid: servicePrice,
        uvEarned: uv,
        status: "completed",
        deviceBrand,
        deviceModel,
        deviceImei,
      });
    }

    user.selfVolume = (user.selfVolume || 0) + uv;


    if (isRenew) {
  const rspToAdd = uv * RSP_PER_UV_RENEW;
  user.rsp = (user.rsp || 0) + rspToAdd;
  user.Totalrsp = (user.Totalrsp || 0) + rspToAdd;

  // ✅ monthly RSP created
  const month = monthStartUTC(new Date());
  await UserMonthlyCheckStats.findOneAndUpdate(
    { user: user._id, month },
    { $inc: { rspCreated: rspToAdd } },
    { upsert: true, new: true }
  );
}

    // ✅ RSP earn on renew (with time logging)
    const rspPerUvSetting = await getSettingValue("rsp_to_uv", 120);
    const rspPerUv = Number(rspPerUvSetting);
    const safeRspPerUv = Number.isFinite(rspPerUv) && rspPerUv > 0 ? rspPerUv : 0;

    let rspToAdd = 0;
    if (isRenew && safeRspPerUv > 0 && uv > 0) {
      rspToAdd = uv * safeRspPerUv;
      user.rsp = (user.rsp || 0) + rspToAdd;
      user.Totalrsp = (user.Totalrsp || 0) + rspToAdd;

      await UserMetricEvent.create({
        user: user._id,
        eventType: "rsp_earned",
        metrics: {
          rsp: rspToAdd,
          uv,
          rspPerUv: safeRspPerUv,
        },
        refs: {
          serviceId: service._id,
          purchaseId: purchase?._id,
          previousPurchaseId: previousPurchaseId || undefined,
        },
        meta: {
          method: "wallet",
          isRenew: true,
          paidInr: amountNum,
        },
      });
    }

    const ACTIVATION_THRESHOLD = await getSettingValue("referralActive_limit", 5);

    if (user.selfVolume >= ACTIVATION_THRESHOLD && !user.referralActive) {
      user.referralActive = true;
      user.at_hotposition = false;
    }

    if (!user.hasMadeFirstPurchase) {
      user.hasMadeFirstPurchase = true;
    }

    await user.save();

    if (user.referredBy) {
      await updateReferralVolumes(user._id, uv);
    }

    return res.json({
      message: isRenew
        ? "Service renewed using wallet balance"
        : "Service purchased using wallet balance",
      purchase,
      walletRemaining: user.walletBalance,
      rspAdded: rspToAdd, // ✅ helpful for UI
    });
  } catch (err) {
    console.error("Error in wallet payment:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
