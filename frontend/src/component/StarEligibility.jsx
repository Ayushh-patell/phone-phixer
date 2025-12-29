import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FiStar,
  FiArrowRight,
  FiAlertTriangle,
  FiGitBranch,
  FiCheckCircle,
  FiRefreshCw,
  FiTrendingUp,
  FiXCircle,
} from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Your new backend endpoints
const ELIGIBILITY_BASE_URL = `${API_BASE_URL}/star-eligibility-check`;
const ELIGIBILITY_ME_URL = `${API_BASE_URL}/star-eligibility-check/me`;

// Placeholder: set your real backend star upgrade endpoint here
const LEVEL_UP_URL = `${API_BASE_URL}/star-eligibility-check/level-up`;

const StarEligibilitySection = () => {
  const [user, setUser] = useState(null);
  const [starLevelsSetting, setStarLevelsSetting] = useState(null);
  const [eligibilitySetting, setEligibilitySetting] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Eligibility check state
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityErr, setEligibilityErr] = useState("");
  const [eligibilityRes, setEligibilityRes] = useState(null);

  // Level up state
  const [levelUpLoading, setLevelUpLoading] = useState(false);
  const [levelUpErr, setLevelUpErr] = useState("");
  const [levelUpMsg, setLevelUpMsg] = useState("");

  const token = sessionStorage.getItem("token");

  const fetchBaseData = async () => {
    const [meRes, starLevelsRes, eligibilityRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${API_BASE_URL}/settings/star_levels`),
      axios.get(`${API_BASE_URL}/settings/star_eligibility_criterias`),
    ]);

    setUser(meRes.data || {});
    setStarLevelsSetting(starLevelsRes.data || null);
    setEligibilitySetting(eligibilityRes.data || null);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setErr("");
        await fetchBaseData();
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStarLevel = typeof user?.star === "number" ? user.star : null;
  const currentStarName = user?.starInfo?.name ?? null;

  const starLevels = Array.isArray(starLevelsSetting?.value)
    ? starLevelsSetting.value
    : [];
  const eligibilityRules = Array.isArray(eligibilitySetting?.value)
    ? eligibilitySetting.value
    : [];

  const nextStar = useMemo(() => {
    if (typeof currentStarLevel !== "number") return null;
    const nextLevel = currentStarLevel + 1;
    const found = starLevels.find((s) => s?.lvl === nextLevel);
    return found || { lvl: nextLevel, name: null };
  }, [currentStarLevel, starLevels]);

  const nextLevelRules = useMemo(() => {
    if (!nextStar?.lvl) return null;
    return eligibilityRules.find((r) => r?.starLevel === nextStar.lvl) || null;
  }, [eligibilityRules, nextStar]);

  // If levelsToCheck is "infinity", we don't mention it at all.
  const levelsPhrase = (levelsToCheck) => {
    if (levelsToCheck === "infinity") return "";
    if (typeof levelsToCheck === "number") return ` (within ${levelsToCheck} levels)`;
    return "";
  };

  const ConditionLine = ({ condition }) => {
    if (!condition || typeof condition !== "object") return null;

    const type = condition.type;

    if (type === "hotposition" && condition.hotposition) {
      const p = condition.hotposition;
      return (
        <li className="flex items-start gap-2">
          <FiCheckCircle className="mt-0.5 h-4 w-4 text-neutral-700" />
          <div className="text-sm text-neutral-800">
            Have <span className="font-semibold">{p.minCount}+</span> hot positions
            {levelsPhrase(p.levelsToCheck)}.
          </div>
        </li>
      );
    }

    if (type === "activeReferrals" && condition.activeReferrals) {
      const p = condition.activeReferrals;
      return (
        <li className="flex items-start gap-2">
          <FiCheckCircle className="mt-0.5 h-4 w-4 text-neutral-700" />
          <div className="text-sm text-neutral-800">
            Have <span className="font-semibold">{p.minCount}+</span> active referrals
            {levelsPhrase(p.levelsToCheck)}.
          </div>
        </li>
      );
    }

    if (type === "personal_rsp" && condition.personalRsp) {
      const p = condition.personalRsp;
      return (
        <li className="flex items-start gap-2">
          <FiCheckCircle className="mt-0.5 h-4 w-4 text-neutral-700" />
          <div className="text-sm text-neutral-800">
            Earn <span className="font-semibold">{p.minRsp}+</span> personal RSP in the last{" "}
            <span className="font-semibold">{p.monthsToCheck}</span> month
            {p.monthsToCheck === 1 ? "" : "s"}.
          </div>
        </li>
      );
    }

    if (type === "group_rsp" && condition.groupRsp) {
      const p = condition.groupRsp;
      return (
        <li className="flex items-start gap-2">
          <FiCheckCircle className="mt-0.5 h-4 w-4 text-neutral-700" />
          <div className="text-sm text-neutral-800">
            Earn <span className="font-semibold">{p.minRsp}+</span> group RSP in the last{" "}
            <span className="font-semibold">{p.monthsToCheck}</span> month
            {p.monthsToCheck === 1 ? "" : "s"}
            {levelsPhrase(p.levelsToCheck)}.
          </div>
        </li>
      );
    }

    if (type === "group_star" && condition.groupStar) {
      const p = condition.groupStar;
      return (
        <li className="flex items-start gap-2">
          <FiCheckCircle className="mt-0.5 h-4 w-4 text-neutral-700" />
          <div className="text-sm text-neutral-800">
            Have <span className="font-semibold">{p.minUsers}+</span> people in your group at star
            level <span className="font-semibold">{p.starLevel}</span>
            {levelsPhrase(p.levelsToCheck)}.
          </div>
        </li>
      );
    }

    if (type === "personal_check" && condition.personalCheck) {
      const p = condition.personalCheck;
      return (
        <li className="flex items-start gap-2">
          <FiCheckCircle className="mt-0.5 h-4 w-4 text-neutral-700" />
          <div className="text-sm text-neutral-800">
            Create <span className="font-semibold">{p.minChecksCreated}+</span> checks in the last{" "}
            <span className="font-semibold">{p.monthsToCheck}</span> month
            {p.monthsToCheck === 1 ? "" : "s"}.
          </div>
        </li>
      );
    }

    if (type === "group_check" && condition.groupCheck) {
      const p = condition.groupCheck;
      return (
        <li className="flex items-start gap-2">
          <FiCheckCircle className="mt-0.5 h-4 w-4 text-neutral-700" />
          <div className="text-sm text-neutral-800">
            Have <span className="font-semibold">{p.minChecksCreated}+</span> checks created by
            your group in the last <span className="font-semibold">{p.monthsToCheck}</span> month
            {p.monthsToCheck === 1 ? "" : "s"}
            {levelsPhrase(p.levelsToCheck)}.
          </div>
        </li>
      );
    }

    return (
      <li className="text-sm text-neutral-700">
        <span className="font-semibold">Requirement</span>: {JSON.stringify(condition)}
      </li>
    );
  };

  const CriteriaCard = ({ criteria, index }) => {
    if (!criteria || typeof criteria !== "object") return null;

    const mode = criteria.isOr ? "Any one is enough" : "You need all of these";
    const conditions = Array.isArray(criteria.conditions) ? criteria.conditions : [];

    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FiGitBranch className="h-4 w-4 text-neutral-800" />
            <div className="text-sm font-semibold text-neutral-900">
              Requirement set #{index + 1}
            </div>
          </div>
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-800">
            {mode}
          </span>
        </div>

        <div className="mt-3 text-xs text-neutral-600">
          {criteria.isOr ? "Meet any one of the items below." : "Meet all of the items below."}
        </div>

        <ul className="mt-3 space-y-2">
          {conditions.length === 0 ? (
            <li className="text-sm text-neutral-600">No requirements configured.</li>
          ) : (
            conditions.map((c, i) => <ConditionLine key={i} condition={c} />)
          )}
        </ul>
      </div>
    );
  };

  // Human-readable failure message builder
  const toHumanFailure = (c) => {
    if (!c) return null;

    const type = c.type;

    if (type === "hotposition") {
      const min = c?.required?.minCount;
      const lv = c?.required?.levelsToCheck;
      const actual = Number(c.actual ?? 0);
      const shortBy = typeof min === "number" ? Math.max(0, min - actual) : null;

      return `You have ${actual} hot positions${
        lv === "infinity" ? "" : typeof lv === "number" ? ` within ${lv} levels` : ""
      }, but need at least ${min}.` + (shortBy ? ` (${shortBy} more needed)` : "");
    }

    if (type === "activeReferrals") {
      const min = c?.required?.minCount;
      const lv = c?.required?.levelsToCheck;
      const actual = Number(c.actual ?? 0);
      const shortBy = typeof min === "number" ? Math.max(0, min - actual) : null;

      return `You have ${actual} active referrals${
        lv === "infinity" ? "" : typeof lv === "number" ? ` within ${lv} levels` : ""
      }, but need at least ${min}.` + (shortBy ? ` (${shortBy} more needed)` : "");
    }

    if (type === "group_star") {
      const minUsers = c?.required?.minUsers;
      const starLevel = c?.required?.starLevel;
      const lv = c?.required?.levelsToCheck;
      const actual = Number(c.actual ?? 0);
      const shortBy =
        typeof minUsers === "number" ? Math.max(0, minUsers - actual) : null;

      return `You have ${actual} people in your group with star level ${starLevel} or above${
        lv === "infinity" ? "" : typeof lv === "number" ? ` within ${lv} levels` : ""
      }, but need at least ${minUsers}.` + (shortBy ? ` (${shortBy} more needed)` : "");
    }

    if (type === "personal_rsp") {
      const minRsp = c?.required?.minRsp;
      const months = c?.required?.monthsToCheck;
      const actual = Number(c.actual ?? 0);
      const shortBy = typeof minRsp === "number" ? Math.max(0, minRsp - actual) : null;

      return `Your personal RSP in the last ${months} month${
        months === 1 ? "" : "s"
      } is ${actual}, but you need at least ${minRsp}.` + (shortBy ? ` (${shortBy} more needed)` : "");
    }

    if (type === "group_rsp") {
      const minRsp = c?.required?.minRsp;
      const months = c?.required?.monthsToCheck;
      const lv = c?.required?.levelsToCheck;
      const actual = Number(c.actual ?? 0);
      const shortBy = typeof minRsp === "number" ? Math.max(0, minRsp - actual) : null;

      return `Your group RSP in the last ${months} month${
        months === 1 ? "" : "s"
      }${
        lv === "infinity" ? "" : typeof lv === "number" ? ` within ${lv} levels` : ""
      } is ${actual}, but you need at least ${minRsp}.` + (shortBy ? ` (${shortBy} more needed)` : "");
    }

    if (type === "personal_check") {
      const min = c?.required?.minChecksCreated;
      const months = c?.required?.monthsToCheck;
      const actual = Number(c.actual ?? 0);
      const shortBy = typeof min === "number" ? Math.max(0, min - actual) : null;

      return `You created ${actual} check${
        actual === 1 ? "" : "s"
      } in the last ${months} month${months === 1 ? "" : "s"}, but need at least ${min}.` +
        (shortBy ? ` (${shortBy} more needed)` : "");
    }

    if (type === "group_check") {
      const min = c?.required?.minChecksCreated;
      const months = c?.required?.monthsToCheck;
      const lv = c?.required?.levelsToCheck;
      const actual = Number(c.actual ?? 0);
      const shortBy = typeof min === "number" ? Math.max(0, min - actual) : null;

      return `Your group created ${actual} check${
        actual === 1 ? "" : "s"
      } in the last ${months} month${months === 1 ? "" : "s"}${
        lv === "infinity" ? "" : typeof lv === "number" ? ` within ${lv} levels` : ""
      }, but need at least ${min}.` + (shortBy ? ` (${shortBy} more needed)` : "");
    }

    return `You didn’t meet requirement: ${type}`;
  };

  const failedItems = useMemo(() => {
    const res = eligibilityRes;
    if (!res || !Array.isArray(res.criteriaResults)) return [];

    const items = [];
    for (const block of res.criteriaResults) {
      const conds = Array.isArray(block?.conditions) ? block.conditions : [];
      for (const c of conds) {
        if (c?.passed === false) {
          items.push({
            criteriaIndex: block.index,
            isOr: !!block.isOr,
            ...c,
            human: toHumanFailure(c),
          });
        }
      }
    }
    return items;
  }, [eligibilityRes]);

  const onCheckEligibility = async () => {
    try {
      setEligibilityLoading(true);
      setEligibilityErr("");
      setEligibilityRes(null);
      setLevelUpErr("");
      setLevelUpMsg("");

      // optional: ping base URL (if your backend uses it)
      // await axios.get(ELIGIBILITY_BASE_URL, { headers: { Authorization: `Bearer ${token}` } });

      const r = await axios.get(ELIGIBILITY_ME_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setEligibilityRes(r.data || null);
    } catch (e) {
      setEligibilityErr(e?.response?.data?.message || e?.message || "Failed to check eligibility");
    } finally {
      setEligibilityLoading(false);
    }
  };

  const onLevelUp = async () => {
    try {
      setLevelUpLoading(true);
      setLevelUpErr("");
      setLevelUpMsg("");

      const r = await axios.post(
        LEVEL_UP_URL,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLevelUpMsg(r?.data?.message || "Star upgraded successfully.");
      await fetchBaseData();
      setEligibilityRes(null);
    } catch (e) {
      setLevelUpErr(e?.response?.data?.message || e?.message || "Failed to level up");
    } finally {
      setLevelUpLoading(false);
    }
  };

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="h-1.5 w-full bg-prim" />
        <div className="p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                Star upgrade
              </div>
              <h2 className="mt-1 text-lg md:text-xl font-semibold text-neutral-900">
                What you need for the next level
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                These are the current rules for your next star level.
              </p>
            </div>

            {!loading && !err && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-semibold text-neutral-900">
                  <FiStar className="h-4 w-4" />
                  You are:{" "}
                  <span className="font-semibold">
                    {typeof currentStarLevel === "number" ? `Lvl ${currentStarLevel}` : "-"}
                  </span>
                  <span className="text-neutral-400 font-normal">•</span>
                  <span className="font-semibold text-neutral-800">{currentStarName ?? "-"}</span>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-prim/40 bg-prim/15 px-3 py-1.5 text-sm font-semibold text-neutral-900">
                  <FiArrowRight className="h-4 w-4" />
                  Next:{" "}
                  <span className="font-semibold">{nextStar?.lvl ? `Lvl ${nextStar.lvl}` : "-"}</span>
                  <span className="text-neutral-400 font-normal">•</span>
                  <span className="font-semibold text-neutral-800">{nextStar?.name ?? "-"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-neutral-200 border-t-prim" />
            Loading…
          </div>
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 h-4 w-4" />
            <span>{err}</span>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="h-1.5 w-full bg-prim" />
          <div className="p-4 md:p-5">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500">
              Requirements for next star
            </div>
            <div className="mt-1 text-base font-semibold text-neutral-900">
              {nextStar?.lvl ? `Lvl ${nextStar.lvl}` : "Next level"}{" "}
              {nextStar?.name ? `• ${nextStar.name}` : ""}
              {nextStar?.checkPrice ? `• with ₹${nextStar.checkPrice} Check Price` : ""}
            </div>

            <div className="mt-1 text-sm text-neutral-600">
              {nextLevelRules ? "Below are the current requirement sets." : "No requirements have been set for your next level yet."}
            </div>

            {nextLevelRules?.criterias && Array.isArray(nextLevelRules.criterias) ? (
              nextLevelRules.criterias.length === 0 ? (
                <div className="mt-4 text-sm text-neutral-600">Requirement list is empty.</div>
              ) : (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* LEFT: criteria cards */}
                  <div className="space-y-4">
                    {nextLevelRules.criterias.map((cr, i) => (
                      <CriteriaCard key={i} criteria={cr} index={i} />
                    ))}
                  </div>

                  {/* RIGHT: action card */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm h-fit">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-neutral-900">
                        Eligibility check
                      </div>

                      {eligibilityRes?.eligible === true ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
                          <FiCheckCircle className="h-3.5 w-3.5" />
                          Eligible
                        </span>
                      ) : eligibilityRes?.eligible === false ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800">
                          <FiXCircle className="h-3.5 w-3.5" />
                          Not eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
                          Not checked
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-xs text-neutral-600">
                      Click below to check if you qualify for{" "}
                      <span className="font-semibold">
                        {nextStar?.lvl ? `Lvl ${nextStar.lvl}` : "next level"}
                      </span>
                      .
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        onClick={onCheckEligibility}
                        disabled={eligibilityLoading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-prim px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                      >
                        {eligibilityLoading ? (
                          <>
                            <FiRefreshCw className="h-4 w-4 animate-spin" />
                            Checking…
                          </>
                        ) : (
                          <>
                            <FiTrendingUp className="h-4 w-4" />
                            Check eligibility
                          </>
                        )}
                      </button>

                      {eligibilityErr ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {eligibilityErr}
                        </div>
                      ) : null}

                      {eligibilityRes?.eligible === true ? (
                        <button
                          onClick={onLevelUp}
                          disabled={levelUpLoading}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 disabled:opacity-60"
                        >
                          {levelUpLoading ? (
                            <>
                              <FiRefreshCw className="h-4 w-4 animate-spin" />
                              Leveling up…
                            </>
                          ) : (
                            <>
                              <FiArrowRight className="h-4 w-4" />
                              Level up now
                            </>
                          )}
                        </button>
                      ) : null}

                      {levelUpMsg ? (
                        <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                          {levelUpMsg}
                        </div>
                      ) : null}

                      {levelUpErr ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {levelUpErr}
                        </div>
                      ) : null}
                    </div>

                    {/* Failure breakdown (human-readable) */}
                    {eligibilityRes?.eligible === false ? (
                      <div className="mt-4">
                        <div className="text-xs font-semibold text-neutral-900">
                          What’s missing
                        </div>
                        <div className="mt-1 text-xs text-neutral-600">
                          Based on your latest check, these items are still incomplete.
                        </div>

                        {failedItems.length === 0 ? (
                          <div className="mt-2 text-xs text-neutral-600">
                            No failure details available.
                          </div>
                        ) : (
                          <ul className="mt-3 space-y-2">
                            {failedItems.slice(0, 12).map((it, idx) => (
                              <li
                                key={idx}
                                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="text-xs font-semibold text-neutral-900">
                                    Requirement set #{(it.criteriaIndex ?? 0) + 1}{" "}
                                    <span className="font-normal text-neutral-600">
                                      ({it.isOr ? "OR" : "AND"})
                                    </span>
                                  </div>
                                  <span className="text-[11px] rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-semibold text-red-800">
                                    Not met
                                  </span>
                                </div>

                                <div className="mt-1 text-xs text-neutral-700">
                                  {it.human || "This requirement was not met."}
                                </div>

                                {it.note ? (
                                  <div className="mt-1 text-[11px] text-neutral-600">
                                    {it.note}
                                  </div>
                                ) : null}
                              </li>
                            ))}

                            {failedItems.length > 12 ? (
                              <li className="text-xs text-neutral-600">
                                Showing 12 of {failedItems.length} missing items.
                              </li>
                            ) : null}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            ) : (
              <div className="mt-4 text-sm text-neutral-600">
                {nextLevelRules ? "Rules format is missing/invalid." : "—"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StarEligibilitySection;
