import express from "express";
import User from "../models/User.js";
import Code from "../models/Code.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import axios from "axios";
import crypto from 'crypto'
import { protect } from "../middleware/authMiddleware.js";
import jwt from "jsonwebtoken"
import { placeInReferralTree } from "../lib/PlacementLogic.js";
import { getStarLevels } from "../lib/starLogic.js";
import { getSandboxToken } from "../lib/sandboxClient.js";






const router = express.Router();

// ====== USER CREATION ======
router.post("/register", async (req, res) => {
  try {
    let {
      name,
      email,
      password,
      referralCode,
      phone,
      address,
      deviceBrand,
      deviceModel,
      deviceImei,
      dob,
    } = req.body || {};

    // Check if all required fields are provided
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate password length
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email,
      phone: phone || null,
      dob: dob || null, 
      password: hash,
      verified: false,
      aadhaarVerified: false,
      address: address || null,
      deviceBrand: deviceBrand || null,
      deviceModel: deviceModel || null,
      deviceImei: deviceImei || null,
      // referredBy stays null here if you're using the tree placement later
    };

    // ===== referral logic (only if referralCode is sent) =====
    let referrer = null;

    if (referralCode !== undefined && referralCode !== null) {
      referralCode = String(referralCode).trim();

      // if it's an empty string, treat as "not sent"
      if (referralCode.length > 0) {
        const formattedCode = referralCode.toLowerCase().startsWith("pp")
          ? referralCode.slice(2)
          : referralCode;

        if (!formattedCode) {
          return res.status(400).json({ message: "Invalid referral code" });
        }

        // Find the referrer by referralCode (correct query)
        referrer = await User.findOne({ referralCode: formattedCode });
        if (!referrer) {
          return res.status(400).json({ message: "Invalid referral code" });
        }

        // set sponsor like /use-code does
        userData.referralUsed = referrer._id;

        // If you STILL want the old behavior too, uncomment this:
        // userData.referredBy = referrer._id;
      }
    }

    // Create user
    const user = await User.create(userData);

    // Add new user to referrer's request queue (if referral was provided & valid)
    if (referrer) {
      await User.updateOne(
        { _id: referrer._id },
        { $addToSet: { referralRequest: user._id } }
      );
    }

    return res.status(201).json({
      message: "User created",
      userId: user._id,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
});


// ====== AADHAAR OTP: SEND ======
router.post("/aadhaar/send-otp", async (req, res) => {
  try {
    const { userId, aadhaarNumber } = req.body || {};

    if (!userId || userId.length !== 24) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res
        .status(400)
        .json({ message: "Valid 12-digit Aadhaar number is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.aadhaarVerified) {
      return res
        .status(400)
        .json({ message: "Aadhaar already verified for this user" });
    }

    const accessToken = await getSandboxToken();
    
    const baseURL =
    process.env.SANDBOX_BASE_URL || "https://test-api.sandbox.co.in";
    
    console.log(accessToken, baseURL, process.env.SANDBOX_API_KEY);
    const sandboxRes = await axios.post(
      `${baseURL}/kyc/aadhaar/okyc/otp`,
      {
        "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
        aadhaar_number: aadhaarNumber,
        consent: "Y",
        reason: "User onboarding",
      },
      {
        headers: {
          Authorization: accessToken, // NOTE: token only, no "Bearer "
          "x-api-key": process.env.SANDBOX_API_KEY,
          "x-api-version": process.env.SANDBOX_API_VERSION || "1.0",
          "Content-Type": "application/json",
        },
      }
    );

    const data = sandboxRes.data;
    const referenceId = data?.data?.reference_id;

    if (!referenceId) {
      console.error("Sandbox missing reference_id:", data);
      return res
        .status(502)
        .json({ message: "Failed to generate Aadhaar OTP" });
    }

    await Code.create({
      userId: user._id,
      code: String(referenceId),
      type: "aadhaar_otp",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    user.aadhaarNumber = aadhaarNumber;
    await user.save();

    return res.json({
      message: "OTP sent to Aadhaar registered mobile",
      referenceId,
    });
  } catch (error) {
    console.error(
      "AADHAAR SEND OTP ERROR:",
      error.response?.data || error.message || error
    );
    return res.status(500).json({ message: "Server error" });
  }
});


// ====== AADHAAR OTP: VERIFY ======
router.post("/aadhaar/verify-otp", async (req, res) => {
  try {
    const { userId, otp } = req.body || {};

    if (!userId || userId.length !== 24 || !otp) {
      return res
        .status(400)
        .json({ message: "userId and otp are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.aadhaarVerified) {
      return res
        .status(400)
        .json({ message: "Aadhaar already verified for this user" });
    }

    const record = await Code.findOne({
      userId,
      type: "aadhaar_otp",
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({
        message: "No Aadhaar OTP session found. Please resend OTP.",
      });
    }

    if (record.expiresAt < new Date()) {
      await Code.deleteMany({ userId, type: "aadhaar_otp" });
      return res.status(400).json({ message: "OTP session expired" });
    }

    const referenceId = record.code;
    const accessToken = await getSandboxToken();
    const baseURL =
      process.env.SANDBOX_BASE_URL || "https://test-api.sandbox.co.in";

const sandboxRes = await axios.post(
  `${baseURL}/kyc/aadhaar/okyc/otp/verify`,
  {
    "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
    reference_id: referenceId,        // string from Generate OTP response
    otp: String(otp),                 // ensure it's a string
  },
  {
    headers: {
      Authorization: accessToken,
      "x-api-key": process.env.SANDBOX_API_KEY,
      "x-api-version": process.env.SANDBOX_API_VERSION || "1.0",
      "Content-Type": "application/json",
    },
  }
);

    const data = sandboxRes.data;
    const kyc = data?.data;

    if (!kyc || kyc.status !== "VALID") {
      return res.status(400).json({
        message:
          kyc?.message ||
          "Invalid OTP or Aadhaar could not be verified",
      });
    }

    const update = { aadhaarVerified: true };
    if (kyc.full_address && !user.address) {
      update.address = kyc.full_address;
    }

    await User.findByIdAndUpdate(userId, update);
    await Code.deleteMany({ userId, type: "aadhaar_otp" });

    return res.json({
      message: "Aadhaar verified successfully",
      aadhaarVerified: true,
      aadhaarInfo: {
        status: kyc.status,
        message: kyc.message,
        full_address: kyc.full_address,
        date_of_birth: kyc.date_of_birth,
      },
    });
  } catch (error) {
    console.error(
      "AADHAAR VERIFY OTP ERROR:",
      error.response?.data || error.message || error
    );
    return res.status(500).json({ message: "Server error" });
  }
});


// ====== EMAIL VERIFICATION ======
router.post("/send-email-verification", async (req, res) => {
  try {
    const { userId } = req.body || {};

    // Check if request has userId
    if (!userId || userId.length !== 24) return res.status(400).json({ message: "userId is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if user has email
    if (!user.email) return res.status(400).json({ message: "User does not have an email" });

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Save code in DB
    await Code.create({
      userId: user._id,
      code,
      type: "email_verify",
      expiresAt: new Date(Date.now() + 20 * 60 * 1000) // 20 minutes
    });

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.FROM, pass: process.env.FROMPASSWORD },
    });

    // Send email
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: "Email Verification Code",
      text: `Your verification code is: ${code}`
    });

    res.json({ message: "Verification code sent" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// ====== CODE VERTIFICATION ======
router.post("/verify-code", async (req, res) => {
  try {
    const { userId, code } = req.body || {};

    if (!userId || !code || userId.length !== 24) {
      return res.status(400).json({ message: "User ID and code are required" });
    }

    const record = await Code.findOne({
      userId,
      code,
      type: "email_verify"
    });

    if (!record) return res.status(400).json({ message: "Invalid code" });

    if (record.expiresAt < new Date())
      return res.status(400).json({ message: "Code expired" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.verified) {
      return res.status(400).json({ message: "User already verified" });
    }

    // CREATE REFERAL CODE
    let refCode;
    let exists = true;

    while (exists) {
    refCode = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 chars
    exists = await User.findOne({ referralCode: refCode });
    }

    await User.findByIdAndUpdate(userId, { verified: true, referralCode: refCode });
    await Code.deleteMany({ userId, type: "email_verify" });

    res.json({ message: "Email verified successfully", referralCode:user.referralCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// ====== USER LOGIN ======
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
      return res.status(400).json({ message: "Referral and password are required" });
    }

    email = String(email).trim();

    // 1) Try normal email login
    const userByEmail = await User.findOne({ email });

    // 2) Also allow "login by referral code" using the same input field
    // If it starts with "pp" (any case), strip it
    const formattedCode = email.toLowerCase().startsWith("pp")
      ? email.slice(2)
      : email;

    const userByReferral = await User.findOne({ referralCode: formattedCode });

    if (!userByEmail && !userByReferral) {
      return res.status(400).json({ message: "User not found" });
    }

    const validUser = userByEmail || userByReferral;

    // Check if verified
    if (!validUser.verified) {
      return res.status(400).json({ message: "Please verify your email first" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, validUser.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    // Create JWT token (VALID FOR 1 DAY)
    const token = jwt.sign(
      {
        id: validUser._id,
        email: validUser.email,
        admin: validUser.role === "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } // or "24h"
    );

    return res.json({
      message: "Login successful",
      token,
      validUser: {
        id: validUser._id,
        name: validUser.name,
        email: validUser.email,
        admin: validUser.role === "admin",
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});


// ====== VERIFY JWT TOKEN ======
router.post("/verify-token", async (req, res) => {
  try {
    // Prefer Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization || "";
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.body && req.body.token) {
      // Fallback: token in body
      token = req.body.token;
    }

    if (!token) {
      return res.status(400).json({ valid: false, message: "Token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ valid: false, message: "Token expired" });
      }
      return res.status(401).json({ valid: false, message: "Invalid token" });
    }

    const user = await User.findById(decoded.id).select("_id name email admin role verified star Totalrsp aadhaarVerified referralActive");
    if (!user) {
      return res.status(404).json({ valid: false, message: "User not found" });
    }
    const levels = await getStarLevels()

    const userStars = levels.find((item) => item.lvl === user.star);
const needed = (user.referralActive && !user.aadhaarVerified)

    return res.json({
      valid: true,
      needAadhaar: needed,
      message: "Token is valid",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        admin: user.admin ?? false,
        star:userStars,
        rsp:user.Totalrsp,
        verified: user.verified,
      },
      tokenPayload: {
        id: decoded.id,
        email: decoded.email,
        admin: decoded.admin ?? false,
        iat: decoded.iat,
        exp: decoded.exp,
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ valid: false, message: "Server error" });
  }
});


// ====== ADMIN CREATION ======
router.post("/create-admin", protect, async (req, res) => {
    try {
        // Check if current user is admin
        if (!req.user.isAdmin) {
            return res.status(403).json({ message: "Access denied. Admins only." });
        }

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if email already exists
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const hash = await bcrypt.hash(password, 10);

          // CREATE REFERAL CODE
          let refCode;
          let exists = true;

          while (exists) {
          refCode = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 chars
          exists = await User.findOne({ referralCode: refCode });
          }

        const newAdmin = await User.create({
            name,
            email,
            password: hash,
            verified: true, 
            role: 'admin',
            referralCode:refCode,
        });

        res.json({
            message: "Admin created successfully",
            admin: {
                id: newAdmin._id,
                name: newAdmin.name,
                email: newAdmin.email,
                admin: true
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ====== FORGOT PASSWORD ======
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await Code.create({
      userId: user._id,
      code,
      type: "password_reset",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.FROM, pass: process.env.FROMPASSWORD },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Code",
      text: `Your password reset code is: ${code}`
    });

    res.json({ message: "Password reset code sent to email" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ====== RESET PASSWORD ======
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const record = await Code.findOne({
      userId: user._id,
      code,
      type: "password_reset"
    });

    if (!record) return res.status(400).json({ message: "Invalid code" });

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: "Code expired" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(user._id, { password: hashed });

    await Code.deleteMany({ userId: user._id, type: "password_reset" });

    res.json({ message: "Password updated successfully" });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /users/me - get current logged-in user's info
router.get("/me", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate("referredBy", "name email referralCode")
      .populate('referralUsed', "name email referralCode")
      .select(
        "name email role selfVolume leftVolume rightVolume walletBalance totalEarnings referralCode referralActive createdAt referredBy star referralUsed at_hotposition deviceModel deviceBrand deviceImei, rsp Totalrsp"
      );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const levels = await getStarLevels()

    const userStars = levels.find((item) => item.lvl === user.star);

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      selfVolume: user.selfVolume || 0,
      leftVolume: user.leftVolume || 0,
      rightVolume: user.rightVolume || 0,
      walletBalance: user.walletBalance || 0,
      totalEarnings: user.totalEarnings || 0,
      referralCode: user.referralCode || null,
      referralActive: user.referralActive || false,
      deviceBrand: user.deviceBrand,
      deviceModel: user.deviceModel,
      deviceImei: user.deviceImei,
      rsp: user.rsp,
      Totalrsp: user.Totalrsp,
      createdAt: user.createdAt,
      // referredBy info (if any)
      referredBy: user.referredBy
        ? {
            id: user.referredBy._id,
            name: user.referredBy.name,
            email: user.referredBy.email,
            referralCode: user.referredBy.referralCode || null,
          }
        : null,
      availableChecks: user.availableChecks || 0, // optional, if you add to schema or compute
      star: user.star || 1,
      starInfo:userStars,
      referralUsed:user.referralUsed
        ? {
            id: user.referralUsed._id,
            name: user.referralUsed.name,
            email: user.referralUsed.email,
            referralCode: user.referralUsed.referralCode || null,
          }
        : null, 
      at_hotposition:user.at_hotposition || false
    });
  } catch (err) {
    console.error("Error fetching user info:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ====== USE REFERRAL CODE ======
router.post("/use-code", protect, async (req, res) => {
  try {
    let { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ message: "Referral code required" });
    }

        // normalize input
    referralCode = String(referralCode).trim();
    
    // if referralCode starts with "pp" (any case), remove it; else use as-is
    const formattedCode = referralCode.toLowerCase().startsWith("pp")
      ? referralCode.slice(2)
      : referralCode;

    if (!formattedCode) {
      return res.status(400).json({ message: "Invalid referral code" });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // normalize own code too (recommended)
const userOwnCode = String(user.referralCode || "").trim();
const userOwnFormatted = userOwnCode.toLowerCase().startsWith("pp")
  ? userOwnCode.slice(2)
  : userOwnCode;

    // Can't use own code
    if (userOwnFormatted && userOwnFormatted === formattedCode) {
      return res.status(400).json({ message: "Cannot use your own referral code" });
    }

    // Find the referrer by referralCode
    const referrer = await User.findOne({ referralCode: formattedCode });

    if (!referrer) {
      return res.status(400).json({ message: "Invalid referral code" });
    }

    const previousSponsorId = user.referralUsed;

    // If user already had a sponsor and it's the same as the new one
    if (
      previousSponsorId &&
      previousSponsorId.toString() === referrer._id.toString()
    ) {
      // Just ensure they are in the referrer's request list (no duplicates)
      const alreadyRequested = (referrer.referralRequest || []).some(
        (id) => id.toString() === user._id.toString()
      );

      if (!alreadyRequested) {
        referrer.referralRequest.push(user._id);
        await referrer.save();
      }

      return res.json({
        message: "Referral code accepted. Sponsor unchanged.",
      });
    }

    // If user had a previous sponsor, remove them from that sponsor's request list
    if (previousSponsorId) {
      const previousSponsor = await User.findById(previousSponsorId);

      if (previousSponsor) {
        previousSponsor.referralRequest =
          (previousSponsor.referralRequest || []).filter(
            (id) => id.toString() !== user._id.toString()
          );
        await previousSponsor.save();
      }
    }

    // Set new sponsor
    user.referralUsed = referrer._id;
    // NOTE: referredBy stays null here, will be set when placed in the tree
    await user.save();

    // Add this user into the new referrer's request queue (if not already there)
    const alreadyRequestedNew = (referrer.referralRequest || []).some(
      (id) => id.toString() === user._id.toString()
    );

    if (!alreadyRequestedNew) {
      referrer.referralRequest.push(user._id);
      await referrer.save();
    }

    return res.json({
      message: previousSponsorId
        ? "Referral code accepted. Sponsor updated."
        : "Referral code accepted. User added to sponsor's placement queue.",
    });
  } catch (err) {
    console.error("Error in /use-code:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// GET /users/requests
// Returns info about users currently in the logged-in user's referralRequest list
router.get("/requests", protect, async (req, res) => {
  try {
    const actingUserId = req.user.id;

    // Fetch the current user with their referralRequest list
    const actingUser = await User.findById(actingUserId).select("referralRequest");

    if (!actingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const requestIds = actingUser.referralRequest || [];

    if (requestIds.length === 0) {
      return res.json({
        total: 0,
        requests: [],
      });
    }

    // Fetch all users in referralRequest
    const pendingUsers = await User.find({
      _id: { $in: requestIds },
    }).select("_id name email selfVolume referralActive createdAt");

    // Preserve the same order as in referralRequest array
    const mapById = new Map(
      pendingUsers.map((u) => [u._id.toString(), u])
    );

    const orderedUsers = requestIds
      .map((id) => mapById.get(id.toString()))
      .filter(Boolean);

    return res.json({
      total: orderedUsers.length,
      requests: orderedUsers.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        selfVolume: u.selfVolume || 0,
        referralActive: !!u.referralActive,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    console.error("Error fetching referral requests:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// ====== JOIN REFERRAL PROGRAM (DEPRECATED) ======
router.post("/join-referral-program", protect, async (req, res) => {
  return res.status(410).json({
    message:
      "This endpoint is deprecated. Referral program participation and placement are now handled via the new placement flow.",
  });
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.referralActive) {
      return res.status(400).json({ message: "Already in referral program" });
    }

    if (user.selfVolume < 5) {
      return res.status(400).json({ message: "Not enough UV to join program" });
    }

    if (user.referredBy) {
      const referrer = await User.findById(user.referredBy);
      if (referrer) {
        await placeInReferralTree(user, referrer);
      }
    }

    user.referralActive = true;
    await user.save();

    res.json({ message: "Joined referral program successfully" });

  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
