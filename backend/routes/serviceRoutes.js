import express from "express";
import Service from "../models/Service.js";
import { protect } from "../middleware/authMiddleware.js";
import Purchase from "../models/Purchase.js";
import User from "../models/User.js";
import { updateReferralVolumes } from "../lib/referralVolumeLogic.js";

const router = express.Router();

/**
 * @route   POST /api/service/create
 * @desc    Create a new service (Admin only)
 */
router.post("/create", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { name, description, price, uv, validityDays } = req.body;

    if (!name || !price || !uv || !validityDays) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const service = await Service.create({
      name,
      description,
      price,
      uv,
      validityDays,
    });

    res.json({ message: "Service created", service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/service
 * @desc    Get all ACTIVE services (public)
 */
router.get("/", async (req, res) => {
  try {
    const services = await Service.find({ isActive: true }).sort({
      createdAt: -1,
    });
    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/service/all
 * @desc    Get all services including inactive (Admin only)
 */
router.get("/all", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const services = await Service.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/service/:id
 * @desc    Get a single service by id
 *          - Public can only see active services
 *          - Admin can see any service
 */
router.get("/:id", protect, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Non-admins can only see active services
    if (!service.isActive && !req.user.isAdmin) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json(service);
  } catch (error) {
    console.error(error);
    // Handle invalid ObjectId
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   PUT /api/service/:id
 * @desc    Update a service (Admin only)
 */
router.put("/:id", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { name, description, price, uv, validityDays, isActive } = req.body;

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    if (name !== undefined) service.name = name;
    if (description !== undefined) service.description = description;
    if (price !== undefined) service.price = price;
    if (uv !== undefined) service.uv = uv;
    if (validityDays !== undefined) service.validityDays = validityDays;
    if (isActive !== undefined) service.isActive = isActive;

    const updatedService = await service.save();

    res.json({ message: "Service updated", service: updatedService });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   PATCH /api/service/:id/activate
 * @desc    Activate a service (Admin only)
 */
router.patch("/:id/activate", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    service.isActive = true;
    await service.save();

    res.json({ message: "Service activated", service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   PATCH /api/service/:id/deactivate
 * @desc    Deactivate a service (Admin only, soft delete)
 */
router.patch("/:id/deactivate", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    service.isActive = false;
    await service.save();

    res.json({ message: "Service deactivated", service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   DELETE /api/service/:id
 * @desc    Permanently delete a service (Admin only)
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    await service.deleteOne();

    res.json({ message: "Service deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/service/create-purchase
 * @desc    Create a purchase for a service (Admin only)
 */
router.post("/create-purchase", protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Admin only" });
    }

    const { userId, serviceId } = req.body;

    if (!userId || !serviceId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const service = await Service.findById(serviceId);
    if (!service) return res.status(400).json({ message: "Service not found" });

    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    const purchase = await Purchase.create({
      userId,
      serviceId,
      amountPaid: service.price,
      uvEarned: service.uv,
      status: "completed",
    });

    user.selfVolume += service.uv;
    await user.save();

        // 2) Update left/right volumes of uplines recursively
    await updateReferralVolumes(user._id, service.uv);

    res.json({ message: "Purchase added", purchase });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



/**
 * @route   GET /api/service/purchases/me
 * @desc    Get purchases of the logged in user
 * @access  Private
 */
router.get("/purchases/me", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const purchases = await Purchase.find({ userId })
      .populate("serviceId", "name description price uv validityDays")
      .sort({ createdAt: -1 });

    res.json(purchases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/service/user/:userId/purchases
 * @desc    Get purchases of a specific user
 * @access  Private (same user or Admin)
 */
router.get("/user/:userId/purchases", protect, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only admin or the user themselves can view
    if (!req.user.isAdmin && req.user.id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const purchases = await Purchase.find({ userId })
      .populate("serviceId", "name description price uv validityDays")
      .sort({ createdAt: -1 });

    res.json(purchases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
