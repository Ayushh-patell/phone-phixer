import express from "express";
import UniversalSettings from "../models/UniversalSettings.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

const SETTINGS_KEY = "star_eligibility_criterias";

// ---------- auth helpers ----------
const requireAdmin = (req, res, next) => {
  const user = req.user;

  if (!user) return res.status(401).json({ message: "Not authenticated" });

  const isAdmin = user.isAdmin || user.role === "admin";
  if (!isAdmin) return res.status(403).json({ message: "Admins only" });

  return next();
};

// ---------- validation helpers ----------
const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

const isLevelsToCheckValid = (v) => v === "infinity" || isPositiveInt(v);

const CONDITION_TYPES = new Set([
  "hotposition",
  "activeReferrals",
  "personal_rsp",
  "group_rsp",
  "group_star",
  "personal_check",
  "group_check",
]);

/**
 * Returns { ok: true } or { ok:false, message }
 * This validates ONE condition object.
 */
function validateCondition(condition) {
  if (!condition || typeof condition !== "object") {
    return { ok: false, message: "Condition must be an object." };
  }

  const { type } = condition;
  if (!type || typeof type !== "string" || !CONDITION_TYPES.has(type)) {
    return { ok: false, message: `Invalid condition type '${type}'.` };
  }

  const payloadMap = {
    hotposition: "hotposition",
    activeReferrals: "activeReferrals",
    personal_rsp: "personalRsp",
    group_rsp: "groupRsp",
    group_star: "groupStar",
    personal_check: "personalCheck",
    group_check: "groupCheck",
  };

  const requiredPayloadKey = payloadMap[type];

  // Ensure exactly one payload exists and it is the correct one
  const payloadKeys = Object.values(payloadMap);
  const present = payloadKeys.filter((k) => condition[k] != null);

  if (present.length !== 1 || present[0] !== requiredPayloadKey) {
    return {
      ok: false,
      message: `Condition type '${type}' must include only '${requiredPayloadKey}' payload.`,
    };
  }

  const payload = condition[requiredPayloadKey];
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: `Payload '${requiredPayloadKey}' must be an object.` };
  }

  // Type-specific checks
  if (type === "hotposition") {
    if (!isPositiveInt(payload.minCount)) return { ok: false, message: "hotposition.minCount must be a positive integer." };
    if (!isLevelsToCheckValid(payload.levelsToCheck)) return { ok: false, message: "hotposition.levelsToCheck must be a positive integer or 'infinity'." };
  }

  if (type === "activeReferrals") {
    if (!isPositiveInt(payload.minCount)) return { ok: false, message: "activeReferrals.minCount must be a positive integer." };
    if (!isLevelsToCheckValid(payload.levelsToCheck)) return { ok: false, message: "activeReferrals.levelsToCheck must be a positive integer or 'infinity'." };
  }

  if (type === "personal_rsp") {
    if (typeof payload.minRsp !== "number" || payload.minRsp < 0) return { ok: false, message: "personalRsp.minRsp must be a number >= 0." };
    if (!isPositiveInt(payload.monthsToCheck)) return { ok: false, message: "personalRsp.monthsToCheck must be a positive integer." };
  }

  if (type === "group_rsp") {
    if (typeof payload.minRsp !== "number" || payload.minRsp < 0) return { ok: false, message: "groupRsp.minRsp must be a number >= 0." };
    if (!isPositiveInt(payload.monthsToCheck)) return { ok: false, message: "groupRsp.monthsToCheck must be a positive integer." };
    if (!isLevelsToCheckValid(payload.levelsToCheck)) return { ok: false, message: "groupRsp.levelsToCheck must be a positive integer or 'infinity'." };
  }

  if (type === "group_star") {
    if (!isPositiveInt(payload.starLevel)) return { ok: false, message: "groupStar.starLevel must be a positive integer." };
    if (!isPositiveInt(payload.minUsers)) return { ok: false, message: "groupStar.minUsers must be a positive integer." };
    if (!isLevelsToCheckValid(payload.levelsToCheck)) return { ok: false, message: "groupStar.levelsToCheck must be a positive integer or 'infinity'." };
  }

  if (type === "personal_check") {
    if (!Number.isInteger(payload.minChecksCreated) || payload.minChecksCreated < 0) {
      return { ok: false, message: "personalCheck.minChecksCreated must be an integer >= 0." };
    }
    if (!isPositiveInt(payload.monthsToCheck)) return { ok: false, message: "personalCheck.monthsToCheck must be a positive integer." };
  }

  if (type === "group_check") {
    if (!Number.isInteger(payload.minChecksCreated) || payload.minChecksCreated < 0) {
      return { ok: false, message: "groupCheck.minChecksCreated must be an integer >= 0." };
    }
    if (!isPositiveInt(payload.monthsToCheck)) return { ok: false, message: "groupCheck.monthsToCheck must be a positive integer." };
    if (!isLevelsToCheckValid(payload.levelsToCheck)) return { ok: false, message: "groupCheck.levelsToCheck must be a positive integer or 'infinity'." };
  }

  return { ok: true };
}

