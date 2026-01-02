// routes/referralRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import TreeNode from "../models/TreeNode.js";
import { applyVolumeForNewChildPlacement } from "../lib/PlacementLogic.js";
import { getSettingValue } from "./universalSettingsRoutes.js";

const router = express.Router();

const MAX_TREE_NODES = 10000;

/**
 * Check if targetUserId is inside treeOwnerId's tree.
 * In TreeNode world, this is simply existence of a node in that treeOwner's tree.
 * Root is allowed by id equality (tree owner is always in their own tree).
 */
async function isUserInTree(treeOwnerId, targetUserId) {
  if (!treeOwnerId || !targetUserId) return false;

  const ownerStr = treeOwnerId.toString();
  const targetStr = targetUserId.toString();

  if (ownerStr === targetStr) return true;

  // side L/R indicates actual placement under someone.
  // (If you ever insert root nodes, you can expand side condition.)
  const exists = await TreeNode.exists({
    treeOwner: treeOwnerId,
    user: targetUserId,
    side: { $in: ["L", "R"] },
  });

  return !!exists;
}

/**
 * FETCH TREE
 *
 * Query:
 *   - treeOwnerId (optional): whose tree to fetch. default = auth user
 *   - rootUserId (optional legacy): treated as treeOwnerId if treeOwnerId not provided
 *
 * Authorization:
 *   - Admin: can fetch any tree
 *   - Non-admin:
 *       - can fetch own tree
 *       - can fetch another user's tree ONLY if that user is in their tree
 */
