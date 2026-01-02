// lib/referralVolumeLogic.js
import User from "../models/User.js";
import TreeNode from "../models/TreeNode.js";

// Helper: propagate volume up the sponsor's placement tree (TreeNode-based)
// Supports positive UV (purchase) and negative UV (refund)
export const updateReferralVolumes = async (startingUserId, uv, treeOwnerOverride = null) => {
  const uvNum = Number(uv);
  if (!startingUserId || !Number.isFinite(uvNum) || uvNum === 0) return;

  // Determine which tree to traverse:
  // - prefer snapshot/override (for refunds)
  // - fallback to current referralUsed
  let treeOwnerId = treeOwnerOverride;

  if (!treeOwnerId) {
    const startingUser = await User.findById(startingUserId).select("_id referralUsed");
    if (!startingUser || !startingUser.referralUsed) return;
    treeOwnerId = startingUser.referralUsed;
  }

  // Find starting user's placement inside treeOwner's tree
  const startNode = await TreeNode.findOne({
    treeOwner: treeOwnerId,
    user: startingUserId,
    side: { $in: ["L", "R"] },
  })
    .select("parentUser side")
    .lean();

  if (!startNode || !startNode.parentUser) return; // not placed yet => no uplines to update

  // Safety: prevent infinite loops in case of bad data
  const visited = new Set();

  // Move upward in THIS treeOwner only
  let currentParentId = startNode.parentUser; // upline receiving volume
  let sideToApply = startNode.side;           // "L" or "R" relative to currentParent

  while (currentParentId) {
    const parentKey = currentParentId.toString();
    if (visited.has(parentKey)) {
      console.warn("Detected cycle in TreeNode chain, stopping volume update.");
      break;
    }
    visited.add(parentKey);

    // Read parent's TreeNode in this tree to apply hotposition + go further up
    const parentNode = await TreeNode.findOne({
      treeOwner: treeOwnerId,
      user: currentParentId,
    })
      .select("parentUser side at_hotposition")
      .lean();

    // If missing node, stop (unless you intentionally don't store root nodes)
    if (!parentNode && currentParentId.toString() !== treeOwnerId.toString()) {
      console.warn(
        `Missing TreeNode for parent ${currentParentId} in treeOwner ${treeOwnerId}. Stopping.`
      );
      break;
    }

    const isHot = !!parentNode?.at_hotposition;
    const volumeToAdd = isHot ? uvNum / 2 : uvNum; // works for negative too

    if (sideToApply === "L") {
      await User.updateOne(
        { _id: currentParentId },
        { $inc: { leftVolume: volumeToAdd } }
      );
    } else if (sideToApply === "R") {
      await User.updateOne(
        { _id: currentParentId },
        { $inc: { rightVolume: volumeToAdd } }
      );
    } else {
      console.warn(`Invalid TreeNode.side '${sideToApply}' while propagating volume.`);
      break;
    }

    const nextParentId = parentNode?.parentUser || null;
    const parentSideUnderNext = parentNode?.side || null; // parent's side under its own parent

    if (!nextParentId) break; // reached root
    if (parentSideUnderNext !== "L" && parentSideUnderNext !== "R") break;

    sideToApply = parentSideUnderNext;
    currentParentId = nextParentId;
  }
};
