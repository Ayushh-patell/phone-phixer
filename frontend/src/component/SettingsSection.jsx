import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FiRefreshCw,
  FiSave,
  FiAlertTriangle,
  FiCheckCircle,
  FiPlus,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const SETTINGS_STAR_LEVELS = "star_levels";
const SETTINGS_STAR_ELIG = "star_eligibility_criterias";

const CONDITION_TYPES = [
  { value: "hotposition", label: "Hot positions" },
  { value: "activeReferrals", label: "Active referrals" },
  { value: "personal_rsp", label: "Personal RSP" },
  { value: "group_rsp", label: "Group RSP" },
  { value: "group_star", label: "Group star members" },
  { value: "personal_check", label: "Personal checks" },
  { value: "group_check", label: "Group checks" },
];

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

const SettingsSection = () => {
  const token = sessionStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // full list from GET /settings
  const [settings, setSettings] = useState([]);

  // Editors
  const [starLevels, setStarLevels] = useState([]); // value array
  const [eligRules, setEligRules] = useState([]); // value array

  // For "other settings" simple inputs
  const [simpleDraft, setSimpleDraft] = useState({}); // key -> string/number/boolean or JSON text

  // Collapse state for eligibility per starLevel
  const [openStarLevels, setOpenStarLevels] = useState({}); // starLevel -> bool

  const loadAll = async () => {
    setLoading(true);
    setErr("");
    setOkMsg("");

    try {
      const res = await axios.get(`${API_BASE_URL}/settings`);
      const list = Array.isArray(res.data) ? res.data : [];
      setSettings(list);

      const starLevelsDoc = list.find((s) => s?.key === SETTINGS_STAR_LEVELS);
      const eligDoc = list.find((s) => s?.key === SETTINGS_STAR_ELIG);

      const sl = Array.isArray(starLevelsDoc?.value) ? starLevelsDoc.value : [];
      const er = Array.isArray(eligDoc?.value) ? eligDoc.value : [];

      setStarLevels(sl);
      setEligRules(er);

      // Initialize drafts for all other simple settings
      const draft = {};
      for (const s of list) {
        if (!s?.key) continue;
        if (s.key === SETTINGS_STAR_LEVELS || s.key === SETTINGS_STAR_ELIG) continue;

        const v = s.value;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          draft[s.key] = v;
        } else {
          // fallback (only used if you have object/array settings)
          draft[s.key] = JSON.stringify(v ?? null, null, 2);
        }
      }
      setSimpleDraft(draft);

      // default open next few eligibility groups
      const open = {};
      for (const e of er) open[e.starLevel] = false;
      setOpenStarLevels(open);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSetting = async (key, value) => {
    setSavingKey(key);
    setErr("");
    setOkMsg("");

    try {
      const res = await axios.put(
        `${API_BASE_URL}/settings/${key}`,
        { value },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // update local list
      setSettings((prev) => {
        const next = [...prev];
        const idx = next.findIndex((s) => s.key === key);
        if (idx >= 0) next[idx] = res.data;
        else next.push(res.data);
        return next;
      });

      setOkMsg(`Saved "${key}" successfully.`);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to save setting");
    } finally {
      setSavingKey("");
    }
  };

  /* ------------------------- STAR LEVELS UI ------------------------- */
  const starLevelsSorted = useMemo(() => {
    return [...starLevels].sort((a, b) => (a?.lvl ?? 0) - (b?.lvl ?? 0));
  }, [starLevels]);

  const validateStarLevels = (arr) => {
    if (!Array.isArray(arr)) return { ok: false, message: "Star levels must be a list." };

    for (let i = 0; i < arr.length; i++) {
      const r = arr[i];
      if (!r || typeof r !== "object") return { ok: false, message: `Row ${i + 1} is invalid.` };
      if (!isPositiveInt(r.lvl)) return { ok: false, message: `Row ${i + 1}: level must be 1 or more.` };
      if (!String(r.name || "").trim()) return { ok: false, message: `Row ${i + 1}: name is required.` };
      if (typeof r.checkPrice !== "number" || r.checkPrice < 0) {
        return { ok: false, message: `Row ${i + 1}: check price must be 0 or more.` };
      }
    }

    const levels = arr.map((x) => x.lvl);
    if (new Set(levels).size !== levels.length) {
      return { ok: false, message: "Star level numbers must be unique." };
    }

    return { ok: true };
  };

  const onSaveStarLevels = async () => {
    const v = validateStarLevels(starLevels);
    if (!v.ok) {
      setErr(v.message);
      return;
    }
    await saveSetting(SETTINGS_STAR_LEVELS, starLevelsSorted);
  };

  const addStarLevel = () => {
    // next lvl suggestion
    const maxLvl = starLevels.reduce((m, s) => Math.max(m, Number(s?.lvl || 0)), 0);
    setStarLevels((prev) => [
      ...prev,
      { lvl: maxLvl + 1, name: "New Star", checkPrice: 0 },
    ]);
  };

  const updateStarLevelRow = (idx, patch) => {
    setStarLevels((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const deleteStarLevelRow = (idx) => {
    setStarLevels((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ------------------- ELIGIBILITY UI (human readable) ------------------- */
  const toggleStarOpen = (starLevel) => {
    setOpenStarLevels((prev) => ({ ...prev, [starLevel]: !prev[starLevel] }));
  };

  const addEligibilityStarLevel = () => {
    // optional: allow admins to add starLevel entry inside existing setting (this is still "update", not create a new setting key)
    const existing = new Set(eligRules.map((x) => x.starLevel));
    const max = eligRules.reduce((m, e) => Math.max(m, Number(e?.starLevel || 0)), 0);
    let nextStarLevel = max + 1;
    while (existing.has(nextStarLevel)) nextStarLevel++;

    setEligRules((prev) => [
      ...prev,
      { starLevel: nextStarLevel, criterias: [{ isOr: false, conditions: [] }] },
    ]);
    setOpenStarLevels((prev) => ({ ...prev, [nextStarLevel]: true }));
  };

  const deleteEligibilityStarLevel = (starLevel) => {
    setEligRules((prev) => prev.filter((e) => e.starLevel !== starLevel));
    setOpenStarLevels((prev) => {
      const n = { ...prev };
      delete n[starLevel];
      return n;
    });
  };

  const addCriteriaBlock = (starLevel) => {
    setEligRules((prev) =>
      prev.map((e) =>
        e.starLevel === starLevel
          ? { ...e, criterias: [...(e.criterias || []), { isOr: false, conditions: [] }] }
          : e
      )
    );
  };

  const deleteCriteriaBlock = (starLevel, cIndex) => {
    setEligRules((prev) =>
      prev.map((e) =>
        e.starLevel === starLevel
          ? { ...e, criterias: (e.criterias || []).filter((_, i) => i !== cIndex) }
          : e
      )
    );
  };

  const updateCriteriaBlock = (starLevel, cIndex, patch) => {
    setEligRules((prev) =>
      prev.map((e) => {
        if (e.starLevel !== starLevel) return e;
        const list = [...(e.criterias || [])];
        list[cIndex] = { ...list[cIndex], ...patch };
        return { ...e, criterias: list };
      })
    );
  };

  const addCondition = (starLevel, cIndex) => {
    const defaultCond = {
      type: "activeReferrals",
      activeReferrals: { minCount: 1, levelsToCheck: 1 },
    };

    setEligRules((prev) =>
      prev.map((e) => {
        if (e.starLevel !== starLevel) return e;
        const criterias = [...(e.criterias || [])];
        const block = { ...(criterias[cIndex] || { isOr: false, conditions: [] }) };
        const conditions = [...(block.conditions || []), defaultCond];
        criterias[cIndex] = { ...block, conditions };
        return { ...e, criterias };
      })
    );
  };

  const deleteCondition = (starLevel, cIndex, condIndex) => {
    setEligRules((prev) =>
      prev.map((e) => {
        if (e.starLevel !== starLevel) return e;
        const criterias = [...(e.criterias || [])];
        const block = { ...(criterias[cIndex] || { isOr: false, conditions: [] }) };
        const conditions = (block.conditions || []).filter((_, i) => i !== condIndex);
        criterias[cIndex] = { ...block, conditions };
        return { ...e, criterias };
      })
    );
  };

  const setConditionType = (starLevel, cIndex, condIndex, newType) => {
    // enforce union payload: keep exactly one payload matching the type
    const makePayload = (t) => {
      if (t === "hotposition") return { hotposition: { minCount: 1, levelsToCheck: 1 } };
      if (t === "activeReferrals") return { activeReferrals: { minCount: 1, levelsToCheck: 1 } };
      if (t === "personal_rsp") return { personalRsp: { minRsp: 0, monthsToCheck: 1 } };
      if (t === "group_rsp") return { groupRsp: { minRsp: 0, monthsToCheck: 1, levelsToCheck: 1 } };
      if (t === "group_star") return { groupStar: { starLevel: 1, minUsers: 1, levelsToCheck: 1 } };
      if (t === "personal_check") return { personalCheck: { minChecksCreated: 0, monthsToCheck: 1 } };
      if (t === "group_check") return { groupCheck: { minChecksCreated: 0, monthsToCheck: 1, levelsToCheck: 1 } };
      return {};
    };

    setEligRules((prev) =>
      prev.map((e) => {
        if (e.starLevel !== starLevel) return e;

        const criterias = [...(e.criterias || [])];
        const block = { ...(criterias[cIndex] || { isOr: false, conditions: [] }) };
        const conditions = [...(block.conditions || [])];

        const next = {
          type: newType,
          ...makePayload(newType),
        };

        conditions[condIndex] = next;
        criterias[cIndex] = { ...block, conditions };
        return { ...e, criterias };
      })
    );
  };

  const setLevelsToCheckField = (obj, val) => {
    if (val === "infinity") return "infinity";
    const n = Number(val);
    if (!Number.isFinite(n) || !isPositiveInt(n)) return 1;
    return n;
  };

  const updateConditionPayload = (starLevel, cIndex, condIndex, updater) => {
    setEligRules((prev) =>
      prev.map((e) => {
        if (e.starLevel !== starLevel) return e;
        const criterias = [...(e.criterias || [])];
        const block = { ...(criterias[cIndex] || { isOr: false, conditions: [] }) };
        const conditions = [...(block.conditions || [])];
        const cond = { ...(conditions[condIndex] || {}) };

        const updated = updater(cond);
        conditions[condIndex] = updated;

        criterias[cIndex] = { ...block, conditions };
        return { ...e, criterias };
      })
    );
  };

  const eligRulesSorted = useMemo(() => {
    return [...eligRules].sort((a, b) => (a?.starLevel ?? 0) - (b?.starLevel ?? 0));
  }, [eligRules]);

  const validateEligibility = (value) => {
    if (!Array.isArray(value)) return { ok: false, message: "Eligibility rules must be a list." };

    const seen = new Set();
    for (let i = 0; i < value.length; i++) {
      const e = value[i];
      if (!e || typeof e !== "object") return { ok: false, message: `Rule #${i + 1} invalid.` };
      if (!isPositiveInt(e.starLevel)) return { ok: false, message: `Rule #${i + 1}: starLevel must be 1+.` };
      if (seen.has(e.starLevel)) return { ok: false, message: `Duplicate starLevel: ${e.starLevel}` };
      seen.add(e.starLevel);

      if (!Array.isArray(e.criterias)) return { ok: false, message: `Star ${e.starLevel}: criterias must be a list.` };
      for (let j = 0; j < e.criterias.length; j++) {
        const c = e.criterias[j];
        if (!c || typeof c !== "object") return { ok: false, message: `Star ${e.starLevel}, set #${j + 1} invalid.` };
        if (typeof c.isOr !== "boolean") return { ok: false, message: `Star ${e.starLevel}, set #${j + 1}: isOr must be true/false.` };
        if (!Array.isArray(c.conditions) || c.conditions.length === 0) {
          return { ok: false, message: `Star ${e.starLevel}, set #${j + 1}: add at least one condition.` };
        }
        // deeper validation is already enforced by backend star-eligibility routes you shared
      }
    }

    return { ok: true };
  };

  const onSaveEligibility = async () => {
    const v = validateEligibility(eligRulesSorted);
    if (!v.ok) {
      setErr(v.message);
      return;
    }
    await saveSetting(SETTINGS_STAR_ELIG, eligRulesSorted);
  };

  /* --------------------- OTHER SIMPLE SETTINGS UI --------------------- */
  const otherSettings = useMemo(() => {
    return (settings || [])
      .filter((s) => s?.key && s.key !== SETTINGS_STAR_LEVELS && s.key !== SETTINGS_STAR_ELIG)
      .sort((a, b) => String(a.key).localeCompare(String(b.key)));
  }, [settings]);

  const saveOtherSetting = async (s) => {
    const key = s.key;
    const currentValue = s.value;
    const draft = simpleDraft[key];

    // type check + convert
    let nextValue = draft;

    if (typeof currentValue === "number") {
      const n = Number(draft);
      if (!Number.isFinite(n)) {
        setErr(`"${key}" must be a number.`);
        return;
      }
      nextValue = n;
    } else if (typeof currentValue === "boolean") {
      nextValue = Boolean(draft);
    } else if (typeof currentValue === "string") {
      nextValue = String(draft ?? "");
    } else {
      // object/array fallback: JSON
      try {
        nextValue = JSON.parse(String(draft));
      } catch {
        setErr(`"${key}" must be valid JSON.`);
        return;
      }
    }

    await saveSetting(key, nextValue);
  };

  return (
    <div className="mt-6 space-y-5">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="h-1.5 w-full bg-prim" />
        <div className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500">Settings</div>
              <div className="mt-1 text-lg font-semibold text-neutral-900">Universal settings</div>
              <div className="mt-1 text-sm text-neutral-600">
                Update existing settings only.
              </div>
            </div>

            <button
              onClick={loadAll}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-60"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {err ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <FiAlertTriangle className="mt-0.5 h-4 w-4" />
                <span>{err}</span>
              </div>
            </div>
          ) : null}

          {okMsg ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              <div className="flex items-start gap-2">
                <FiCheckCircle className="mt-0.5 h-4 w-4" />
                <span>{okMsg}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-neutral-200 border-t-prim" />
            Loading…
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* STAR LEVELS */}
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-prim" />
            <div className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Star levels</div>
                  <div className="text-xs text-neutral-600">Key: <span className="font-mono">star_levels</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={addStarLevel}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
                  >
                    <FiPlus className="h-4 w-4" /> Add
                  </button>
                  <button
                    onClick={onSaveStarLevels}
                    disabled={savingKey === SETTINGS_STAR_LEVELS}
                    className="inline-flex items-center gap-2 rounded-xl bg-prim px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <FiSave className="h-4 w-4" />
                    {savingKey === SETTINGS_STAR_LEVELS ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {starLevelsSorted.length === 0 ? (
                  <div className="text-sm text-neutral-600">No star levels set.</div>
                ) : (
                  starLevelsSorted.map((s, idx) => (
                    <div
                      key={`${s.lvl}-${idx}`}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                    >
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <div className="text-[11px] text-neutral-500">Level</div>
                          <input
                            type="number"
                            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                            value={s.lvl ?? ""}
                            onChange={(e) =>
                              updateStarLevelRow(idx, { lvl: Number(e.target.value) })
                            }
                          />
                        </div>

                        <div className="col-span-6">
                          <div className="text-[11px] text-neutral-500">Name</div>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                            value={s.name ?? ""}
                            onChange={(e) => updateStarLevelRow(idx, { name: e.target.value })}
                          />
                        </div>

                        <div className="col-span-3">
                          <div className="text-[11px] text-neutral-500">Check price (₹)</div>
                          <input
                            type="number"
                            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                            value={s.checkPrice ?? 0}
                            onChange={(e) =>
                              updateStarLevelRow(idx, { checkPrice: Number(e.target.value) })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => deleteStarLevelRow(idx)}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                        >
                          <FiTrash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ELIGIBILITY RULES */}
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-prim" />
            <div className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">Star eligibility</div>
                  <div className="text-xs text-neutral-600">
                    Key: <span className="font-mono">star_eligibility_criterias</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={addEligibilityStarLevel}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-900"
                  >
                    <FiPlus className="h-4 w-4" /> Add star
                  </button>
                  <button
                    onClick={onSaveEligibility}
                    disabled={savingKey === SETTINGS_STAR_ELIG}
                    className="inline-flex items-center gap-2 rounded-xl bg-prim px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <FiSave className="h-4 w-4" />
                    {savingKey === SETTINGS_STAR_ELIG ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {eligRulesSorted.length === 0 ? (
                  <div className="text-sm text-neutral-600">No eligibility rules set.</div>
                ) : (
                  eligRulesSorted.map((rule) => {
                    const isOpen = !!openStarLevels[rule.starLevel];
                    const criterias = Array.isArray(rule.criterias) ? rule.criterias : [];

                    return (
                      <div key={rule.starLevel} className="rounded-xl border border-neutral-200 bg-white">
                        <button
                          onClick={() => toggleStarOpen(rule.starLevel)}
                          className="w-full flex items-center justify-between px-3 py-2"
                        >
                          <div className="text-sm font-semibold text-neutral-900">
                            Star level {rule.starLevel}
                          </div>
                          <div className="text-neutral-700">
                            {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                          </div>
                        </button>

                        {isOpen ? (
                          <div className="px-3 pb-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-neutral-600">
                                Requirement sets: {criterias.length}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => addCriteriaBlock(rule.starLevel)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-semibold text-neutral-900"
                                >
                                  <FiPlus className="h-4 w-4" /> Add set
                                </button>
                                <button
                                  onClick={() => deleteEligibilityStarLevel(rule.starLevel)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                                >
                                  <FiTrash2 className="h-4 w-4" /> Remove star
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 space-y-2">
                              {criterias.length === 0 ? (
                                <div className="text-sm text-neutral-600">
                                  Add at least one requirement set.
                                </div>
                              ) : (
                                criterias.map((c, cIndex) => {
                                  const conditions = Array.isArray(c.conditions) ? c.conditions : [];
                                  const modeLabel = c.isOr
                                    ? "Any ONE condition is enough"
                                    : "ALL conditions are required";

                                  return (
                                    <div
                                      key={cIndex}
                                      className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="text-sm font-semibold text-neutral-900">
                                            Set #{cIndex + 1}
                                          </div>
                                          <div className="text-xs text-neutral-600">{modeLabel}</div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <select
                                            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-900"
                                            value={c.isOr ? "or" : "and"}
                                            onChange={(e) =>
                                              updateCriteriaBlock(rule.starLevel, cIndex, {
                                                isOr: e.target.value === "or",
                                              })
                                            }
                                          >
                                            <option value="and">AND (need all)</option>
                                            <option value="or">OR (need any)</option>
                                          </select>

                                          <button
                                            onClick={() => addCondition(rule.starLevel, cIndex)}
                                            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-900"
                                          >
                                            <FiPlus className="h-4 w-4" /> Add condition
                                          </button>

                                          <button
                                            onClick={() => deleteCriteriaBlock(rule.starLevel, cIndex)}
                                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                                          >
                                            <FiTrash2 className="h-4 w-4" /> Remove set
                                          </button>
                                        </div>
                                      </div>

                                      <div className="mt-3 space-y-2">
                                        {conditions.length === 0 ? (
                                          <div className="text-sm text-neutral-600">
                                            No conditions yet — add one.
                                          </div>
                                        ) : (
                                          conditions.map((cond, condIndex) => {
                                            const type = cond?.type;

                                            const renderLevelsToCheck = (value, onChange) => (
                                              <div className="col-span-3">
                                                <div className="text-[11px] text-neutral-500">
                                                  Depth
                                                </div>
                                                <select
                                                  className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                  value={value === "infinity" ? "infinity" : String(value)}
                                                  onChange={(e) => onChange(e.target.value)}
                                                >
                                                  <option value="1">1 level</option>
                                                  <option value="2">2 levels</option>
                                                  <option value="3">3 levels</option>
                                                  <option value="4">4 levels</option>
                                                  <option value="5">5 levels</option>
                                                  <option value="10">10 levels</option>
                                                  <option value="infinity">All levels</option>
                                                </select>
                                              </div>
                                            );

                                            return (
                                              <div
                                                key={condIndex}
                                                className="rounded-xl border border-neutral-200 bg-white p-3"
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="text-xs font-semibold text-neutral-900">
                                                    Condition #{condIndex + 1}
                                                  </div>
                                                  <button
                                                    onClick={() =>
                                                      deleteCondition(rule.starLevel, cIndex, condIndex)
                                                    }
                                                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                                                  >
                                                    <FiTrash2 className="h-4 w-4" />
                                                    Remove
                                                  </button>
                                                </div>

                                                <div className="mt-2 grid grid-cols-12 gap-2 items-end">
                                                  <div className="col-span-4">
                                                    <div className="text-[11px] text-neutral-500">
                                                      Type
                                                    </div>
                                                    <select
                                                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                      value={type}
                                                      onChange={(e) =>
                                                        setConditionType(
                                                          rule.starLevel,
                                                          cIndex,
                                                          condIndex,
                                                          e.target.value
                                                        )
                                                      }
                                                    >
                                                      {CONDITION_TYPES.map((t) => (
                                                        <option key={t.value} value={t.value}>
                                                          {t.label}
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </div>

                                                  {/* hotposition */}
                                                  {type === "hotposition" ? (
                                                    <>
                                                      <div className="col-span-5">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Need at least
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.hotposition?.minCount ?? 1}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                hotposition: {
                                                                  ...cnd.hotposition,
                                                                  minCount: Number(e.target.value),
                                                                  levelsToCheck:
                                                                    cnd.hotposition?.levelsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          hot positions
                                                        </div>
                                                      </div>
                                                      {renderLevelsToCheck(
                                                        cond.hotposition?.levelsToCheck ?? 1,
                                                        (val) =>
                                                          updateConditionPayload(
                                                            rule.starLevel,
                                                            cIndex,
                                                            condIndex,
                                                            (cnd) => ({
                                                              ...cnd,
                                                              hotposition: {
                                                                ...cnd.hotposition,
                                                                minCount: cnd.hotposition?.minCount ?? 1,
                                                                levelsToCheck: setLevelsToCheckField(
                                                                  cnd.hotposition,
                                                                  val
                                                                ),
                                                              },
                                                            })
                                                          )
                                                      )}
                                                    </>
                                                  ) : null}

                                                  {/* activeReferrals */}
                                                  {type === "activeReferrals" ? (
                                                    <>
                                                      <div className="col-span-5">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Need at least
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.activeReferrals?.minCount ?? 1}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                activeReferrals: {
                                                                  ...cnd.activeReferrals,
                                                                  minCount: Number(e.target.value),
                                                                  levelsToCheck:
                                                                    cnd.activeReferrals?.levelsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          active referrals
                                                        </div>
                                                      </div>
                                                      {renderLevelsToCheck(
                                                        cond.activeReferrals?.levelsToCheck ?? 1,
                                                        (val) =>
                                                          updateConditionPayload(
                                                            rule.starLevel,
                                                            cIndex,
                                                            condIndex,
                                                            (cnd) => ({
                                                              ...cnd,
                                                              activeReferrals: {
                                                                ...cnd.activeReferrals,
                                                                minCount:
                                                                  cnd.activeReferrals?.minCount ?? 1,
                                                                levelsToCheck: setLevelsToCheckField(
                                                                  cnd.activeReferrals,
                                                                  val
                                                                ),
                                                              },
                                                            })
                                                          )
                                                      )}
                                                    </>
                                                  ) : null}

                                                  {/* personal_rsp */}
                                                  {type === "personal_rsp" ? (
                                                    <>
                                                      <div className="col-span-5">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Need at least
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.personalRsp?.minRsp ?? 0}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                personalRsp: {
                                                                  ...cnd.personalRsp,
                                                                  minRsp: Number(e.target.value),
                                                                  monthsToCheck:
                                                                    cnd.personalRsp?.monthsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          RSP
                                                        </div>
                                                      </div>
                                                      <div className="col-span-3">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Time range
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.personalRsp?.monthsToCheck ?? 1}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                personalRsp: {
                                                                  ...cnd.personalRsp,
                                                                  minRsp: cnd.personalRsp?.minRsp ?? 0,
                                                                  monthsToCheck: Number(e.target.value),
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          months
                                                        </div>
                                                      </div>
                                                    </>
                                                  ) : null}

                                                  {/* group_rsp */}
                                                  {type === "group_rsp" ? (
                                                    <>
                                                      <div className="col-span-5">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Need at least
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.groupRsp?.minRsp ?? 0}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                groupRsp: {
                                                                  ...cnd.groupRsp,
                                                                  minRsp: Number(e.target.value),
                                                                  monthsToCheck: cnd.groupRsp?.monthsToCheck ?? 1,
                                                                  levelsToCheck: cnd.groupRsp?.levelsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          group RSP
                                                        </div>
                                                      </div>

                                                      <div className="col-span-3">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Time range
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.groupRsp?.monthsToCheck ?? 1}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                groupRsp: {
                                                                  ...cnd.groupRsp,
                                                                  minRsp: cnd.groupRsp?.minRsp ?? 0,
                                                                  monthsToCheck: Number(e.target.value),
                                                                  levelsToCheck: cnd.groupRsp?.levelsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          months
                                                        </div>
                                                      </div>

                                                      {renderLevelsToCheck(
                                                        cond.groupRsp?.levelsToCheck ?? 1,
                                                        (val) =>
                                                          updateConditionPayload(
                                                            rule.starLevel,
                                                            cIndex,
                                                            condIndex,
                                                            (cnd) => ({
                                                              ...cnd,
                                                              groupRsp: {
                                                                ...cnd.groupRsp,
                                                                minRsp: cnd.groupRsp?.minRsp ?? 0,
                                                                monthsToCheck: cnd.groupRsp?.monthsToCheck ?? 1,
                                                                levelsToCheck: setLevelsToCheckField(
                                                                  cnd.groupRsp,
                                                                  val
                                                                ),
                                                              },
                                                            })
                                                          )
                                                      )}
                                                    </>
                                                  ) : null}

                                                  {/* group_star */}
                                                  {type === "group_star" ? (
                                                    <>
                                                      <div className="col-span-3">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Star level (or above)
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.groupStar?.starLevel ?? 1}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                groupStar: {
                                                                  ...cnd.groupStar,
                                                                  starLevel: Number(e.target.value),
                                                                  minUsers: cnd.groupStar?.minUsers ?? 1,
                                                                  levelsToCheck: cnd.groupStar?.levelsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                      </div>

                                                      <div className="col-span-5">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Need at least
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.groupStar?.minUsers ?? 1}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                groupStar: {
                                                                  ...cnd.groupStar,
                                                                  starLevel: cnd.groupStar?.starLevel ?? 1,
                                                                  minUsers: Number(e.target.value),
                                                                  levelsToCheck: cnd.groupStar?.levelsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          members
                                                        </div>
                                                      </div>

                                                      {renderLevelsToCheck(
                                                        cond.groupStar?.levelsToCheck ?? 1,
                                                        (val) =>
                                                          updateConditionPayload(
                                                            rule.starLevel,
                                                            cIndex,
                                                            condIndex,
                                                            (cnd) => ({
                                                              ...cnd,
                                                              groupStar: {
                                                                ...cnd.groupStar,
                                                                starLevel: cnd.groupStar?.starLevel ?? 1,
                                                                minUsers: cnd.groupStar?.minUsers ?? 1,
                                                                levelsToCheck: setLevelsToCheckField(
                                                                  cnd.groupStar,
                                                                  val
                                                                ),
                                                              },
                                                            })
                                                          )
                                                      )}
                                                    </>
                                                  ) : null}

                                                  {/* personal_check */}
                                                  {type === "personal_check" ? (
                                                    <>
                                                      <div className="col-span-5">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Need at least
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.personalCheck?.minChecksCreated ?? 0}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                personalCheck: {
                                                                  ...cnd.personalCheck,
                                                                  minChecksCreated: Number(e.target.value),
                                                                  monthsToCheck: cnd.personalCheck?.monthsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          checks
                                                        </div>
                                                      </div>

                                                      <div className="col-span-3">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Time range
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.personalCheck?.monthsToCheck ?? 1}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                personalCheck: {
                                                                  ...cnd.personalCheck,
                                                                  minChecksCreated: cnd.personalCheck?.minChecksCreated ?? 0,
                                                                  monthsToCheck: Number(e.target.value),
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          months
                                                        </div>
                                                      </div>
                                                    </>
                                                  ) : null}

                                                  {/* group_check */}
                                                  {type === "group_check" ? (
                                                    <>
                                                      <div className="col-span-5">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Need at least
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.groupCheck?.minChecksCreated ?? 0}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                groupCheck: {
                                                                  ...cnd.groupCheck,
                                                                  minChecksCreated: Number(e.target.value),
                                                                  monthsToCheck: cnd.groupCheck?.monthsToCheck ?? 1,
                                                                  levelsToCheck: cnd.groupCheck?.levelsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          group checks
                                                        </div>
                                                      </div>

                                                      <div className="col-span-3">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Time range
                                                        </div>
                                                        <input
                                                          type="number"
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={cond.groupCheck?.monthsToCheck ?? 1}
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                groupCheck: {
                                                                  ...cnd.groupCheck,
                                                                  minChecksCreated: cnd.groupCheck?.minChecksCreated ?? 0,
                                                                  monthsToCheck: Number(e.target.value),
                                                                  levelsToCheck: cnd.groupCheck?.levelsToCheck ?? 1,
                                                                },
                                                              })
                                                            )
                                                          }
                                                        />
                                                        <div className="mt-1 text-[11px] text-neutral-600">
                                                          months
                                                        </div>
                                                      </div>

                                                      <div className="col-span-3">
                                                        <div className="text-[11px] text-neutral-500">
                                                          Depth
                                                        </div>
                                                        <select
                                                          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                                                          value={
                                                            cond.groupCheck?.levelsToCheck === "infinity"
                                                              ? "infinity"
                                                              : String(cond.groupCheck?.levelsToCheck ?? 1)
                                                          }
                                                          onChange={(e) =>
                                                            updateConditionPayload(
                                                              rule.starLevel,
                                                              cIndex,
                                                              condIndex,
                                                              (cnd) => ({
                                                                ...cnd,
                                                                groupCheck: {
                                                                  ...cnd.groupCheck,
                                                                  minChecksCreated: cnd.groupCheck?.minChecksCreated ?? 0,
                                                                  monthsToCheck: cnd.groupCheck?.monthsToCheck ?? 1,
                                                                  levelsToCheck: e.target.value === "infinity"
                                                                    ? "infinity"
                                                                    : Number(e.target.value),
                                                                },
                                                              })
                                                            )
                                                          }
                                                        >
                                                          <option value="1">1 level</option>
                                                          <option value="2">2 levels</option>
                                                          <option value="3">3 levels</option>
                                                          <option value="4">4 levels</option>
                                                          <option value="5">5 levels</option>
                                                          <option value="10">10 levels</option>
                                                          <option value="infinity">All levels</option>
                                                        </select>
                                                      </div>
                                                    </>
                                                  ) : null}
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>

          {/* OTHER SIMPLE SETTINGS */}
          <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-prim" />
            <div className="p-4 md:p-5">
              <div className="text-sm font-semibold text-neutral-900">Other settings</div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {otherSettings.length === 0 ? (
                  <div className="text-sm text-neutral-600">No other settings found.</div>
                ) : (
                  otherSettings.map((s) => {
                    const key = s.key;
                    const v = s.value;
                    const type = typeof v;

                    const isSaving = savingKey === key;

                    return (
                      <div key={key} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-neutral-900">{key}</div>
                            <div className="text-[11px] text-neutral-600">Type: {Array.isArray(v) ? "array" : type}</div>
                          </div>

                          <button
                            onClick={() => saveOtherSetting(s)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-lg bg-prim px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            <FiSave className="h-4 w-4" />
                            {isSaving ? "Saving…" : "Save"}
                          </button>
                        </div>

                        <div className="mt-2">
                          {type === "boolean" ? (
                            <label className="flex items-center gap-2 text-sm text-neutral-800">
                              <input
                                type="checkbox"
                                checked={!!simpleDraft[key]}
                                onChange={(e) =>
                                  setSimpleDraft((prev) => ({ ...prev, [key]: e.target.checked }))
                                }
                              />
                              Enabled
                            </label>
                          ) : type === "number" ? (
                            <input
                              type="number"
                              className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                              value={simpleDraft[key] ?? 0}
                              onChange={(e) =>
                                setSimpleDraft((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                            />
                          ) : type === "string" ? (
                            <input
                              type="text"
                              className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                              value={simpleDraft[key] ?? ""}
                              onChange={(e) =>
                                setSimpleDraft((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                            />
                          ) : (
                            <textarea
                              rows={4}
                              className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 font-mono text-xs"
                              value={simpleDraft[key] ?? ""}
                              onChange={(e) =>
                                setSimpleDraft((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              spellCheck={false}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsSection;
