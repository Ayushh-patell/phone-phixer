// src/components/ReferralTree.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FiUsers,
  FiGitBranch,
  FiArrowLeft,
  FiArrowRight,
  FiTarget,
  FiZap,
  FiInfo,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Build a proper tree from the flat nodes array
function buildBinaryTree(treeData) {
  if (!treeData || !Array.isArray(treeData.nodes) || treeData.nodes.length === 0) {
    return null;
  }

  const { nodes, rootUserId } = treeData;

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

  byId.forEach((node) => {
    if (node.leftChildId && byId.has(node.leftChildId)) node.left = byId.get(node.leftChildId);
    if (node.rightChildId && byId.has(node.rightChildId)) node.right = byId.get(node.rightChildId);
  });

  const root =
    (rootUserId && byId.get(rootUserId)) || (nodes[0] && byId.get(nodes[0].id));

  return root || null;
}

// Find "best" placement on a given side (level-order / BFS insertion)
function findBestPositionForSide(rootNode, side) {
  if (!rootNode) return null;

  if (side === "left") {
    if (!rootNode.left) return { parentId: rootNode.id, side: "left" };
    const queue = [rootNode.left];
    while (queue.length) {
      const node = queue.shift();
      if (!node.left) return { parentId: node.id, side: "left" };
      if (!node.right) return { parentId: node.id, side: "right" };
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
  }

  if (side === "right") {
    if (!rootNode.right) return { parentId: rootNode.id, side: "right" };
    const queue = [rootNode.right];
    while (queue.length) {
      const node = queue.shift();
      if (!node.left) return { parentId: node.id, side: "left" };
      if (!node.right) return { parentId: node.id, side: "right" };
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
  }

  return null;
}

const EmptyChildSlot = ({ onClick, isSelected, canSelect, isHotPlacement }) => {
  let classes =
    "rounded-xl border border-dashed px-3 py-2 text-[10px] min-w-[96px] text-center transition select-none";

  if (!canSelect) {
    classes += " border-neutral-200 bg-neutral-50 text-neutral-400";
  } else {
    if (isHotPlacement) {
      classes +=
        " cursor-pointer border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100";
    } else {
      classes +=
        " cursor-pointer border-prim/60 bg-prim/15 text-neutral-900 hover:bg-prim/25";
    }
  }

  if (isSelected) {
    if (isHotPlacement) {
      classes += " border-amber-500 bg-amber-100 ring-2 ring-amber-200";
    } else {
      classes += " border-prim bg-prim/25 ring-2 ring-prim/30";
    }
  }

  return (
    <div className={classes} onClick={canSelect ? onClick : undefined}>
      {canSelect ? "Place" : "Empty"}
    </div>
  );
};

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
  const hasChildren = showLeft || showRight || canSelectPosition;

  return (
    <div className="flex flex-col items-center">
      {/* Node */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white px-3 py-2 shadow-sm min-w-[132px]">
        <div className="absolute inset-x-0 top-0 h-1 bg-prim" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-prim/20 blur-2xl" />

        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30">
            <FiUsers className="h-4.5 w-4.5 text-neutral-900" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-neutral-900 truncate max-w-[92px]">
              {node.name || "User"}
            </div>
            <div className="text-[10px] text-neutral-500">Self UV</div>
          </div>
        </div>

        <div className="mt-1 flex items-end justify-between">
          <div className="text-lg font-semibold text-neutral-900">
            {node.selfVolume ?? 0}
          </div>
          <span className="inline-flex items-center rounded-full border border-prim/30 bg-prim/15 px-2 py-0.5 text-[10px] text-neutral-900">
            <FiGitBranch className="mr-1 h-3 w-3" />
            node
          </span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && depth < maxDepth && (
        <>
          <div className="h-4 w-px bg-neutral-300" />

          <div className="flex w-full items-start justify-between gap-5">
            {/* Left */}
            <div className="flex-1 flex justify-center">
              {showLeft ? (
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-neutral-300" />
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
                  <div className="h-4 w-px bg-neutral-300" />
                  <EmptyChildSlot
                    canSelect={canSelectPosition}
                    isHotPlacement={isHotPlacement}
                    isSelected={
                      !!selectedPosition &&
                      selectedPosition.parentId === node.id &&
                      selectedPosition.side === "left"
                    }
                    onClick={() =>
                      onSelectPosition &&
                      onSelectPosition({ parentId: node.id, side: "left" })
                    }
                  />
                </div>
              )}
            </div>

            {/* Right */}
            <div className="flex-1 flex justify-center">
              {showRight ? (
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-neutral-300" />
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
                  <div className="h-4 w-px bg-neutral-300" />
                  <EmptyChildSlot
                    canSelect={canSelectPosition}
                    isHotPlacement={isHotPlacement}
                    isSelected={
                      !!selectedPosition &&
                      selectedPosition.parentId === node.id &&
                      selectedPosition.side === "right"
                    }
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

const SideSummaryBox = ({ side, nodes, disabled, onPlace, isHotPlacement }) => {
  const title = side === "left" ? "Left" : "Right";
  const nodeCount = nodes.length;
  const totalUV = nodes.reduce((sum, n) => sum + (n.selfVolume ?? 0), 0);

  const buttonClasses = (() => {
    const base =
      "mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 ";
    if (disabled) return base + "bg-neutral-200 text-neutral-500 cursor-not-allowed";
    if (isHotPlacement) return base + "bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-200";
    return base + "bg-prim text-neutral-900 hover:opacity-95 focus:ring-prim/40";
  })();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-prim" />
      <div className="pointer-events-none absolute -right-12 -top-10 h-28 w-28 rounded-full bg-prim/18 blur-2xl" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-500">
            Side
          </div>
          <div className="mt-0.5 text-sm font-semibold text-neutral-900">
            {title}
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-neutral-500">
            {nodeCount} users
          </div>
          <div className="text-xs font-semibold text-neutral-900">UV {totalUV}</div>
        </div>
      </div>

      <div className="mt-3 max-h-32 overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2">
        {nodes.length === 0 ? (
          <div className="text-[11px] text-neutral-500">No users yet.</div>
        ) : (
          <ul className="space-y-1">
            {nodes.map((n) => (
              <li key={n.id} className="flex items-center justify-between text-[11px]">
                <span className="truncate max-w-[140px] text-neutral-900">
                  {n.name || "User"}
                </span>
                <span className="text-neutral-600">UV {n.selfVolume ?? 0}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" disabled={disabled} onClick={onPlace} className={buttonClasses}>
        {side === "left" ? <FiArrowLeft className="h-4 w-4" /> : <FiArrowRight className="h-4 w-4" />}
        {disabled ? "Select a user" : `Auto place ${title}`}
      </button>
    </div>
  );
};

const ReferralTree = () => {
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState("");
  const [treeData, setTreeData] = useState(null);

  const [referralRequests, setReferralRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");

  // Hot position threshold from settings
  const [hotMinUV, setHotMinUV] = useState(2);

  // Placement UI state
  const [selectedPlacementUser, setSelectedPlacementUser] = useState(null);
  const [selectedPlacementSource, setSelectedPlacementSource] = useState(null); // "regular" | "hot" | "pending" | null
  const [selectedPosition, setSelectedPosition] = useState(null); // { parentId, side }

  const [placementLoading, setPlacementLoading] = useState(false);
  const [placementError, setPlacementError] = useState("");
  const [placementSuccess, setPlacementSuccess] = useState("");

  const fetchTree = async (headers) => {
    try {
      setTreeLoading(true);
      setTreeError("");
      const res = await axios.get(`${API_BASE_URL}/referrals/tree`, { headers });
      setTreeData(res.data);
    } catch (err) {
      console.error(err);
      setTreeError(err.response?.data?.message || "Failed to load referrals.");
    } finally {
      setTreeLoading(false);
    }
  };

  const fetchRequests = async (headers) => {
    try {
      setRequestsLoading(true);
      setRequestsError("");
      const res = await axios.get(`${API_BASE_URL}/users/requests`, { headers });
      const data = res.data;
      const requests = Array.isArray(data) ? data : data.requests || [];
      setReferralRequests(requests);
    } catch (err) {
      console.error(err);
      setRequestsError(err.response?.data?.message || "Failed to load pending users.");
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const token = sessionStorage.getItem("token");
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

  useEffect(() => {
    const fetchHotMinUV = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/settings/hotposition_min_uv`);
        const numeric = Number(res.data?.value);
        if (!Number.isNaN(numeric) && numeric > 0) setHotMinUV(numeric);
      } catch (err) {
        console.error("Failed to fetch hotposition_min_uv:", err);
      }
    };
    fetchHotMinUV();
  }, []);

  const rootNode = useMemo(() => buildBinaryTree(treeData), [treeData]);

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

  // ✅ NEW LOGIC:
  // - If referralActive is true -> NOT hot (ever)
  // - Hot only if (referralActive is false) AND (selfVolume >= hotMinUV)
  // - Everything else goes into "Pending"
  const { regularRequests, hotPositionRequests, pendingRequests } = useMemo(() => {
    const regular = [];
    const hot = [];
    const pending = [];

    for (const user of referralRequests || []) {
      const selfUV = user.selfVolume ?? 0;

      if (user.referralActive) {
        regular.push(user);
        continue;
      }

      if (!user.referralActive && selfUV >= hotMinUV) {
        hot.push(user);
        continue;
      }

      pending.push(user);
    }

    return { regularRequests: regular, hotPositionRequests: hot, pendingRequests: pending };
  }, [referralRequests, hotMinUV]);

  const selectedParentNode = useMemo(() => {
    if (!selectedPosition || !treeData?.nodes) return null;
    return treeData.nodes.find((n) => n.id === selectedPosition.parentId) || null;
  }, [selectedPosition, treeData]);

  const handleSelectPlacementUser = (user, source) => {
    const id = user._id || user.id;
    const selectedId = selectedPlacementUser && (selectedPlacementUser._id || selectedPlacementUser.id);

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
    if (!selectedPlacementUser) return;
    setSelectedPosition({ parentId, side });
    setPlacementError("");
    setPlacementSuccess("");
  };

  const handleSidePlacement = (side) => {
    if (!selectedPlacementUser || !rootNode) return;
    const best = findBestPositionForSide(rootNode, side);
    if (!best) {
      setPlacementError(`No free slot on ${side}.`);
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

    const token = sessionStorage.getItem("token");
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

      setPlacementSuccess(res.data?.message || "Placed successfully.");

      await Promise.all([fetchTree(headers), fetchRequests(headers)]);

      setSelectedPlacementUser(null);
      setSelectedPlacementSource(null);
      setSelectedPosition(null);
    } catch (err) {
      console.error(err);
      setPlacementError(err.response?.data?.message || "Failed to save placement.");
    } finally {
      setPlacementLoading(false);
    }
  };

  const isHotPlacementMode = !!selectedPlacementUser && selectedPlacementSource === "hot";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-prim" />
      <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-prim/18 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-28 h-64 w-64 rounded-full bg-prim/12 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <FiGitBranch className="h-5 w-5 text-neutral-900" />
            Referrals
          </h2>
          <p className="mt-1 text-xs text-neutral-600">
            Pick a user, then choose a spot in the tree.
          </p>
        </div>

        {treeData && (
          <div className="text-[11px] text-neutral-600 text-right">
            <div>
              Nodes:{" "}
              <span className="text-neutral-900 font-semibold">
                {treeData.totalNodes}
              </span>
            </div>
            {treeData.truncated && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">
                <FiAlertTriangle className="h-3 w-3" />
                Truncated at {treeData.maxNodes}
              </div>
            )}
          </div>
        )}
      </div>

      {treeLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-prim" />
        </div>
      ) : treeError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {treeError}
        </div>
      ) : !rootNode ? (
        <div className="py-10 text-center text-sm text-neutral-600">
          No referral data yet.
        </div>
      ) : (
        <>
          {/* Side summary */}
          <div className="mb-5 grid gap-4 md:grid-cols-2">
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

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Tree */}
            <div className="flex-1 max-h-[32rem] overflow-auto rounded-2xl border border-neutral-200 bg-neutral-50">
              <div className="min-w-[340px] flex justify-center py-5">
                <TreeNode
                  node={rootNode}
                  onSelectPosition={handleSelectTreePosition}
                  selectedPosition={selectedPosition}
                  canSelectPosition={!!selectedPlacementUser}
                  isHotPlacement={isHotPlacementMode}
                />
              </div>
            </div>

            {/* Right panel */}
            <div className="w-full lg:w-80 flex-shrink-0">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                    <FiUsers className="h-4.5 w-4.5" />
                    Pending
                  </h3>
                  {requestsLoading && (
                    <span className="text-[10px] text-neutral-500">Loading…</span>
                  )}
                </div>

                {requestsError && (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                    {requestsError}
                  </div>
                )}

                {!requestsLoading && !requestsError && referralRequests.length === 0 && (
                  <div className="text-[11px] text-neutral-600">
                    No users waiting.
                  </div>
                )}

                {/* Regular */}
                {regularRequests.length > 0 && (
                  <div className="mt-2">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                        Referrals
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        {regularRequests.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {regularRequests.map((user) => {
                        const id = user._id || user.id;
                        const selectedId =
                          selectedPlacementUser && (selectedPlacementUser._id || selectedPlacementUser.id);
                        const isSelected = selectedId === id && selectedPlacementSource === "regular";

                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleSelectPlacementUser(user, "regular")}
                            className={[
                              "w-full rounded-xl border px-3 py-2 text-left text-[11px] transition",
                              isSelected
                                ? "border-prim bg-prim/15 ring-2 ring-prim/30"
                                : "border-neutral-200 bg-neutral-50 hover:border-prim/60 hover:bg-prim/10",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-neutral-900 truncate">
                                {user.name || "User"}
                              </span>
                              <span className="text-[10px] text-neutral-600">
                                UV {user.selfVolume ?? 0}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Hot */}
                {hotPositionRequests.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                        <FiZap className="h-3.5 w-3.5" />
                        Hot ({hotMinUV}+ UV)
                      </div>
                      <span className="text-[10px] text-amber-800">
                        {hotPositionRequests.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {hotPositionRequests.map((user) => {
                        const id = user._id || user.id;
                        const selectedId =
                          selectedPlacementUser && (selectedPlacementUser._id || selectedPlacementUser.id);
                        const isSelected = selectedId === id && selectedPlacementSource === "hot";

                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleSelectPlacementUser(user, "hot")}
                            className={[
                              "w-full rounded-xl border px-3 py-2 text-left text-[11px] transition",
                              isSelected
                                ? "border-amber-500 bg-amber-100 ring-2 ring-amber-200"
                                : "border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100/70",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-amber-900 truncate">
                                {user.name || "User"}
                              </span>
                              <span className="text-[10px] text-amber-800">
                                UV {user.selfVolume ?? 0}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pending (not active + not hot) */}
                {pendingRequests.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                        <FiInfo className="h-3.5 w-3.5" />
                        Waiting
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        {pendingRequests.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {pendingRequests.map((user) => {
                        const id = user._id || user.id;
                        const selectedId =
                          selectedPlacementUser && (selectedPlacementUser._id || selectedPlacementUser.id);
                        const isSelected = selectedId === id && selectedPlacementSource === "pending";

                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleSelectPlacementUser(user, "pending")}
                            className={[
                              "w-full rounded-xl border px-3 py-2 text-left text-[11px] transition",
                              isSelected
                                ? "border-prim bg-prim/15 ring-2 ring-prim/30"
                                : "border-neutral-200 bg-neutral-50 hover:border-prim/60 hover:bg-prim/10",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-neutral-900 truncate">
                                {user.name || "User"}
                              </span>
                              <span className="text-[10px] text-neutral-600">
                                UV {user.selfVolume ?? 0}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selection + save */}
                {selectedPlacementUser ? (
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] text-neutral-700">
                        Selected:{" "}
                        <span className="font-semibold text-neutral-900">
                          {selectedPlacementUser.name || "User"}
                        </span>
                      </div>
                      {selectedPlacementSource === "hot" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">
                          <FiZap className="h-3 w-3" /> Hot
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-prim/40 bg-prim/15 px-2 py-0.5 text-[10px] text-neutral-900">
                          <FiTarget className="h-3 w-3" /> Place
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-[10px] text-neutral-600">
                      {selectedPosition ? (
                        <>
                          Under{" "}
                          <span className="font-semibold text-neutral-900">
                            {selectedParentNode?.name || selectedPosition.parentId}
                          </span>{" "}
                          ·{" "}
                          <span className="font-semibold text-neutral-900">
                            {selectedPosition.side}
                          </span>
                        </>
                      ) : (
                        "Choose Left/Right above or click an empty slot."
                      )}
                    </div>

                    {placementError && (
                      <div className="mt-2 text-[11px] text-red-600">{placementError}</div>
                    )}
                    {placementSuccess && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-700">
                        <FiCheckCircle className="h-4 w-4" />
                        {placementSuccess}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!selectedPosition || placementLoading}
                      onClick={handleSavePlacement}
                      className={[
                        "mt-3 w-full inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2",
                        !selectedPosition || placementLoading
                          ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                          : isHotPlacementMode
                          ? "bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-200"
                          : "bg-prim text-neutral-900 hover:opacity-95 focus:ring-prim/40",
                      ].join(" ")}
                    >
                      {placementLoading ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : referralRequests.length > 0 ? (
                  <div className="mt-4 text-[10px] text-neutral-600">
                    Pick a user, then pick a spot.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default ReferralTree;
