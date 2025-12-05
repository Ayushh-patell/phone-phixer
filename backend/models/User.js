// models/User.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    // Basic Info
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, required: true },
    phone: { type: String, unique: true, sparse: true },
    password: { type: String, required: true },
    verified: { type: Boolean, default: false },

    // User Roles
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // Admin Controls
    isDisabled: {
      type: Boolean,
      default: false,
    },

    // Whether user is eligible/active in the referral tree
    referralActive: {
      type: Boolean,
      default: false,
    },

    // Referral system
    referralCode: { type: String, unique: true }, // this user's code

    // Binary-tree parent (placement parent)
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // User whose referral code this user used (sponsor)
    referralUsed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Users waiting to be placed under me
    referralRequest: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Placement status flag (you'll define semantics later)
    at_hotposition: {
      type: Boolean,
      default: false,
    },

    // Referral Tree Pointers
    leftChild: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rightChild: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Volumes / Points
    leftVolume: { type: Number, default: 0 }, // total left side UV
    rightVolume: { type: Number, default: 0 }, // total right side UV
    selfVolume: { type: Number, default: 0 }, // total self UV

    // Wallet Summary
    walletBalance: { type: Number, default: 0 }, // money available to withdraw
    totalEarnings: { type: Number, default: 0 }, // lifetime earnings


    star:  {type:Number, default:1},
    checksClaimed: { type: Number, default: 0 }, // total checks already redeemed

    // Status
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
