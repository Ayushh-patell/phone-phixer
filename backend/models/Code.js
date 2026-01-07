// models/Code.js
import mongoose from "mongoose";

const CodeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    code: { type: String, required: true },

    type: {
      type: String,
      enum: [
        "otp",
        "recovery",
        "email_verify",
        "password_reset",
        "aadhaar_otp",
        "wallet_transfer", // ✅ add this
      ],
      default: "otp",
    },

    // ✅ store transfer intent here (amount, receiverId, etc.)
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    expiresAt: { type: Date, required: true },

    createdAt: { type: Date, default: Date.now, expires: 86400 }, // 24 hours
  },
  { timestamps: false }
);

CodeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("Code", CodeSchema);
