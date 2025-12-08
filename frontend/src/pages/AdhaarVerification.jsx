// src/pages/VerifyAadhaarPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { sendAadhaarOtp, verifyAadhaarOtp } from "../api/auth";

function VerifyAadhaarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const email = searchParams.get("email") || "";

  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("aadhaar"); // "aadhaar" | "otp"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!userId) {
      setError("Missing user information. Please sign up again.");
    }
  }, [userId]);

  async function handleSendOtp(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!/^\d{12}$/.test(aadhaarNumber.trim())) {
      setError("Please enter a valid 12-digit Aadhaar number");
      return;
    }

    setLoading(true);
    try {
      await sendAadhaarOtp({
        userId,
        aadhaarNumber: aadhaarNumber.trim(),
      });

      setInfo("OTP sent to your Aadhaar-registered mobile number.");
      setStep("otp");
    } catch (err) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!otp.trim()) {
      setError("Please enter the OTP");
      return;
    }

    setLoading(true);
    try {
      await verifyAadhaarOtp({
        userId,
        otp: otp.trim(),
      });

      setInfo("Aadhaar verified successfully.");

      // After Aadhaar is verified, go to existing email verification flow
      navigate(
        `/verify-email?userId=${encodeURIComponent(
          userId
        )}&email=${encodeURIComponent(email)}`
      );
    } catch (err) {
      setError(err.message || "Failed to verify OTP");
    } finally {
      setLoading(false);
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
            Aadhaar verification for secure onboarding.
          </p>
        </div>

        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Verify Aadhaar
        </h2>

        {/* Error / Info */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {info}
          </div>
        )}

        {/* Step 1: Aadhaar number */}
        {step === "aadhaar" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label
                htmlFor="aadhaar"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Aadhaar number
              </label>
              <input
                id="aadhaar"
                name="aadhaar"
                inputMode="numeric"
                maxLength={12}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={aadhaarNumber}
                onChange={(e) =>
                  setAadhaarNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder="XXXX XXXX XXXX"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                We’ll send an OTP to the mobile number linked with this Aadhaar.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !userId}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label
                htmlFor="otp"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Enter OTP
              </label>
              <input
                id="otp"
                name="otp"
                inputMode="numeric"
                maxLength={6}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Enter the OTP sent to your Aadhaar-linked mobile number.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !userId}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Verifying..." : "Verify Aadhaar"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep("aadhaar");
                setOtp("");
                setInfo("");
              }}
              className="w-full text-xs text-sky-600 hover:text-sky-700 hover:underline mt-1"
            >
              Change Aadhaar number / Resend OTP
            </button>
          </form>
        )}

        <div className="mt-6 text-xs text-slate-500 flex justify-between">
          <span>Your account isn’t fully active until you verify Aadhaar.</span>
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

export default VerifyAadhaarPage;
