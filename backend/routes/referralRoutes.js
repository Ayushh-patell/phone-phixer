// routes/referralRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import { applyVolumeForNewChildPlacement } from "../lib/PlacementLogic.js";
import { getSettingValue } from "./universalSettingsRoutes.js";


const router = express.Router();

const MAX_TREE_NODES = 10000;

// Helper: check via BFS if targetId is in rootUserId's tree
async function isUserInTree(rootUserId, targetUserId, maxNodes = MAX_TREE_NODES) {
  const rootIdStr = rootUserId.toString();
  const targetIdStr = targetUserId.toString();

  const visited = new Set([rootIdStr]);
  let currentLevelIds = [rootUserId];

  while (currentLevelIds.length > 0 && visited.size <= maxNodes) {
    const levelUsers = await User.find({
      _id: { $in: currentLevelIds },
    }).select("_id leftChild rightChild");

    const nextLevelSet = new Set();

    for (const user of levelUsers) {
      const userIdStr = user._id.toString();

      if (userIdStr === targetIdStr) {
        return true;
      }

      if (user.leftChild) {
        const leftIdStr = user.leftChild.toString();
        if (!visited.has(leftIdStr)) {
          visited.add(leftIdStr);
          nextLevelSet.add(user.leftChild);
        }
      }

      if (user.rightChild) {
        const rightIdStr = user.rightChild.toString();
        if (!visited.has(rightIdStr)) {
          visited.add(rightIdStr);
          nextLevelSet.add(user.rightChild);
        }
      }
    }

    currentLevelIds = Array.from(nextLevelSet);
  }

  return false;
}


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



// ====== PLACE CHILD IN TREE (MANUAL PLACEMENT, WITH HOT POSITION) ======
// body: { parentId, childId, position: "left" | "right", is_hotposition?: boolean }
router.post("/place", protect, async (req, res) => {
  try {
    const { parentId, childId, position, is_hotposition } = req.body || {};
    const actingUserId = req.user.id;

    if (!parentId || !childId || !position) {
      return res
        .status(400)
        .json({ message: "parentId, childId and position are required" });
    }

    const normalizedPos = String(position).toLowerCase();
    if (!["left", "right"].includes(normalizedPos)) {
      return res
        .status(400)
        .json({ message: "position must be 'left' or 'right'" });
    }

    const isHotPosition =
      typeof is_hotposition === "string"
        ? is_hotposition === "true"
        : !!is_hotposition;

    if (parentId === childId) {
      return res
        .status(400)
        .json({ message: "Parent and child cannot be the same user" });
    }

    // Load users
    const [actingUser, parent, child] = await Promise.all([
      User.findById(actingUserId),
      User.findById(parentId),
      User.findById(childId),
    ]);

    if (!actingUser) {
      return res.status(400).json({ message: "Acting user not found" });
    }
    if (!parent) {
      return res.status(400).json({ message: "Parent user not found" });
    }
    if (!child) {
      return res.status(400).json({ message: "Child user not found" });
    }

    // 1) Eligibility: normal vs hot-position
    if (!isHotPosition) {
      // Normal placement: child must already be referralActive
      if (!child.referralActive) {
        return res
          .status(400)
          .json({ message: "Child is not active in the referral program" });
      }
    } else {
      // Hot-position placement:
      // - bypass referralActive check
      // - require at least X selfVolume (from settings)
      const hotpositionMinUv = await getSettingValue("hotposition_min_uv", 2);
      const childSelfVolume = child.selfVolume || 0;

      if (childSelfVolume < hotpositionMinUv) {
        return res.status(400).json({
          message: `Hot position placement requires the child to have at least ${hotpositionMinUv} self UV.`,
        });
      }

      // IMPORTANT (based on what you said earlier):
      // In hot position, referralActive stays false.
      // So we DO NOT flip referralActive here.
      // We'll let the purchase API handle:
      //   - referralActive = true
      //   - at_hotposition = false
      // when selfVolume reaches the referralActive_limit.
      //
      // So here we ONLY control at_hotposition flag if you want:
      // child.at_hotposition = true;  // if you haven't already done this elsewhere
    }

    // 2) Child must be in actingUser.referralRequest
    const inRequests = (actingUser.referralRequest || []).some(
      (id) => id.toString() === child._id.toString()
    );
    if (!inRequests) {
      return res.status(403).json({
        message:
          "You do not have permission to place this user (not in your referral requests).",
      });
    }

    // 3) Parent must be within actingUser's tree (or the actingUser themselves)
    const parentIsInTree =
      parent._id.toString() === actingUser._id.toString() ||
      (await isUserInTree(actingUser._id, parent._id));
    if (!parentIsInTree) {
      return res.status(403).json({
        message:
          "Selected parent is not part of your referral tree. Placement not allowed.",
      });
    }

    // 4) Child must not already have a placement parent
    if (child.referredBy) {
      return res
        .status(400)
        .json({ message: "Child is already placed in the tree" });
    }

    // 5) Parent must have free slot at requested position
    if (normalizedPos === "left") {
      if (parent.leftChild) {
        return res
          .status(400)
          .json({ message: "Parent's left position is already occupied" });
      }
    } else if (normalizedPos === "right") {
      if (parent.rightChild) {
        return res
          .status(400)
          .json({ message: "Parent's right position is already occupied" });
      }
    }

    // ---- Perform placement ----
    if (normalizedPos === "left") {
      parent.leftChild = child._id;
    } else {
      parent.rightChild = child._id;
    }

    // Link parent on the child
    child.referredBy = parent._id;

    // Remove child from actingUser.referralRequest
    actingUser.referralRequest = (actingUser.referralRequest || []).filter(
      (id) => id.toString() !== child._id.toString()
    );

    // Save entities BEFORE updating volumes
    await Promise.all([parent.save(), child.save(), actingUser.save()]);

    // ---- Volume update up the tree (hotposition logic is inside applyVolumeForNewChildPlacement/updateVolumes) ----
    await applyVolumeForNewChildPlacement(parent._id, child._id, normalizedPos);

    return res.json({
      message: "User placed successfully in the referral tree",
      placement: {
        parentId: parent._id,
        childId: child._id,
        position: normalizedPos,
        is_hotposition: isHotPosition,
      },
    });
  } catch (err) {
    console.error("Error placing user in tree:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
