import express from "express";
import crypto from "crypto";
import axios from "axios";

import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import Withdrawal from "../models/Withdrawal.js";

const router = express.Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAYX_ACCOUNT_NUMBER = process.env.RAZORPAYX_ACCOUNT_NUMBER;

// Use a separate secret if you can. Fallback to Razorpay secret.
const BANK_FINGERPRINT_SECRET =
  process.env.BANK_FINGERPRINT_SECRET || process.env.RAZORPAY_KEY_SECRET;

const rpX = axios.create({
  baseURL: "https://api.razorpay.com/v1",
  auth: { username: RAZORPAY_KEY_ID, password: RAZORPAY_KEY_SECRET },
  timeout: 30000,
});

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}

function toPaise(inr) {
  const n = Number(inr);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

function last4(accountNumber) {
  const s = String(accountNumber || "");
  return s.slice(-4);
}

function bankFingerprint(accountNumber) {
  // HMAC so DB leak doesn't expose account number easily
  return crypto
    .createHmac("sha256", BANK_FINGERPRINT_SECRET || "fallback")
    .update(String(accountNumber || ""))
    .digest("hex")
    .slice(0, 24);
}

function isValidIFSC(ifsc) {
  // Common IFSC format: 4 letters + 0 + 6 alphanum
  return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(String(ifsc || "").trim());
}

function isValidAccountNumber(ac) {
  // Loose: digits, 6–20 length. Adjust to your needs.
  const s = String(ac || "").trim();
  return /^\d{6,20}$/.test(s);
}

async function ensureContact(userDoc) {
  if (userDoc.razorpayX?.contactId) return userDoc.razorpayX.contactId;

  const payload = {
    name: userDoc.name,
    email: userDoc.email,
    contact: userDoc.phone || undefined,
    type: "customer",
    reference_id: String(userDoc._id),
  };

  const { data } = await rpX.post("/contacts", payload);
  const contactId = data.id;

  userDoc.razorpayX = userDoc.razorpayX || {};
  userDoc.razorpayX.contactId = contactId;
  await userDoc.save();

  return contactId;
}

async function ensureBankFundAccount(userDoc, contactId, bank) {
  const fp = bankFingerprint(bank.accountNumber);

  // Reuse if it matches what user already saved (safer than last4-only)
  if (
    userDoc.razorpayX?.fundAccountId &&
    userDoc.razorpayX?.fundAccountType === "bank_account" &&
    userDoc.razorpayX?.ifsc === bank.ifsc &&
    userDoc.razorpayX?.bankFingerprint === fp
  ) {
    return userDoc.razorpayX.fundAccountId;
  }

  const payload = {
    contact_id: contactId,
    account_type: "bank_account",
    bank_account: {
      name: bank.name,
      ifsc: bank.ifsc,
      account_number: String(bank.accountNumber),
    },
  };

  // RazorpayX dedupes fund accounts by full details and returns existing if same. :contentReference[oaicite:5]{index=5}
  const { data } = await rpX.post("/fund_accounts", payload);
  const fundAccountId = data.id;

  userDoc.razorpayX = userDoc.razorpayX || {};
  userDoc.razorpayX.fundAccountId = fundAccountId;
  userDoc.razorpayX.fundAccountType = "bank_account";
  userDoc.razorpayX.ifsc = bank.ifsc;
  userDoc.razorpayX.lastFour = last4(bank.accountNumber);
  userDoc.razorpayX.bankFingerprint = fp;
  userDoc.razorpayX.vpa = undefined;

  await userDoc.save();
  return fundAccountId;
}

// refunds wallet ONCE (safe against double refund)
async function refundWalletOnce(withdrawalId, reason) {
  const w = await Withdrawal.findOneAndUpdate(
    { _id: withdrawalId, "wallet.refundedAt": { $exists: false }, "wallet.deductedAt": { $exists: true } },
    { $set: { "wallet.refundedAt": new Date(), "wallet.refundReason": reason } },
    { new: true }
  );

  if (!w) return { refunded: false };

  const amountInr = w.amountPaise / 100;
  await User.findByIdAndUpdate(w.user, { $inc: { walletBalance: amountInr } });

  return { refunded: true, amountInr };
}

/**
 * USER: Create withdrawal request
 * POST /api/withdrawals/request
 * body: { amount, bank: { name, accountNumber, ifsc } }
 */
router.post("/request", protect, async (req, res) => {
  let deducted = false;
  let deductedAmountInr = 0;

  try {
    const { amount, bank } = req.body || {};

    if (!bank || !bank.name || !bank.accountNumber || !bank.ifsc) {
      return res.status(400).json({
        message: "bank.name, bank.accountNumber and bank.ifsc are required",
      });
    }

    if (!isValidIFSC(bank.ifsc)) {
      return res.status(400).json({ message: "Invalid IFSC format" });
    }

    if (!isValidAccountNumber(bank.accountNumber)) {
      return res.status(400).json({ message: "Invalid account number format" });
    }

    const amountPaise = toPaise(amount);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const amountInr = amountPaise / 100;
    deductedAmountInr = amountInr;

    // ✅ atomic wallet deduction
    const userAfterDeduct = await User.findOneAndUpdate(
      { _id: req.user.id, walletBalance: { $gte: amountInr }, isDisabled: { $ne: true } },
      { $inc: { walletBalance: -amountInr } },
      { new: true }
    );

    if (!userAfterDeduct) {
      return res.status(400).json({ message: "Insufficient wallet balance (or user disabled)" });
    }
    deducted = true;

    const userDoc = await User.findById(userAfterDeduct._id);
    if (!userDoc) {
      await User.findByIdAndUpdate(userAfterDeduct._id, { $inc: { walletBalance: amountInr } });
      return res.status(404).json({ message: "User not found (refunded)" });
    }

    // Create/reuse RazorpayX contact + fund account now
    const contactId = await ensureContact(userDoc);
    const fundAccountId = await ensureBankFundAccount(userDoc, contactId, bank);

    // Idempotency key is mandatory for payouts (store once per withdrawal). :contentReference[oaicite:6]{index=6}
    const idempotencyKey = crypto.randomUUID();

    const w = await Withdrawal.create({
      user: userDoc._id,
      amountPaise,
      currency: "INR",
      status: "pending_approval",
      destination: {
        type: "bank_account",
        name: bank.name,
        ifsc: bank.ifsc,
        lastFour: last4(bank.accountNumber),
      },
      razorpay: {
        idempotencyKey,
        contactId,
        fundAccountId,
      },
      wallet: { deductedAt: new Date() },
    });

    return res.json({
      message: "Withdrawal requested (pending approval)",
      withdrawalId: w._id,
      status: w.status,
      walletBalance: userAfterDeduct.walletBalance,
    });
  } catch (err) {
    console.error("Withdrawal request error:", err);

    // compensate if deducted but something failed after deduction
    if (deducted && deductedAmountInr > 0) {
      try {
        await User.findByIdAndUpdate(req.user.id, { $inc: { walletBalance: deductedAmountInr } });
      } catch (e) {
        console.error("Compensation refund failed:", e);
      }
    }

    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * USER: List my withdrawals
 * GET /api/withdrawals/my
 */
router.get("/my", protect, async (req, res) => {
  try {
    const items = await Withdrawal.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({ items });
  } catch (err) {
    console.error("My withdrawals error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * USER: Cancel withdrawal (refund)
 * POST /api/withdrawals/:id/cancel
 */
router.post("/:id/cancel", protect, async (req, res) => {
  try {
    const wid = req.params.id;

    const w = await Withdrawal.findOne({ _id: wid, user: req.user.id });
    if (!w) return res.status(404).json({ message: "Withdrawal not found" });

    if (w.status !== "pending_approval") {
      return res.status(400).json({ message: `Cannot cancel in status ${w.status}` });
    }

    await Withdrawal.findByIdAndUpdate(w._id, {
      $set: { status: "cancelled", "cancel.cancelledAt": new Date() },
    });

    const refund = await refundWalletOnce(w._id, "cancelled");

    return res.json({
      message: "Withdrawal cancelled",
      refunded: refund.refunded,
    });
  } catch (err) {
    console.error("Cancel withdrawal error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: list withdrawals
 * GET /api/withdrawals/admin/list?status=pending_approval
 */
router.get("/admin/list", protect, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const items = await Withdrawal.find(filter)
      .populate("user", "name email phone walletBalance")
      .sort({ createdAt: -1 })
      .limit(300);

    return res.json({ items });
  } catch (err) {
    console.error("Admin list withdrawals error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: reject withdrawal (refund)
 * POST /api/withdrawals/admin/:id/reject
 * body: { reason?: string }
 */
router.post("/admin/:id/reject", protect, requireAdmin, async (req, res) => {
  try {
    const wid = req.params.id;
    const { reason } = req.body || {};

    const w = await Withdrawal.findById(wid);
    if (!w) return res.status(404).json({ message: "Withdrawal not found" });

    if (w.status !== "pending_approval") {
      return res.status(400).json({ message: `Cannot reject in status ${w.status}` });
    }

    await Withdrawal.findByIdAndUpdate(w._id, {
      $set: {
        status: "rejected",
        "approval.rejectedBy": req.user.id,
        "approval.rejectedAt": new Date(),
        "approval.rejectionReason": reason || "Rejected by admin",
      },
    });

    const refund = await refundWalletOnce(w._id, "rejected");

    return res.json({ message: "Withdrawal rejected", refunded: refund.refunded });
  } catch (err) {
    console.error("Admin reject error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: approve withdrawal -> create payout
 * POST /api/withdrawals/admin/:id/approve
 *
 * IMPORTANT:
 * - Do NOT refund wallet on timeout/unknown errors. With idempotency, a payout may still exist.
 * - Refund only when you have a definitive terminal failure (webhook failed/reversed) or a confirmed 4xx validation error.
 */
router.post("/admin/:id/approve", protect, requireAdmin, async (req, res) => {
  const wid = req.params.id;

  try {
    let w = await Withdrawal.findById(wid);
    if (!w) return res.status(404).json({ message: "Withdrawal not found" });

    if (["cancelled", "rejected"].includes(w.status)) {
      return res.status(400).json({ message: `Cannot approve in status ${w.status}` });
    }

    if (w.status === "pending_approval") {
      // lock: only one admin can approve
      w = await Withdrawal.findOneAndUpdate(
        { _id: wid, status: "pending_approval" },
        {
          $set: {
            status: "approved",
            "approval.approvedBy": req.user.id,
            "approval.approvedAt": new Date(),
          },
        },
        { new: true }
      );
      if (!w) {
        // someone else already moved it
        w = await Withdrawal.findById(wid);
        return res.status(400).json({ message: `Already processed by another admin (status ${w?.status})` });
      }
    }

    // If payout already initiated, just return current
    if (w.razorpay?.payoutId) {
      return res.json({
        message: "Payout already initiated",
        payoutId: w.razorpay.payoutId,
        withdrawalStatus: w.status,
      });
    }

    if (!w.razorpay?.fundAccountId) {
      await Withdrawal.findByIdAndUpdate(w._id, {
        $set: {
          status: "failed",
          failure: {
            reason: "missing_fund_account",
            description: "fundAccountId not found on withdrawal",
            source: "server",
          },
        },
      });
      await refundWalletOnce(w._id, "failed_missing_fund_account");
      return res.status(400).json({ message: "Missing fund account (refunded)" });
    }

    const idempotencyKey = w.razorpay.idempotencyKey || crypto.randomUUID();

    // mark processing before calling Razorpay
    await Withdrawal.findByIdAndUpdate(w._id, {
      $set: {
        status: "processing",
        "razorpay.idempotencyKey": idempotencyKey,
        "razorpay.payoutCreateAttemptedAt": new Date(),
      },
    });

    const payoutPayload = {
      account_number: RAZORPAYX_ACCOUNT_NUMBER,
      fund_account_id: w.razorpay.fundAccountId,
      amount: w.amountPaise,
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: String(w._id).slice(-40),
      narration: `Wallet withdrawal ${String(w._id).slice(-8)}`,
    };

    // Header is correct and mandatory for payouts. :contentReference[oaicite:7]{index=7}
    const { data: payout } = await rpX.post("/payouts", payoutPayload, {
      headers: { "X-Payout-Idempotency": idempotencyKey },
    });

    await Withdrawal.findByIdAndUpdate(w._id, {
      $set: {
        status: payout.status || "processing", // can be queued/processing/processed :contentReference[oaicite:8]{index=8}
        "razorpay.payoutId": payout.id,
        "razorpay.payoutStatus": payout.status,
        "razorpay.statusDetails": payout.status_details || undefined,
      },
    });

    return res.json({
      message: "Approved and payout initiated",
      payoutId: payout.id,
      payoutStatus: payout.status,
    });
  } catch (err) {
    console.error("Admin approve error:", err);

    // IMPORTANT:
    // - If Razorpay responded with a 4xx, payout was not created -> safe to fail+refund.
    // - If timeout/network/5xx, payout may still exist (idempotency) -> DO NOT refund here.
    const statusCode = err?.response?.status;

    if (statusCode >= 400 && statusCode < 500) {
      try {
        const w = await Withdrawal.findById(wid);
        if (w && ["approved", "processing"].includes(w.status)) {
          await Withdrawal.findByIdAndUpdate(w._id, {
            $set: {
              status: "failed",
              failure: {
                reason: "payout_create_failed_4xx",
                description:
                  err?.response?.data?.error?.description ||
                  err?.response?.data?.error?.reason ||
                  err.message,
                source: "server",
                httpStatus: statusCode,
              },
            },
          });
          await refundWalletOnce(w._id, "failed_payout_create_4xx");
        }
      } catch (e) {
        console.error("Approve 4xx compensation failed:", e);
      }

      return res.status(400).json({
        message: "Payout creation failed (validation/4xx). Wallet refunded.",
      });
    }

    // Unknown/timeout/5xx: keep it processing and let webhook or a retry reconcile it.
    try {
      await Withdrawal.findByIdAndUpdate(wid, {
        $set: {
          status: "processing",
          failure: {
            reason: "payout_create_uncertain",
            description: err.message,
            source: "server",
            httpStatus: statusCode || null,
          },
        },
      });
    } catch (e) {
      console.error("Mark uncertain failed:", e);
    }

    return res.status(502).json({
      message:
        "Payout initiation uncertain (timeout/5xx). Not refunded to avoid double-pay. Retry approve later or rely on webhook updates.",
    });
  }
});

export default router;
