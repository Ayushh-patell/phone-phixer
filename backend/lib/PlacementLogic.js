// lib/PlacementLogic.js
import User from "../models/User.js";

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

/**
 * Recursively updates left/right volumes up the tree.
 *
 * Per-user hotposition logic:
 *  - At each ancestor (parent, grandparent, ...):
 *    - If that ancestor has at_hotposition === true, they receive uv / 2
 *    - Otherwise they receive full uv
 *  - The uv argument itself is NOT mutated as we go up.
 *
 * @param {Object} parent - parent user document (Mongoose)
 * @param {Number} uv - UV to add (base UV, before hotposition adjustments)
 * @param {String} side - 'left' or 'right' (which side on this parent)
 */
export const updateVolumes = async (parent, uv, side) => {
  if (!parent || !uv || uv === 0) return;

  // Apply hotposition logic PER ancestor
  let volumeToAdd = uv;
  if (parent.at_hotposition) {
    volumeToAdd = uv / 2;
  }

  if (side === "left") {
    parent.leftVolume = (parent.leftVolume || 0) + volumeToAdd;
  } else if (side === "right") {
    parent.rightVolume = (parent.rightVolume || 0) + volumeToAdd;
  } else {
    throw new Error(`updateVolumes: invalid side '${side}'`);
  }

  await parent.save();

  // Move up the tree
  if (parent.referredBy) {
    const grandParent = await User.findById(parent.referredBy);

    if (grandParent) {
      // Determine which side of grandParent this parent is on
      const parentIdStr = parent._id.toString();
      const isLeft =
        grandParent.leftChild &&
        grandParent.leftChild.toString() === parentIdStr;

      const parentSide = isLeft ? "left" : "right";

      // IMPORTANT: pass the original uv, not volumeToAdd
      // so each ancestor independently applies its own hotposition rule.
      await updateVolumes(grandParent, uv, parentSide);
    }
  }
};

/**
 * To be called AFTER you manually attach `child` under `parent`
 * at the specified position ("left" | "right").
 *
 * It:
 *  - loads parent and child fresh
 *  - computes child's total subtree volume
 *  - calls updateVolumes to propagate up the tree
 *
 * Hotposition behavior:
 *  - Any ancestor (including parent) that has at_hotposition === true
 *    will receive half of the child's subtree UV.
 *
 * @param {String|ObjectId} parentId
 * @param {String|ObjectId} childId
 * @param {"left"|"right"} position
 */
export const applyVolumeForNewChildPlacement = async (
  parentId,
  childId,
  position
) => {
  const parent = await User.findById(parentId);
  const child = await User.findById(childId);

  if (!parent || !child) {
    throw new Error("applyVolumeForNewChildPlacement: parent or child not found");
  }

  const normalizedPos = String(position).toLowerCase();
  if (!["left", "right"].includes(normalizedPos)) {
    throw new Error(
      `applyVolumeForNewChildPlacement: invalid position '${position}'`
    );
  }

  // Use full subtree volume for the child.
  // Hotposition is applied PER ancestor inside updateVolumes.
  const uv = computeSubtreeVolume(child);

  if (uv === 0) {
    // nothing to add, but not an error
    return;
  }

  await updateVolumes(parent, uv, normalizedPos);
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
