import express from "express";
const router = express.Router();

import Purchase from "../models/Purchase.js";
import { protect } from "../middleware/authMiddleware.js";

/**
 * Helper: determine if purchase is refunded (full or partial)
 * Works even if you didn't add "refunded"/"partial_refunded" to status enum.
 */
function isRefundedPurchase(p) {
  const s = (p.status || "").toString().toLowerCase();
  if (s === "refunded" || s === "partial_refunded") return true;

  const refundedWallet = Number(p.refundedWalletAmount || 0);
  const refundedRazorpay = Number(p.refundedRazorpayAmount || 0);
  const refundedAt = p.refundedAt ? new Date(p.refundedAt) : null;

  if (refundedAt && !Number.isNaN(refundedAt.getTime())) return true;
  if (refundedWallet > 0 || refundedRazorpay > 0) return true;

  return false;
}

/**
 * @route   GET /api/purchases/admin
 * @desc    Get all purchases (admin only) with optional date range
 * @query   startDate?: string (ISO or yyyy-mm-dd)
 *          endDate?:   string (ISO or yyyy-mm-dd)
 * @access  Private (Admin)
 */
router.get("/admin", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { startDate, endDate } = req.query;

    const filter = {};

    // Optional date range on createdAt / renewedAt
    if (startDate || endDate) {
      const dateFilter = {};

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({ message: "Invalid startDate" });
        }
        dateFilter.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({ message: "Invalid endDate" });
        }
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }

      filter.$or = [{ createdAt: dateFilter }, { renewedAt: dateFilter }];
    }

    const purchases = await Purchase.find(filter)
      .populate("userId", "name email phone")
      .populate("serviceId", "name price uv validityDays")
      .sort({ createdAt: -1 });

    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const now = new Date();

    const purchasesWithValidity = purchases.map((p) => {
      const obj = p.toObject();
      const service = obj.serviceId;

      const baseDateRaw = obj.renewedAt || obj.createdAt;
      const baseDate = baseDateRaw ? new Date(baseDateRaw) : null;

      let expired = true;
      let daysLeft = 0;
      let expiresAt = null;

      const validityDays = service?.validityDays || 0;

      if (baseDate && validityDays > 0) {
        const expiryDate = new Date(baseDate.getTime() + validityDays * MS_PER_DAY);
        expiresAt = expiryDate;

        if (now < expiryDate) {
          expired = false;
          const diffMs = expiryDate.getTime() - now.getTime();
          daysLeft = Math.ceil(diffMs / MS_PER_DAY);
        } else {
          expired = true;
          daysLeft = 0;
        }
      }

      // ✅ NEW: block renew if refunded
      const refunded = isRefundedPurchase(obj);

      return {
        ...obj,
        validity: {
          expired,
          daysLeft,
          expiresAt,
          validityDays,
        },
        // ✅ frontend can use this to hide/disable renew buttons
        canRenew: !refunded,
        refunded,
      };
    });

    return res.json({
      count: purchasesWithValidity.length,
      purchases: purchasesWithValidity,
    });
  } catch (err) {
    console.error("Error fetching admin purchases:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/purchases/me
 * @desc    Get all purchases for the logged-in user
 * @query   startDate?: string (ISO or yyyy-mm-dd)
 *          endDate?:   string (ISO or yyyy-mm-dd)
 * @access  Private (Any authenticated user)
 */
router.get("/me", protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = { userId: req.user.id };

    if (startDate || endDate) {
      const dateFilter = {};

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({ message: "Invalid startDate" });
        }
        dateFilter.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({ message: "Invalid endDate" });
        }
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }

      filter.$or = [{ createdAt: dateFilter }, { renewedAt: dateFilter }];
    }

    const purchases = await Purchase.find(filter)
      .populate("serviceId", "name price uv validityDays")
      .sort({ createdAt: -1 });

    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const now = new Date();

    const purchasesWithValidity = purchases.map((p) => {
      const obj = p.toObject();
      const service = obj.serviceId;

      const baseDateRaw = obj.renewedAt || obj.createdAt;
      const baseDate = baseDateRaw ? new Date(baseDateRaw) : null;

      let expired = true;
      let daysLeft = 0;
      let expiresAt = null;

      const validityDays = service?.validityDays || 0;

      if (baseDate && validityDays > 0) {
        const expiryDate = new Date(baseDate.getTime() + validityDays * MS_PER_DAY);
        expiresAt = expiryDate;

        if (now < expiryDate) {
          expired = false;
          const diffMs = expiryDate.getTime() - now.getTime();
          daysLeft = Math.ceil(diffMs / MS_PER_DAY);
        } else {
          expired = true;
          daysLeft = 0;
        }
      }

      // ✅ NEW: block renew if refunded
      const refunded = isRefundedPurchase(obj);

      return {
        ...obj,
        validity: {
          expired,
          daysLeft,
          expiresAt,
          validityDays,
        },
        // ✅ frontend can use this to hide/disable renew buttons
        canRenew: !refunded,
        refunded,
      };
    });

    return res.json({
      count: purchasesWithValidity.length,
      purchases: purchasesWithValidity,
    });
  } catch (err) {
    console.error("Error fetching user purchases:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
