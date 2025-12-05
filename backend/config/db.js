import mongoose from "mongoose";
import { runWeeklyCheckPayouts } from "../cron/weeklyCheckPayoutJob.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    runWeeklyCheckPayouts();
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

export default connectDB;