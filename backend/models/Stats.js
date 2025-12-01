// models/Stats.js
import mongoose from "mongoose";

const StatsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      required: true,
      default: "global", // so we can easily find it
    },
    totalChecksCreated: {
      type: Number,
      default: 0,
    },
    totalPayoutAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Stats", StatsSchema);
