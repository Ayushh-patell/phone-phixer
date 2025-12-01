import dotenv from "dotenv";
dotenv.config();

import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";

import { protect } from "../middleware/authMiddleware.js";
import Service from "../models/Service.js";
import Purchase from "../models/Purchase.js";
import User from "../models/User.js";
import { updateReferralVolumes } from "../lib/referralVolumeLogic.js";
import { placeInReferralTree } from "../lib/PlacementLogic.js";

const router = express.Router();

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("⚠️ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set in env");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * @route   POST /api/payments/create-order
 * @desc    Create Razorpay order for a service (Test mode)
 * @access  Private (logged-in user)
 *
 * Body: { serviceId }
 */
router.post("/create-order", protect, async (req, res) => {
  try {
    const { serviceId } = req.body;

    if (!serviceId) {
      return res.status(400).json({ message: "serviceId is required" });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Amount in paise; service.price assumed to be in INR (number)
    const amountInPaise = Math.round(service.price * 100);

    // Make sure receipt is < 40 chars
    const shortServiceId = service._id.toString().slice(-8);
    const shortTimestamp = Date.now().toString().slice(-6);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `svc_${shortServiceId}_${shortTimestamp}`,
    };

    const order = await razorpay.orders.create(options);

    // Optional: send some user details to prefill on frontend
    const userDoc = await User.findById(req.user.id).select(
      "name email phone"
    );

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      serviceId: service._id,
      user: userDoc
        ? {
            name: userDoc.name,
            email: userDoc.email,
            phone: userDoc.phone,
          }
        : null,
    });
  } catch (err) {
    console.error("Error creating Razorpay order:", err);
    // If Razorpay responded with a validation error, bubble it up for easier debugging
    if (err.error) {
      return res.status(400).json({
        message: err.error.description || "Razorpay error",
        details: err.error,
      });
    }
    return res.status(500).json({ message: "Unable to create order" });
  }
});

/**
 * @route   POST /api/payments/verify
 * @desc    Verify Razorpay payment signature + create Purchase
 * @access  Private (logged-in user)
 *
 * Body:
 *  {
 *    razorpay_payment_id,
 *    razorpay_order_id,
 *    razorpay_signature,
 *    serviceId
 *  }
 */
router.post("/verify", protect, async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      serviceId,
    } = req.body;

    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !serviceId
    ) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    // 1. Verify signature using Razorpay secret
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // 2. Get service + user
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 3. Create purchase record
    const purchase = await Purchase.create({
      userId: user._id,
      serviceId: service._id,
      amountPaid: service.price,
      uvEarned: service.uv,
      status: "completed",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    });

    // 4. Update user's selfVolume
    user.selfVolume += service.uv;


    // TODO USE DYNAMIC
    if((user.selfVolume >= 5) && !user.referralActive) {
      if (user.referredBy) {
        const referrer = await User.findById(user.referredBy);
        if (referrer) {
          await placeInReferralTree(user, referrer);
        }
      }

    user.referralActive = true;   
   }
   // 2) Update left/right volumes of uplines recursively
   else if(user.referralActive) {
     await updateReferralVolumes(user._id, service.uv);
   }
    await user.save();

    

    return res.json({
      message: "Payment verified & purchase created",
      purchase,
    });
  } catch (err) {
    console.error("Error verifying Razorpay payment:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
