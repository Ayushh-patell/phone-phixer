// utils/updateReferralRSP.js (or wherever you keep helpers)
import User from "../models/User.js";
import { getSettingValue } from "../routes/universalSettingsRoutes.js";

/**
 * Propagate RSP up the referral (placement parent) chain for up to 5 levels
 * INCLUDING the starting user.
 *
 * Rule:
 * - For each visited user:
 *   - if user.Totalrsp > group_min_rsp => add rspToAdd to user.rsp and user.Totalrsp
 *   - else => don't add, but continue upwards
 *
 * Notes:
 * - Uses cycle protection
 * - Stops if chain ends
 */
export const updateReferralRSP = async (startingUserId, rspToAdd) => {
  if (!startingUserId) return;

  const rspNum = Number(rspToAdd);
  if (!Number.isFinite(rspNum) || rspNum <= 0) return;

  const groupMinRspSetting = await getSettingValue("group_min_rsp", 600);
  const groupMinRsp = Number(groupMinRspSetting);
  const safeGroupMinRsp = Number.isFinite(groupMinRsp) ? groupMinRsp : 0;

  const visited = new Set();

  let currentUserId = startingUserId;
  let level = 0;

  // 5 levels INCLUDING current user
  while (currentUserId && level < 5) {
    const key = currentUserId.toString();
    if (visited.has(key)) {
      console.warn("Detected cycle in referral chain, stopping RSP propagation.");
      break;
    }
    visited.add(key);

    // Fetch current user in the chain
    const currentUser = await User.findById(currentUserId).select(
      "_id referredBy rsp Totalrsp"
    );

    if (!currentUser) break;

    const totalRspNow = Number(currentUser.Totalrsp || 0);

    // IMPORTANT: strictly "more than" (>) as you asked
    if (totalRspNow > safeGroupMinRsp) {
      // Use atomic inc to reduce race issues
      await User.updateOne(
        { _id: currentUser._id },
        { $inc: { rsp: rspNum, Totalrsp: rspNum } }
      );
    }

    // Move up
    currentUserId = currentUser.referredBy;
    level += 1;
  }
};
