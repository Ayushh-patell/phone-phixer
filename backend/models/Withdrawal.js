// models/Withdrawal.js
import mongoose from "mongoose";

const WithdrawalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Store in paise (integer) to avoid float issues
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },

    /**
     * Lifecycle:
     * requested -> pending_approval -> approved -> processing -> processed
     * Cancel/Reject:
     * cancelled (by user) OR rejected (by admin) => refund wallet
     * Payout issues:
     * failed / reversed => refund wallet
     */
    status: {
      type: String,
      enum: [
        "requested",
        "pending_approval",
        "approved",
        "processing",
        "processed",
        "cancelled",
        "rejected",
        "failed",
        "reversed",
      ],
      default: "pending_approval",
      index: true,
    },

    // Snapshot of where money is supposed to go (audit + support)
    destination: {
      type: { type: String, enum: ["bank_account", "vpa"], required: true },

      // For bank_account
      name: { type: String },
      ifsc: { type: String },
      lastFour: { type: String },

      // For vpa
      vpa: { type: String },
    },

    // Razorpay references (filled after you create these objects)
    razorpay: {
      contactId: { type: String },
      fundAccountId: { type: String },
      payoutId: { type: String },

      // Used to safely retry payout creation without double-paying
      idempotencyKey: { type: String, required: true, unique: true, index: true },
    },

    // Admin decision (if you have an Admin model, change ref accordingly)
    approval: {
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approvedAt: { type: Date },
      rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rejectedAt: { type: Date },
      rejectionReason: { type: String },
    },

    // User cancel info (optional)
    cancel: {
      cancelledAt: { type: Date },
      cancelReason: { type: String },
    },

    // Failure details (for payout failed / reversed)
    failure: {
      reason: { type: String },
      description: { type: String },
      source: { type: String }, // "razorpay_webhook", "server", etc.
    },

    /**
     * Refund tracking:
     * Since you deduct wallet immediately on request,
     * you should mark when you refunded to prevent double-refund.
     */
    wallet: {
      deductedAt: { type: Date },        // when you subtracted walletBalance
      refundedAt: { type: Date },        // when you added it back (cancel/reject/fail)
      refundReason: { type: String },    // cancelled/rejected/failed/reversed
    },
  },
  { timestamps: true }
);

// Helpful indexes
WithdrawalSchema.index({ status: 1, createdAt: -1 });
WithdrawalSchema.index({ "razorpay.payoutId": 1 }, { sparse: true });

export default mongoose.model("Withdrawal", WithdrawalSchema);
