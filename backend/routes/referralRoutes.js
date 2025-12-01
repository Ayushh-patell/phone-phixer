// routes/referralRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

const MAX_TREE_NODES = 10000;

router.get("/tree", protect, async (req, res) => {
  try {
    const { rootUserId } = req.query;

    const authUserId = req.user.id.toString();
    const effectiveRootUserId = rootUserId || authUserId;

    if (!req.user.isAdmin && effectiveRootUserId !== authUserId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const USER_SELECT_FIELDS =
      "_id name email referredBy leftChild rightChild selfVolume leftVolume rightVolume createdAt";

    const rootUser = await User.findById(effectiveRootUserId).select(
      USER_SELECT_FIELDS
    );

    if (!rootUser) {
      return res.status(404).json({ message: "Root user not found" });
    }

    const visited = new Set();
    const nodes = [];

    let currentLevelIds = [rootUser._id];
    visited.add(rootUser._id.toString());

    let reachedLimit = false;

    while (currentLevelIds.length > 0) {
      const levelUsers = await User.find({
        _id: { $in: currentLevelIds },
      }).select(USER_SELECT_FIELDS);

      const nextLevelIdSet = new Set();

      for (const user of levelUsers) {
        nodes.push({
          id: user._id,
          name: user.name,
          email: user.email,
          parentId: user.referredBy ? user.referredBy.toString() : null,
          leftChildId: user.leftChild ? user.leftChild.toString() : null,
          rightChildId: user.rightChild ? user.rightChild.toString() : null,
          selfVolume: user.selfVolume || 0,
          leftVolume: user.leftVolume || 0,
          rightVolume: user.rightVolume || 0,
          createdAt: user.createdAt,
        });

        if (nodes.length >= MAX_TREE_NODES) {
          reachedLimit = true;
          break;
        }

        const children = [];
        if (user.leftChild) children.push(user.leftChild.toString());
        if (user.rightChild) children.push(user.rightChild.toString());

        for (const childId of children) {
          if (!visited.has(childId)) {
            visited.add(childId);
            nextLevelIdSet.add(childId);
          }
        }
      }

      if (reachedLimit) {
        break;
      }

      currentLevelIds = Array.from(nextLevelIdSet);
    }

    return res.json({
      rootUserId: effectiveRootUserId,
      totalNodes: nodes.length,
      maxNodes: MAX_TREE_NODES,
      truncated: reachedLimit,
      nodes,
    });
  } catch (err) {
    console.error("Error fetching referral tree:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
