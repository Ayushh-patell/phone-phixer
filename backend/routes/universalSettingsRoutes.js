// routes/universalSettingsRoutes.js
import express from "express";
import UniversalSettings from "../models/UniversalSettings.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Small helper to enforce admin
const requireAdmin = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Support both isAdmin boolean and role === 'admin'
  const isAdmin = user.isAdmin || user.role === "admin";
  if (!isAdmin) {
    return res.status(403).json({ message: "Admins only" });
  }

  return next();
};

/**
 * PUBLIC: Get all settings
 * GET /settings
 */
router.get("/", async (req, res) => {
  try {
    const settings = await UniversalSettings.find({}).select("-__v");
    return res.json(settings);
  } catch (err) {
    console.error("Error fetching universal settings:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUBLIC: Get single setting by key
 * GET /settings/:key
 */
router.get("/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const setting = await UniversalSettings.findOne({ key }).select("-__v");

    if (!setting) {
      return res.status(404).json({ message: "Setting not found" });
    }

    return res.json(setting);
  } catch (err) {
    console.error("Error fetching universal setting:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: Create/update setting by key
 * PUT /settings/:key
 * body: { value: any, description?: string }
 */
router.put("/:key", protect, requireAdmin, async (req, res) => {
  try {
    const key = req.params.key;
    const { value, description } = req.body;

    if (typeof value === "undefined") {
      return res.status(400).json({ message: "value is required" });
    }

    const update = { value };
    if (typeof description !== "undefined") {
      update.description = description;
    }

    const setting = await UniversalSettings.findOneAndUpdate(
      { key },
      { $set: update },
      {
        new: true,
        upsert: true,
      }
    ).select("-__v");

    return res.json(setting);
  } catch (err) {
    console.error("Error updating universal setting:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


/**
 * Fetch a single universal setting by key.
 * Returns defaultValue if not found or if value is undefined.
 */
export const getSettingValue = async (key, defaultValue) => {
  const doc = await UniversalSettings.findOne({ key }).lean();
  if (!doc || typeof doc.value === "undefined") {
    return defaultValue;
  }
  return doc.value;
};

export default router;
