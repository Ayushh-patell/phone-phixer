// routes/withdrawalWebhookRoutes.js
import express from "express";
import crypto from "crypto";
import Withdrawal from "../models/Withdrawal.js";
import User from "../models/User.js";

const router = express.Router();
const WEBHOOK_SECRET = process.env.RAZORPAYX_WEBHOOK_SECRET;

function verifySignature(rawBodyBuffer, signature, secret) {
  const expected = crypto.createHmac("sha256", secret).update(rawBodyBuffer).digest("hex");
  return expected === signature;
}

async function refundWalletOnce(withdrawalId, reason) {
  const w = await Withdrawal.findOneAndUpdate(
    { _id: withdrawalId, "wallet.refundedAt": { $exists: false } },
    { $set: { "wallet.refundedAt": new Date(), "wallet.refundReason": reason } },
    { new: true }
  );

  if (!w) return { refunded: false };

  const amountInr = w.amountPaise / 100;
  await User.findByIdAndUpdate(w.user, { $inc: { walletBalance: amountInr } });
  return { refunded: true };
}

router.post("/", async (req, res) => {
  try {
    if (!WEBHOOK_SECRET) return res.status(500).send("Missing webhook secret");

    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body; // Buffer because express.raw()

    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      return res.status(400).send("Invalid signature");
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    const payout = event?.payload?.payout?.entity;
    if (!payout?.id) return res.status(200).send("ok");

    const payoutId = payout.id;
    const payoutStatus = payout.status;

    const w = await Withdrawal.findOne({ "razorpay.payoutId": payoutId });
    if (!w) return res.status(200).send("ok");

    // success
    if (event.event === "payout.processed" || payoutStatus === "processed") {
      await Withdrawal.findByIdAndUpdate(w._id, { $set: { status: "processed" } });
      return res.status(200).send("ok");
    }

    // failure / reversed => refund
    if (
      event.event === "payout.failed" ||
      event.event === "payout.reversed" ||
      payoutStatus === "failed" ||
      payoutStatus === "reversed"
    ) {
      const newStatus =
        payoutStatus === "reversed" || event.event === "payout.reversed" ? "reversed" : "failed";

      await Withdrawal.findByIdAndUpdate(w._id, {
        $set: {
          status: newStatus,
          failure: {
            reason: payoutStatus,
            description: payout?.failure_reason || payout?.remarks || "Payout failed/reversed",
            source: "razorpay_webhook",
          },
        },
      });

      await refundWalletOnce(w._id, newStatus);
      return res.status(200).send("ok");
    }

    // ignore non-terminal
    return res.status(200).send("ok");
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).send("ok");
  }
});

export default router;
