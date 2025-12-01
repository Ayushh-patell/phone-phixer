import mongoose from "mongoose";

const UniversalSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },

    description: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model("UniversalSettings", UniversalSettingsSchema);
