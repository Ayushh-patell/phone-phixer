import React, { useMemo } from "react";
import { FiUsers } from "react-icons/fi";

function buildBinaryTree(treeData) {
  if (!treeData?.nodes?.length) return null;

  const byId = new Map(
    treeData.nodes.map((n) => [
      String(n.id),
      {
        ...n,
        id: String(n.id),
        leftChildId: n.leftChildId ? String(n.leftChildId) : null,
        rightChildId: n.rightChildId ? String(n.rightChildId) : null,
        left: null,
        right: null,
      },
    ])
  );

  byId.forEach((node) => {
    if (node.leftChildId) node.left = byId.get(node.leftChildId);
    if (node.rightChildId) node.right = byId.get(node.rightChildId);
  });

  return byId.get(String(treeData.rootUserId));
}

const TreeNode = ({ node, depth = 0, maxDepth = 5 }) => {
  if (!node || depth > maxDepth) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="border rounded-xl px-3 py-2 bg-white min-w-[120px] text-center">
        <div className="flex items-center justify-center gap-1">
          <FiUsers className="h-4 w-4" />
          <span className="text-xs font-semibold truncate">
            {node.name || "User"}
          </span>
        </div>

        <div className="text-xs text-neutral-500">
          UV {node.selfVolume ?? 0}
        </div>
      </div>

      {(node.left || node.right) && depth < maxDepth && (
        <>
          <div className="h-4 w-px bg-neutral-300" />
          <div className="flex gap-6">
            <TreeNode node={node.left} depth={depth + 1} />
            <TreeNode node={node.right} depth={depth + 1} />
          </div>
        </>
      )}
    </div>
  );
};

const ReferralTreeViewOnly = ({ treeData }) => {
  const rootNode = useMemo(() => buildBinaryTree(treeData), [treeData]);

  if (!rootNode) {
    return (
      <div className="text-sm text-neutral-500 py-6 text-center">
        No tree data.
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <div className="flex justify-center py-6">
        <TreeNode node={rootNode} />
      </div>
    </div>
  );
};

export default ReferralTreeViewOnly;