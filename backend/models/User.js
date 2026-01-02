// models/User.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    // Basic Info
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, required: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },

    aadhaarNumber: { type: String },
    dob: { type: String },
    verified: { type: Boolean, default: false },

    // Aadhaar / KYC
    aadhaarVerified: { type: Boolean, default: false },

    // Device Info
    deviceBrand: { type: String },
    deviceModel: { type: String },
    deviceImei: { type: String },

    // Address
    address: { type: String },

    // Roles
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // Admin Controls
    isDisabled: { type: Boolean, default: false },

    hasMadeFirstPurchase: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Whether user is eligible/active in the referral tree
    referralActive: { type: Boolean, default: false },

    // This user's referral code
    referralCode: { type: String },

    // Sponsor: user whose referral code this user used
    referralUsed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Users waiting to be placed under me
    referralRequest: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // OPTIONAL cache for UI (TreeNode is the source of truth)
    placementCache: {
      treeOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      parentUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      side: { type: String, enum: ["L", "R"], default: null },
      level: { type: Number, default: null },
    },

    // Volumes / Points (as you want: stays on User)
    leftVolume: { type: Number, default: 0 },
    rightVolume: { type: Number, default: 0 },
    selfVolume: { type: Number, default: 0 },
    rsp: { type: Number, default: 0 },
    Totalrsp: { type: Number, default: 0 },

    // Wallet Summary
    walletBalance: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },

    star: { type: Number, default: 1 },
    checksClaimed: { type: Number, default: 0 },

    razorpayX: {
      contactId: { type: String },
      fundAccountId: { type: String },
      fundAccountType: { type: String, enum: ["bank_account", "vpa"] },

      lastFour: { type: String },
      ifsc: { type: String },
      vpa: { type: String },
    },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique referralCode only when it exists
UserSchema.index(
  { referralCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      referralCode: { $exists: true, $ne: null },
    },
  }
);

export default mongoose.model("User", UserSchema);
