// src/pages/VerifyEmail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { sendEmailVerification, verifyEmailCode } from "../api/auth";
import { HiOutlineDevicePhoneMobile } from "react-icons/hi2";
import {
  FiMail,
  FiRefreshCw,
  FiArrowLeft,
  FiCheckCircle,
  FiAlertTriangle,
  FiShield,
} from "react-icons/fi";

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userId = searchParams.get("userId");
  const email = searchParams.get("email");

  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const inputClass = useMemo(
    () =>
      [
        "w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-sm text-neutral-900",
        "placeholder:text-neutral-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-prim/35 focus:border-prim",
      ].join(" "),
    []
  );

  useEffect(() => {
    if (!userId) return;
    handleSendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleSendCode() {
    if (!userId) return;
    setError("");
    setInfo("");
    setSending(true);
    try {
      await sendEmailVerification(userId);
      setInfo("We sent a 6-digit code to your email.");
    } catch (err) {
      setError(err.message || "Failed to send verification email.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();

    if (!userId) {
      setError("Missing user information. Please sign up again.");
      return;
    }

    const clean = (code || "").replace(/\s+/g, "").slice(0, 6);
    if (clean.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setError("");
    setInfo("");
    setVerifying(true);
    try {
      const res = await verifyEmailCode({ userId, code: clean });

      setInfo("Email verified. Redirecting…");
      sessionStorage.setItem('referralCode', res.referralCode);
      setTimeout(() => navigate(`/login?ref=${res.referralCode}`), 900);
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  // ===== Missing userId state =====
  if (!userId) {
    return (
      <div className="min-h-screen bg-neutral-50">
        {/* soft prim backdrop */}
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-neutral-50 to-neutral-100" />
          <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-prim/20 blur-3xl" />
          <div className="absolute -bottom-52 right-[-180px] h-[620px] w-[620px] rounded-full bg-prim/18 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
            <div className="h-1.5 w-full bg-prim" />

            <div className="p-7 sm:p-8">
              <div className="flex items-center justify-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                  <HiOutlineDevicePhoneMobile className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold tracking-[0.35em] uppercase text-neutral-900">
                  phone-phixer
                </div>
              </div>

              <h2 className="mt-6 text-xl font-semibold text-neutral-900">
                Email verification
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                We couldn’t find your signup details.
              </p>

              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <FiAlertTriangle className="mt-0.5 h-4 w-4" />
                  <span>Please sign up again to get a fresh verification link.</span>
                </div>
              </div>

              <Link
                to="/signup"
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-prim/35"
              >
                Go to sign up
              </Link>

              <div className="mt-4 text-center text-sm text-neutral-600">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 font-semibold text-neutral-900 hover:underline"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-prim/25 ring-1 ring-prim/30">
                    <FiArrowLeft className="h-4 w-4" />
                  </span>
                  Back to login
                </Link>
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-neutral-50 px-7 py-4 text-xs text-neutral-600">
              If you opened an old link, sign up again and verify using the latest code.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== Normal state =====
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* soft prim backdrop */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-neutral-50 to-neutral-100" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-prim/20 blur-3xl" />
        <div className="absolute -bottom-52 right-[-180px] h-[620px] w-[620px] rounded-full bg-prim/18 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left panel */}
            <div className="hidden md:flex flex-col justify-between p-10 bg-neutral-50">
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                    <HiOutlineDevicePhoneMobile className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold tracking-[0.35em] uppercase text-neutral-800">
                      phone-phixer
                    </div>
                    <div className="text-xs text-neutral-500">Email verification</div>
                  </div>
                </div>

                <h1 className="mt-10 text-3xl font-semibold text-neutral-900 leading-tight">
                  Verify your email
                  <span className="text-neutral-900">
                    {" "}
                    to <span className="text-prim">activate</span> your account.
                  </span>
                </h1>

                <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                      <FiMail className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-neutral-700">Code sent to</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-900 truncate">
                        {email || "your email"}
                      </p>
                      <p className="mt-2 text-xs text-neutral-600">
                        Check spam/promotions if you don’t see it.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-neutral-700">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>Enter the 6-digit code on the right.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>You can resend if it didn’t arrive.</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                    <FiShield className="h-5 w-5" />
                  </div>
                  <p className="text-xs text-neutral-600">
                    Keep your code private. Don’t share it with anyone.
                  </p>
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div className="p-6 sm:p-8 md:p-10">
              {/* Mobile brand */}
              <div className="mb-6 flex items-center gap-3 md:hidden">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                  <HiOutlineDevicePhoneMobile className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-[0.35em] uppercase text-neutral-900">
                    phone-phixer
                  </div>
                  <div className="text-xs text-neutral-500">Email verification</div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-900">
                    Check your email
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Enter the code sent to{" "}
                    <span className="font-semibold text-neutral-900">
                      {email || "your email"}
                    </span>
                    .
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className="rounded-full px-2.5 py-1 font-semibold bg-prim/25 text-neutral-900 ring-1 ring-prim/30">
                    1
                  </span>
                  <span className="text-neutral-300">—</span>
                  <span className="rounded-full px-2.5 py-1 font-semibold bg-neutral-100 text-neutral-600">
                    2
                  </span>
                </div>
              </div>

              {info && (
                <div className="mt-5 rounded-2xl border border-prim/30 bg-prim/15 px-3.5 py-3 text-sm text-neutral-800">
                  <div className="flex items-start gap-2">
                    <FiCheckCircle className="mt-0.5 h-4 w-4" />
                    <span>{info}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="mt-0.5 h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerify} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="code"
                    className="block text-sm font-medium text-neutral-800 mb-1.5"
                  >
                    Verification code
                  </label>
                  <input
                    id="code"
                    className={`${inputClass} text-center tracking-[0.45em] font-semibold`}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\s+/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                  <p className="mt-2 text-xs text-neutral-500">
                    Tip: you can paste the code — we’ll trim it.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={verifying}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-prim/35 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {verifying ? "Verifying…" : "Verify email"}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-prim/35 disabled:opacity-70"
                >
                  <FiRefreshCw className={sending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  {sending ? "Resending…" : "Resend"}
                </button>

                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 font-semibold text-neutral-900 hover:underline"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-prim/25 ring-1 ring-prim/30">
                    <FiArrowLeft className="h-4 w-4" />
                  </span>
                  Back
                </Link>
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
                Wrong email? Go back and sign up again with the correct address.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
