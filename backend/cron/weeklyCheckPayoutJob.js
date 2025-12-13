// cron/weeklyCheckPayoutJob.js
import cron from "node-cron";
import User from "../models/User.js";
import Stats from "../models/Stats.js";
import UserMonthlyCheckStats from "../models/UserMonthlyCheckStats.js";
import {
  calculateSelfChecks,
  calculateTreeChecks,
} from "../lib/checkLogic.js";
import { getStarLevels } from "../lib/starLogic.js";
import { getSettingValue } from "../routes/universalSettingsRoutes.js";

// ---- helpers for monthly stats ----
function monthStartUTC(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function cleanupOldMonthlyStats(retainMonths = 12) {
  const now = new Date();
  const cutoff = monthStartUTC(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - retainMonths, 1))
  );

  const result = await UserMonthlyCheckStats.deleteMany({ month: { $lt: cutoff } });
  console.log(
    `[CRON] Monthly stats cleanup: deleted ${result.deletedCount} docs older than ${cutoff.toISOString()}`
  );
}

export const runWeeklyCheckPayouts = async () => {
  console.log("[CRON] Weekly check payout job started");

  const [starLevels, maxUVSetting, moneyToRspSetting] = await Promise.all([
    getStarLevels(),
    getSettingValue("max_checks_per_week", 290), // NOTE: this is max UV per week in your logic
    getSettingValue("money_to_rsp", 1.1),
  ]);

  const maxUVPerRun = Number(maxUVSetting) || 0; // 0 => no cap
  const moneyToRsp = Number(moneyToRspSetting) || 1.1;

  // Convert UV->checks uses 4 UV per check (self=4, tree=2+2)
  const maxPayableChecks =
    maxUVPerRun > 0 ? Math.floor(maxUVPerRun / 4) : 0; // 0 used only when cap exists
  // If maxUVPerRun=0 => no cap => payable = totalChecks

  const users = await User.find({
    $or: [
      { selfVolume: { $gt: 0 } },
      { leftVolume: { $gt: 0 } },
      { rightVolume: { $gt: 0 } },
      { rsp: { $gt: 0 } },
    ],
  }).select(
    "_id selfVolume leftVolume rightVolume walletBalance totalEarnings checksClaimed star rsp"
  );

  let totalChecksAllUsers = 0; // payable checks (credited to users)
  let totalPayoutAllUsers = 0;

  let totalRspConvertedAmount = 0;
  let totalRspConvertedUnits = 0;

  const statsBulkOps = [];
  const month = monthStartUTC(new Date());

  for (const user of users) {
    const selfVol = user.selfVolume || 0;
    const leftVol = user.leftVolume || 0;
    const rightVol = user.rightVolume || 0;

    // ---- RSP -> money conversion ----
    const currentRsp = user.rsp || 0;
    const didConvertRsp = currentRsp > 0;

    if (didConvertRsp) {
      const rspMoney = currentRsp * moneyToRsp;
      user.walletBalance = (user.walletBalance || 0) + rspMoney;
      user.totalEarnings = (user.totalEarnings || 0) + rspMoney;
      user.rsp = 0;

      totalRspConvertedUnits += currentRsp;
      totalRspConvertedAmount += rspMoney;
    }

    // ---- compute checks from ALL UV (no cap here) ----
    const selfChecks = calculateSelfChecks(selfVol);
    const treeChecks = calculateTreeChecks(leftVol, rightVol);
    const totalChecksPossible = selfChecks + treeChecks;

    // If no checks possible, only save if RSP converted
    if (totalChecksPossible <= 0) {
      if (didConvertRsp) await user.save();
      continue;
    }

    // ---- cap ONLY the checks credited to user (based on max UV 290) ----
    const payableChecks =
      maxUVPerRun > 0 ? Math.min(totalChecksPossible, maxPayableChecks) : totalChecksPossible;

    const burnedChecks = totalChecksPossible - payableChecks; // internal/company burn (not saved in monthly stats)

    // ✅ Monthly stats: store ONLY checks credited to user, additive across runs
    if (payableChecks > 0) {
      statsBulkOps.push({
        updateOne: {
          filter: { user: user._id, month },
          update: { $inc: { checksCreated: payableChecks } },
          upsert: true,
        },
      });
    }

    // ---- consume UV for ALL checks possible (paid + burned) ----
    // selfChecks consume 4 self UV each
    // treeChecks consume 2 left + 2 right each
    const usedSelfUV = selfChecks * 4;
    const usedLeftUV = treeChecks * 2;
    const usedRightUV = treeChecks * 2;

    user.selfVolume = Math.max(0, selfVol - usedSelfUV);
    user.leftVolume = Math.max(0, leftVol - usedLeftUV);
    user.rightVolume = Math.max(0, rightVol - usedRightUV);

    // ---- payout for payableChecks only ----
    const level = user.star || 0;
    const starCfg =
      starLevels.find((s) => s.lvl === level || s.level === level) || {};
    const checkPrice = starCfg.checkPrice ?? 0;

    if (!checkPrice || checkPrice <= 0) {
      console.warn(
        `[CRON] User ${user._id} has checks possible (${totalChecksPossible}) but star level ${level} has no checkPrice configured. Skipping payout. Burned checks will still be consumed.`
      );

      await user.save();
      continue;
    }

    const payoutAmount = payableChecks * checkPrice;

    user.checksClaimed = (user.checksClaimed || 0) + payableChecks;
    user.walletBalance = (user.walletBalance || 0) + payoutAmount;
    user.totalEarnings = (user.totalEarnings || 0) + payoutAmount;

    await user.save();

    totalChecksAllUsers += payableChecks;
    totalPayoutAllUsers += payoutAmount;

    if (burnedChecks > 0) {
      console.log(
        `[CRON] User ${user._id} had ${totalChecksPossible} checks possible, credited ${payableChecks}, burned ${burnedChecks}. (cap=${maxUVPerRun} UV => ${maxPayableChecks} checks)`
      );
    }
  }

  // bulk write monthly stats after loop
  if (statsBulkOps.length > 0) {
    await UserMonthlyCheckStats.bulkWrite(statsBulkOps, { ordered: false });
    console.log(
      `[CRON] Monthly stats updated for ${statsBulkOps.length} users (month=${month.toISOString()}).`
    );
  }

  // update global stats
  if (totalChecksAllUsers > 0 || totalPayoutAllUsers > 0 || totalRspConvertedAmount > 0) {
    await Stats.findOneAndUpdate(
      { key: "global" },
      {
        $inc: {
          totalChecksCreated: totalChecksAllUsers, // credited checks
          totalPayoutAmount: totalPayoutAllUsers,

          totalRspConvertedUnits: totalRspConvertedUnits,
          totalRspConvertedAmount: totalRspConvertedAmount,
        },
        $setOnInsert: { key: "global" },
      },
      { new: true, upsert: true }
    );
  }

  console.log(
    `[CRON] Weekly check payout job finished. Credited checks: ${totalChecksAllUsers}, Payout: ${totalPayoutAllUsers}, RSP converted: ${totalRspConvertedUnits} => ${totalRspConvertedAmount}`
  );
};

export const startWeeklyCheckCron = () => {
  cron.schedule("5 0 * * 1", () => {
    runWeeklyCheckPayouts().catch((err) => {
      console.error("[CRON] Weekly check payout job error:", err);
    });
  });

  cron.schedule("20 3 * * *", () => {
    cleanupOldMonthlyStats(12).catch((err) => {
      console.error("[CRON] Monthly stats cleanup error:", err);
    });
  });

  console.log("[CRON] Weekly check payout job scheduled (every Monday 00:05).");
  console.log("[CRON] Monthly stats cleanup scheduled (daily 03:20, retain 12 months).");
};
