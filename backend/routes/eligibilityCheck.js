import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import UniversalSettings from "../models/UniversalSettings.js";
import UserMonthlyCheckStats from "../models/UserMonthlyCheckStats.js";

const router = express.Router();

const SETTINGS_KEY = "star_eligibility_criterias";
const MAX_TREE_NODES_CHECK = Number(process.env.MAX_TREE_NODES_CHECK || 20000);

/* ------------------ date helpers ------------------ */
function monthStartUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addMonthsUTC(date, months) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0)
  );
}

function isPositiveInt(n) {
  return Number.isInteger(n) && n > 0;
}

function levelsToDepth(levelsToCheck) {
  if (levelsToCheck === "infinity") return Infinity;
  if (isPositiveInt(levelsToCheck)) return levelsToCheck;
  return 0;
}

function startMonthForLastNMonthsUTC(monthsToCheck, now = new Date()) {
  const currentMonthStart = monthStartUTC(now);
  return monthStartUTC(addMonthsUTC(currentMonthStart, -(monthsToCheck - 1)));
}

/* ------------------ settings helpers ------------------ */
async function getRulesArray() {
  const doc = await UniversalSettings.findOne({ key: SETTINGS_KEY })
    .select("value -_id")
    .lean();

  if (!doc || !Array.isArray(doc.value)) return [];
  return doc.value;
}

/* ------------------ tree traversal (BFS) ------------------ */
/**
 * Returns nodes: [{ id, depth, at_hotposition, referralActive, star }]
 */
async function traverseDownlineBFS(rootUserId, maxDepth) {
  if (!maxDepth || maxDepth <= 0) return [];

  const visited = new Set();
  const nodes = [];

  let depth = 1;
  let frontier = [rootUserId];

  visited.add(String(rootUserId));

  while (frontier.length > 0 && depth <= maxDepth) {
    const parents = await User.find({ _id: { $in: frontier } })
      .select("_id leftChild rightChild")
      .lean();

    const childIds = [];
    for (const p of parents) {
      if (p.leftChild) childIds.push(p.leftChild);
      if (p.rightChild) childIds.push(p.rightChild);
    }

    const nextIds = [];
    for (const cid of childIds) {
      const key = String(cid);
      if (!visited.has(key)) {
        visited.add(key);
        nextIds.push(cid);
      }
    }

    if (nextIds.length === 0) break;

    if (nodes.length + nextIds.length > MAX_TREE_NODES_CHECK) {
      // Safety stop
      break;
    }

    const childDocs = await User.find({ _id: { $in: nextIds } })
      .select("_id at_hotposition referralActive star leftChild rightChild")
      .lean();

    for (const c of childDocs) {
      nodes.push({
        id: c._id,
        depth,
        at_hotposition: !!c.at_hotposition,
        referralActive: !!c.referralActive,
        star: Number(c.star || 0),
      });
    }

    frontier = childDocs.map((d) => d._id);
    depth += 1;
  }

  return nodes;
}

/* ------------------ monthly aggregation ------------------ */
async function sumMonthlyFieldForUsers({ userIds, monthsToCheck, field }) {
  if (!Array.isArray(userIds) || userIds.length === 0) return 0;
  if (!isPositiveInt(monthsToCheck)) return 0;
  if (field !== "rspCreated" && field !== "checksCreated") return 0;

  const startMonth = startMonthForLastNMonthsUTC(monthsToCheck, new Date());

  const rows = await UserMonthlyCheckStats.aggregate([
    {
      $match: {
        user: { $in: userIds },
        month: { $gte: startMonth },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: [`$${field}`, 0] } },
      },
    },
  ]);

  return rows?.[0]?.total || 0;
}

