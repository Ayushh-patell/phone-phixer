// src/pages/ForgotPassword.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { HiOutlineDevicePhoneMobile } from "react-icons/hi2";
import {
  FiMail,
  FiKey,
  FiEye,
  FiEyeOff,
  FiArrowLeft,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const inputClass = useMemo(
    () =>
      [
        "w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-sm text-neutral-900",
        "placeholder:text-neutral-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-prim/35 focus:border-prim",
      ].join(" "),
    []
  );

  async function handleSendCode(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }

    try {
      setSending(true);
      await axios.post(`${API_BASE_URL}/users/forgot-password`, {
        email: email.trim(),
      });

      setCodeSent(true);
      setMessage("We sent a 6-digit reset code to your email.");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        "Failed to send reset code. Please try again.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    if (!trimmedEmail || !trimmedCode || !newPassword || !confirmPassword) {
      setError("Fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setResetting(true);
      await axios.post(`${API_BASE_URL}/users/reset-password`, {
        email: trimmedEmail,
        code: trimmedCode,
        newPassword,
      });

      setMessage("Password updated. Redirecting…");
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        "Failed to reset password. Please try again.";
      setError(msg);
    } finally {
      setResetting(false);
    }
  }

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
            {/* Left / Info panel */}
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
                    <div className="text-xs text-neutral-500">Password reset</div>
                  </div>
                </div>

                <h1 className="mt-10 text-3xl font-semibold text-neutral-900 leading-tight">
                  Reset your password
                  <span className="text-neutral-900">
                    {" "}
                    with a <span className="text-prim">one-time code</span>.
                  </span>
                </h1>

                <div className="mt-6 space-y-3 text-sm text-neutral-700">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>We’ll email you a 6-digit code.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>Enter the code and set a new password.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>You’ll return to login after success.</p>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                      <FiKey className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-neutral-600">
                      If you requested multiple codes, only the latest one may work.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-10 text-xs text-neutral-500">
                Tip: check Spam/Promotions if you don’t see the email.
              </div>
            </div>

            {/* Right / Form panel */}
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
                  <div className="text-xs text-neutral-500">Password reset</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Account
                </div>
                <h2 className="mt-1 text-2xl font-semibold text-neutral-900">
                  Forgot password
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Send a reset code, then choose a new password.
                </p>
              </div>

              {/* Messages */}
              {message && (
                <div className="mb-4 rounded-2xl border border-prim/30 bg-prim/15 px-3.5 py-3 text-sm text-neutral-800">
                  <div className="flex items-start gap-2">
                    <FiCheckCircle className="mt-0.5 h-4 w-4" />
                    <span>{message}</span>
                  </div>
                </div>
              )}
              {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="mt-0.5 h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Step pills */}
              <div className="mb-5 flex items-center gap-2 text-xs">
                <span
                  className={[
                    "rounded-full px-2.5 py-1 font-semibold ring-1",
                    !codeSent
                      ? "bg-prim/25 text-neutral-900 ring-prim/30"
                      : "bg-neutral-100 text-neutral-600 ring-neutral-200",
                  ].join(" ")}
                >
                  1. Code
                </span>
                <span className="text-neutral-300">—</span>
                <span
                  className={[
                    "rounded-full px-2.5 py-1 font-semibold ring-1",
                    codeSent
                      ? "bg-prim/25 text-neutral-900 ring-prim/30"
                      : "bg-neutral-100 text-neutral-600 ring-neutral-200",
                  ].join(" ")}
                >
                  2. Reset
                </span>
              </div>

              {/* Step 1: Send code */}
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-neutral-800 mb-1.5"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      className={`${inputClass} pl-11`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                      <FiMail className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-prim px-4 py-3 text-sm font-semibold text-neutral-900 shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-prim/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send code"}
                </button>
              </form>

              {/* Step 2 */}
              <div
                className={[
                  "mt-6 rounded-3xl border border-neutral-200 p-5",
                  "bg-neutral-50",
                  codeSent ? "" : "opacity-60",
                ].join(" ")}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-2xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                      <FiKey className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Reset password
                    </h3>
                  </div>

                  <span
                    className={[
                      "text-[11px] font-semibold rounded-full px-2 py-1 ring-1",
                      codeSent
                        ? "bg-white text-neutral-700 ring-neutral-200"
                        : "bg-white/70 text-neutral-500 ring-neutral-200",
                    ].join(" ")}
                  >
                    {codeSent ? "Enabled" : "Send code first"}
                  </span>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label
                      htmlFor="code"
                      className="block text-sm font-medium text-neutral-800 mb-1.5"
                    >
                      Verification code
                    </label>
                    <input
                      id="code"
                      type="text"
                      className={`${inputClass} tracking-[0.35em] text-center font-semibold`}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\s+/g, "").slice(0, 6))
                      }
                      placeholder="123456"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      disabled={!codeSent}
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="newPassword"
                      className="block text-sm font-medium text-neutral-800 mb-1.5"
                    >
                      New password
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        className={`${inputClass} pr-11`}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        disabled={!codeSent}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((s) => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-neutral-500 hover:text-neutral-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-prim/35"
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                        disabled={!codeSent}
                      >
                        {showNewPassword ? (
                          <FiEyeOff className="h-5 w-5" />
                        ) : (
                          <FiEye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-neutral-500">
                      Use at least 6 characters.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-neutral-800 mb-1.5"
                    >
                      Confirm new password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        className={`${inputClass} pr-11`}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        disabled={!codeSent}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((s) => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-neutral-500 hover:text-neutral-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-prim/35"
                        aria-label={
                          showConfirmPassword ? "Hide password" : "Show password"
                        }
                        disabled={!codeSent}
                      >
                        {showConfirmPassword ? (
                          <FiEyeOff className="h-5 w-5" />
                        ) : (
                          <FiEye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!codeSent || resetting}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-prim/35 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resetting ? "Resetting…" : "Reset password"}
                  </button>
                </form>
              </div>

              {/* Footer */}
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="text-neutral-600">Remembered your password?</span>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
