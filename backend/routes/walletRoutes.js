import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Code from "../models/Code.js";
import { protect } from "../middleware/authMiddleware.js";
import nodemailer from "nodemailer";

const router = express.Router();

function normalizeReferralOrEmail(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  // strip optional pp prefix if present
  const noPP = raw.toLowerCase().startsWith("pp") ? raw.slice(2).trim() : raw;

  return noPP;
}

function isValidObjectId(id) {
  return typeof id === "string" && id.length === 24;
}

// ====== REQUEST WALLET TRANSFER (SEND OTP) ======
// User provides: amount + receiver (email or referralCode)
router.post("/transfer/request", protect, async (req, res) => {
  try {
    const senderId = req.user.id;
    let { amount, receiver } = req.body || {};

    if (amount === undefined || amount === null || !receiver) {
      return res.status(400).json({ message: "amount and receiver are required" });
    }

    // amount validation
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    // OPTIONAL: enforce 2 decimals (if wallet is money)
    const rounded = Math.round(amt * 100) / 100;
    if (Math.abs(rounded - amt) > 0.000001) {
      return res.status(400).json({ message: "amount must have at most 2 decimals" });
    }

    const sender = await User.findById(senderId).select("_id email name walletBalance verified isDisabled");
    if (!sender) return res.status(404).json({ message: "Sender not found" });

    if (sender.isDisabled) {
      return res.status(403).json({ message: "Account disabled" });
    }

    if (!sender.verified) {
      return res.status(400).json({ message: "Please verify your email first" });
    }

    if (!sender.email) {
      return res.status(400).json({ message: "Sender does not have an email set" });
    }

    if ((sender.walletBalance || 0) < rounded) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    // find receiver by email OR referralCode
    const receiverKey = normalizeReferralOrEmail(receiver);
    if (!receiverKey) return res.status(400).json({ message: "Invalid receiver" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let receiverUser = null;

    if (emailRegex.test(receiverKey)) {
      receiverUser = await User.findOne({ email: receiverKey }).select("_id email name isDisabled");
    } else {
      // normalize to uppercase since your generated codes are uppercase hex
      const normalizedRef = receiverKey.toUpperCase();
      receiverUser = await User.findOne({ referralCode: normalizedRef }).select("_id email name isDisabled");
    }

    if (!receiverUser) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    if (receiverUser.isDisabled) {
      return res.status(400).json({ message: "Receiver account is disabled" });
    }

    if (receiverUser._id.toString() === sender._id.toString()) {
      return res.status(400).json({ message: "Cannot transfer to yourself" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Optional: invalidate previous pending wallet_transfer codes for sender
    await Code.deleteMany({ userId: sender._id, type: "wallet_transfer" });

    // Save OTP + transfer intent
    await Code.create({
      userId: sender._id,
      code: otp,
      type: "wallet_transfer",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      meta: {
        amount: rounded,
        receiverId: receiverUser._id.toString(),
      },
    });

    // Send OTP email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.FROM, pass: process.env.FROMPASSWORD },
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: sender.email,
      subject: "Wallet Transfer OTP",
      text: `Your OTP for wallet transfer of ₹${rounded} is: ${otp}. It expires in 10 minutes.`,
    });

    return res.json({
      message: "OTP sent to your email",
      transfer: {
        amount: rounded,
        receiver: {
          id: receiverUser._id,
          name: receiverUser.name,
          email: receiverUser.email || null,
        },
      },
    });
  } catch (err) {
    console.error("WALLET TRANSFER REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ====== CONFIRM WALLET TRANSFER (VERIFY OTP + SEND MONEY) ======
router.post("/transfer/confirm", protect, async (req, res) => {
  let session = null;

  try {
    const senderId = req.user.id;
    const { otp } = req.body || {};

    if (!otp) {
      return res.status(400).json({ message: "otp is required" });
    }

    // Load latest wallet_transfer code for this sender
    const record = await Code.findOne({
      userId: senderId,
      type: "wallet_transfer",
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({ message: "No pending wallet transfer found. Please request OTP again." });
    }

    if (record.expiresAt < new Date()) {
      await Code.deleteMany({ userId: senderId, type: "wallet_transfer" });
      return res.status(400).json({ message: "OTP expired. Please request again." });
    }

    if (String(record.code) !== String(otp).trim()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const amount = Number(record.meta?.amount);
    const receiverId = String(record.meta?.receiverId || "");

    if (!Number.isFinite(amount) || amount <= 0 || !isValidObjectId(receiverId)) {
      await Code.deleteMany({ userId: senderId, type: "wallet_transfer" });
      return res.status(400).json({ message: "Transfer intent is invalid. Please request OTP again." });
    }

    // Transactional transfer (best)
    const runTransfer = async (useSession) => {
      const opts = useSession ? { session } : undefined;

      // Fetch both inside the same session for consistency
      const [sender, receiver] = await Promise.all([
        User.findById(senderId).select("_id walletBalance isDisabled").session(useSession ? session : null),
        User.findById(receiverId).select("_id walletBalance isDisabled").session(useSession ? session : null),
      ]);

      if (!sender) throw new Error("SenderNotFound");
      if (!receiver) throw new Error("ReceiverNotFound");
      if (sender.isDisabled) throw new Error("SenderDisabled");
      if (receiver.isDisabled) throw new Error("ReceiverDisabled");

      if ((sender.walletBalance || 0) < amount) throw new Error("InsufficientBalance");

      // Atomic updates
      await User.updateOne(
        { _id: sender._id },
        { $inc: { walletBalance: -amount } },
        opts
      );

      await User.updateOne(
        { _id: receiver._id },
        { $inc: { walletBalance: amount } },
        opts
      );

      // Consume OTP
      await Code.deleteMany({ userId: senderId, type: "wallet_transfer" }, opts);

      return { senderId: sender._id, receiverId: receiver._id, amount };
    };

    let result;

    try {
      session = await mongoose.startSession();
      session.startTransaction();

      result = await runTransfer(true);

      await session.commitTransaction();
      session.endSession();
      session = null;
    } catch (txErr) {
      // fallback if transactions unsupported
      if (session) {
        try {
          await session.abortTransaction();
        } catch {}
        session.endSession();
        session = null;
      }

      const msg = String(txErr?.message || "");
      const isTxnNotSupported =
        msg.includes("Transaction numbers are only allowed") ||
        msg.includes("replica set") ||
        msg.includes("mongos");

      if (!isTxnNotSupported) throw txErr;

      // NOTE: fallback is not fully atomic in standalone Mongo; acceptable if you accept that tradeoff.
      result = await runTransfer(false);
    }

    return res.json({
      message: "Wallet transfer successful",
      transfer: {
        amount: result.amount,
        receiverId: result.receiverId,
      },
    });
  } catch (err) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch {}
      session.endSession();
    }

    console.error("WALLET TRANSFER CONFIRM ERROR:", err);

    // friendly error mapping
    const msg = String(err?.message || "");
    if (msg === "InsufficientBalance") return res.status(400).json({ message: "Insufficient wallet balance" });
    if (msg === "ReceiverNotFound") return res.status(404).json({ message: "Receiver not found" });
    if (msg === "SenderDisabled") return res.status(403).json({ message: "Account disabled" });
    if (msg === "ReceiverDisabled") return res.status(400).json({ message: "Receiver account is disabled" });

    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
