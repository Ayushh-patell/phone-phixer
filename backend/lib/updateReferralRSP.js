import User from "../models/User.js";
import TreeNode from "../models/TreeNode.js";
import { getSettingValue } from "../routes/universalSettingsRoutes.js";

/**
 * Propagate RSP up the placement chain (within sponsor's tree) for up to 5 levels
 * INCLUDING the starting user.
 *
 * Rule:
 * - For each visited user:
 *   - if user.Totalrsp > group_min_rsp => add rspToAdd to user.rsp and user.Totalrsp
 *   - else => don't add, but continue upwards
 *
 * Traversal:
 * - Uses TreeNode to move upward within a single treeOwner (= startingUser.referralUsed)
 * - Stops at root or if user not placed
 */
export const updateReferralRSP = async (startingUserId, rspToAdd) => {
  if (!startingUserId) return;

  const rspNum = Number(rspToAdd);
  if (!Number.isFinite(rspNum) || rspNum <= 0) return;

  const groupMinRspSetting = await getSettingValue("group_min_rsp", 600);
  const groupMinRsp = Number(groupMinRspSetting);
  const safeGroupMinRsp = Number.isFinite(groupMinRsp) ? groupMinRsp : 0;

  // We always process the starting user (same as your old code)
  const starter = await User.findById(startingUserId).select("_id referralUsed");
  if (!starter) return;

  const treeOwnerId = starter.referralUsed || null; // may be null if they never used a code

  const visited = new Set();
  let currentUserId = starter._id;
  let level = 0;

  while (currentUserId && level < 5) {
    const key = currentUserId.toString();
    if (visited.has(key)) {
      console.warn("Detected cycle in TreeNode chain, stopping RSP propagation.");
      break;
    }
    visited.add(key);

    const currentUser = await User.findById(currentUserId).select("_id rsp Totalrsp");
    if (!currentUser) break;

    const totalRspNow = Number(currentUser.Totalrsp || 0);

    // strictly "more than" (>) as you asked
    if (totalRspNow > safeGroupMinRsp) {
      await User.updateOne(
        { _id: currentUser._id },
        { $inc: { rsp: rspNum, Totalrsp: rspNum } }
      );
    }

    // Move up within sponsor's tree (if sponsor exists and node exists)
    if (!treeOwnerId) break;

    const node = await TreeNode.findOne({
      treeOwner: treeOwnerId,
      user: currentUserId,
    })
      .select("parentUser")
      .lean();

    if (!node || !node.parentUser) break;

    currentUserId = node.parentUser;
    level += 1;
  }
};
