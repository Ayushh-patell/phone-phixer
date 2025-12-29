// routes/refundRoutes.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import Razorpay from "razorpay";

import { protect } from "../middleware/authMiddleware.js";
import Purchase from "../models/Purchase.js";
import User from "../models/User.js";
import RefundRequest from "../models/RefundRequest.js";

const router = express.Router();

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("⚠️ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in env");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const REFUND_WINDOW_DAYS = 7;

function isAdmin(req) {
  return req.user.isAdmin;
}

function withinRefundWindow(purchase) {
  const base = purchase.renewedAt ? new Date(purchase.renewedAt) : new Date(purchase.createdAt);
  const deadline = new Date(base.getTime() + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return new Date() <= deadline;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function refundableRemaining(purchase) {
  const total = round2(purchase.amountPaid || 0);
  const refunded = round2((purchase.refundedWalletAmount || 0) + (purchase.refundedRazorpayAmount || 0));
  return Math.max(0, round2(total - refunded));
}

/**
 * USER: POST /api/refunds/request
 * Body: { purchaseId, reason }
 *
 * Rules:
 * - Only within 7 days of purchase.createdAt OR purchase.renewedAt (latest)
 * - If payment is full wallet => refund instantly (credit wallet) and update purchase refund fields
 * - If mixed => refund wallet part instantly, create RefundRequest for razorpay part
 * - If full razorpay => create RefundRequest for full amount
 */
router.post("/request", protect, async (req, res) => {
  try {
    const { purchaseId, reason } = req.body || {};
    if (!purchaseId) return res.status(400).json({ message: "purchaseId is required" });

    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });

    if (purchase.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (purchase.status !== "completed") {
      return res.status(400).json({ message: "Only completed purchases can be refunded" });
    }

    if (!withinRefundWindow(purchase)) {
      return res.status(400).json({ message: "Refund window expired (7 days)" });
    }

    const remaining = refundableRemaining(purchase);
    if (remaining <= 0) {
      return res.status(400).json({ message: "Nothing left to refund for this purchase" });
    }

    // Avoid duplicate pending requests for same purchase
    const existingPending = await RefundRequest.findOne({
      purchaseId: purchase._id,
      status: "pending",
    });
    if (existingPending) {
      return res.status(400).json({ message: "A refund request is already pending for this purchase" });
    }

    const method = purchase.paymentMethod;

    // WALLET-ONLY => instant refund (to wallet)
    if (method === "wallet") {
      const user = await User.findById(purchase.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const credit = Math.min(remaining, round2(purchase.paidViaWallet || purchase.amountPaid || 0));
      if (credit <= 0) return res.status(400).json({ message: "No wallet amount refundable" });

      user.walletBalance = round2((user.walletBalance || 0) + credit);
      await user.save();

      purchase.refundedWalletAmount = round2((purchase.refundedWalletAmount || 0) + credit);
      purchase.refundedAt = new Date();
      await purchase.save();

      return res.json({
        message: "Refunded instantly to wallet",
        refundedWalletAmount: credit,
        purchase,
      });
    }

    // MIXED or RAZORPAY-ONLY:
    // - refund wallet portion instantly if any remaining wallet not refunded yet
    // - create RefundRequest for razorpay portion (INR)
    let walletRefundedNow = 0;

    if (method === "razorpay+wallet") {
      const user = await User.findById(purchase.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const walletPaid = round2(purchase.paidViaWallet || 0);
      const walletAlreadyRefunded = round2(purchase.refundedWalletAmount || 0);
      const walletRemaining = Math.max(0, round2(walletPaid - walletAlreadyRefunded));

      walletRefundedNow = Math.min(walletRemaining, remaining);

      if (walletRefundedNow > 0) {
        user.walletBalance = round2((user.walletBalance || 0) + walletRefundedNow);
        await user.save();

        purchase.refundedWalletAmount = round2((purchase.refundedWalletAmount || 0) + walletRefundedNow);
        purchase.refundedAt = new Date();
        await purchase.save();
      }
    }

    // Now compute how much should go to Razorpay request
    const remainingAfterWallet = refundableRemaining(purchase);
    const razorpayNeed = Math.min(
      remainingAfterWallet,
      round2(purchase.paidViaRazorpay || purchase.amountPaid || 0) -
        round2(purchase.refundedRazorpayAmount || 0)
    );

    if (razorpayNeed <= 0) {
      // This can happen if mixed purchase had only wallet remaining
      return res.json({
        message: walletRefundedNow > 0 ? "Wallet part refunded; no Razorpay refund needed" : "No Razorpay refund needed",
        walletRefundedNow,
        purchase,
      });
    }

    if (!purchase.razorpayPaymentId) {
      return res.status(400).json({
        message: "Missing razorpayPaymentId on purchase; cannot create Razorpay refund request",
      });
    }

    const rr = await RefundRequest.create({
      purchaseId: purchase._id,
      userId: purchase.userId,
      amountInr: round2(razorpayNeed),
      paymentMethodSnapshot: purchase.paymentMethod,
      razorpayPaymentIdSnapshot: purchase.razorpayPaymentId,
      razorpayOrderIdSnapshot: purchase.razorpayOrderId,
      reason: reason || "",
      status: "pending",
    });

    return res.json({
      message:
        method === "razorpay+wallet"
          ? "Wallet part refunded; Razorpay refund request created"
          : "Razorpay refund request created",
      walletRefundedNow,
      refundRequest: rr,
      purchase,
    });
  } catch (err) {
    console.error("Refund request error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: GET /api/refunds/admin/pending
 * List pending refund requests
 */
router.get("/admin/pending", protect, async (req, res) => {
  try {    
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });

    const items = await RefundRequest.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .populate("userId", "name email phone")
      .populate("purchaseId", "amountPaid paymentMethod paidViaWallet paidViaRazorpay razorpayPaymentId createdAt renewedAt");

    return res.json({ items });
  } catch (err) {
    console.error("Admin pending refunds error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: POST /api/refunds/admin/:id/reject
 * Body: { adminComment }
 */
router.post("/admin/:id/reject", protect, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });

    const { adminComment } = req.body || {};

    const rr = await RefundRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: "Refund request not found" });

    if (rr.status !== "pending") {
      return res.status(400).json({ message: `Cannot reject request in status ${rr.status}` });
    }

    rr.status = "rejected";
    rr.reviewedBy = req.user.id;
    rr.reviewedAt = new Date();
    rr.adminComment = adminComment || "";
    await rr.save();

    return res.json({ message: "Refund request rejected", refundRequest: rr });
  } catch (err) {
    console.error("Admin reject refund error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: POST /api/refunds/admin/:id/approve
 * Body: { adminComment }
 *
 * Approve triggers Razorpay refund for rr.amountInr (INR).
 * Updates Purchase.refundedRazorpayAmount and RefundRequest status.
 */
router.post("/admin/:id/approve", protect, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ message: "Admin only" });

    const { adminComment } = req.body || {};

    const rr = await RefundRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: "Refund request not found" });

    if (rr.status === "completed") {
      return res.json({ message: "Already completed", refundRequest: rr });
    }
    if (rr.status !== "pending") {
      return res.status(400).json({ message: `Cannot approve request in status ${rr.status}` });
    }

    const purchase = await Purchase.findById(rr.purchaseId);
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });

    // Safety: refund window check (admin should not refund after window)
    if (!withinRefundWindow(purchase)) {
      rr.status = "rejected";
      rr.reviewedBy = req.user.id;
      rr.reviewedAt = new Date();
      rr.adminComment = `Auto-rejected: refund window expired. ${adminComment || ""}`.trim();
      await rr.save();
      return res.status(400).json({ message: "Refund window expired (7 days)", refundRequest: rr });
    }

    // Safety: ensure amount still refundable
    const remaining = refundableRemaining(purchase);
    const need = Math.min(remaining, round2(rr.amountInr || 0));
    if (need <= 0) {
      rr.status = "failed";
      rr.reviewedBy = req.user.id;
      rr.reviewedAt = new Date();
      rr.adminComment = adminComment || "";
      rr.failureReason = "No refundable amount remaining on purchase";
      await rr.save();
      return res.status(400).json({ message: "Nothing left to refund", refundRequest: rr });
    }

    if (!purchase.razorpayPaymentId) {
      rr.status = "failed";
      rr.reviewedBy = req.user.id;
      rr.reviewedAt = new Date();
      rr.adminComment = adminComment || "";
      rr.failureReason = "Missing purchase.razorpayPaymentId";
      await rr.save();
      return res.status(400).json({ message: "Missing Razorpay payment id", refundRequest: rr });
    }

    rr.status = "processing";
    rr.reviewedBy = req.user.id;
    rr.reviewedAt = new Date();
    rr.adminComment = adminComment || "";
    await rr.save();

    // Razorpay refund expects paise
    const amountPaise = Math.round(need * 100);

    try {
      const rzRefund = await razorpay.payments.refund(purchase.razorpayPaymentId, {
        amount: amountPaise,
        notes: {
          purchaseId: String(purchase._id),
          refundRequestId: String(rr._id),
        },
      });

      purchase.refundedRazorpayAmount = round2((purchase.refundedRazorpayAmount || 0) + need);
      purchase.refundedAt = new Date();
      await purchase.save();

      rr.status = "completed";
      rr.razorpayRefundId = rzRefund?.id || null;
      rr.failureReason = "";
      await rr.save();

      return res.json({
        message: "Razorpay refund successful",
        razorpayRefundId: rr.razorpayRefundId,
        refundedRazorpayAmount: need,
        refundRequest: rr,
        purchase,
      });
    } catch (e) {
      rr.status = "failed";
      rr.failureReason =
        e?.error?.description ||
        e?.message ||
        "Razorpay refund failed";
      await rr.save();

      return res.status(400).json({
        message: "Razorpay refund failed",
        error: rr.failureReason,
        refundRequest: rr,
      });
    }
  } catch (err) {
    console.error("Admin approve refund error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * USER: GET /api/refunds/my
 * Returns the logged-in user's refund requests (latest first)
 * Optional query params:
 *  - status=pending|approved|rejected|processing|completed|failed
 *  - page=1
 *  - limit=20
 */
router.get("/my", protect, async (req, res) => {
  try {
    const status = (req.query.status || "").toString().trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const skip = (page - 1) * limit;

    const filter = { userId: req.user.id };
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      RefundRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("purchaseId", [
          "serviceId",
          "amountPaid",
          "paymentMethod",
          "paidViaWallet",
          "paidViaRazorpay",
          "razorpayOrderId",
          "razorpayPaymentId",
          "refundedWalletAmount",
          "refundedRazorpayAmount",
          "refundedAt",
          "status",
          "createdAt",
          "renewedAt",
          "deviceBrand",
          "deviceModel",
          "deviceImei",
        ]),
      RefundRequest.countDocuments(filter),
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (err) {
    console.error("Get my refund requests error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


export default router;
