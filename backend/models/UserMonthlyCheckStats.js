import mongoose from "mongoose";

const UserMonthlyCheckStatsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // first day of month in UTC
    month: {
      type: Date,
      required: true,
      index: true,
    },

    // checks credited to the user in that month (your existing field)
    checksCreated: {
      type: Number,
      default: 0,
      min: 0,
    },

    // total payout credited for those checks in that month (₹)
    payoutAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // RSP earned by user in that month (ex: renew flow adds RSP)
    rspCreated: {
      type: Number,
      default: 0,
      min: 0,
    },

    // RSP converted (deducted from rsp and credited to wallet) in that month
    rspConvertedUnits: {
      type: Number,
      default: 0,
      min: 0,
    },

    // money credited to wallet from RSP conversion in that month (₹)
    rspConvertedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

UserMonthlyCheckStatsSchema.index({ user: 1, month: 1 }, { unique: true });

// useful leaderboards (optional)
UserMonthlyCheckStatsSchema.index({ month: 1, checksCreated: -1 });
UserMonthlyCheckStatsSchema.index({ month: 1, rspCreated: -1 });
UserMonthlyCheckStatsSchema.index({ month: 1, rspConvertedUnits: -1 });

export default mongoose.model("UserMonthlyCheckStats", UserMonthlyCheckStatsSchema);
