// src/pages/VerifyEmail.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { sendEmailVerification, verifyEmailCode } from "../api/auth";

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
      setInfo("A 6-digit verification code has been sent to your email.");
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
    if (!code || code.length < 6) {
      setError("Please enter the 6-digit code.");
      return;
    }

    setError("");
    setInfo("");
    setVerifying(true);
    try {
      await verifyEmailCode({ userId, code });
      setInfo("Email verified successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl p-8">
          <div className="text-2xl font-semibold tracking-[0.35em] uppercase text-sky-400 text-center mb-4">
            phone-phixer
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-3">
            Email verification
          </h2>
          <div className="mb-4 rounded-lg border border-red-600 bg-red-900/40 px-3 py-2 text-sm text-red-100">
            We couldn&apos;t find your signup information. Please sign up again.
          </div>
          <Link
            to="/signup"
            className="inline-flex w-full items-center justify-center rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-sky-300"
          >
            Go to sign up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl p-8">
        {/* Brand */}
        <div className="text-2xl font-semibold tracking-[0.35em] uppercase text-sky-400 text-center mb-2">
          phone-phixer
        </div>
        <p className="text-center text-sm text-slate-400 mb-6">
          Verify your email to activate your account.
        </p>

        <h2 className="text-xl font-semibold text-slate-100 mb-3">
          Check your email
        </h2>

        <p className="text-sm text-slate-300 mb-3">
          We&apos;ve sent a 6-digit verification code to{" "}
          <span className="font-semibold text-slate-100">
            {email || "your email"}
          </span>
          . Enter it below to verify your account.
        </p>

        {info && (
          <div className="mb-3 rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-slate-100">
            {info}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-red-600 bg-red-900/40 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-slate-200 mb-1"
            >
              Verification code
            </label>
            <input
              id="code"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center text-sm text-slate-100 tracking-[0.35em] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder="123456"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>

          <button
            type="submit"
            disabled={verifying}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? "Verifying..." : "Verify email"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <button
            type="button"
            onClick={handleSendCode}
            disabled={sending}
            className="font-medium text-sky-400 hover:text-sky-300 hover:underline disabled:opacity-60"
          >
            {sending ? "Resending..." : "Resend code"}
          </button>

          <Link
            to="/login"
            className="font-medium text-sky-400 hover:text-sky-300 hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
