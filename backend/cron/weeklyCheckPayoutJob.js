import cron from "node-cron";
import User from "../models/User.js";
import Stats from "../models/Stats.js";
import UserMonthlyCheckStats from "../models/UserMonthlyCheckStats.js";
import { calculateSelfChecks, calculateTreeChecks } from "../lib/checkLogic.js";
import { getStarLevels } from "../lib/starLogic.js";
import { getSettingValue } from "../routes/universalSettingsRoutes.js";

// ---- helpers for monthly stats ----
function monthStartUTC(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)
  );
}

// ✅ retainMonths=60 => 5 years
async function cleanupOldMonthlyStats(retainMonths = 60) {
  const now = new Date();
  const cutoff = monthStartUTC(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - retainMonths, 1))
  );

  const result = await UserMonthlyCheckStats.deleteMany({ month: { $lt: cutoff } });
  console.log(
    `[CRON] Monthly stats cleanup: deleted ${result.deletedCount} docs older than ${cutoff.toISOString()}`
  );
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function addMonthlyInc(map, userId, incObj) {
  const key = String(userId);
  const prev = map.get(key) || {
    checksCreated: 0,
    payoutAmount: 0,
    rspConvertedUnits: 0,
    rspConvertedAmount: 0,
  };

  map.set(key, {
    checksCreated: prev.checksCreated + (incObj.checksCreated || 0),
    payoutAmount: prev.payoutAmount + (incObj.payoutAmount || 0),
    rspConvertedUnits: prev.rspConvertedUnits + (incObj.rspConvertedUnits || 0),
    rspConvertedAmount: prev.rspConvertedAmount + (incObj.rspConvertedAmount || 0),
  });
}

