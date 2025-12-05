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

// Find "best" placement on a given side to keep tree shape balanced
// (level-order / BFS insertion)
function findBestPositionForSide(rootNode, side) {
  if (!rootNode) return null;

  if (side === "left") {
    if (!rootNode.left) {
      return { parentId: rootNode.id, side: "left" };
    }
    const queue = [rootNode.left];
    while (queue.length) {
      const node = queue.shift();

      if (!node.left) return { parentId: node.id, side: "left" };
      if (!node.right) return { parentId: node.id, side: "right" };

      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
  } else if (side === "right") {
    if (!rootNode.right) {
      return { parentId: rootNode.id, side: "right" };
    }
    const queue = [rootNode.right];
    while (queue.length) {
      const node = queue.shift();

      if (!node.left) return { parentId: node.id, side: "left" };
      if (!node.right) return { parentId: node.id, side: "right" };

      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
  }

  // No empty slot on that side
  return null;
}

// Small placeholder for an empty child slot (clickable when placing a user)
const EmptyChildSlot = ({ onClick, isSelected, canSelect, isHotPlacement }) => {
  let classes =
    "rounded-xl border border-dashed px-3 py-2 text-[10px] min-w-[90px] text-center transition";

  if (canSelect) {
    if (isHotPlacement) {
      classes +=
        " cursor-pointer border-amber-300 bg-amber-50/60 text-amber-700 hover:bg-amber-50 hover:border-amber-400";
    } else {
      classes +=
        " cursor-pointer border-sky-300 bg-sky-50/60 text-sky-700 hover:bg-sky-50 hover:border-sky-400";
    }
  } else {
    classes += " border-slate-300 bg-slate-50 text-slate-400";
  }

  if (isSelected) {
    if (isHotPlacement) {
      classes += " border-amber-500 bg-amber-100 shadow-sm";
    } else {
      classes += " border-sky-500 bg-sky-100 shadow-sm";
    }
  }

  return (
    <div className={classes} onClick={canSelect ? onClick : undefined}>
      {canSelect ? "Place here" : "Empty"}
    </div>
  );
};

// Recursive node component
const TreeNode = ({
  node,
  depth = 0,
  maxDepth = 6,
  onSelectPosition,
  selectedPosition,
  canSelectPosition,
  isHotPlacement,
}) => {
  if (!node || depth > maxDepth) return null;

  const showLeft = !!node.left;
  const showRight = !!node.right;

  // When placing a user, we want to show child slots
  // even if this node currently has NO children.
  const hasChildren = showLeft || showRight || canSelectPosition;

  return (
    <div className="flex flex-col items-center">
      {/* Node box */}
      <div className="rounded-xl border border-slate-200 bg-sky-500 px-3 py-2 text-xs min-w-[120px] flex flex-col items-center shadow-sm">
        <div className="flex items-center gap-1 mb-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-medium text-slate-900 truncate max-w-[100px]">
            {node.name || "User"}
          </span>
        </div>
        <div className="text-[11px] text-slate-50">Self UV</div>
        <div className="text-lg font-semibold text-slate-900">
          {node.selfVolume ?? 0}
        </div>
      </div>

      {/* Connectors and children */}
      {hasChildren && depth < maxDepth && (
        <>
          {/* Vertical line from parent downwards */}
          <div className="h-4 w-px bg-slate-300" />

          {/* Children row */}
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
                    onSelectPosition={onSelectPosition}
                    selectedPosition={selectedPosition}
                    canSelectPosition={canSelectPosition}
                    isHotPlacement={isHotPlacement}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-slate-300" />
                  <EmptyChildSlot
                    canSelect={canSelectPosition}
                    isSelected={
                      !!selectedPosition &&
                      selectedPosition.parentId === node.id &&
                      selectedPosition.side === "left"
                    }
                    isHotPlacement={isHotPlacement}
                    onClick={() =>
                      onSelectPosition &&
                      onSelectPosition({ parentId: node.id, side: "left" })
                    }
                  />
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
                    onSelectPosition={onSelectPosition}
                    selectedPosition={selectedPosition}
                    canSelectPosition={canSelectPosition}
                    isHotPlacement={isHotPlacement}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-slate-300" />
                  <EmptyChildSlot
                    canSelect={canSelectPosition}
                    isSelected={
                      !!selectedPosition &&
                      selectedPosition.parentId === node.id &&
                      selectedPosition.side === "right"
                    }
                    isHotPlacement={isHotPlacement}
                    onClick={() =>
                      onSelectPosition &&
                      onSelectPosition({ parentId: node.id, side: "right" })
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Simple side box component (top representation)
const SideSummaryBox = ({
  side,
  nodes,
  disabled,
  onPlace,
  isHotPlacement,
}) => {
  const title = side === "left" ? "Left side" : "Right side";
  const nodeCount = nodes.length;
  const totalUV = nodes.reduce(
    (sum, n) => sum + (n.selfVolume ?? 0),
    0
  );

  const placeButtonClasses = (() => {
    let base =
      "mt-2 w-full rounded-lg px-2 py-1.5 text-[11px] font-medium transition ";
    if (disabled) {
      return base + "bg-slate-200 text-slate-500 cursor-not-allowed";
    }
    if (isHotPlacement) {
      return base + "bg-amber-500 text-white hover:bg-amber-600";
    }
    return base + "bg-sky-500 text-white hover:bg-sky-600";
  })();

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold text-slate-900 text-sm">
          {title}
        </div>
        <div className="text-[10px] text-slate-500">
          {nodeCount} users · UV {totalUV}
        </div>
      </div>
      <div className="mt-1 max-h-32 overflow-auto rounded border border-slate-100 bg-white/70 px-2 py-1">
        {nodes.length === 0 ? (
          <div className="text-[11px] text-slate-400">
            No users on this side yet.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {nodes.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="truncate max-w-[100px]">
                  {n.name || "User"}
                </span>
                <span className="text-[10px] text-slate-500">
                  UV {n.selfVolume ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onPlace}
        className={placeButtonClasses}
      >
        {disabled ? "Select a user first" : `Place on ${title}`}
      </button>
    </div>
  );
};

const ReferralTree = () => {
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState("");
  const [treeData, setTreeData] = useState(null);

  // Referral requests (users waiting to be placed)
  const [referralRequests, setReferralRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");

  // Hot position threshold from universal settings
  const [hotMinUV, setHotMinUV] = useState(2);

  // Placement UI state
  const [selectedPlacementUser, setSelectedPlacementUser] = useState(null);
  const [selectedPlacementSource, setSelectedPlacementSource] = useState(null); // "regular" | "hot" | null
  const [selectedPosition, setSelectedPosition] = useState(null); // { parentId, side }

  const [placementLoading, setPlacementLoading] = useState(false);
  const [placementError, setPlacementError] = useState("");
  const [placementSuccess, setPlacementSuccess] = useState("");

  // Helpers to fetch tree & requests
  const fetchTree = async (headers) => {
    try {
      setTreeLoading(true);
      setTreeError("");
      const res = await axios.get(`${API_BASE_URL}/referrals/tree`, {
        headers,
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

  const fetchRequests = async (headers) => {
    try {
      setRequestsLoading(true);
      setRequestsError("");
      const res = await axios.get(`${API_BASE_URL}/users/requests`, {
        headers,
      });

      // Allow both {requests: [...]} and plain array
      const data = res.data;
      const requests = Array.isArray(data) ? data : data.requests || [];
      setReferralRequests(requests);
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.message || "Failed to load referral requests.";
      setRequestsError(message);
    } finally {
      setRequestsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        const msg = "No auth token found. Please log in again.";
        setTreeError(msg);
        setRequestsError(msg);
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      await Promise.all([fetchTree(headers), fetchRequests(headers)]);
    };

    init();
  }, []);

  // Fetch hot position min UV from universal settings
  useEffect(() => {
    const fetchHotMinUV = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/settings/hotposition_min_uv`
        );
        const value = res.data?.value;
        const numeric = Number(value);
        if (!Number.isNaN(numeric) && numeric > 0) {
          setHotMinUV(numeric);
        }
      } catch (err) {
        console.error("Failed to fetch hotposition_min_uv:", err);
        // Keep default 2 if request fails
      }
    };

    fetchHotMinUV();
  }, []);

  const rootNode = useMemo(() => buildBinaryTree(treeData), [treeData]);

  // Collect all nodes on left and right side (simple representation)
  const { leftSideNodes, rightSideNodes } = useMemo(() => {
    const left = [];
    const right = [];

    if (!rootNode) return { leftSideNodes: left, rightSideNodes: right };

    const traverse = (start, arr) => {
      if (!start) return;
      const queue = [start];
      while (queue.length) {
        const node = queue.shift();
        arr.push(node);
        if (node.left) queue.push(node.left);
        if (node.right) queue.push(node.right);
      }
    };

    if (rootNode.left) traverse(rootNode.left, left);
    if (rootNode.right) traverse(rootNode.right, right);

    return { leftSideNodes: left, rightSideNodes: right };
  }, [rootNode]);

  // Split into regular referrals and hot positions
  // - Regular: referralActive === true
  // - Hot position: selfVolume >= hotMinUV
  // If both are true, user appears in both lists.
  const { regularRequests, hotPositionRequests } = useMemo(() => {
    const regular = [];
    const hot = [];

    for (const user of referralRequests || []) {
      const selfUV = user.selfVolume ?? 0;

      if (user.referralActive) {
        regular.push(user);
      }
      if (selfUV >= hotMinUV) {
        hot.push(user);
      }
    }

    return { regularRequests: regular, hotPositionRequests: hot };
  }, [referralRequests, hotMinUV]);

  // Parent node data for the currently selected position
  const selectedParentNode = useMemo(() => {
    if (!selectedPosition || !treeData?.nodes) return null;
    return (
      treeData.nodes.find((n) => n.id === selectedPosition.parentId) || null
    );
  }, [selectedPosition, treeData]);

  // Handlers
  const handleSelectPlacementUser = (user, source) => {
    const id = user._id || user.id;
    const selectedId =
      selectedPlacementUser &&
      (selectedPlacementUser._id || selectedPlacementUser.id);

    // Toggle: click again in same source to deselect
    if (selectedId === id && selectedPlacementSource === source) {
      setSelectedPlacementUser(null);
      setSelectedPlacementSource(null);
      setSelectedPosition(null);
      setPlacementError("");
      setPlacementSuccess("");
      return;
    }

    setSelectedPlacementUser(user);
    setSelectedPlacementSource(source);
    setSelectedPosition(null);
    setPlacementError("");
    setPlacementSuccess("");
  };

  const handleSelectTreePosition = ({ parentId, side }) => {
    if (!selectedPlacementUser) return; // don't allow selecting without a user
    setSelectedPosition({ parentId, side });
    setPlacementError("");
    setPlacementSuccess("");
  };

  const handleSidePlacement = (side) => {
    if (!selectedPlacementUser || !rootNode) return;
    const best = findBestPositionForSide(rootNode, side);
    if (!best) {
      setPlacementError(`No free slot available on the ${side} side.`);
      setPlacementSuccess("");
      return;
    }
    setSelectedPosition(best);
    setPlacementError("");
    setPlacementSuccess("");
  };

  const handleSavePlacement = async () => {
    setPlacementError("");
    setPlacementSuccess("");

    if (!selectedPlacementUser || !selectedPosition) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setPlacementError("No auth token found. Please log in again.");
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const childId = selectedPlacementUser._id || selectedPlacementUser.id;
    const { parentId, side } = selectedPosition;

    try {
      setPlacementLoading(true);

      const res = await axios.post(
        `${API_BASE_URL}/referrals/place`,
        {
          parentId,
          childId,
          position: side,
          is_hotposition: selectedPlacementSource === "hot",
        },
        { headers }
      );

      const message =
        res.data?.message ||
        "User placed successfully in the referral tree.";
      setPlacementSuccess(message);

      // Refresh tree and requests
      await Promise.all([fetchTree(headers), fetchRequests(headers)]);

      // Clear selection
      setSelectedPlacementUser(null);
      setSelectedPlacementSource(null);
      setSelectedPosition(null);
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.message || "Failed to save placement.";
      setPlacementError(message);
    } finally {
      setPlacementLoading(false);
    }
  };

  const isHotPlacementMode =
    !!selectedPlacementUser && selectedPlacementSource === "hot";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Referral tree
          </h2>
          <p className="text-xs text-slate-500">
            View your binary tree and place pending referrals.
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
        <>
          {/* Simple left/right side summary with auto-placement */}
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <SideSummaryBox
              side="left"
              nodes={leftSideNodes}
              disabled={!selectedPlacementUser}
              isHotPlacement={isHotPlacementMode}
              onPlace={() => handleSidePlacement("left")}
            />
            <SideSummaryBox
              side="right"
              nodes={rightSideNodes}
              disabled={!selectedPlacementUser}
              isHotPlacement={isHotPlacementMode}
              onPlace={() => handleSidePlacement("right")}
            />
          </div>

          {/* Tree + side panel */}
          <div className="mt-4 flex flex-col gap-6 lg:flex-row">
            {/* Tree */}
            <div className="flex-1 max-h-[32rem] overflow-auto rounded-xl border border-slate-100">
              <div className="min-w-[320px] flex justify-center py-4">
                <TreeNode
                  node={rootNode}
                  onSelectPosition={handleSelectTreePosition}
                  selectedPosition={selectedPosition}
                  canSelectPosition={!!selectedPlacementUser}
                  isHotPlacement={isHotPlacementMode}
                />
              </div>
            </div>

            {/* Placement side panel */}
            <div className="w-full lg:w-72 flex-shrink-0">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Pending referrals
                  </h3>
                  {requestsLoading && (
                    <span className="text-[10px] text-slate-500">Loading…</span>
                  )}
                </div>

                {requestsError && (
                  <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                    {requestsError}
                  </div>
                )}

                {!requestsLoading &&
                  !requestsError &&
                  referralRequests.length === 0 && (
                    <div className="text-[11px] text-slate-500">
                      No users waiting for placement.
                    </div>
                  )}

                {/* Regular referrals */}
                {regularRequests.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Regular
                    </div>
                    <div className="mt-1 space-y-1.5">
                      {regularRequests.map((user) => {
                        const id = user._id || user.id;
                        const selectedId =
                          selectedPlacementUser &&
                          (selectedPlacementUser._id ||
                            selectedPlacementUser.id);
                        const isSelected =
                          selectedId === id &&
                          selectedPlacementSource === "regular";

                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() =>
                              handleSelectPlacementUser(user, "regular")
                            }
                            className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] transition ${
                              isSelected
                                ? "border-sky-500 bg-white shadow-sm"
                                : "border-slate-200 bg-white/70 hover:border-sky-300 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-slate-900 truncate">
                                {user.name || "User"}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                UV: {user.selfVolume ?? 0}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Hot positions */}
                {hotPositionRequests.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                      Hot positions ({hotMinUV}+ UV)
                    </div>
                    <div className="mt-1 space-y-1.5">
                      {hotPositionRequests.map((user) => {
                        const id = user._id || user.id;
                        const selectedId =
                          selectedPlacementUser &&
                          (selectedPlacementUser._id ||
                            selectedPlacementUser.id);
                        const isSelected =
                          selectedId === id && selectedPlacementSource === "hot";

                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() =>
                              handleSelectPlacementUser(user, "hot")
                            }
                            className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] transition ${
                              isSelected
                                ? "border-amber-500 bg-white shadow-sm"
                                : "border-amber-200 bg-amber-50/70 hover:border-amber-400 hover:bg-amber-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-amber-900 truncate">
                                {user.name || "User"}
                              </span>
                              <span className="text-[10px] text-amber-700">
                                UV: {user.selfVolume ?? 0}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Placement summary + save */}
                {selectedPlacementUser && (
                  <div className="mt-3 border-t border-slate-200 pt-2">
                    <div className="text-[11px] text-slate-600">
                      Selected:{" "}
                      <span className="font-medium text-slate-900">
                        {selectedPlacementUser.name}
                      </span>{" "}
                      <span className="text-[10px] text-slate-400">
                        (
                        {selectedPlacementSource === "hot"
                          ? "Hot"
                          : "Regular"}
                        )
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {selectedPosition ? (
                        <>
                          Under{" "}
                          <span className="font-medium text-slate-800">
                            {selectedParentNode?.name ||
                              selectedPosition.parentId}
                          </span>{" "}
                          –{" "}
                          <span className="font-medium text-slate-800">
                            {selectedPosition.side}
                          </span>{" "}
                          side
                        </>
                      ) : (
                        "Choose a side above or click an empty slot in the tree."
                      )}
                    </div>

                    {placementError && (
                      <div className="mt-1 text-[11px] text-red-600">
                        {placementError}
                      </div>
                    )}
                    {placementSuccess && (
                      <div className="mt-1 text-[11px] text-emerald-600">
                        {placementSuccess}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!selectedPosition || placementLoading}
                      onClick={handleSavePlacement}
                      className={`mt-2 w-full rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                        !selectedPosition || placementLoading
                          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                          : "bg-sky-500 text-white hover:bg-sky-600"
                      }`}
                    >
                      {placementLoading ? "Saving..." : "Save placement"}
                    </button>
                  </div>
                )}

                {!selectedPlacementUser && referralRequests.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-2 text-[10px] text-slate-500">
                    1) Pick a user. 2) Use left/right boxes or click a slot in the tree.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default ReferralTree;
