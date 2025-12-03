// src/components/ReferralTree.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Build a proper tree from the flat nodes array
function buildBinaryTree(treeData) {
  if (
    !treeData ||
    !Array.isArray(treeData.nodes) ||
    treeData.nodes.length === 0
  ) {
    return null;
  }

  const { nodes, rootUserId } = treeData;

  // Clone nodes and add left/right fields
  const byId = new Map(
    nodes.map((n) => [
      n.id,
      {
        ...n,
        left: null,
        right: null,
      },
    ])
  );

  // Link children
  byId.forEach((node) => {
    if (node.leftChildId && byId.has(node.leftChildId)) {
      node.left = byId.get(node.leftChildId);
    }
    if (node.rightChildId && byId.has(node.rightChildId)) {
      node.right = byId.get(node.rightChildId);
    }
  });

  const root =
    (rootUserId && byId.get(rootUserId)) || (nodes[0] && byId.get(nodes[0].id));

  return root || null;
}

// Small placeholder for an empty child slot
const EmptyChildSlot = () => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[10px] text-slate-400 min-w-[90px] text-center">
    Empty
  </div>
);

// Recursive node component
const TreeNode = ({ node, depth = 0, maxDepth = 6 }) => {
  if (!node || depth > maxDepth) return null;

  const showLeft = !!node.left;
  const showRight = !!node.right;
  const hasChildren = showLeft || showRight;

  return (
    <div className="flex flex-col items-center">
      {/* Node box */}
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs min-w-[120px] flex flex-col items-center shadow-sm">
        <div className="flex items-center gap-1 mb-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-medium text-slate-900 truncate max-w-[100px]">
            {node.name || "User"}
          </span>
        </div>
        <div className="text-[11px] text-slate-500">Self UV</div>
        <div className="text-lg font-semibold text-slate-900">
          {node.selfVolume ?? 0}
        </div>
      </div>

      {/* Connectors and children */}
      {hasChildren && (
        <>
          {/* Vertical line from parent downwards */}
          <div className="h-4 w-px bg-slate-300" />

          {/* Children row: always two slots if at least one child exists */}
          <div className="flex w-full items-start justify-between gap-4">
            {/* Left child column */}
            <div className="flex-1 flex justify-center">
              {showLeft ? (
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-slate-300" />
                  <TreeNode
                    node={node.left}
                    depth={depth + 1}
                    maxDepth={maxDepth}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-slate-300" />
                  <EmptyChildSlot />
                </div>
              )}
            </div>

            {/* Right child column */}
            <div className="flex-1 flex justify-center">
              {showRight ? (
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-slate-300" />
                  <TreeNode
                    node={node.right}
                    depth={depth + 1}
                    maxDepth={maxDepth}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-slate-300" />
                  <EmptyChildSlot />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ReferralTree = () => {
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState("");
  const [treeData, setTreeData] = useState(null);

  // Fetch referral tree with axios
  useEffect(() => {
    const fetchTree = async () => {
      try {
        setTreeLoading(true);
        setTreeError("");

        const token = localStorage.getItem("token");
        if (!token) {
          setTreeError("No auth token found. Please log in again.");
          setTreeLoading(false);
          return;
        }

        const res = await axios.get(`${API_BASE_URL}/referrals/tree`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setTreeData(res.data);
      } catch (err) {
        console.error(err);
        const message =
          err.response?.data?.message || "Failed to load referral tree.";
        setTreeError(message);
      } finally {
        setTreeLoading(false);
      }
    };

    fetchTree();
  }, []);

  const rootNode = useMemo(() => buildBinaryTree(treeData), [treeData]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Referral tree</h2>
          <p className="text-xs text-slate-500">
            Binary tree view of your downline (name + self UV).
          </p>
        </div>
        {treeData && (
          <div className="text-[11px] text-slate-500 text-right">
            <div>
              Nodes:{" "}
              <span className="text-slate-900 font-medium">
                {treeData.totalNodes}
              </span>
            </div>
            {treeData.truncated && (
              <div className="mt-1 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 border border-amber-200">
                Tree truncated at {treeData.maxNodes} nodes
              </div>
            )}
          </div>
        )}
      </div>

      {treeLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
        </div>
      ) : treeError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          {treeError}
        </div>
      ) : !rootNode ? (
        <div className="py-8 text-center text-sm text-slate-500">
          No referral tree data is available yet.
        </div>
      ) : (
        // Scrollable container with tree centered
        <div className="mt-4 max-h-[32rem] overflow-auto">
          <div className="min-w-[320px] flex justify-center">
            <TreeNode node={rootNode} />
          </div>
        </div>
      )}
    </section>
  );
};

export default ReferralTree;