export const runWeeklyCheckPayouts = async () => {
  console.log("[CRON] Weekly check payout job started");

  const [starLevels, maxUVSetting, moneyToRspSetting] = await Promise.all([
    getStarLevels(),
    getSettingValue("max_checks_per_week", 290),
    getSettingValue("money_to_rsp", 1.1),
  ]);

  const maxUVPerRun = safeNum(maxUVSetting, 0); // 0 => no cap
  const moneyToRsp = safeNum(moneyToRspSetting, 1.1);

  const maxPayableChecks = maxUVPerRun > 0 ? Math.floor(maxUVPerRun / 4) : 0;

  const users = await User.find({
    $or: [
      { selfVolume: { $gt: 0 } },
      { leftVolume: { $gt: 0 } },
      { rightVolume: { $gt: 0 } },
      { rsp: { $gt: 0 } },
    ],
  }).select("_id selfVolume leftVolume rightVolume walletBalance totalEarnings checksClaimed star rsp");

  let totalChecksAllUsers = 0;
  let totalPayoutAllUsers = 0;

  let totalRspConvertedUnits = 0;
  let totalRspConvertedAmount = 0;

  const month = monthStartUTC(new Date());

  // ✅ NEW: collect monthly increments per user so we write ONE upsert per user/month
  const monthlyIncByUser = new Map();

  for (const user of users) {
    const selfVol = safeNum(user.selfVolume, 0);
    const leftVol = safeNum(user.leftVolume, 0);
    const rightVol = safeNum(user.rightVolume, 0);

    // ---- compute checks possible ----
    const selfChecks = calculateSelfChecks(selfVol);
    const treeChecks = calculateTreeChecks(leftVol, rightVol);
    const totalChecksPossible = selfChecks + treeChecks;

    // ---- cap ----
    let payableChecks =
      maxUVPerRun > 0
        ? Math.min(totalChecksPossible, maxPayableChecks)
        : totalChecksPossible;

    // ---- compute payout based on star ----
    const level = safeNum(user.star, 0);
    const starCfg = starLevels.find((s) => s.lvl === level || s.level === level) || {};
    const checkPrice = safeNum(starCfg.checkPrice, 0);

    // If checkPrice invalid, do not credit checks (treat all as burned)
    let payoutAmount = 0;
    if (payableChecks > 0 && (!checkPrice || checkPrice <= 0)) {
      console.warn(
        `[CRON] User ${user._id} has checks possible (${totalChecksPossible}) but star level ${level} has no checkPrice. Burning checks (no credit).`
      );
      payableChecks = 0;
    }

    if (payableChecks > 0) {
      payoutAmount = payableChecks * checkPrice;
    }

    // ---- RSP -> money conversion ----
    const currentRsp = safeNum(user.rsp, 0);
    if (currentRsp > 0) {
      const rspMoney = currentRsp * moneyToRsp;

      user.walletBalance = safeNum(user.walletBalance, 0) + rspMoney;
      user.totalEarnings = safeNum(user.totalEarnings, 0) + rspMoney;
      user.rsp = 0;

      totalRspConvertedUnits += currentRsp;
      totalRspConvertedAmount += rspMoney;

      addMonthlyInc(monthlyIncByUser, user._id, {
        rspConvertedUnits: currentRsp,
        rspConvertedAmount: rspMoney,
      });
    }

    // If no checks credited and only RSP converted, still save user and continue
    if (totalChecksPossible <= 0 || payableChecks <= 0) {
      if (currentRsp > 0) await user.save();
      continue;
    }

    // ---- consume UV for ALL checks possible (paid + burned) ----
    const usedSelfUV = selfChecks * 4;
    const usedLeftUV = treeChecks * 2;
    const usedRightUV = treeChecks * 2;

    user.selfVolume = Math.max(0, selfVol - usedSelfUV);
    user.leftVolume = Math.max(0, leftVol - usedLeftUV);
    user.rightVolume = Math.max(0, rightVol - usedRightUV);

    // ---- credit payout for payableChecks only ----
    user.checksClaimed = safeNum(user.checksClaimed, 0) + payableChecks;
    user.walletBalance = safeNum(user.walletBalance, 0) + payoutAmount;
    user.totalEarnings = safeNum(user.totalEarnings, 0) + payoutAmount;

    addMonthlyInc(monthlyIncByUser, user._id, {
      checksCreated: payableChecks,
      payoutAmount,
    });

    await user.save();

    totalChecksAllUsers += payableChecks;
    totalPayoutAllUsers += payoutAmount;
  }

  // ✅ NEW: one upsert per (user, month)
  const statsBulkOps = [];
  for (const [userIdStr, inc] of monthlyIncByUser.entries()) {
    const update = {};
    const incObj = {};

    if (inc.checksCreated) incObj.checksCreated = inc.checksCreated;
    if (inc.payoutAmount) incObj.payoutAmount = inc.payoutAmount;
    if (inc.rspConvertedUnits) incObj.rspConvertedUnits = inc.rspConvertedUnits;
    if (inc.rspConvertedAmount) incObj.rspConvertedAmount = inc.rspConvertedAmount;

    if (Object.keys(incObj).length === 0) continue;

    update.$inc = incObj;

    statsBulkOps.push({
      updateOne: {
        filter: { user: userIdStr, month },
        update,
        upsert: true,
      },
    });
  }

  if (statsBulkOps.length > 0) {
    // ordered:false is safe now because each (user,month) appears only once
    await UserMonthlyCheckStats.bulkWrite(statsBulkOps, { ordered: false });
    console.log(
      `[CRON] Monthly stats updated for ${statsBulkOps.length} users (month=${month.toISOString()}).`
    );
  }

  if (totalChecksAllUsers > 0 || totalPayoutAllUsers > 0 || totalRspConvertedAmount > 0) {
    await Stats.findOneAndUpdate(
      { key: "global" },
      {
        $inc: {
          totalChecksCreated: totalChecksAllUsers,
          totalPayoutAmount: totalPayoutAllUsers,
          totalRspConvertedUnits,
          totalRspConvertedAmount,
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

  // ✅ keep 5 years (60 months)
  cron.schedule("20 3 * * *", () => {
    cleanupOldMonthlyStats(60).catch((err) => {
      console.error("[CRON] Monthly stats cleanup error:", err);
    });
  });

  console.log("[CRON] Weekly check payout job scheduled (every Monday 00:05).");
  console.log("[CRON] Monthly stats cleanup scheduled (daily 03:20, retain 60 months).");
};
