// src/components/TopMetrics.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { FiCopy, FiCheck } from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const calculateSelfCheck = (selfVol) => Math.floor(selfVol / 4);

const calculateTreeChecks = (left, right) => {
  const leftPairs = Math.floor(left / 2);
  const rightPairs = Math.floor(right / 2);
  return Math.min(leftPairs, rightPairs);
};

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

  // referralActive_limit from universal settings
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
    referredBy: null, // placement parent in tree
    referralUsed: null, // sponsor (whose code was used)
    referralCode: null,
    referralActive: false,
    star: 1,
    at_hotposition: false,
  });

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      if (!token) {
        setError("No auth token found. Please log in again.");
        setLoading(false);
        return;
      }

      const res = await axios.get(`${API_BASE_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        referredBy: user.referredBy || null, // placement parent
        referralUsed: user.referralUsed || null, // sponsor
        referralCode: user.referralCode || null,
        referralActive: user.referralActive || false,
        star: user.star ?? 1,
        at_hotposition: user.at_hotposition || false,
      });
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.message || "Failed to load user metrics.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  // Fetch referralActive_limit from universal settings
  useEffect(() => {
    const fetchReferralThreshold = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/settings/referralActive_limit`
        );
        const value = res.data?.value;
        const numeric = Number(value);
        if (!Number.isNaN(numeric) && numeric > 0) {
          setReferralUvThreshold(numeric);
        }
      } catch (err) {
        console.error("Failed to fetch referralActive_limit:", err);
        // keep default 5 if this fails
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
      const token = localStorage.getItem("token");
      if (!token) {
        setApplyError("No auth token found. Please log in again.");
        setApplyLoading(false);
        return;
      }

      const res = await axios.post(
        `${API_BASE_URL}/users/use-code`,
        { referralCode: trimmed },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const message =
        res.data?.message || "Referral code applied successfully.";
      setApplySuccess(message);
      setReferralCodeInput("");
      await fetchUserInfo(); // refresh referralUsed / referredBy
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.message || "Failed to apply referral code.";
      setApplyError(message);
    } finally {
      setApplyLoading(false);
    }
  };

  const handleJoinReferralProgram = async () => {
    setJoinError("");
    setJoinSuccess("");

    try {
      setJoinLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        setJoinError("No auth token found. Please log in again.");
        setJoinLoading(false);
        return;
      }

      await axios.post(
        `${API_BASE_URL}/users/join-referral-program`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setJoinSuccess("You have joined the referral program!");
      await fetchUserInfo(); // refresh referralActive & referralCode
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.message || "Failed to join referral program.";
      setJoinError(message);
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCopyReferral = async () => {
    if (!userInfo.referralCode) return;
    try {
      await navigator.clipboard.writeText(userInfo.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <section className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-center col-span-3">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-6">
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
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
    referredBy,
    referralCode,
    referralActive,
    referralUsed,
  } = userInfo;

  const canJoinProgram =
    selfVolume >= referralUvThreshold && !referralActive;

  const checks =
    calculateSelfCheck(selfVolume) + calculateTreeChecks(leftVolume, rightVolume);

  const sponsor = referralUsed || null; // sponsor = user whose code we used

  return (
    <>
      {/* Metrics cards */}
      <section className="grid gap-4 md:grid-cols-3 mb-4">
        <div className="rounded-2xl border border-slate-200 bg-sky-500 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-50">
              Self UV
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">
            {selfVolume}
          </div>
          <p className="mt-1 text-xs text-slate-50">
            Your personal volume on phone-phixer.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-sky-500 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-50">
              Available Checks
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">
            {checks}
          </div>
          <p className="mt-1 text-xs text-slate-50">
            Checks you can currently redeem or request.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-sky-500 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-50">
              Total Earnings
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">
            &#8377;{Number(totalEarnings || 0).toFixed(2)}
          </div>
          <p className="mt-1 text-xs text-slate-50">
            Lifetime earnings from your repairs and referrals.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-sky-500 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-50">
              Left UV
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">
            {Number(leftVolume || 0).toFixed(0)}
          </div>
          <p className="mt-1 text-xs text-slate-50">
            Current UV on the left side of your tree.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-sky-500 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-50">
              Right UV
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">
            {Number(rightVolume || 0).toFixed(0)}
          </div>
          <p className="mt-1 text-xs text-slate-50">
            Current UV on the right side of your tree.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-sky-500 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-50">
              Wallet Balance
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-900">
            &#8377;{Number(walletBalance || 0).toFixed(2)}
          </div>
          <p className="mt-1 text-xs text-slate-50">Current wallet balance.</p>
        </div>
      </section>

      {/* Referral program + sponsor / placement info */}
      <section className="mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          {/* Referral program / Your referral code */}
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Referral program
            </div>

            {referralActive && referralCode ? (
              <div>
                <p className="text-xs text-slate-500 mb-2">
                  You are in the referral program. Share your code:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-900">
                    {referralCode}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition"
                  >
                    {copied ? (
                      <>
                        <FiCheck className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <FiCopy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Once you have{" "}
                  <span className="font-semibold text-slate-900">
                    {referralUvThreshold} UV
                  </span>{" "}
                  you can join the referral program and get your own code.
                </p>
                <p className="text-[11px] text-slate-500">
                  Current UV:{" "}
                  <span className="text-slate-900 font-medium">
                    {selfVolume} / {referralUvThreshold}
                  </span>
                </p>

                {joinError && (
                  <p className="text-[11px] text-red-500">{joinError}</p>
                )}
                {joinSuccess && (
                  <p className="text-[11px] text-emerald-600">{joinSuccess}</p>
                )}

                {canJoinProgram && (
                  <button
                    type="button"
                    onClick={handleJoinReferralProgram}
                    disabled={joinLoading}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {joinLoading ? "Joining..." : "Join referral program"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-200" />

          {/* Sponsor / placement info + referral input (only before placement) */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Referral sponsor & placement
            </div>

            {/* Sponsor info (referralUsed) */}
            {sponsor ? (
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 border border-slate-200">
                    {sponsor.name || "User"}
                  </span>
                  {sponsor.email && (
                    <span className="text-xs text-slate-500">
                      {sponsor.email}
                    </span>
                  )}
                  {sponsor.referralCode && (
                    <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700 border border-sky-200">
                      Code: {sponsor.referralCode}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                You haven&apos;t used a referral code yet. You can link a referrer
                before you are placed in the tree.
              </p>
            )}

            {/* Placement parent info (referredBy) */}
            {referredBy && (
              <div className="text-[11px] text-slate-500">
                Referred By:{" "}
                <span className="font-medium text-slate-800">
                  {referredBy.name || "User"}
                </span>

              </div>
            )}

            {/* Apply / change referral code
                Only allowed if NOT yet placed in tree (no referredBy) */}
            {!referredBy && (
              <form
                onSubmit={handleApplyReferral}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                    {sponsor ? "Use a different referral code" : "Referral code"}
                  </label>
                  <input
                    type="text"
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value)}
                    placeholder="Enter referral code"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                  {applyError && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {applyError}
                    </p>
                  )}
                  {applySuccess && (
                    <p className="mt-1 text-[11px] text-emerald-600">
                      {applySuccess}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={applyLoading}
                  className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
                >
                  {applyLoading
                    ? "Applying..."
                    : sponsor
                    ? "Change Referrer"
                    : "Apply referral"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default TopMetrics;
