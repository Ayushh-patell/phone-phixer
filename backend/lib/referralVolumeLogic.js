import User from "../models/User.js";

// Helper: propagate volume up the referral tree
export const updateReferralVolumes = async (startingUserId, uv) => {
  if (!startingUserId || !uv || uv === 0) return;

  // Safety: prevent infinite loops in case of a bad cycle
  const visited = new Set();

  let currentUserId = startingUserId;

  while (currentUserId) {
    if (visited.has(currentUserId.toString())) {
      console.warn("Detected cycle in referral tree, stopping volume update.");
      break;
    }
    visited.add(currentUserId.toString());

    // Current user (the one whose action generated UV)
    const currentUser = await User.findById(currentUserId).select("_id referredBy");
    if (!currentUser || !currentUser.referredBy) {
      // No more uplines
      break;
    }

    // Referrer (upline)
    const referrer = await User.findById(currentUser.referredBy).select(
      "_id leftChild rightChild leftVolume rightVolume at_hotposition"
    );
    if (!referrer) {
      break;
    }

    const isLeft =
      referrer.leftChild &&
      referrer.leftChild.toString() === currentUser._id.toString();
    const isRight =
      referrer.rightChild &&
      referrer.rightChild.toString() === currentUser._id.toString();

    // Per-referrer hotposition logic:
    // - If referrer is at hotposition, they get half UV
    // - Otherwise they get full UV
    let volumeToAdd = uv;
    if (referrer.at_hotposition) {
      volumeToAdd = uv / 2;
    }

    if (isLeft) {
      referrer.leftVolume = (referrer.leftVolume || 0) + volumeToAdd;
    } else if (isRight) {
      referrer.rightVolume = (referrer.rightVolume || 0) + volumeToAdd;
    } else {
      // This means currentUser is not set as leftChild or rightChild for this referrer.
      console.warn(
        `User ${currentUser._id} is not leftChild/rightChild of referrer ${referrer._id}`
      );
    }

    await referrer.save();

    // Move one level up
    currentUserId = referrer._id;
  }
};