router.get("/tree", protect, async (req, res) => {
  try {
    const authUserId = req.user.id.toString();

    // Backward-compatible: if caller sends ?rootUserId, treat it as "treeOwnerId"
    const { treeOwnerId, rootUserId } = req.query;
    const effectiveTreeOwnerId = (treeOwnerId || rootUserId || authUserId).toString();

    // Authorization rule requested:
    // user can fetch someone else's tree only if that someone is in user's tree (unless admin)
    if (!req.user.isAdmin && effectiveTreeOwnerId !== authUserId) {
      const allowed = await isUserInTree(authUserId, effectiveTreeOwnerId);
      if (!allowed) {
        return res.status(403).json({ message: "Not authorized" });
      }
    }

    const USER_SELECT_FIELDS =
      "_id name email selfVolume leftVolume rightVolume createdAt";

    // Root user of that tree is the treeOwner themselves
    const rootUser = await User.findById(effectiveTreeOwnerId).select(USER_SELECT_FIELDS);

    if (!rootUser) {
      return res.status(404).json({ message: "Tree owner not found" });
    }

    // BFS over TreeNode edges scoped by treeOwner
    const visited = new Set();
    const nodes = [];

    // nodeMeta: userIdStr -> { parentId, side, level, at_hotposition }
    const nodeMeta = new Map();
    nodeMeta.set(rootUser._id.toString(), {
      parentId: null,
      side: "root",
      level: 0,
      at_hotposition: false,
    });

    let currentLevelIds = [rootUser._id];
    visited.add(rootUser._id.toString());

    let reachedLimit = false;

    while (currentLevelIds.length > 0) {
      // Fetch user docs for this level
      const levelUsers = await User.find({ _id: { $in: currentLevelIds } }).select(
        USER_SELECT_FIELDS
      );

      const userById = new Map(levelUsers.map((u) => [u._id.toString(), u]));

      // Fetch children edges for these parents (L/R only)
      const childEdges = await TreeNode.find({
        treeOwner: effectiveTreeOwnerId,
        parentUser: { $in: currentLevelIds },
        side: { $in: ["L", "R"] },
      })
        .select("parentUser user side level at_hotposition")
        .lean();

      // Build children map: parentIdStr -> { L: childIdStr, R: childIdStr }
      const childrenMap = new Map();
      for (const edge of childEdges) {
        const p = edge.parentUser?.toString();
        const c = edge.user?.toString();
        if (!p || !c) continue;

        if (!childrenMap.has(p)) childrenMap.set(p, { L: null, R: null });
        const slot = childrenMap.get(p);
        slot[edge.side] = c;

        // Save meta for child (so we can output parent/side/level)
        if (!nodeMeta.has(c)) {
          nodeMeta.set(c, {
            parentId: p,
            side: edge.side,
            level: edge.level ?? null,
            at_hotposition: !!edge.at_hotposition,
          });
        }
      }

      const nextLevelSet = new Set();

      // Preserve BFS order by iterating currentLevelIds (not levelUsers)
      for (const id of currentLevelIds) {
        const idStr = id.toString();
        const u = userById.get(idStr);
        if (!u) continue;

        const meta = nodeMeta.get(idStr) || {
          parentId: null,
          side: "root",
          level: 0,
          at_hotposition: false,
        };

        const kids = childrenMap.get(idStr) || { L: null, R: null };

        nodes.push({
          id: u._id,
          name: u.name,
          email: u.email,
          parentId: meta.parentId,
          leftChildId: kids.L,
          rightChildId: kids.R,
          side: meta.side, // "root" | "L" | "R"
          level: meta.level,
          at_hotposition: meta.at_hotposition,
          selfVolume: u.selfVolume || 0,
          leftVolume: u.leftVolume || 0,
          rightVolume: u.rightVolume || 0,
          createdAt: u.createdAt,
        });

        if (nodes.length >= MAX_TREE_NODES) {
          reachedLimit = true;
          break;
        }

        // Add children to next level in BFS
        for (const childIdStr of [kids.L, kids.R]) {
          if (!childIdStr) continue;
          if (!visited.has(childIdStr)) {
            visited.add(childIdStr);
            nextLevelSet.add(childIdStr);
          }
        }
      }

      if (reachedLimit) break;

      currentLevelIds = Array.from(nextLevelSet);
    }

    return res.json({
      treeOwnerId: effectiveTreeOwnerId,
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

/**
 * PLACE CHILD IN TREE (MANUAL PLACEMENT, WITH HOT POSITION)
 * body: { parentId, childId, position: "left" | "right", is_hotposition?: boolean }
 *
 * New behavior:
 *  - Inserts TreeNode { treeOwner: actingUserId, user: childId, parentUser: parentId, side: "L"|"R" }
 *  - Removes child from actingUser.referralRequest
 *  - Updates child's placementCache (optional)
 *  - Does NOT touch User.leftChild/rightChild/referredBy (they don't exist anymore)
 */
router.post("/place", protect, async (req, res) => {
  try {
    const { parentId, childId, position, is_hotposition } = req.body || {};
    const actingUserId = req.user.id;

    if (!parentId || !childId || !position) {
      return res
        .status(400)
        .json({ message: "parentId, childId and position are required" });
    }

    if (parentId === childId) {
      return res
        .status(400)
        .json({ message: "Parent and child cannot be the same user" });
    }

    const normalizedPos = String(position).toLowerCase();
    if (!["left", "right"].includes(normalizedPos)) {
      return res
        .status(400)
        .json({ message: "position must be 'left' or 'right'" });
    }

    const side = normalizedPos === "left" ? "L" : "R";

    const isHotPosition =
      typeof is_hotposition === "string"
        ? is_hotposition === "true"
        : !!is_hotposition;

    // Load only what we need
    const [actingUser, parent, child] = await Promise.all([
      User.findById(actingUserId).select("_id referralRequest"),
      User.findById(parentId).select("_id"),
      User.findById(childId).select("_id selfVolume referralUsed"),
    ]);

    if (!actingUser) return res.status(400).json({ message: "Acting user not found" });
    if (!parent) return res.status(400).json({ message: "Parent user not found" });
    if (!child) return res.status(400).json({ message: "Child user not found" });

    // 1) Child must be in actingUser.referralRequest
    const inRequests = (actingUser.referralRequest || []).some(
      (id) => id.toString() === child._id.toString()
    );
    if (!inRequests) {
      return res.status(403).json({
        message:
          "You do not have permission to place this user (not in your referral requests).",
      });
    }

    // Optional but strongly recommended consistency check:
    // the child should have used actingUser's referral code as sponsor
    if (!child.referralUsed || child.referralUsed.toString() !== actingUserId.toString()) {
      return res.status(400).json({
        message: "Child is not sponsored by you (referralUsed mismatch).",
      });
    }

    // 2) Parent must be within actingUser's tree (or actingUser themselves)
    const parentIsAllowed =
      parent._id.toString() === actingUserId.toString() ||
      (await isUserInTree(actingUserId, parent._id));

    if (!parentIsAllowed) {
      return res.status(403).json({
        message:
          "Selected parent is not part of your referral tree. Placement not allowed.",
      });
    }

    // 3) Child must not already be placed in actingUser's tree
    const alreadyPlacedHere = await TreeNode.exists({
      treeOwner: actingUserId,
      user: child._id,
      side: { $in: ["L", "R"] },
    });

    if (alreadyPlacedHere) {
      return res.status(400).json({ message: "Child is already placed in your tree" });
    }

    // 4) Requested slot must be free in actingUser's tree
    const slotOccupied = await TreeNode.exists({
      treeOwner: actingUserId,
      parentUser: parent._id,
      side,
    });

    if (slotOccupied) {
      return res.status(400).json({
        message:
          side === "L"
            ? "Parent's left position is already occupied"
            : "Parent's right position is already occupied",
      });
    }

    // 5) Eligibility: normal vs hot-position
    if (isHotPosition) {
      const hotpositionMinUv = await getSettingValue("hotposition_min_uv", 2);
      const childSelfVolume = child.selfVolume || 0;

      if (childSelfVolume < hotpositionMinUv) {
        return res.status(400).json({
          message: `Hot position placement requires the child to have at least ${hotpositionMinUv} self UV.`,
        });
      }
    }

    // 6) Compute level (optional; depends if you rely on level in UI)
    // If parent is root (actingUser), level = 1.
    // Otherwise read parent's TreeNode.level
    let level = 1;
    if (parent._id.toString() !== actingUserId.toString()) {
      const parentNode = await TreeNode.findOne({
        treeOwner: actingUserId,
        user: parent._id,
      })
        .select("level")
        .lean();

      level = (parentNode?.level ?? 0) + 1;
    }

    // 7) Insert placement node into actingUser's tree
    // Unique indexes in TreeNode will also protect against duplicates.
    try {
      await TreeNode.create({
        treeOwner: actingUserId,
        user: child._id,
        parentUser: parent._id,
        side,
        level,
        at_hotposition: isHotPosition,
      });
    } catch (e) {
      // E11000 means slot/user already exists due to race condition
      if (e?.code === 11000) {
        return res.status(409).json({
          message: "Placement conflict: slot already filled or user already placed.",
        });
      }
      throw e;
    }

    // 8) Remove child from referralRequest queue
    await User.updateOne(
      { _id: actingUserId },
      { $pull: { referralRequest: child._id } }
    );

    // 9) Update placementCache (optional, but helps UI)
    await User.updateOne(
      { _id: child._id },
      {
        $set: {
          placementCache: {
            treeOwner: actingUserId,
            parentUser: parent._id,
            side,
            level,
          },
        },
      }
    );

    // 10) Volume update (NOTE)
    // Your existing function likely uses old leftChild/rightChild/referredBy.
    // Keep the call but you MUST update the function internals to traverse via TreeNode.
    // Passing actingUserId as 4th arg lets you update it without changing routes later.
    await applyVolumeForNewChildPlacement(parent._id, child._id, normalizedPos, actingUserId);

    return res.json({
      message: "User placed successfully in the referral tree",
      placement: {
        treeOwnerId: actingUserId,
        parentId: parent._id,
        childId: child._id,
        position: normalizedPos,
        side,
        level,
        is_hotposition: isHotPosition,
      },
    });
  } catch (err) {
    console.error("Error placing user in tree:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
