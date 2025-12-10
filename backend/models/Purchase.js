import mongoose from "mongoose";

const PurchaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },

    amountPaid: { type: Number, required: true },
    uvEarned: { type: Number, required: true },

    deviceBrand:{ type: String },
    deviceModel:{ type: String },
    deviceImei:{ type: String },

    status: { type: String, enum: ["completed", 'failed', 'pending'], default: "completed" }
  },
  { timestamps: true }
);

export default mongoose.model("Purchase", PurchaseSchema);
