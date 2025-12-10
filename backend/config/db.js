import mongoose from "mongoose";
import { startDailyUserCleanupCron } from "../cron/inactiveUserCleanupJob.js";
import { startWeeklyCheckCron } from "../cron/weeklyCheckPayoutJob.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    startWeeklyCheckCron();
    startDailyUserCleanupCron();
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

export default connectDB;