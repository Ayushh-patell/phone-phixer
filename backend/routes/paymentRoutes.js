// routes/paymentRoutes.js
import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import express from "express";
import Razorpay from "razorpay";

import { protect } from "../middleware/authMiddleware.js";
import { updateReferralVolumes } from "../lib/referralVolumeLogic.js";
import { updateReferralRSP } from "../lib/updateReferralRSP.js";

import Purchase from "../models/Purchase.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import TreeNode from "../models/TreeNode.js";
import UserMetricEvent from "../models/UserMetricEvent.js";
import UserMonthlyCheckStats from "../models/UserMonthlyCheckStats.js";

import { getSettingValue } from "./universalSettingsRoutes.js";
import { generateInvoicePDF } from "../lib/invoiceGenerator.js";
import { sendInvoiceEmail } from "../lib/emailSender.js";

function monthStartUTC(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)
  );
}

const router = express.Router();

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("⚠️ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in env");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ------------------------------------------------------------
// POST /api/payments/verify
// ------------------------------------------------------------


// Minimum Razorpay amount in INR (must match frontend logic)
const RAZORPAY_MIN_AMOUNT = 1;

/**
 * @route   POST /api/payments/create-order
 * @desc    Create Razorpay order for a service
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

        const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if(user.isDisabled) {
      return res.status(404).json({ message: "Account Disabled" })
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

    // ✅ SERVER-SIDE GST (never trust frontend)
    const validTax = Number(((amountInRupees * 18) / 100).toFixed(2));
    const totalAmount = amountInRupees + validTax;

    const amountInPaise = Math.round(totalAmount * 100);

    const shortServiceId = service._id.toString().slice(-8);
    const shortTimestamp = Date.now().toString().slice(-6);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `svc_${shortServiceId}_${shortTimestamp}`,
    };

    const order = await razorpay.orders.create(options);

    const userDoc = await User.findById(req.user.id).select(
      "name email phone"
    );

    return res.json({
      orderId: order.id,
      amount: order.amount, // ✅ already includes tax
      currency: order.currency,
      serviceId: service._id,
      tax: validTax,
      baseAmount: amountInRupees,
      totalAmount,
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


// ------------------------------------------------------------
// POST /api/payments/verify
// ------------------------------------------------------------
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
// Single device fields (keep for fallback)
      deviceBrand,
      deviceModel,
      deviceImei,
      // New devices array field
      devices,
      isRenew,
      previousPurchaseId,
    } = req.body || {};

    // Required for this route: Razorpay proof + serviceId
    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !serviceId
    ) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    // Verify Razorpay signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });


    // NEW: Device Array Validation
    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ message: "Devices list is required" });
    }

    const maxAllowed = service.deviceCovered || 1; // Default to 1 if not defined
    if (devices.length > maxAllowed) {
      return res.status(400).json({ 
        message: `This service only covers up to ${maxAllowed} device(s).` 
      });
    }

    // Validate structure of objects inside devices array
    for (const d of devices) {
      if (!d.deviceBrand || !d.deviceModel || !d.deviceImei) {
        return res.status(400).json({ message: "Each device must have brand, model, and IMEI" });
      }
    }

        const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if(user.isDisabled) {
      return res.status(404).json({ message: "Account Disabled" })
    }
    const servicePrice = Number(service.price || 0);
    if (!Number.isFinite(servicePrice) || servicePrice <= 0) {
      return res.status(400).json({ message: "Invalid service price" });
    }

    // -----------------------------
    // Wallet handling
    // -----------------------------
    let walletToDeduct = 0;

    if (useWallet && walletUsed != null) {
      const walletUsedNum = Number(walletUsed);

      if (!Number.isFinite(walletUsedNum) || walletUsedNum < 0) {
        return res
          .status(400)
          .json({ message: "walletUsed must be a non-negative number" });
      }

      if (walletUsedNum > servicePrice) {
        return res
          .status(400)
          .json({ message: "walletUsed cannot exceed service price" });
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
    if (!Number.isFinite(uv) || uv < 0) {
      return res.status(400).json({ message: "Invalid service UV" });
    }

    // -----------------------------
    // Payment math (FIXED)
    // -----------------------------
    const basePrice = servicePrice;

    const paidViaWalletBase = walletToDeduct;
    const paidViaRazorpayBase = Math.max(0, basePrice - walletToDeduct);

    const taxAmount = Number(((basePrice * 18) / 100).toFixed(2));

    // ✅ Wallet pays BASE only
    const paidViaWallet = paidViaWalletBase;

    // ✅ Razorpay pays remaining + tax
    const paidViaRazorpay = paidViaRazorpayBase + taxAmount;

    const totalPaid = basePrice + taxAmount;

    const paymentMethod =
      paidViaWalletBase > 0 && paidViaRazorpayBase > 0
        ? "razorpay+wallet"
        : paidViaWalletBase > 0
        ? "wallet"
        : "razorpay";

    let purchase = null;

    // -----------------------------
    // Renewal vs New
    // -----------------------------
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
            deviceBrand: devices[0].deviceBrand, // Store first device in legacy fields
            deviceModel: devices[0].deviceModel,
            deviceImei: devices[0].deviceImei,
            devices: devices, // Store full array
            paymentMethod,
            paidViaWallet,
            paidViaRazorpay,
            razorpayOrderId: paidViaRazorpayBase > 0 ? razorpay_order_id : null,
            razorpayPaymentId:
              paidViaRazorpayBase > 0 ? razorpay_payment_id : null,
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
        amountPaid: totalPaid,
        serviceId: service._id,
        uvEarned: uv,
        status: "completed",
        paymentMethod,
        paidViaWallet,
        paidViaRazorpay,
        razorpayOrderId: paidViaRazorpayBase > 0 ? razorpay_order_id : null,
        razorpayPaymentId:
          paidViaRazorpayBase > 0 ? razorpay_payment_id : null,
        deviceBrand: devices[0].deviceBrand, // Store first device in legacy fields
        deviceModel: devices[0].deviceModel,
        deviceImei: devices[0].deviceImei,
        devices: devices, // Store full array
      });
    }

    // -----------------------------
    // Wallet deduction
    // -----------------------------
    if (walletToDeduct > 0) {
      user.walletBalance = Math.max(
        0,
        (user.walletBalance || 0) - walletToDeduct
      );
    }

    // Update self volume
    user.selfVolume = (user.selfVolume || 0) + uv;

    // -----------------------------
    // RSP on renew
    // -----------------------------
    let rspAdded = 0;

    if (isRenew) {
      const rspPerUvSetting = await getSettingValue("rsp_to_uv", 120);
      const rspPerUv = Number(rspPerUvSetting);
      const safeRspPerUv =
        Number.isFinite(rspPerUv) && rspPerUv > 0 ? rspPerUv : 0;

      if (safeRspPerUv > 0 && uv > 0) {
        rspAdded = uv * safeRspPerUv;

        await updateReferralRSP(user._id, rspAdded);

        const month = monthStartUTC(new Date());
        await UserMonthlyCheckStats.findOneAndUpdate(
          { user: user._id, month },
          { $inc: { rspCreated: rspAdded } },
          { upsert: true, new: true }
        );

        await UserMetricEvent.create({
          user: user._id,
          eventType: "rsp_earned",
          metrics: {
            rsp: rspAdded,
            uv,
            rspPerUv: safeRspPerUv,
          },
          refs: {
            serviceId: service._id,
            purchaseId: purchase?._id,
            previousPurchaseId: previousPurchaseId || undefined,
            razorpayOrderId:
              paidViaRazorpayBase > 0 ? razorpay_order_id : undefined,
            razorpayPaymentId:
              paidViaRazorpayBase > 0 ? razorpay_payment_id : undefined,
          },
          meta: {
            method: paymentMethod,
            isRenew: true,
            originalPrice: originalPrice ?? servicePrice,
            walletUsed: paidViaWallet,
            paidViaRazorpay,
          },
        });
      }
    }

    // -----------------------------
    // Activation logic
    // -----------------------------
    const ACTIVATION_THRESHOLD = await getSettingValue(
      "referralActive_limit",
      5
    );

    let activatedNow = false;

    if ((user.selfVolume || 0) >= ACTIVATION_THRESHOLD && !user.referralActive) {
      user.referralActive = true;
      activatedNow = true;
    }

    if (!user.hasMadeFirstPurchase) {
      user.hasMadeFirstPurchase = true;
    }

    await user.save();

    // -----------------------------
    // Invoice
    // -----------------------------
    try {
      const invoicePath = await generateInvoicePDF({
        purchase,
        user,
        tax: taxAmount,
        service,
      });

      await sendInvoiceEmail({
        to: user.email,
        name: user.name,
        invoicePath,
      });
    } catch (err) {
      console.error("Invoice generation/email failed:", err);
    }

    // Clear hotposition
    if (activatedNow && user.referralUsed) {
      await TreeNode.updateOne(
        { treeOwner: user.referralUsed, user: user._id },
        { $set: { at_hotposition: false } }
      );
    }

    // Propagate UV
    if (uv > 0) {
      await updateReferralVolumes(user._id, uv);
    }

    return res.json({
      message: isRenew
        ? "Payment verified & renewal applied"
        : "Payment verified & purchase created",
      purchase,
      walletDeducted: paidViaWallet,
      taxAmount,
      paidViaRazorpay,
      paymentMethod,
      originalPrice: originalPrice ?? servicePrice,
      rspAdded,
    });
  } catch (err) {
    console.error("Error verifying Razorpay payment:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------------------------
// POST /api/payments/pay-with-wallet
// ------------------------------------------------------------
router.post("/pay-with-wallet", protect, async (req, res) => {
  try {
    const {
      serviceId,
      amount,
      tax,
      deviceBrand,
      deviceModel,
      deviceImei,
      devices,
      isRenew,
      previousPurchaseId,
    } = req.body || {};

    if (!serviceId || typeof amount === "undefined") {
      return res
        .status(400)
        .json({ message: "serviceId and amount are required" });
    }


    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({ message: "Service not found" });
    }

    // NEW: Device Array Validation
    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ message: "Devices list is required" });
    }

    const maxAllowed = service.deviceCovered || 1; // Default to 1 if not defined
    if (devices.length > maxAllowed) {
      return res.status(400).json({ 
        message: `This service only covers up to ${maxAllowed} device(s).` 
      });
    }

    // Validate structure of objects inside devices array
    for (const d of devices) {
      if (!d.deviceBrand || !d.deviceModel || !d.deviceImei) {
        return res.status(400).json({ message: "Each device must have brand, model, and IMEI" });
      }
    }

        const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if(user.isDisabled) {
      return res.status(404).json({ message: "Account Disabled" })
    }
    
    const servicePrice = Number(service.price || 0);
    if (!Number.isFinite(servicePrice) || servicePrice <= 0) {
      return res.status(400).json({ message: "Invalid service price" });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res
        .status(400)
        .json({ message: "amount must be a positive number" });
    }

    // ✅ safer GST calculation
    const validTax = Number(((amountNum * 18) / 100).toFixed(2));
    const clientTax = Number(tax);

    if (!Number.isFinite(clientTax) || Math.abs(validTax - clientTax) > 0.01) {
      return res.status(400).json({
        message: "Invalid Tax value",
      });
    }

    // Full wallet purchase only
    if (amountNum !== servicePrice) {
      return res.status(400).json({
        message:
          "Wallet payment amount must match the service price for full wallet purchase",
      });
    }

    const amountWithTax = Number((amountNum + validTax).toFixed(2));

    if ((user.walletBalance || 0) < amountWithTax) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    // ✅ Deduct wallet
    user.walletBalance = Math.max(
      0,
      (user.walletBalance || 0) - amountWithTax
    );

    const uv = Number(service.uv || 0);
    if (!Number.isFinite(uv) || uv < 0) {
      return res.status(400).json({ message: "Invalid service UV" });
    }

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
            deviceBrand: devices[0].deviceBrand, // Store first device in legacy fields
            deviceModel: devices[0].deviceModel,
            deviceImei: devices[0].deviceImei,
            devices: devices, // Store full array
            paymentMethod: "wallet",
            paidViaWallet: amountWithTax,
            paidViaRazorpay: 0,
            razorpayOrderId: null,
            razorpayPaymentId: null,
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
        amountPaid: amountWithTax, // ✅ FIXED (was servicePrice)
        uvEarned: uv,
        status: "completed",
        paymentMethod: "wallet",
        paidViaWallet: amountWithTax, // ✅ FIXED
        paidViaRazorpay: 0,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        deviceBrand: devices[0].deviceBrand, // Store first device in legacy fields
        deviceModel: devices[0].deviceModel,
        deviceImei: devices[0].deviceImei,
        devices: devices, // Store full array
      });
    }

    // Update self volume
    user.selfVolume = (user.selfVolume || 0) + uv;

    // ---------------------------
    // RSP on renew
    // ---------------------------
    let rspAdded = 0;

    if (isRenew) {
      const rspPerUvSetting = await getSettingValue("rsp_to_uv", 120);
      const rspPerUv = Number(rspPerUvSetting);
      const safeRspPerUv =
        Number.isFinite(rspPerUv) && rspPerUv > 0 ? rspPerUv : 0;

      if (safeRspPerUv > 0 && uv > 0) {
        rspAdded = uv * safeRspPerUv;

        await updateReferralRSP(user._id, rspAdded);

        const month = monthStartUTC(new Date());
        await UserMonthlyCheckStats.findOneAndUpdate(
          { user: user._id, month },
          { $inc: { rspCreated: rspAdded } },
          { upsert: true, new: true }
        );

        await UserMetricEvent.create({
          user: user._id,
          eventType: "rsp_earned",
          metrics: {
            rsp: rspAdded,
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
            paidInr: amountWithTax,
          },
        });
      }
    }

    // Activation logic
    const ACTIVATION_THRESHOLD = await getSettingValue(
      "referralActive_limit",
      5
    );

    let activatedNow = false;

    if ((user.selfVolume || 0) >= ACTIVATION_THRESHOLD && !user.referralActive) {
      user.referralActive = true;
      activatedNow = true;
    }

    if (!user.hasMadeFirstPurchase) {
      user.hasMadeFirstPurchase = true;
    }

    await user.save();

    // Clear hotposition
    if (activatedNow && user.referralUsed) {
      await TreeNode.updateOne(
        { treeOwner: user.referralUsed, user: user._id },
        { $set: { at_hotposition: false } }
      );
    }

    // Propagate UV
    if (uv > 0) {
      await updateReferralVolumes(user._id, uv);
    }

    // -----------------------------
    // Invoice
    // -----------------------------
    try {
      const invoicePath = await generateInvoicePDF({
        purchase,
        user,
        tax: validTax,
        service,
      });

      await sendInvoiceEmail({
        to: user.email,
        name: user.name,
        invoicePath,
      });
    } catch (err) {
      console.error("Invoice generation/email failed:", err);
    }

    return res.json({
      message: isRenew
        ? "Service renewed using wallet balance"
        : "Service purchased using wallet balance",
      purchase,
      walletRemaining: user.walletBalance,
      paymentMethod: "wallet",
      walletDeducted: amountWithTax, // ✅ FIXED
      paidViaRazorpay: 0,
      taxAmount: validTax,
      rspAdded,
    });
  } catch (err) {
    console.error("Error in wallet payment:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
