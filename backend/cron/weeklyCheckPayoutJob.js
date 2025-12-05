// cron/weeklyCheckPayoutJob.js
import cron from "node-cron";
import User from "../models/User.js";
import Stats from "../models/Stats.js";
import {
  calculateSelfChecks,
  calculateTreeChecks,
} from "../lib/checkLogic.js";
import { getStarLevels } from "../lib/starLogic.js";
import { getSettingValue } from "../routes/universalSettingsRoutes.js";

/**
 * Core job: go through all users, compute checks, cap by max limit,
 * pay them based on star level, consume UV, and update global Stats.
 */
export const runWeeklyCheckPayouts = async () => {
  console.log("[CRON] Weekly check payout job started");

  // Load global settings
  const [starLevels, maxChecksSetting] = await Promise.all([
    getStarLevels(), // from starLogic.js (reads star_levels)
    getSettingValue("max_checks_per_week", 290),
  ]);

  const maxChecksPerRun = Number(maxChecksSetting) || 0; // 0 => no cap

  // Fetch users that actually have some UV
  const users = await User.find({
    $or: [
      { selfVolume: { $gt: 0 } },
      { leftVolume: { $gt: 0 } },
      { rightVolume: { $gt: 0 } },
    ],
  }).select(
    "_id selfVolume leftVolume rightVolume walletBalance totalEarnings checksClaimed star"
  );

  let totalChecksAllUsers = 0;   // checks actually paid to users
  let totalPayoutAllUsers = 0;

  for (const user of users) {
    const selfVol = user.selfVolume || 0;
    const leftVol = user.leftVolume || 0;
    const rightVol = user.rightVolume || 0;

    // 1) How many checks does this user have from current UV?
    const selfChecks = calculateSelfChecks(selfVol);
    const treeChecks = calculateTreeChecks(leftVol, rightVol);
    const totalChecks = selfChecks + treeChecks;

    if (totalChecks <= 0) {
      continue; // nothing to do for this user
    }

    // 2) Figure out how many checks we will actually pay them for
    const payableChecks =
      maxChecksPerRun > 0 ? Math.min(totalChecks, maxChecksPerRun) : totalChecks;

    const companyChecks = totalChecks - payableChecks; // "goes to company" (not paid)

    // 3) Find the check price based on star level
    const level = user.star || 0;
    const starCfg =
      starLevels.find(
        (s) =>
          s.lvl === level || // if config uses "lvl"
          s.level === level  // if config uses "level"
      ) || {};

    const checkPrice = starCfg.checkPrice ?? 0;

    if (!checkPrice || checkPrice <= 0) {
      console.warn(
        `[CRON] User ${user._id} has checks (${totalChecks}) but star level ${level} has no checkPrice configured. Skipping payout.`
      );

      // We still want to consume UV (company keeps all these checks)
      const usedSelfUV = selfChecks * 4;
      const usedLeftUV = treeChecks * 2;
      const usedRightUV = treeChecks * 2;

      user.selfVolume = Math.max(0, selfVol - usedSelfUV);
      user.leftVolume = Math.max(0, leftVol - usedLeftUV);
      user.rightVolume = Math.max(0, rightVol - usedRightUV);

      await user.save();
      continue;
    }

    // 4) Compute how much UV we consume (for ALL checks, payable + company)
    const usedSelfUV = selfChecks * 4;
    const usedLeftUV = treeChecks * 2;
    const usedRightUV = treeChecks * 2;

    // Subtract consumed UV from user volumes
    user.selfVolume = Math.max(0, selfVol - usedSelfUV);
    user.leftVolume = Math.max(0, leftVol - usedLeftUV);
    user.rightVolume = Math.max(0, rightVol - usedRightUV);

    // 5) Compute payout ONLY for payableChecks
    const payoutAmount = payableChecks * checkPrice;

    // 6) Update user wallet + earnings + checksClaimed
    user.checksClaimed = (user.checksClaimed || 0) + payableChecks;
    user.walletBalance = (user.walletBalance || 0) + payoutAmount;
    user.totalEarnings = (user.totalEarnings || 0) + payoutAmount;

    await user.save();

    totalChecksAllUsers += payableChecks;
    totalPayoutAllUsers += payoutAmount;

    // If you later want stats for companyChecks, you can add another Stats field
    if (companyChecks > 0) {
      console.log(
        `[CRON] User ${user._id} had ${totalChecks} checks, paid ${payableChecks}, company kept ${companyChecks}.`
      );
    }
  }

  // 7) Update global stats once
  if (totalChecksAllUsers > 0 || totalPayoutAllUsers > 0) {
    await Stats.findOneAndUpdate(
      { key: "global" },
      {
        $inc: {
          totalChecksCreated: totalChecksAllUsers,
          totalPayoutAmount: totalPayoutAllUsers,
        },
        $setOnInsert: { key: "global" },
      },
      { new: true, upsert: true }
    );
  }

  console.log(
    `[CRON] Weekly check payout job finished. Paid checks: ${totalChecksAllUsers}, Payout: ${totalPayoutAllUsers}`
  );
};

/**
 * Schedule the cron job to run once a week (example: Monday 00:05).
 */
export const startWeeklyCheckCron = () => {
  cron.schedule("5 0 * * 1", () => {
    runWeeklyCheckPayouts().catch((err) => {
      console.error("[CRON] Weekly check payout job error:", err);
    });
  });

  console.log("[CRON] Weekly check payout job scheduled (every Monday 00:05).");
};
