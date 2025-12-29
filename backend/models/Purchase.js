import mongoose from "mongoose";

const PurchaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },

    amountPaid: { type: Number, required: true },
    uvEarned: { type: Number, required: true },

    // How it was paid (this is what you need for refund routing)
    paymentMethod: {
      type: String,
      enum: ["razorpay", "wallet", "razorpay+wallet"],
      required: true,
      index: true,
    },

    deviceBrand:{ type: String },
    deviceModel:{ type: String },
    deviceImei:{ type: String },

    status: { type: String, enum: ["completed", 'failed', 'pending'], default: "completed" },

        // Breakdown (store both so mixed refunds are straightforward)
    paidViaWallet: { type: Number, default: 0 },   // INR
    paidViaRazorpay: { type: Number, default: 0 }, // INR

    // Razorpay references (nullable for wallet-only)
    razorpayOrderId: { type: String, default: null, index: true },
    razorpayPaymentId: { type: String, default: null, index: true },

    // Refund tracking (optional but useful)
    refundedWalletAmount: { type: Number, default: 0 },   // INR
    refundedRazorpayAmount: { type: Number, default: 0 }, // INR
    refundedAt: { type: Date, default: null },

    renewedAt: {type: Date}
  },
  { timestamps: true }
);

export default mongoose.model("Purchase", PurchaseSchema);
