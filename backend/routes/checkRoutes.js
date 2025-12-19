// routes/checkRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import Stats from "../models/Stats.js";
import {
  calculateSelfChecks,
  calculateTreeChecks,
  CHECK_PAYOUT_AMOUNT,
} from "../lib/checkLogic.js";
import { runWeeklyCheckPayouts } from "../cron/weeklyCheckPayoutJob.js";

// Monthly stats model (now includes checks + payout + RSP created/converted)
import UserMonthlyCheckStats from "../models/UserMonthlyCheckStats.js";

const router = express.Router();

function monthStartUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function parseMonthParam(monthStr) {
  // accepts "YYYY-MM" (recommended) or ISO date
  if (!monthStr) return null;

  // "2025-12"
  const m = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]); // 1-12
    if (mo < 1 || mo > 12) return null;
    return new Date(Date.UTC(y, mo - 1, 1));
  }

  // fallback: Date parse
  const d = new Date(monthStr);
  if (Number.isNaN(d.getTime())) return null;
  return monthStartUTC(d);
}

function addMonthsUTC(date, months) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0)
  );
}

function isAdminUser(user) {
  return user?.role === "admin" || user?.isAdmin === true;
}

router.post("/run-weekly", protect, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: "Admins only" });
    }

    await runWeeklyCheckPayouts();
    return res.json({ message: "Weekly payout job executed." });
  } catch (err) {
    console.error("Error running weekly payout job manually:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/checks/redeem (DEPRECATED)
 * @desc    Redeem available checks and credit wallet
 * @access  Private
 */
router.post("/redeem", protect, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "User info missing from token" });
    }

    const user = await User.findById(userId).select(
      "selfVolume leftVolume rightVolume walletBalance totalEarnings checksClaimed"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const selfChecks = calculateSelfChecks(user.selfVolume);
    const treeChecks = calculateTreeChecks(user.leftVolume, user.rightVolume);
    const totalChecks = selfChecks + treeChecks;

    if (totalChecks <= 0) {
      return res.status(400).json({ message: "No checks available to redeem" });
    }

    const usedSelfUV = selfChecks * 4;
    const usedLeftUV = treeChecks * 2;
    const usedRightUV = treeChecks * 2;

    user.selfVolume = Math.max(0, (user.selfVolume || 0) - usedSelfUV);
    user.leftVolume = Math.max(0, (user.leftVolume || 0) - usedLeftUV);
    user.rightVolume = Math.max(0, (user.rightVolume || 0) - usedRightUV);

    const payoutAmount = totalChecks * CHECK_PAYOUT_AMOUNT;

    user.checksClaimed = (user.checksClaimed || 0) + totalChecks;
    user.walletBalance = (user.walletBalance || 0) + payoutAmount;
    user.totalEarnings = (user.totalEarnings || 0) + payoutAmount;

    await user.save();

    const stats = await Stats.findOneAndUpdate(
      { key: "global" },
      {
        $inc: {
          totalChecksCreated: totalChecks,
          totalPayoutAmount: payoutAmount,
        },
        $setOnInsert: { key: "global" },
      },
      { new: true, upsert: true }
    );

    return res.json({
      message: "Checks redeemed successfully",
      checksRedeemed: totalChecks,
      payoutAmount,
      usedSelfUV,
      usedLeftUV,
      usedRightUV,
      user: {
        walletBalance: user.walletBalance,
        totalEarnings: user.totalEarnings,
        checksClaimed: user.checksClaimed,
        selfVolume: user.selfVolume,
        leftVolume: user.leftVolume,
        rightVolume: user.rightVolume,
      },
      statsSummary: {
        totalChecksCreated: stats.totalChecksCreated,
        totalPayoutAmount: stats.totalPayoutAmount,
      },
    });
  } catch (err) {
    console.error("Error redeeming checks:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/checks/stats
 * @desc    Get global check/payout stats (admin only)
 * @access  Private / Admin
 */
router.get("/stats", protect, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: "Admins only" });
    }

    const stats =
      (await Stats.findOne({ key: "global" })) ||
      (await Stats.create({ key: "global" }));

    return res.json({
      totalChecksCreated: stats.totalChecksCreated ?? 0,
      totalPayoutAmount: stats.totalPayoutAmount ?? 0,

      // RSP conversion totals (from cron)
      totalRspConvertedUnits: stats.totalRspConvertedUnits ?? 0,
      totalRspConvertedAmount: stats.totalRspConvertedAmount ?? 0,

      updatedAt: stats.updatedAt,
      createdAt: stats.createdAt,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * ADMIN APIs
 * =========================
 */

/**
 * Admin: Get one user's monthly stats (by userId OR email)
 * GET /api/checks/admin/user?email=a@b.com&months=6
 * GET /api/checks/admin/user?userId=...&months=12
 * Optional: &from=YYYY-MM  (otherwise last N months)
 *
 * Returns per month:
 * - checksCreated (credited)
 * - payoutAmount (₹ credited from checks)
 * - rspCreated (earned by renewals, etc.)
 * - rspConvertedUnits (converted into wallet)
 * - rspConvertedAmount (₹ credited from RSP conversion)
 */
router.get("/admin/user", protect, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: "Admins only" });
    }

    const { email, userId } = req.query;

    // 5 years retention => allow up to 60 months
    const months = Math.min(Math.max(Number(req.query.months || 6), 1), 60);
    const from = parseMonthParam(req.query.from);

    if (!email && !userId) {
      return res.status(400).json({ message: "Provide email or userId" });
    }

    const user = email
      ? await User.findOne({ email: String(email).toLowerCase().trim() }).select(
          "_id name email role"
        )
      : await User.findById(userId).select("_id name email role");

    if (!user) return res.status(404).json({ message: "User not found" });

    const start = from
      ? from
      : monthStartUTC(addMonthsUTC(new Date(), -(months - 1)));

    const rows = await UserMonthlyCheckStats.find({
      user: user._id,
      month: { $gte: start },
    })
      .sort({ month: 1 })
      .lean();

    return res.json({
      user: { id: user._id, name: user.name, email: user.email },
      range: { from: start.toISOString(), months },
      stats: rows.map((r) => ({
        month: r.month,
        checksCreated: r.checksCreated ?? 0,
        payoutAmount: r.payoutAmount ?? 0,
        rspCreated: r.rspCreated ?? 0,
        rspConvertedUnits: r.rspConvertedUnits ?? 0,
        rspConvertedAmount: r.rspConvertedAmount ?? 0,
      })),
    });
  } catch (err) {
    console.error("Error in /admin/user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Admin: Get all users stats for a given month (leaderboard / reporting)
 * GET /api/checks/admin/month?month=YYYY-MM&limit=50&skip=0
 *
 * Sorts by checksCreated desc by default.
 */
router.get("/admin/month", protect, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: "Admins only" });
    }

    const month = parseMonthParam(req.query.month);
    if (!month) {
      return res.status(400).json({ message: "month is required (YYYY-MM)" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 500);
    const skip = Math.max(Number(req.query.skip || 0), 0);

    const rows = await UserMonthlyCheckStats.find({ month })
      .sort({ checksCreated: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email role")
      .lean();

    const total = await UserMonthlyCheckStats.countDocuments({ month });

    return res.json({
      month: month.toISOString(),
      total,
      limit,
      skip,
      rows: rows.map((r) => ({
        user: r.user
          ? { id: r.user._id, name: r.user.name, email: r.user.email }
          : null,
        month: r.month,
        checksCreated: r.checksCreated ?? 0,
        payoutAmount: r.payoutAmount ?? 0,
        rspCreated: r.rspCreated ?? 0,
        rspConvertedUnits: r.rspConvertedUnits ?? 0,
        rspConvertedAmount: r.rspConvertedAmount ?? 0,
      })),
    });
  } catch (err) {
    console.error("Error in /admin/month:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Admin: Range query (all users) for reporting
 * GET /api/checks/admin/range?from=YYYY-MM&to=YYYY-MM
 */
router.get("/admin/range", protect, async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ message: "Admins only" });
    }

    const from = parseMonthParam(req.query.from);
    const to = parseMonthParam(req.query.to);

    if (!from || !to) {
      return res
        .status(400)
        .json({ message: "from and to are required (YYYY-MM)" });
    }

    if (to < from) {
      return res.status(400).json({ message: "to must be >= from" });
    }

    const endExclusive = addMonthsUTC(to, 1);

    const rows = await UserMonthlyCheckStats.find({
      month: { $gte: from, $lt: endExclusive },
    })
      .populate("user", "name email")
      .sort({ month: 1, checksCreated: -1 })
      .lean();

    return res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      rows: rows.map((r) => ({
        user: r.user
          ? { id: r.user._id, name: r.user.name, email: r.user.email }
          : null,
        month: r.month,
        checksCreated: r.checksCreated ?? 0,
        payoutAmount: r.payoutAmount ?? 0,
        rspCreated: r.rspCreated ?? 0,
        rspConvertedUnits: r.rspConvertedUnits ?? 0,
        rspConvertedAmount: r.rspConvertedAmount ?? 0,
      })),
    });
  } catch (err) {
    console.error("Error in /admin/range:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * =========================
 * PUBLIC (USER) APIs
 * =========================
 */

/**
 * User: get their own last N months stats
 * GET /api/checks/me?months=6
 * Optional: &from=YYYY-MM
 */
router.get("/me", protect, async (req, res) => {
  try {
    if (req.user?.isDisabled) {
      return res.status(403).json({ message: "Account disabled" });
    }

    const months = Math.min(Math.max(Number(req.query.months || 6), 1), 60);
    const from = parseMonthParam(req.query.from);

    const start = from
      ? from
      : monthStartUTC(addMonthsUTC(new Date(), -(months - 1)));

    const rows = await UserMonthlyCheckStats.find({
      user: req.user.id,
      month: { $gte: start },
    })
      .sort({ month: 1 })
      .lean();

    return res.json({
      userId: req.user.id,
      range: { from: start.toISOString(), months },
      stats: rows.map((r) => ({
        month: r.month,
        checksCreated: r.checksCreated ?? 0,
        payoutAmount: r.payoutAmount ?? 0,
        rspCreated: r.rspCreated ?? 0,
        rspConvertedUnits: r.rspConvertedUnits ?? 0,
        rspConvertedAmount: r.rspConvertedAmount ?? 0,
      })),
    });
  } catch (err) {
    console.error("Error in /me:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
