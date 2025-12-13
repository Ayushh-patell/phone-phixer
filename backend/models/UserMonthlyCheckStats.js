// models/UserMonthlyCheckStats.js
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

    // checks generated in that month
    checksCreated: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

UserMonthlyCheckStatsSchema.index({ user: 1, month: 1 }, { unique: true });
UserMonthlyCheckStatsSchema.index({ month: 1, checksCreated: -1 });

export default mongoose.model("UserMonthlyCheckStats", UserMonthlyCheckStatsSchema);
