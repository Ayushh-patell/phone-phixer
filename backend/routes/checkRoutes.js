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

const router = express.Router();




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

    // 1) Calculate checks from CURRENT volumes
    const selfChecks = calculateSelfChecks(user.selfVolume);           // 4 self UV per check
    const treeChecks = calculateTreeChecks(user.leftVolume, user.rightVolume); // 2 left + 2 right per check

    const totalChecks = selfChecks + treeChecks;

    if (totalChecks <= 0) {
      return res.status(400).json({ message: "No checks available to redeem" });
    }

    // 2) Compute how much UV we consume
    const usedSelfUV = selfChecks * 4;
    const usedLeftUV = treeChecks * 2;
    const usedRightUV = treeChecks * 2;

    // 3) Subtract consumed UV from user volumes
    user.selfVolume = Math.max(0, (user.selfVolume || 0) - usedSelfUV);
    user.leftVolume = Math.max(0, (user.leftVolume || 0) - usedLeftUV);
    user.rightVolume = Math.max(0, (user.rightVolume || 0) - usedRightUV);

    // 4) Compute payout
    const payoutAmount = totalChecks * CHECK_PAYOUT_AMOUNT;

    // 5) Update user wallet + earnings + checksClaimed
    user.checksClaimed = (user.checksClaimed || 0) + totalChecks;
    user.walletBalance = (user.walletBalance || 0) + payoutAmount;
    user.totalEarnings = (user.totalEarnings || 0) + payoutAmount;

    await user.save();

    // 6) Update global stats
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












function isAdminUser(user) {
  return user?.role === "admin" || user?.isAdmin === true;
}

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
      totalChecksCreated: stats.totalChecksCreated,
      totalPayoutAmount: stats.totalPayoutAmount,
      updatedAt: stats.updatedAt,
      createdAt: stats.createdAt,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
