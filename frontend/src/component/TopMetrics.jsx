// src/components/TopMetrics.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FiCopy,
  FiCheck,
  FiTrendingUp,
  FiGrid,
  FiDollarSign,
  FiCreditCard,
  FiArrowLeft,
  FiArrowRight,
  FiUsers,
  FiGift,
  FiLink,
  FiX, FiSend
} from "react-icons/fi";


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const calculateSelfCheck = (selfVol) => Math.floor(selfVol / 4);

const calculateTreeChecks = (left, right) => {
  const leftPairs = Math.floor(left / 2);
  const rightPairs = Math.floor(right / 2);
  return Math.min(leftPairs, rightPairs);
};

function MetricCard({ label, value, sub, Icon, highlight = false }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition",
        "hover:shadow-md",
        "border-t-4 border-t-prim", // <-- makes prim VERY visible
        highlight ? "ring-2 ring-prim/30" : "ring-0", // <-- highlight without changing border color
      ].join(" ")}
    >
      {/* subtle prim glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-prim/20 blur-3xl" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-black font-semibold">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold text-neutral-900">
            {value}
          </div>
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30">
          <Icon className="h-5 w-5 text-prim" />
        </div>
      </div>

      {sub ? <p className="mt-2 text-xs text-neutral-600">{sub}</p> : null}
    </div>
  );
}

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
    prim: "border-prim/40 bg-prim/20 text-neutral-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${
        tones[tone] || tones.neutral
      }`}
    >
      {children}
    </span>
  );
}

const TopMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [applyLoading, setApplyLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  const [error, setError] = useState("");
  const [applyError, setApplyError] = useState("");
  const [applySuccess, setApplySuccess] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [copied, setCopied] = useState(false);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawSuccess, setWithdrawSuccess] = useState("");

  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    name: "",
    accountNumber: "",
    ifsc: "",
  });


  const [referralUvThreshold, setReferralUvThreshold] = useState(5);

  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
    role: "user",
    selfVolume: 0,
    totalEarnings: 0,
    walletBalance: 0,
    leftVolume: 0,
    rightVolume: 0,
    placement:null,
    referralUsed: null,
    referralCode: null,
    referralActive: false,
    star: 1,
    at_hotposition: false,
  });

  const inputClass = useMemo(
    () =>
      [
        "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900",
        "placeholder:text-neutral-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-prim/40 focus:border-prim",
      ].join(" "),
    []
  );

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem("token");
      if (!token) {
        setError("No auth token found. Please log in again.");
        setLoading(false);
        return;
      }

      const res = await axios.get(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = res.data || {};
      setUserInfo({
        name: user.name || "",
        email: user.email || "",
        role: user.role || "user",
        selfVolume: user.selfVolume ?? 0,
        totalEarnings: user.totalEarnings ?? 0,
        walletBalance: user.walletBalance ?? 0,
        rightVolume: user.rightVolume ?? 0,
        leftVolume: user.leftVolume ?? 0,
        placement:user.placement || null,
        referralUsed: user.referralUsed || null,
        referralCode: user.referralCode || null,
        referralActive: user.referralActive || false,
        star: user.star ?? 1,
        at_hotposition: user.at_hotposition || false,
      });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load user metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  useEffect(() => {
    const fetchReferralThreshold = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/settings/referralActive_limit`
        );
        const numeric = Number(res.data?.value);
        if (!Number.isNaN(numeric) && numeric > 0) setReferralUvThreshold(numeric);
      } catch (err) {
        console.error("Failed to fetch referralActive_limit:", err);
      }
    };
    fetchReferralThreshold();
  }, []);

  const handleApplyReferral = async (e) => {
    e.preventDefault();
    setApplyError("");
    setApplySuccess("");

    const trimmed = referralCodeInput.trim();
    if (!trimmed) {
      setApplyError("Please enter a referral code.");
      return;
    }

    try {
      setApplyLoading(true);
      const token = sessionStorage.getItem("token");
      if (!token) {
        setApplyError("No auth token found. Please log in again.");
        setApplyLoading(false);
        return;
      }

      const res = await axios.post(
        `${API_BASE_URL}/users/use-code`,
        { referralCode: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setApplySuccess(res.data?.message || "Referral code applied successfully.");
      setReferralCodeInput("");
      await fetchUserInfo();
    } catch (err) {
      console.error(err);
      setApplyError(err.response?.data?.message || "Failed to apply referral code.");
    } finally {
      setApplyLoading(false);
    }
  };

  const handleJoinReferralProgram = async () => {
    setJoinError("");
    setJoinSuccess("");

    try {
      setJoinLoading(true);
      const token = sessionStorage.getItem("token");
      if (!token) {
        setJoinError("No auth token found. Please log in again.");
        setJoinLoading(false);
        return;
      }

      await axios.post(
        `${API_BASE_URL}/users/join-referral-program`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setJoinSuccess("You have joined the referral program!");
      await fetchUserInfo();
    } catch (err) {
      console.error(err);
      setJoinError(err.response?.data?.message || "Failed to join referral program.");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCopyReferral = async () => {
    if (!userInfo.referralCode) return;
    try {
      await navigator.clipboard.writeText("PP" + userInfo.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <section className="mb-6">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-neutral-200 border-t-prim" />
            <p className="text-sm text-neutral-600">Loading your metrics…</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </section>
    );
  }

  const {
    selfVolume,
    totalEarnings,
    walletBalance,
    rightVolume,
    leftVolume,
    placement,
    referralCode,
    referralActive,
    referralUsed,
  } = userInfo;

  const canJoinProgram = selfVolume >= referralUvThreshold && !referralActive;

  const checks =
    calculateSelfCheck(selfVolume) + calculateTreeChecks(leftVolume, rightVolume);

  const sponsor = referralUsed || null;

  const joinProgress = Math.min(
    1,
    referralUvThreshold > 0
      ? Number(selfVolume || 0) / Number(referralUvThreshold)
      : 0
  );

  return (
    <>
      {/* Metrics */}
      <section className="grid gap-4 md:grid-cols-3 mb-4">
        <MetricCard
          label="Self UV"
          value={Number(selfVolume || 0).toFixed(0)}
          sub="Your personal volume on phone-phixer."
          Icon={FiTrendingUp}
          highlight
        />
        <MetricCard
          label="Available Checks"
          value={Number(checks || 0).toFixed(0)}
          sub="Available checks auto-redeemed weekly"
          Icon={FiGrid}
        />
        <MetricCard
          label="Total Earnings"
          value={`₹${Number(totalEarnings || 0).toFixed(2)}`}
          sub="Lifetime earnings from repairs and referrals."
          Icon={FiDollarSign}
        />
        <MetricCard
          label="Left UV"
          value={Number(leftVolume || 0).toFixed(0)}
          sub="Current UV on the left side of your tree."
          Icon={FiArrowLeft}
        />
        <MetricCard
          label="Right UV"
          value={Number(rightVolume || 0).toFixed(0)}
          sub="Current UV on the right side of your tree."
          Icon={FiArrowRight}
        />
      <MetricCard
        label="Wallet Balance"
        value={`₹${Number(walletBalance || 0).toFixed(2)}`}
        sub={
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-prim/40 bg-prim/20 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-prim/30 transition"
          >
            <FiSend className="h-3.5 w-3.5" />
            Withdraw
          </button>
        }
        Icon={FiCreditCard}
      />
      </section>

      {/* Referral + Sponsor/Placement */}
      <section className="mb-6">
        <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-5">
          {/* Strong prim accent bar */}
          <div className="absolute inset-x-0 top-0 h-1.5 bg-prim" />

          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-prim/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-prim/15 blur-3xl" />

          {/* Referral header */}
          <div className="relative flex items-start justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30">
                <FiGift className="h-5 w-5 text-prim" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Referral program
                </div>
                <div className="text-sm font-semibold text-neutral-900">
                  Invite & earn
                </div>
              </div>
            </div>

            {referralActive ? <Pill tone="prim">Active</Pill> : <Pill>Inactive</Pill>}
          </div>

          {referralActive && referralCode ? (
            <div className="relative rounded-2xl border border-prim/40 bg-prim/20 p-4">
              <p className="text-xs text-neutral-700 mb-2">
                Share your referral code:
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-prim/40 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 font-mono tracking-wide">
                  PP{referralCode}
                </div>

                <button
                  type="button"
                  onClick={handleCopyReferral}
                  className={[
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition",
                    "focus:outline-none focus:ring-2 focus:ring-prim/40",
                    copied
                      ? "border-prim/50 bg-prim/30 text-neutral-900"
                      : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50",
                  ].join(" ")}
                >
                  {copied ? (
                    <>
                      <FiCheck className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <FiCopy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-sm text-neutral-800">
                Reach{" "}
                <span className="font-semibold text-neutral-900">
                  {referralUvThreshold} UV
                </span>{" "}
                to unlock your referral code.
              </p>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-neutral-600">
                  <span>
                    Progress:{" "}
                    <span className="font-medium text-neutral-900">
                      {selfVolume} / {referralUvThreshold}
                    </span>
                  </span>
                  <span className="font-medium text-neutral-900">
                    {Math.round(joinProgress * 100)}%
                  </span>
                </div>

                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-prim"
                    style={{ width: `${Math.round(joinProgress * 100)}%` }}
                  />
                </div>
              </div>

              {joinError && <p className="mt-3 text-sm text-red-600">{joinError}</p>}
              {joinSuccess && <p className="mt-3 text-sm text-emerald-700">{joinSuccess}</p>}

              {canJoinProgram && (
                <button
                  type="button"
                  onClick={handleJoinReferralProgram}
                  disabled={joinLoading}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-prim px-4 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-prim/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {joinLoading ? "Joining..." : "Join referral program"}
                </button>
              )}
            </div>
          )}

          <div className="h-px bg-neutral-200" />

          {/* Sponsor & placement */}
          <div className="relative space-y-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30">
                <FiUsers className="h-5 w-5 text-prim" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Referral sponsor & placement
                </div>
                <div className="text-sm font-semibold text-neutral-900">
                  Who invited you & where you’re placed
                </div>
              </div>
            </div>

            {sponsor ? (
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{sponsor.name || "User"}</Pill>
                {sponsor.email ? (
                  <span className="text-sm text-neutral-600">{sponsor.email}</span>
                ) : null}
                {sponsor.referralCode ? (
                  <Pill tone="prim">
                    Code: PP<span className="ml-1 font-mono">{sponsor.referralCode}</span>
                  </Pill>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-neutral-600">
                You haven&apos;t used a referral code yet. You can link a referrer
                before you are placed in the tree.
              </p>
            )}

            {placement?.parentUser?.id ? (
              <div className="flex items-center gap-2">
                <Pill tone="prim">Placed under</Pill>
                <span className="text-sm font-medium text-neutral-900">
                  {placement.parentUser.name || "User"}
                </span>
              </div>
            ) : null}

            {!placement?.parentUser?.id && (
              <form
                onSubmit={handleApplyReferral}
                className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
                    {sponsor ? "Use a different referral code" : "Referral code"}
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      value={referralCodeInput}
                      onChange={(e) => setReferralCodeInput(e.target.value)}
                      placeholder="Enter referral code"
                      className={`${inputClass} pl-11`}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                      <FiLink className="h-5 w-5" />
                    </div>
                  </div>

                  {applyError ? <p className="mt-2 text-sm text-red-600">{applyError}</p> : null}
                  {applySuccess ? (
                    <p className="mt-2 text-sm text-emerald-700">{applySuccess}</p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={applyLoading}
                  className="inline-flex items-center justify-center rounded-xl bg-prim px-4 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-prim/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {applyLoading ? "Applying..." : sponsor ? "Change referrer" : "Apply referral"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>


{showWithdrawModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-900">
          Withdraw wallet balance
        </h2>
        <button
          onClick={() => setShowWithdrawModal(false)}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <FiX className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setWithdrawError("");
          setWithdrawSuccess("");

          const amt = Number(withdrawForm.amount);

          if (!Number.isFinite(amt) || amt < 100) {
            return setWithdrawError("Minimum withdrawal amount is ₹100.");
          }

          if (amt > Number(walletBalance || 0)) {
            return setWithdrawError("Amount exceeds wallet balance.");
          }

          const { name, accountNumber, ifsc } = withdrawForm;
          if (!name || !accountNumber || !ifsc) {
            return setWithdrawError("Please fill all bank details.");
          }

          try {
            setWithdrawLoading(true);
            const token = sessionStorage.getItem("token");

            await axios.post(
              `${API_BASE_URL}/withdrawals/request`,
              {
                amount: amt,
                bank: {
                  name: name.trim(),
                  accountNumber: accountNumber.trim(),
                  ifsc: ifsc.trim().toUpperCase(),
                },
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            setWithdrawSuccess("Withdrawal request submitted for approval.");
            setWithdrawForm({
              amount: "",
              name: "",
              accountNumber: "",
              ifsc: "",
            });

            await fetchUserInfo(); // refresh wallet balance
          } catch (err) {
            setWithdrawError(
              err.response?.data?.message || "Failed to request withdrawal."
            );
          } finally {
            setWithdrawLoading(false);
          }
        }}
        className="p-4 space-y-4"
      >
        {/* Amount */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
            Amount (₹)
          </label>
          <input
            type="number"
            min="100"
            placeholder="Minimum ₹100"
            value={withdrawForm.amount}
            onChange={(e) =>
              setWithdrawForm({ ...withdrawForm, amount: e.target.value })
            }
            className={inputClass}
          />
        </div>

        {/* Account Holder */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
            Account holder name
          </label>
          <input
            value={withdrawForm.name}
            onChange={(e) =>
              setWithdrawForm({ ...withdrawForm, name: e.target.value })
            }
            className={inputClass}
            placeholder="As per bank records"
          />
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
            Account number
          </label>
          <input
            value={withdrawForm.accountNumber}
            onChange={(e) =>
              setWithdrawForm({
                ...withdrawForm,
                accountNumber: e.target.value,
              })
            }
            className={inputClass}
            placeholder="e.g. 1234567890"
          />
        </div>

        {/* IFSC */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-neutral-500 mb-1">
            IFSC code
          </label>
          <input
            value={withdrawForm.ifsc}
            onChange={(e) =>
              setWithdrawForm({ ...withdrawForm, ifsc: e.target.value })
            }
            className={inputClass}
            placeholder="e.g. HDFC0001234"
          />
        </div>

        {/* Errors / success */}
        {withdrawError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {withdrawError}
          </div>
        )}

        {withdrawSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {withdrawSuccess}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-neutral-600">
            Available: ₹{Number(walletBalance || 0).toFixed(2)}
          </span>

          <button
            type="submit"
            disabled={withdrawLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-prim px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:opacity-95 disabled:opacity-70"
          >
            <FiSend className="h-4 w-4" />
            {withdrawLoading ? "Submitting..." : "Request withdrawal"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </>
  );
};

export default TopMetrics;
