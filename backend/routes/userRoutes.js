import express from "express";
import User from "../models/User.js";
import Code from "../models/Code.js";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import crypto from 'crypto'
import { protect } from "../middleware/authMiddleware.js";
import jwt from "jsonwebtoken"
import { placeInReferralTree } from "../lib/PlacementLogic.js";






const router = express.Router();

// ====== USER CREATION ======
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, referralCode } = req.body || {};

    // Check if all required fields are provided
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already exists" });

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email,
      password: hash,
      verified: false
    };

    // Optional referral
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        userData.referredBy = referrer._id;
      }
    }

    // Create user
    const user = await User.create(userData);

    res.status(201).json({ message: "User created", userId: user._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
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

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


// ====== USER LOGIN ======
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check required fields
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Check if verified
        if (!user.verified) {
            return res.status(400).json({ message: "Please verify your email first" });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect password" });
        }

        // Create JWT token
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                admin: user.admin ?? false,   // depends on your user schema
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                admin: user.admin ?? false,
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
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

    const user = await User.findById(decoded.id).select("_id name email admin verified");
    if (!user) {
      return res.status(404).json({ valid: false, message: "User not found" });
    }

    return res.json({
      valid: true,
      message: "Token is valid",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        admin: user.admin ?? false,
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
      .select(
        "name email role selfVolume leftVolume rightVolume walletBalance totalEarnings referralCode referralActive createdAt referredBy"
      );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

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
      // you can compute / add availableChecks here if needed
      availableChecks: user.availableChecks || 0, // optional, if you add to schema or compute
    });
  } catch (err) {
    console.error("Error fetching user info:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ====== USE REFERRAL CODE ======
router.post("/use-code", protect, async (req, res) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ message: "Referral code required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.referredBy) {
      return res.status(400).json({ message: "Referral already applied" });
    }

    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(400).json({ message: "Invalid referral code" });
    }

    if (user.referralActive) {
      await placeInReferralTree(user, referrer);

    }

    user.referredBy = referrer._id;
    await user.save();

    res.json({ message: "Referral applied successfully" });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// ====== JOIN REFERRAL PROGRAM ======
router.post("/join-referral-program", protect, async (req, res) => {
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
