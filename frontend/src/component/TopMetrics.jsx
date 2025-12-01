// src/components/TopMetrics.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { FiCopy, FiCheck } from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const REFERRAL_UV_THRESHOLD = 5;

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


  const [userInfo, setUserInfo] = useState({
    selfVolume: 0,
    availableChecks: 0,
    totalEarnings: 0,
    referredBy: null,
    referralCode: null,
    referralActive: false,
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
        selfVolume: user.selfVolume ?? 0,
        totalEarnings: user.totalEarnings ?? 0,
        walletBalance: user.walletBalance ?? 0,
        rightVolume: user.rightVolume ?? 0,
        leftVolume: user.leftVolume ?? 0,
        referredBy: user.referredBy || null,
        referralCode: user.referralCode || null,
        referralActive: user.referralActive || false,
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

      await axios.post(
        `${API_BASE_URL}/users/use-code`,
        { referralCode: trimmed },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setApplySuccess("Referral applied successfully.");
      setReferralCodeInput("");
      await fetchUserInfo(); // refresh referredBy
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-center col-span-3">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-6">
        <div className="rounded-2xl border border-red-700 bg-red-900/40 p-4 text-sm text-red-100">
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
  } = userInfo;

  const canJoinProgram = selfVolume >= REFERRAL_UV_THRESHOLD && !referralActive;

  const checks = calculateSelfCheck(selfVolume) + calculateTreeChecks(leftVolume, rightVolume);
  return (
    <>
      {/* Metrics cards */}
      <section className="grid gap-4 md:grid-cols-3 mb-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Self UV
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-50">
            {selfVolume}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Your personal volume on phone-phixer.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Available Checks
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-50">
            {checks}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Checks you can currently redeem or request.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Total Earnings
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-50">
            ${Number(totalEarnings || 0).toFixed(2)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Lifetime earnings from your repairs and referrals.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Left UV
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-50">
            {Number(leftVolume || 0).toFixed(0)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Current UV in your Left side of the tree 
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Right UV
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-50">
            {Number(rightVolume || 0).toFixed(0)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Current UV in your Right side of the tree
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Wallet Balance
            </span>
          </div>
          <div className="text-2xl font-semibold text-slate-50">
            ${Number(walletBalance || 0).toFixed(2)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Current wallet balance
          </p>
        </div>
      </section>

      {/* Referral program + referral code + referred by */}
      <section className="mb-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
          {/* Referral program / Your referral code */}
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Referral program
            </div>

            {referralActive && referralCode ? (
              <div>
                <p className="text-xs text-slate-400 mb-2">
                  You are in the referral program. Share your code:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-100">
                    {referralCode}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 hover:bg-slate-800 transition"
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
                <p className="text-xs text-slate-400">
                  Once you have{" "}
                  <span className="font-semibold text-slate-200">
                    {REFERRAL_UV_THRESHOLD} UV
                  </span>{" "}
                  you can join the referral program and get your own code.
                </p>
                <p className="text-[11px] text-slate-500">
                  Current UV:{" "}
                  <span className="text-slate-100 font-medium">
                    {selfVolume} / {REFERRAL_UV_THRESHOLD}
                  </span>
                </p>

                {joinError && (
                  <p className="text-[11px] text-red-300">{joinError}</p>
                )}
                {joinSuccess && (
                  <p className="text-[11px] text-emerald-300">{joinSuccess}</p>
                )}

                {canJoinProgram && (
                  <button
                    type="button"
                    onClick={handleJoinReferralProgram}
                    disabled={joinLoading}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-600/70"
                  >
                    {joinLoading ? "Joining..." : "Join referral program"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-800" />

          {/* Referred by / Apply referral */}
          {referredBy ? (
            <div className="flex flex-col gap-1">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Referred by
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1 text-xs text-slate-100 border border-slate-700">
                  {referredBy.name || "User"}
                </span>
                {referredBy.email && (
                  <span className="text-xs text-slate-400">
                    {referredBy.email}
                  </span>
                )}
                {referredBy.referralCode && (
                  <span className="inline-flex items-center rounded-full bg-sky-900/40 px-2 py-0.5 text-[11px] text-sky-300 border border-sky-700/60">
                    Code: {referredBy.referralCode}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-emerald-300">
                Referral already applied to this account.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleApplyReferral}
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                  Referral code
                </label>
                <input
                  type="text"
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(e.target.value)}
                  placeholder="Enter referral code"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
                {applyError && (
                  <p className="mt-1 text-[11px] text-red-300">{applyError}</p>
                )}
                {applySuccess && (
                  <p className="mt-1 text-[11px] text-emerald-300">
                    {applySuccess}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={applyLoading}
                className="mt-2 sm:mt-0 inline-flex items-center justify-center rounded-lg bg-sky-400 px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-sky-500/70"
              >
                {applyLoading ? "Applying..." : "Apply referral"}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
};

export default TopMetrics;
