import User from "../models/User.js";

/**
 * Places a user in the referral binary tree of their referrer.
 * Updates left/right volumes recursively up the tree.
 *
 * @param {Object} user - The user to be placed
 * @param {Object} referrer - The referrer user
 */
export const placeInReferralTree = async (user, referrer) => {
  // BFS queue
  const queue = [referrer];

  while (queue.length) {
    const current = queue.shift();

    // Fetch latest data
    const parent = await User.findById(current._id);

    if (!parent.leftChild) {
      parent.leftChild = user._id;
      await parent.save();

      // Update volumes
      await updateVolumes(parent, user.selfVolume, "left");
      break;
    } else if (!parent.rightChild) {
      parent.rightChild = user._id;
      await parent.save();

      // Update volumes
      const totalVolume = user.selfVolume + user.rightVolume + user.leftVolume;
      await updateVolumes(parent, totalVolume, "right");
      break;
    } else {
      // Push children to queue
      const left = await User.findById(parent.leftChild);
      const right = await User.findById(parent.rightChild);

      if (left) queue.push(left);
      if (right) queue.push(right);
    }
  }

  // Set referredBy
  user.referredBy = referrer._id;
  await user.save();
};

/**
 * Recursively updates left/right volumes up the tree
 *
 * @param {Object} parent - parent user
 * @param {Number} uv - UV to add
 * @param {String} side - 'left' or 'right'
 */
const updateVolumes = async (parent, uv, side) => {
  if (side === "left") parent.leftVolume += uv;
  else parent.rightVolume += uv;

  await parent.save();

  if (parent.referredBy) {
    const grandParent = await User.findById(parent.referredBy);

    if (grandParent) {
      // Determine which side of grandParent this parent is
      const parentSide = grandParent.leftChild?.toString() === parent._id.toString() ? "left" : "right";
      await updateVolumes(grandParent, uv, parentSide);
    }
  }
};