/**
 * Validate a criteria block:
 * { isOr?: boolean, conditions: Condition[] }
 */
function validateCriteria(criteria) {
  if (!criteria || typeof criteria !== "object") {
    return { ok: false, message: "Criteria must be an object." };
  }

  if (typeof criteria.isOr !== "undefined" && typeof criteria.isOr !== "boolean") {
    return { ok: false, message: "criteria.isOr must be boolean." };
  }

  if (!Array.isArray(criteria.conditions) || criteria.conditions.length === 0) {
    return { ok: false, message: "criteria.conditions must be a non-empty array." };
  }

  for (let i = 0; i < criteria.conditions.length; i++) {
    const v = validateCondition(criteria.conditions[i]);
    if (!v.ok) return { ok: false, message: `criteria.conditions[${i}]: ${v.message}` };
  }

  return { ok: true };
}

/**
 * Validate one star level entry:
 * { starLevel: number, criterias: Criteria[] }
 */
function validateStarLevelEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return { ok: false, message: "Star level entry must be an object." };
  }

  if (!isPositiveInt(entry.starLevel)) {
    return { ok: false, message: "starLevel must be a positive integer." };
  }

  if (!Array.isArray(entry.criterias)) {
    return { ok: false, message: "criterias must be an array." };
  }

  for (let i = 0; i < entry.criterias.length; i++) {
    const v = validateCriteria(entry.criterias[i]);
    if (!v.ok) return { ok: false, message: `criterias[${i}]: ${v.message}` };
  }

  return { ok: true };
}

/**
 * Validate full value:
 * value: StarLevelEntry[]
 * Also enforces unique starLevel.
 */
function validateFullRules(value) {
  if (!Array.isArray(value)) {
    return { ok: false, message: "value must be an array." };
  }

  const seen = new Set();
  for (let i = 0; i < value.length; i++) {
    const entry = value[i];
    const v = validateStarLevelEntry(entry);
    if (!v.ok) return { ok: false, message: `value[${i}]: ${v.message}` };

    if (seen.has(entry.starLevel)) {
      return { ok: false, message: `Duplicate starLevel ${entry.starLevel} in rules.` };
    }
    seen.add(entry.starLevel);
  }

  return { ok: true };
}

// ---------- DB helpers ----------
async function getRulesDoc() {
  return UniversalSettings.findOne({ key: SETTINGS_KEY }).select("-__v");
}

async function upsertRules(value, description) {
  const update = { value };
  if (typeof description !== "undefined") update.description = description;

  return UniversalSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: update },
    { new: true, upsert: true }
  ).select("-__v");
}

async function ensureRulesArray() {
  const doc = await getRulesDoc();
  if (!doc) return [];
  if (!Array.isArray(doc.value)) return [];
  return doc.value;
}

// ---------- routes ----------

/**
 * ADMIN: Get star eligibility rules
 * GET /settings/star-eligibility
 */
