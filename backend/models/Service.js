import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    uv: { type: Number, required: true }, // Universal Volume gained from buying this service


    validityDays: { type: Number, required: true },
    deviceCovered: { type: Number, required: true, default: 1 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("Service", ServiceSchema);