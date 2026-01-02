// models/TreeNode.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const TreeNodeSchema = new Schema(
  {
    // The owner/root of this tree (each user has their own tree)
    treeOwner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // The user placed in this tree
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Parent inside THIS tree (null allowed if you use a root record)
    parentUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Placement side relative to parent
    // "root" is optional but recommended for a clean root record
    side: {
      type: String,
      enum: ["root", "L", "R"],
      required: true,
    },

    // Optional but useful for UI constraints / faster queries
    level: {
      type: Number,
      default: 0,
      index: true,
    },

    at_hotposition: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// A user can appear in many different trees, but only once per treeOwner.
TreeNodeSchema.index({ treeOwner: 1, user: 1 }, { unique: true });

// Prevent double-filling same slot in same tree:
// (treeOwner, parentUser, side) must be unique for L/R.
TreeNodeSchema.index(
  { treeOwner: 1, parentUser: 1, side: 1 },
  {
    unique: true,
    partialFilterExpression: { side: { $in: ["L", "R"] } },
  }
);

// Helpful for fetching a parent's children quickly
TreeNodeSchema.index({ treeOwner: 1, parentUser: 1 });

export default mongoose.model("TreeNode", TreeNodeSchema);
