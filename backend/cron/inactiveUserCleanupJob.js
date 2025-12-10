// cron/dailyInactiveUserCleanupJob.js
import cron from "node-cron";
import User from "../models/User.js";
import Purchase from "../models/Purchase.js";


/**
 * Daily job:
 * Delete users who are 7+ days old AND have no purchases.
 * Uses user.hasMadeFirstPurchase to skip users who've already bought once.
 */
export const runInactiveUserCleanup = async () => {
  console.log("[CRON] Inactive user cleanup job started");

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_PER_DAY);

  const candidates = await User.find({
    createdAt: { $lte: sevenDaysAgo },
    role: { $ne: "admin" },           // not admin
    hasMadeFirstPurchase: { $ne: true }, // never (flagged as) purchased
  }).select("_id email createdAt role hasMadeFirstPurchase");

  let deletedCount = 0;

  for (const user of candidates) {
    // Safety: double-check in DB in case of older data / missing flag
    const hasPurchase = await Purchase.exists({ userId: user._id });

    if (!hasPurchase) {
      await User.deleteOne({ _id: user._id });
      deletedCount += 1;

      console.log(
        `[CRON] Deleted inactive user ${user._id} (${user.email}) – 7+ days old, no purchases.`
      );
    }
  }

  console.log(
    `[CRON] Inactive user cleanup job finished. Deleted users: ${deletedCount}`
  );
};

/**
 * Schedule: daily at 00:10 AM
 */
export const startDailyUserCleanupCron = () => {
  cron.schedule("10 0 * * *", () => {
    runInactiveUserCleanup().catch((err) => {
      console.error("[CRON] Inactive user cleanup error:", err);
    });
  });

  console.log("[CRON] Daily inactive user cleanup scheduled (00:10 every day)");
};