/* ------------------ condition evaluation ------------------ */
async function evalCondition(condition, ctx) {
  const { type } = condition;

  const withinDepth = (depthLimit) => {
    if (!Number.isFinite(depthLimit)) return ctx.downlineNodes;
    return ctx.downlineNodes.filter((n) => n.depth <= depthLimit);
  };

  if (type === "hotposition") {
    const { minCount, levelsToCheck } = condition.hotposition;
    const d = levelsToDepth(levelsToCheck);
    const count = withinDepth(d).filter((n) => n.at_hotposition).length;

    return {
      type,
      passed: count >= minCount,
      actual: count,
      required: { minCount, levelsToCheck },
    };
  }

  if (type === "activeReferrals") {
    const { minCount, levelsToCheck } = condition.activeReferrals;
    const d = levelsToDepth(levelsToCheck);
    const count = withinDepth(d).filter((n) => n.referralActive).length;

    return {
      type,
      passed: count >= minCount,
      actual: count,
      required: { minCount, levelsToCheck },
    };
  }

  if (type === "group_star") {
    const { starLevel, minUsers, levelsToCheck } = condition.groupStar;
    const d = levelsToDepth(levelsToCheck);

    // "at least" check
    const count = withinDepth(d).filter((n) => n.star >= starLevel).length;

    return {
      type,
      passed: count >= minUsers,
      actual: count,
      required: { starLevel, minUsers, levelsToCheck },
      note: "group_star uses 'at least' (>= starLevel)",
    };
  }

  if (type === "personal_rsp") {
    const { minRsp, monthsToCheck } = condition.personalRsp;
    const total = await sumMonthlyFieldForUsers({
      userIds: [ctx.userId],
      monthsToCheck,
      field: "rspCreated",
    });

    return {
      type,
      passed: total >= minRsp,
      actual: total,
      required: { minRsp, monthsToCheck },
      sourceField: "UserMonthlyCheckStats.rspCreated",
    };
  }

  if (type === "group_rsp") {
    const { minRsp, monthsToCheck, levelsToCheck } = condition.groupRsp;
    const d = levelsToDepth(levelsToCheck);
    const ids = withinDepth(d).map((n) => n.id);

    const total = await sumMonthlyFieldForUsers({
      userIds: ids,
      monthsToCheck,
      field: "rspCreated",
    });

    return {
      type,
      passed: total >= minRsp,
      actual: total,
      required: { minRsp, monthsToCheck, levelsToCheck },
      sourceField: "UserMonthlyCheckStats.rspCreated",
      downlineUsersConsidered: ids.length,
    };
  }

  if (type === "personal_check") {
    const { minChecksCreated, monthsToCheck } = condition.personalCheck;
    const total = await sumMonthlyFieldForUsers({
      userIds: [ctx.userId],
      monthsToCheck,
      field: "checksCreated",
    });

    return {
      type,
      passed: total >= minChecksCreated,
      actual: total,
      required: { minChecksCreated, monthsToCheck },
      sourceField: "UserMonthlyCheckStats.checksCreated",
    };
  }

  if (type === "group_check") {
    const { minChecksCreated, monthsToCheck, levelsToCheck } = condition.groupCheck;
    const d = levelsToDepth(levelsToCheck);
    const ids = withinDepth(d).map((n) => n.id);

    const total = await sumMonthlyFieldForUsers({
      userIds: ids,
      monthsToCheck,
      field: "checksCreated",
    });

    return {
      type,
      passed: total >= minChecksCreated,
      actual: total,
      required: { minChecksCreated, monthsToCheck, levelsToCheck },
      sourceField: "UserMonthlyCheckStats.checksCreated",
      downlineUsersConsidered: ids.length,
    };
  }

  return { type, passed: false, actual: null, required: null, error: "Unknown condition type" };
}

async function evalCriteriaBlock(criteria, ctx) {
  const isOr = !!criteria.isOr;
  const conditionResults = [];

  for (const cond of criteria.conditions || []) {
    const r = await evalCondition(cond, ctx);
    conditionResults.push(r);
  }

  const passed = isOr
    ? conditionResults.some((c) => c.passed)
    : conditionResults.every((c) => c.passed);

  return { isOr, passed, conditions: conditionResults };
}

