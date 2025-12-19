// src/pages/VerifyAadhaarPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { sendAadhaarOtp, verifyAadhaarOtp } from "../api/auth";
import { HiOutlineDevicePhoneMobile } from "react-icons/hi2";
import {
  FiShield,
  FiRefreshCw,
  FiArrowLeft,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";

function VerifyAadhaarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId") || "";

  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("aadhaar"); // "aadhaar" | "otp"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

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
    if (!userId) setError("Missing user information. Please sign up again.");
  }, [userId]);

  async function handleSendOtp(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!/^\d{12}$/.test(aadhaarNumber.trim())) {
      setError("Enter a valid 12-digit Aadhaar number.");
      return;
    }

    setLoading(true);
    try {
      await sendAadhaarOtp({ userId, aadhaarNumber: aadhaarNumber.trim() });
      setInfo("OTP sent to your Aadhaar-linked mobile.");
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

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setError("Enter the OTP.");
      return;
    }

    setLoading(true);
    try {
      await verifyAadhaarOtp({ userId, otp: cleanOtp });
      setInfo("Aadhaar verified. Redirecting…");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to verify OTP");
    } finally {
      setLoading(false);
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
                    <div className="text-xs text-neutral-500">
                      Aadhaar verification
                    </div>
                  </div>
                </div>

                <h1 className="mt-10 text-3xl font-semibold text-neutral-900 leading-tight">
                  Secure onboarding
                  <span className="text-neutral-900">
                    {" "}
                    with <span className="text-prim">Aadhaar OTP</span>.
                  </span>
                </h1>

                <div className="mt-6 space-y-3 text-sm text-neutral-700">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>OTP is sent to your Aadhaar-linked mobile.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>Helps protect your account from misuse.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>You’ll continue to your dashboard after verification.</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                    <FiShield className="h-5 w-5" />
                  </div>
                  <p className="text-xs text-neutral-600">
                    Enter your own Aadhaar number only. Keep your OTP private.
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
                  <div className="text-xs text-neutral-500">
                    Aadhaar verification
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-900">
                    Verify Aadhaar
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Enter Aadhaar to receive an OTP.
                  </p>
                </div>

                {/* step pills */}
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 font-semibold",
                      step === "aadhaar"
                        ? "bg-prim/25 text-neutral-900 ring-1 ring-prim/30"
                        : "bg-neutral-100 text-neutral-600",
                    ].join(" ")}
                  >
                    1
                  </span>
                  <span className="text-neutral-300">—</span>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 font-semibold",
                      step === "otp"
                        ? "bg-prim/25 text-neutral-900 ring-1 ring-prim/30"
                        : "bg-neutral-100 text-neutral-600",
                    ].join(" ")}
                  >
                    2
                  </span>
                </div>
              </div>

              {/* alerts */}
              {error && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="mt-0.5 h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {info && (
                <div className="mt-5 rounded-2xl border border-prim/30 bg-prim/15 px-3.5 py-3 text-sm text-neutral-800">
                  <div className="flex items-start gap-2">
                    <FiCheckCircle className="mt-0.5 h-4 w-4" />
                    <span>{info}</span>
                  </div>
                </div>
              )}

              {/* Step 1 */}
              {step === "aadhaar" && (
                <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="aadhaar"
                      className="block text-sm font-medium text-neutral-800 mb-1.5"
                    >
                      Aadhaar number
                    </label>
                    <input
                      id="aadhaar"
                      name="aadhaar"
                      inputMode="numeric"
                      maxLength={12}
                      className={`${inputClass} tracking-[0.18em] text-center font-semibold`}
                      value={aadhaarNumber}
                      onChange={(e) =>
                        setAadhaarNumber(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="XXXXXXXXXXXX"
                      required
                    />
                    <p className="mt-2 text-xs text-neutral-500">
                      OTP will be sent to your Aadhaar-linked mobile.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !userId}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-prim/35 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Sending OTP…" : "Send OTP"}
                  </button>
                </form>
              )}

              {/* Step 2 */}
              {step === "otp" && (
                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                  <div>
                    <label
                      htmlFor="otp"
                      className="block text-sm font-medium text-neutral-800 mb-1.5"
                    >
                      OTP
                    </label>
                    <input
                      id="otp"
                      name="otp"
                      inputMode="numeric"
                      maxLength={6}
                      className={`${inputClass} tracking-[0.35em] text-center font-semibold`}
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="123456"
                      required
                    />
                    <p className="mt-2 text-xs text-neutral-500">
                      Enter the code from SMS.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !userId}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-prim/35 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Verifying…" : "Verify"}
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setStep("aadhaar");
                      setOtp("");
                      setInfo("");
                      setError("");
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-prim/35 disabled:opacity-70"
                  >
                    <FiRefreshCw
                      className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                    />
                    Change Aadhaar / Resend OTP
                  </button>
                </form>
              )}

              <div className="mt-7 flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  Verification is required to continue.
                </span>
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

              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
                If you don’t receive the OTP, check your Aadhaar-linked mobile and try again.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyAadhaarPage;