router.get("/", protect, requireAdmin, async (req, res) => {
  try {
    const doc = await getRulesDoc();
    return res.json(
      doc || {
        key: SETTINGS_KEY,
        description: "Eligibility rules per star level for upgrades",
        value: [],
      }
    );
  } catch (err) {
    console.error("Error fetching star eligibility rules:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: Replace entire rules array
 * PUT /settings/star-eligibility
 * body: { value: StarLevelEntry[], description?: string }
 */
router.put("/", protect, requireAdmin, async (req, res) => {
  try {
    const { value, description } = req.body;

    if (typeof value === "undefined") {
      return res.status(400).json({ message: "value is required" });
    }

    const v = validateFullRules(value);
    if (!v.ok) return res.status(400).json({ message: v.message });

    const doc = await upsertRules(value, description);
    return res.json(doc);
  } catch (err) {
    console.error("Error replacing star eligibility rules:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: Add (or upsert) one star level entry
 * POST /settings/star-eligibility/levels
 * body: StarLevelEntry
 *
 * If starLevel exists, it will be replaced.
 */
router.post("/levels", protect, requireAdmin, async (req, res) => {
  try {
    const entry = req.body;

    const v = validateStarLevelEntry(entry);
    if (!v.ok) return res.status(400).json({ message: v.message });

    const current = await ensureRulesArray();

    const idx = current.findIndex((x) => x.starLevel === entry.starLevel);
    if (idx >= 0) current[idx] = entry;
    else current.push(entry);

    // Keep consistent ordering by starLevel
    current.sort((a, b) => a.starLevel - b.starLevel);

    const doc = await upsertRules(current);
    return res.json(doc);
  } catch (err) {
    console.error("Error upserting star level entry:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: Update one star level entry (same as upsert but explicit)
 * PUT /settings/star-eligibility/levels/:starLevel
 * body: { criterias: Criteria[] }
 */
router.put("/levels/:starLevel", protect, requireAdmin, async (req, res) => {
  try {
    const starLevel = Number(req.params.starLevel);
    if (!isPositiveInt(starLevel)) return res.status(400).json({ message: "Invalid starLevel" });

    const { criterias } = req.body;
    if (!Array.isArray(criterias)) return res.status(400).json({ message: "criterias must be an array" });

    // Validate by constructing full entry
    const entry = { starLevel, criterias };
    const v = validateStarLevelEntry(entry);
    if (!v.ok) return res.status(400).json({ message: v.message });

    const current = await ensureRulesArray();
    const idx = current.findIndex((x) => x.starLevel === starLevel);
    if (idx < 0) return res.status(404).json({ message: "Star level entry not found" });

    current[idx] = entry;
    current.sort((a, b) => a.starLevel - b.starLevel);

    const doc = await upsertRules(current);
    return res.json(doc);
  } catch (err) {
    console.error("Error updating star level entry:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: Delete one star level entry
 * DELETE /settings/star-eligibility/levels/:starLevel
 */
router.delete("/levels/:starLevel", protect, requireAdmin, async (req, res) => {
  try {
    const starLevel = Number(req.params.starLevel);
    if (!isPositiveInt(starLevel)) return res.status(400).json({ message: "Invalid starLevel" });

    const current = await ensureRulesArray();
    const next = current.filter((x) => x.starLevel !== starLevel);

    if (next.length === current.length) {
      return res.status(404).json({ message: "Star level entry not found" });
    }

    const doc = await upsertRules(next);
    return res.json(doc);
  } catch (err) {
    console.error("Error deleting star level entry:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: Add a criteria block to a starLevel
 * POST /settings/star-eligibility/levels/:starLevel/criterias
 * body: Criteria
 */
router.post("/levels/:starLevel/criterias", protect, requireAdmin, async (req, res) => {
  try {
    const starLevel = Number(req.params.starLevel);
    if (!isPositiveInt(starLevel)) return res.status(400).json({ message: "Invalid starLevel" });

    const criteria = req.body;
    const cv = validateCriteria(criteria);
    if (!cv.ok) return res.status(400).json({ message: cv.message });

    const current = await ensureRulesArray();
    const idx = current.findIndex((x) => x.starLevel === starLevel);
    if (idx < 0) {
      // create new level entry if missing
      current.push({ starLevel, criterias: [criteria] });
    } else {
      current[idx].criterias = Array.isArray(current[idx].criterias) ? current[idx].criterias : [];
      current[idx].criterias.push(criteria);
    }

    current.sort((a, b) => a.starLevel - b.starLevel);

    const doc = await upsertRules(current);
    return res.json(doc);
  } catch (err) {
    console.error("Error adding criteria:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: Update criteria block by index
 * PUT /settings/star-eligibility/levels/:starLevel/criterias/:index
 * body: Criteria
 */
router.put("/levels/:starLevel/criterias/:index", protect, requireAdmin, async (req, res) => {
  try {
    const starLevel = Number(req.params.starLevel);
    const index = Number(req.params.index);

    if (!isPositiveInt(starLevel)) return res.status(400).json({ message: "Invalid starLevel" });
    if (!Number.isInteger(index) || index < 0) return res.status(400).json({ message: "Invalid index" });

    const criteria = req.body;
    const cv = validateCriteria(criteria);
    if (!cv.ok) return res.status(400).json({ message: cv.message });

    const current = await ensureRulesArray();
    const idx = current.findIndex((x) => x.starLevel === starLevel);
    if (idx < 0) return res.status(404).json({ message: "Star level entry not found" });

    const list = Array.isArray(current[idx].criterias) ? current[idx].criterias : [];
    if (index >= list.length) return res.status(404).json({ message: "Criteria index out of range" });

    list[index] = criteria;
    current[idx].criterias = list;

    const doc = await upsertRules(current);
    return res.json(doc);
  } catch (err) {
    console.error("Error updating criteria:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * ADMIN: Delete criteria block by index
 * DELETE /settings/star-eligibility/levels/:starLevel/criterias/:index
 */
router.delete("/levels/:starLevel/criterias/:index", protect, requireAdmin, async (req, res) => {
  try {
    const starLevel = Number(req.params.starLevel);
    const index = Number(req.params.index);

    if (!isPositiveInt(starLevel)) return res.status(400).json({ message: "Invalid starLevel" });
    if (!Number.isInteger(index) || index < 0) return res.status(400).json({ message: "Invalid index" });

    const current = await ensureRulesArray();
    const idx = current.findIndex((x) => x.starLevel === starLevel);
    if (idx < 0) return res.status(404).json({ message: "Star level entry not found" });

    const list = Array.isArray(current[idx].criterias) ? current[idx].criterias : [];
    if (index >= list.length) return res.status(404).json({ message: "Criteria index out of range" });

    list.splice(index, 1);
    current[idx].criterias = list;

    const doc = await upsertRules(current);
    return res.json(doc);
  } catch (err) {
    console.error("Error deleting criteria:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
