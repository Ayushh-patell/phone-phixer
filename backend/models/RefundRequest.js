// models/RefundRequest.js
import mongoose from "mongoose";

const RefundRequestSchema = new mongoose.Schema(
  {
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Amount that needs Razorpay refund (INR)
    amountInr: { type: Number, required: true, min: 1 },

    // Snapshot (helps admin + safety)
    paymentMethodSnapshot: {
      type: String,
      enum: ["razorpay", "wallet", "razorpay+wallet"],
      required: true,
    },
    razorpayPaymentIdSnapshot: { type: String, default: null },
    razorpayOrderIdSnapshot: { type: String, default: null },

    reason: { type: String, default: "" },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },

    // Admin action
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    adminComment: { type: String, default: "" },

    // Execution result
    razorpayRefundId: { type: String, default: null, index: true },
    failureReason: { type: String, default: "" },
  },
  { timestamps: true }
);

// Optional: prevent multiple pending requests per purchase
RefundRequestSchema.index(
  { purchaseId: 1, status: 1 },
  { partialFilterExpression: { status: "pending" } }
);

export default mongoose.model("RefundRequest", RefundRequestSchema);
