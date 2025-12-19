// models/UserMetricEvent.js
import mongoose from "mongoose";

const { Schema } = mongoose;

// Universal event log for user-related metric changes (RSP earned, RSP converted, checks credited, etc.)
const UserMetricEventSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // e.g. "rsp_earned", "rsp_converted", "checks_credited", "wallet_debited", etc.
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    /**
     * Numeric metrics for the event.
     * Examples:
     *  - { rsp: 240, uv: 2, rspPerUv: 120 }
     *  - { checksCredited: 10, payoutAmount: 50 }
     *  - { rspUnits: 100, rspAmountInr: 110 }
     */
    metrics: {
      type: Map,
      of: Number,
      default: {},
    },

    /**
     * References to other docs / ids involved in the event.
     * Keep them optional so the same schema works for many event types.
     */
    refs: {
      serviceId: { type: Schema.Types.ObjectId, ref: "Service" },
      purchaseId: { type: Schema.Types.ObjectId, ref: "Purchase" },
      previousPurchaseId: { type: Schema.Types.ObjectId, ref: "Purchase" },

      // Razorpay ids are strings
      razorpayOrderId: { type: String, trim: true },
      razorpayPaymentId: { type: String, trim: true },
    },

    /**
     * Extra non-numeric / descriptive metadata.
     * Examples:
     *  - { method: "wallet", isRenew: true, paidInr: 199 }
     *  - { source: "weekly_cron", note: "cap applied" }
     */
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Common query patterns
UserMetricEventSchema.index({ user: 1, createdAt: -1 });
UserMetricEventSchema.index({ user: 1, eventType: 1, createdAt: -1 });
UserMetricEventSchema.index({ eventType: 1, createdAt: -1 });

export default mongoose.model("UserMetricEvent", UserMetricEventSchema);
