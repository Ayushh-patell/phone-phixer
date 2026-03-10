import express from "express";
import { v2 as cloudinary } from 'cloudinary'; // Fix 1: Must use .v2
import Kyc from "../models/KYC.js"; 
import User from "../models/User.js"; // Fix 2: Ensure User is imported for the verified update
import { protect } from "../middleware/authMiddleware.js"; // Ensure protect is imported

const router = express.Router();
// ph1Xerr @ cloudinary
// GET /api/kyc/sign-upload
router.get("/sign-upload", protect, async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: 'user_kyc_documents',
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY
    });
  } catch (err) {
    res.status(500).json({ message: "Sign error" });
  }
});

// At the top of your file, ensure config is initialized
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post("/submit", protect, async (req, res) => {
  try {
    const { documentType, kycFiles } = req.body;
    let kyc = await Kyc.findOne({ userId: req.user.id });

    if (kyc && kyc.status === 'verified') {
      return res.status(400).json({ message: "KYC already verified" });
    }

    if (kyc) {
      const newIds = kycFiles.map(f => f.cloudinaryId);
      const filesToDelete = kyc.kycFiles.filter(
        oldFile => !newIds.includes(oldFile.cloudinaryId)
      );
      console.log(newIds, filesToDelete);
      

      if (filesToDelete.length > 0) {
        const deletePromises = filesToDelete.map(file => {
          // --- FIX: Dynamic Resource Type ---
          let resourceType = 'image'; 
          if (file.fileType === 'video') resourceType = 'video';
          if (file.fileType === 'pdf' || file.url.endsWith('.pdf')) resourceType = 'image'; 
          // Note: If you uploaded PDF as 'raw', change 'image' to 'raw' above.
          
          return cloudinary.uploader.destroy(file.cloudinaryId, { 
            resource_type: resourceType 
          });
        });
        
        // Use allSettled so one fail doesn't crash the whole update
        await Promise.allSettled(deletePromises);
      }

      kyc.documentType = documentType;
      kyc.kycFiles = kycFiles; 
      kyc.status = 'pending';
      kyc.adminNote = ''; 
      await kyc.save();
    } else {
      kyc = await Kyc.create({
        userId: req.user.id,
        documentType,
        kycFiles,
        status: 'pending'
      });
    }

    res.status(201).json({ message: "KYC submitted successfully", kyc });
  } catch (err) {
    console.error("KYC Submit Error:", err); // This will now show the specific Cloudinary error
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

// GET /api/kyc/my-status
router.get("/my-status", protect, async (req, res) => {
  try {
    const kyc = await Kyc.findOne({ userId: req.user.id });
    if (!kyc) return res.status(404).json({ message: "No KYC record found" });
    res.json(kyc);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/kyc/admin/list
router.get("/admin/list", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: "Not authorized" });

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const filter = req.query.status ? { status: req.query.status } : {};

    const kycRequests = await Kyc.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Kyc.countDocuments(filter);

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      kycRequests,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/kyc/admin/review/:id
router.put("/admin/review/:id", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: "Not authorized" });

    const { status, adminNote } = req.body;
    const kyc = await Kyc.findById(req.params.id);
    
    if (!kyc) return res.status(404).json({ message: "KYC record not found" });

    kyc.status = status;
    kyc.adminNote = adminNote;
    kyc.reviewedBy = req.user.id;
    kyc.reviewedAt = Date.now();

    await kyc.save();

    if (status === 'verified') {
      await User.findByIdAndUpdate(kyc.userId, { kycVerified: true });
    }

    res.json({ message: `KYC updated to ${status}`, kyc });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;