import mongoose from "mongoose";

const CodeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    code: { type: String, required: true },

    // What type of code is it? (optional but useful)
    type: {
      type: String,
      enum: ["otp", "recovery", "email_verify", "password_reset"],
      default: "otp"
    },

    // Code validity period (in minutes)
    expiresAt: { type: Date, required: true },

    // Automatically remove after 1 day — MongoDB TTL index
    createdAt: { type: Date, default: Date.now, expires: 86400 } // 24 hours
  },
  { timestamps: false }
);

// TTL index ensures auto deletion
CodeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("Code", CodeSchema);
