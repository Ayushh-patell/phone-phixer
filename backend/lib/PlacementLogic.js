// lib/PlacementLogic.js
import User from "../models/User.js";
import TreeNode from "../models/TreeNode.js";

/**
 * Compute total volume for a user's subtree:
 * selfVolume + leftVolume + rightVolume
 *
 * Assumes leftVolume/rightVolume already maintained elsewhere.
 */
const computeSubtreeVolume = (user) => {
  const self = user.selfVolume || 0;
  const left = user.leftVolume || 0;
  const right = user.rightVolume || 0;
  return self + left + right;
};

const normalizePos = (position) => {
  const p = String(position).toLowerCase();
  if (p === "left" || p === "l") return "left";
  if (p === "right" || p === "r") return "right";
  throw new Error(`Invalid position '${position}'`);
};

const nodeSideToPos = (nodeSide) => {
  if (nodeSide === "L") return "left";
  if (nodeSide === "R") return "right";
  return null; // "root" or invalid
};

/**
 * Updates volumes up the tree (TreeNode based).
 *
 * Hotposition logic (per-ancestor, per-tree):
 *  - At each ancestor in THIS treeOwner's tree:
 *      if ancestor's TreeNode.at_hotposition === true -> receives uv/2
 *      else -> receives full uv
 *  - uv itself is NOT mutated as we go up.
 *
 * IMPORTANT:
 *  - This must traverse ONLY inside the given treeOwnerId's TreeNode graph.
 *
 * @param {String|ObjectId} treeOwnerId - The owner of the tree we are updating
 * @param {String|ObjectId} startParentId - The immediate parent where child was attached
 * @param {Number} uv - base UV to propagate (child's subtree total)
 * @param {"left"|"right"} side - which side to increment on the startParent
 */
export const updateVolumes = async (treeOwnerId, startParentId, uv, side) => {
  if (!treeOwnerId) throw new Error("updateVolumes: treeOwnerId is required");
  if (!startParentId) throw new Error("updateVolumes: startParentId is required");
  if (!uv || uv === 0) return;

  const normalizedSide = normalizePos(side);

  // Safety limit to avoid infinite loops if data is corrupted
  const MAX_HOPS = 500;

  let currentParentId = startParentId;
  let currentSide = normalizedSide; // side relative to currentParent

  for (let hops = 0; hops < MAX_HOPS; hops++) {
    // Find this parent node in THIS tree (needed for at_hotposition + to go upward)
    const currentParentNode = await TreeNode.findOne({
      treeOwner: treeOwnerId,
      user: currentParentId,
    })
      .select("parentUser side at_hotposition")
      .lean();

    // If parent isn't represented in this tree, we can't safely traverse further
    if (!currentParentNode) {
      break;
    }

    // Apply hotposition per ancestor (from TreeNode, not User)
    const isHot = !!currentParentNode.at_hotposition;
    const volumeToAdd = isHot ? uv / 2 : uv;

    // Apply volume to the User document
    if (currentSide === "left") {
      await User.updateOne(
        { _id: currentParentId },
        { $inc: { leftVolume: volumeToAdd } }
      );
    } else if (currentSide === "right") {
      await User.updateOne(
        { _id: currentParentId },
        { $inc: { rightVolume: volumeToAdd } }
      );
    } else {
      throw new Error(`updateVolumes: invalid side '${currentSide}'`);
    }

    // Move up to grandparent inside the SAME treeOwner
    const grandParentId = currentParentNode.parentUser;

    // If no grandparent -> reached root
    if (!grandParentId) {
      break;
    }

    // Determine which side this parent occupies under grandparent
    // This is stored on the parent's node as L/R (relative to its parent)
    const parentSideUnderGrand = nodeSideToPos(currentParentNode.side);
    if (!parentSideUnderGrand) {
      // "root" or invalid side -> stop
      break;
    }

    currentParentId = grandParentId;
    currentSide = parentSideUnderGrand;
  }
};

/**
 * Call AFTER inserting TreeNode for child under parent in a given treeOwner's tree.
 *
 * It:
 *  - loads parent + child fresh
 *  - computes child's total subtree volume
 *  - calls updateVolumes(treeOwnerId, parentId, uv, position)
 *
 * @param {String|ObjectId} parentId
 * @param {String|ObjectId} childId
 * @param {"left"|"right"} position
 * @param {String|ObjectId} treeOwnerId - REQUIRED in TreeNode setup
 */
export const applyVolumeForNewChildPlacement = async (
  parentId,
  childId,
  position,
  treeOwnerId
) => {
  if (!treeOwnerId) {
    throw new Error(
      "applyVolumeForNewChildPlacement: treeOwnerId is required in TreeNode setup"
    );
  }

  const parent = await User.findById(parentId).select("_id");
  const child = await User.findById(childId).select(
    "_id selfVolume leftVolume rightVolume"
  );

  if (!parent || !child) {
    throw new Error("applyVolumeForNewChildPlacement: parent or child not found");
  }

  const normalizedPos = normalizePos(position);

  // Child subtree total UV (ancestor hotposition applied inside updateVolumes)
  const uv = computeSubtreeVolume(child);

  if (uv === 0) return;

  await updateVolumes(treeOwnerId, parent._id, uv, normalizedPos);
};

/**
 * DEPRECATED:
 * Old auto-placement helper. Kept here only to avoid import crashes.
 * Do NOT use in new code – use manual placement + applyVolumeForNewChildPlacement.
 */
export const placeInReferralTree = async () => {
  throw new Error(
    "placeInReferralTree is deprecated. Use manual placement + applyVolumeForNewChildPlacement instead."
  );
};
