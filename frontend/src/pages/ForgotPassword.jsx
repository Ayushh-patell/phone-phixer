// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

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

  async function handleSendCode(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    try {
      setSending(true);
      await axios.post(`${API_BASE_URL}/users/forgot-password`, {
        email: email.trim(),
      });

      setCodeSent(true);
      setMessage("A 6-digit password reset code has been sent to your email.");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message || "Failed to send reset code. Please try again.";
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
      setError("Please fill in all fields.");
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

      setMessage("Password updated successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message || "Failed to reset password. Please try again.";
      setError(msg);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-lg p-8">
        {/* Brand */}
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-[0.35em] uppercase text-sky-600">
            phone-phixer
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Reset your password using a one-time code.
          </p>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Forgot password
        </h2>

        {/* Messages */}
        {message && (
          <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Send code */}
        <form onSubmit={handleSendCode} className="space-y-4 mb-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {sending ? "Sending code..." : "Send reset code"}
          </button>
        </form>

        {/* Step 2: Enter code + new password (visible after code is sent) */}
        <div className={`border-t border-slate-200 pt-5 ${codeSent ? "" : "opacity-60"}`}>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            Reset password
          </h3>

          <form
            onSubmit={handleResetPassword}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Verification code
              </label>
              <input
                id="code"
                type="text"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tracking-[0.35em] text-center placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
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
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                disabled={!codeSent}
                required
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                disabled={!codeSent}
                required
              />
            </div>

            <button
              type="submit"
              disabled={!codeSent || resetting}
              className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              {resetting ? "Resetting password..." : "Reset password"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
          <span>Remembered your password?</span>
          <Link
            to="/login"
            className="font-medium text-sky-600 hover:text-sky-700 hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
