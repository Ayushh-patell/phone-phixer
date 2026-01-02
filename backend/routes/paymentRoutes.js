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

    // Required for this route: Razorpay proof + serviceId
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

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const servicePrice = Number(service.price || 0);
    if (!Number.isFinite(servicePrice) || servicePrice <= 0) {
      return res.status(400).json({ message: "Invalid service price" });
    }

    // Wallet part (optional)
    let walletToDeduct = 0;
    if (useWallet && typeof walletUsed !== "undefined" && walletUsed !== null) {
      const walletUsedNum = Number(walletUsed);
      if (Number.isNaN(walletUsedNum) || walletUsedNum < 0) {
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

    // Compute payment breakdown (INR)
    const paidViaWallet = walletToDeduct; // INR
    const paidViaRazorpay = Math.max(0, servicePrice - walletToDeduct); // INR

    const paymentMethod =
      paidViaWallet > 0 && paidViaRazorpay > 0
        ? "razorpay+wallet"
        : paidViaWallet > 0
        ? "wallet"
        : "razorpay";

    let purchase = null;

    // If renew: update the previous purchase
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

            paymentMethod,
            paidViaWallet,
            paidViaRazorpay,

            razorpayOrderId: paidViaRazorpay > 0 ? razorpay_order_id : null,
            razorpayPaymentId: paidViaRazorpay > 0 ? razorpay_payment_id : null,
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
      // New purchase
      purchase = await Purchase.create({
        userId: user._id,
        serviceId: service._id,
        amountPaid: servicePrice,
        uvEarned: uv,
        status: "completed",

        paymentMethod,
        paidViaWallet,
        paidViaRazorpay,

        razorpayOrderId: paidViaRazorpay > 0 ? razorpay_order_id : null,
        razorpayPaymentId: paidViaRazorpay > 0 ? razorpay_payment_id : null,

        deviceBrand,
        deviceModel,
        deviceImei,
      });
    }

    // Deduct wallet if used
    if (walletToDeduct > 0) {
      user.walletBalance = Math.max(
        0,
        (user.walletBalance || 0) - walletToDeduct
      );
    }

    // Update self volume
    user.selfVolume = (user.selfVolume || 0) + uv;

    // ---------------------------
    // RSP on renew (single source of truth)
    // ---------------------------
    let rspAdded = 0;
    if (isRenew) {
      const rspPerUvSetting = await getSettingValue("rsp_to_uv", 120);
      const rspPerUv = Number(rspPerUvSetting);
      const safeRspPerUv =
        Number.isFinite(rspPerUv) && rspPerUv > 0 ? rspPerUv : 0;

      if (safeRspPerUv > 0 && uv > 0) {
        rspAdded = uv * safeRspPerUv;

        // 5-level rule (includes current user). Only eligible users get credited.
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
            razorpayOrderId: paidViaRazorpay > 0 ? razorpay_order_id : undefined,
            razorpayPaymentId:
              paidViaRazorpay > 0 ? razorpay_payment_id : undefined,
          },
          meta: {
            method: paymentMethod,
            isRenew: true,
            originalPrice: originalPrice ?? servicePrice,
            walletUsed: paidViaWallet || 0,
            paidViaRazorpay: paidViaRazorpay || 0,
          },
        });
      }
    }

    // Activation logic (referralActive unrelated to sponsor usage)
    const ACTIVATION_THRESHOLD = await getSettingValue("referralActive_limit", 5);

    let activatedNow = false;
    if ((user.selfVolume || 0) >= ACTIVATION_THRESHOLD && !user.referralActive) {
      user.referralActive = true;
      activatedNow = true;
    }

    if (!user.hasMadeFirstPurchase) {
      user.hasMadeFirstPurchase = true;
    }

    await user.save();

    // If user just activated, clear hotposition flag in the sponsor tree node (if any)
    // (at_hotposition is now stored per-tree in TreeNode, not on User)
    if (activatedNow && user.referralUsed) {
      await TreeNode.updateOne(
        { treeOwner: user.referralUsed, user: user._id },
        { $set: { at_hotposition: false } }
      );
    }

    // Propagate UV volumes up the placement tree (TreeNode-based)
    // Function will no-op if the user is not placed / no sponsor tree exists.
    if (uv > 0) {
      await updateReferralVolumes(user._id, uv);
    }

    return res.json({
      message: isRenew
        ? "Payment verified & renewal applied"
        : "Payment verified & purchase created",
      purchase,
      walletDeducted: paidViaWallet,
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
      deviceBrand,
      deviceModel,
      deviceImei,
      isRenew,
      previousPurchaseId,
    } = req.body || {};

    if (!serviceId || typeof amount === "undefined") {
      return res
        .status(400)
        .json({ message: "serviceId and amount are required" });
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
    if (!user) return res.status(404).json({ message: "User not found" });

    const servicePrice = Number(service.price || 0);
    if (!Number.isFinite(servicePrice) || servicePrice <= 0) {
      return res.status(400).json({ message: "Invalid service price" });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    // This endpoint is for full wallet purchase only
    if (amountNum !== servicePrice) {
      return res.status(400).json({
        message:
          "Wallet payment amount must match the service price for full wallet purchase",
      });
    }

    if ((user.walletBalance || 0) < amountNum) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    // Deduct wallet
    user.walletBalance = Math.max(0, (user.walletBalance || 0) - amountNum);

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
            deviceBrand,
            deviceModel,
            deviceImei,

            paymentMethod: "wallet",
            paidViaWallet: servicePrice,
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
        amountPaid: servicePrice,
        uvEarned: uv,
        status: "completed",

        paymentMethod: "wallet",
        paidViaWallet: servicePrice,
        paidViaRazorpay: 0,
        razorpayOrderId: null,
        razorpayPaymentId: null,

        deviceBrand,
        deviceModel,
        deviceImei,
      });
    }

    // Update self volume
    user.selfVolume = (user.selfVolume || 0) + uv;

    // ---------------------------
    // RSP on renew (single source of truth)
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
            paidInr: amountNum,
          },
        });
      }
    }

    // Activation logic
    const ACTIVATION_THRESHOLD = await getSettingValue("referralActive_limit", 5);

    let activatedNow = false;
    if ((user.selfVolume || 0) >= ACTIVATION_THRESHOLD && !user.referralActive) {
      user.referralActive = true;
      activatedNow = true;
    }

    if (!user.hasMadeFirstPurchase) {
      user.hasMadeFirstPurchase = true;
    }

    await user.save();

    // Clear hotposition in sponsor-tree node if activated now
    if (activatedNow && user.referralUsed) {
      await TreeNode.updateOne(
        { treeOwner: user.referralUsed, user: user._id },
        { $set: { at_hotposition: false } }
      );
    }

    // Propagate UV volumes up the placement tree (TreeNode-based)
    if (uv > 0) {
      await updateReferralVolumes(user._id, uv);
    }

    return res.json({
      message: isRenew
        ? "Service renewed using wallet balance"
        : "Service purchased using wallet balance",
      purchase,
      walletRemaining: user.walletBalance,
      paymentMethod: "wallet",
      walletDeducted: servicePrice,
      paidViaRazorpay: 0,
      rspAdded,
    });
  } catch (err) {
    console.error("Error in wallet payment:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
