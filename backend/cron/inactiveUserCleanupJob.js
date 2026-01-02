// cron/dailyInactiveUserCleanupJob.js
import cron from "node-cron";
import mongoose from "mongoose";
import User from "../models/User.js";
import Purchase from "../models/Purchase.js";
import TreeNode from "../models/TreeNode.js";

export const runInactiveUserCleanup = async () => {
  console.log("[CRON] Inactive user cleanup job started");

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_PER_DAY);

  const candidates = await User.find({
    createdAt: { $lte: sevenDaysAgo },
    role: { $ne: "admin" },
    hasMadeFirstPurchase: { $ne: true },
  }).select("_id email createdAt role hasMadeFirstPurchase");

  let deletedCount = 0;

  for (const user of candidates) {
    // Safety: double-check purchases in DB
    const hasPurchase = await Purchase.exists({ userId: user._id });
    if (hasPurchase) continue;

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // 1) Remove this user from anyone's referralRequest queue (stale pending refs)
      await User.updateMany(
        { referralRequest: user._id },
        { $pull: { referralRequest: user._id } },
        { session }
      );

      // 2) Delete any TreeNode involving this user in ANY tree
      // - as a placed node (user)
      // - as a parent (parentUser)
      // - as a tree owner (treeOwner) -> wipes their personal tree records
      await TreeNode.deleteMany(
        {
          $or: [
            { user: user._id },
            { parentUser: user._id },
            { treeOwner: user._id },
          ],
        },
        { session }
      );

      // 3) Delete the user
      await User.deleteOne({ _id: user._id }, { session });

      await session.commitTransaction();
      deletedCount += 1;

      console.log(
        `[CRON] Deleted inactive user ${user._id} (${user.email}) – 7+ days old, no purchases. TreeNodes & queues cleaned.`
      );
    } catch (err) {
      await session.abortTransaction();
      console.error(
        `[CRON] Failed to delete inactive user ${user._id} (${user.email}):`,
        err
      );
    } finally {
      session.endSession();
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