/* ------------------ main eligibility function ------------------ */
async function checkNextStarEligibility(userId) {
  const user = await User.findById(userId).select("_id star").lean();
  if (!user) return { ok: false, status: 404, message: "User not found" };

  const currentStar = Number(user.star || 1);
  const targetStar = currentStar + 1;

  const rules = await getRulesArray();
  const starEntry = rules.find((r) => Number(r.starLevel) === targetStar);

  if (!starEntry) {
    return {
      ok: true,
      result: {
        userId: String(userId),
        currentStar,
        targetStar,
        eligible: false,
        reason: "No rules configured for this star level",
        criteriaResults: [],
      },
    };
  }

  // Determine max depth needed
  let maxDepthNeeded = 0;
  const allConditions = (starEntry.criterias || []).flatMap((c) => c.conditions || []);

  for (const cond of allConditions) {
    if (cond.type === "hotposition") {
      maxDepthNeeded = Math.max(maxDepthNeeded, levelsToDepth(cond.hotposition.levelsToCheck));
    }
    if (cond.type === "activeReferrals") {
      maxDepthNeeded = Math.max(maxDepthNeeded, levelsToDepth(cond.activeReferrals.levelsToCheck));
    }
    if (cond.type === "group_star") {
      maxDepthNeeded = Math.max(maxDepthNeeded, levelsToDepth(cond.groupStar.levelsToCheck));
    }
    if (cond.type === "group_rsp") {
      maxDepthNeeded = Math.max(maxDepthNeeded, levelsToDepth(cond.groupRsp.levelsToCheck));
    }
    if (cond.type === "group_check") {
      maxDepthNeeded = Math.max(maxDepthNeeded, levelsToDepth(cond.groupCheck.levelsToCheck));
    }
  }

  const useDepth = maxDepthNeeded === Infinity ? Number.MAX_SAFE_INTEGER : maxDepthNeeded;

  const downlineNodes =
    maxDepthNeeded && maxDepthNeeded > 0 ? await traverseDownlineBFS(user._id, useDepth) : [];

  const ctx = { userId: user._id, downlineNodes };

  const criteriaResults = [];
  for (let i = 0; i < (starEntry.criterias || []).length; i++) {
    const c = starEntry.criterias[i];
    const r = await evalCriteriaBlock(c, ctx);
    criteriaResults.push({ index: i, ...r });
  }

  const eligible = criteriaResults.some((c) => c.passed);

  return {
    ok: true,
    result: {
      userId: String(userId),
      currentStar,
      targetStar,
      eligible,
      traversal: {
        maxDepthUsed: maxDepthNeeded === Infinity ? "infinity" : maxDepthNeeded,
        nodesVisited: downlineNodes.length,
        safetyCap: MAX_TREE_NODES_CHECK,
      },
      criteriaResults,
    },
  };
}

/* ------------------ routes ------------------ */

/**
 * GET /api/star-eligibility-check
 * Optional ping
 */
router.get("/", protect, async (req, res) => {
  return res.json({ ok: true, message: "star-eligibility-check online" });
});

/**
 * GET /api/star-eligibility-check/me
 * Check eligibility for next star
 */
router.get("/me", protect, async (req, res) => {
  try {
    if (req.user?.isDisabled) return res.status(403).json({ message: "Account disabled" });

    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const out = await checkNextStarEligibility(userId);
    if (!out.ok) return res.status(out.status || 400).json({ message: out.message });

    return res.json(out.result);
  } catch (err) {
    console.error("Error in GET /star-eligibility-check/me:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/star-eligibility-check/level-up
 * Secure star upgrade:
 * - re-check eligibility on server
 * - only upgrades next star
 * - atomic update: only if user's star hasn't changed
 */
router.post("/level-up", protect, async (req, res) => {
  try {
    if (req.user?.isDisabled) return res.status(403).json({ message: "Account disabled" });

    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    // 1) Check eligibility
    const out = await checkNextStarEligibility(userId);
    if (!out.ok) return res.status(out.status || 400).json({ message: out.message });

    const result = out.result;

    if (!result.eligible) {
      return res.status(400).json({
        message: "Not eligible for star upgrade yet",
        ...result, // includes criteriaResults so frontend can show what failed
      });
    }

    // 2) Atomic upgrade:
    // only update if current star is still what we checked
    const updated = await User.findOneAndUpdate(
      { _id: userId, star: result.currentStar },
      { $set: { star: result.targetStar } },
      { new: true }
    ).select("_id star");

    if (!updated) {
      // Someone already upgraded, or star changed since check
      const fresh = await User.findById(userId).select("_id star").lean();
      return res.status(409).json({
        message: "Star changed before upgrade could be applied. Please retry.",
        currentStar: fresh?.star ?? null,
      });
    }

    return res.json({
      message: "Star upgraded successfully",
      userId: String(userId),
      fromStar: result.currentStar,
      toStar: updated.star,
    });
  } catch (err) {
    console.error("Error in POST /star-eligibility-check/level-up:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
