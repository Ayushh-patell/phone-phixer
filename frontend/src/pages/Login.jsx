// src/pages/Login.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { login } from "../api/auth";
import { HiOutlineDevicePhoneMobile } from "react-icons/hi2";
import {
  FiEye,
  FiEyeOff,
  FiMail,
  FiLock,
  FiArrowRight,
  FiAlertTriangle,
  FiArrowLeft,
} from "react-icons/fi";

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(""); // used as "Referral Code"
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Prefill referral code from ?ref= or sessionStorage("referralCode")
  useEffect(() => {
    const fromQuery = searchParams.get("ref");
    const fromSession = sessionStorage.getItem("referralCode");
    const referralCode = (fromQuery || fromSession || "").trim();

    if (referralCode) {
      setEmail(referralCode);
      // keep it around so refresh/navigation still has it
      sessionStorage.setItem("referralCode", referralCode);
    }
  }, [searchParams]);

  const inputClass = useMemo(
    () =>
      [
        "w-full rounded-2xl border border-neutral-300 bg-white px-3.5 py-3 text-sm text-neutral-900",
        "placeholder:text-neutral-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-prim/35 focus:border-prim",
      ].join(" "),
    []
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email.trim(), password);
      sessionStorage.setItem("token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed");
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
            {/* Left / Brand panel */}
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
                    <div className="text-xs text-neutral-500">Sign in</div>
                  </div>
                </div>

                <h1 className="mt-10 text-3xl font-semibold text-neutral-900 leading-tight">
                  Welcome back.
                  <span className="text-neutral-900">
                    {" "}
                    Let’s <span className="text-prim">get you in</span>.
                  </span>
                </h1>

                <div className="mt-6 space-y-3 text-sm text-neutral-700">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>See your repairs, purchases, and activity in one place.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>Keep device info saved for faster service and renewals.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>Secure sign-in with email verification and OTP steps.</p>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                      <FiLock className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-neutral-600">
                      Quick tip: If this isn’t your device, sign out when you’re done.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-10 text-xs text-neutral-500">
                Use the “Reset” link if you forgot your password.
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
                  <div className="text-xs text-neutral-500">Sign in</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Account
                </div>
                <h2 className="mt-1 text-2xl font-semibold text-neutral-900">
                  Log in
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Use your Referral code and password to continue.
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="mt-0.5 h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-neutral-800 mb-1.5"
                  >
                    Referral Code
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="text"
                      className={`${inputClass} pl-11`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your Referral code"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                      <FiMail className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-neutral-800 mb-1.5"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className={`${inputClass} pl-11 pr-11`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                      <FiLock className="h-5 w-5" />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-prim/35"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <FiEyeOff className="h-5 w-5" />
                      ) : (
                        <FiEye className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Forgot password?</span>
                    <Link
                      to="/forgot-password"
                      className="inline-flex items-center gap-2 font-semibold text-neutral-900 hover:underline"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-prim/25 ring-1 ring-prim/30">
                        <FiArrowRight className="h-4 w-4" />
                      </span>
                      Reset
                    </Link>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-prim/35 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>

              <div className="mt-6 rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                Don&apos;t have an account?{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-neutral-900 hover:underline"
                >
                  Sign up
                </Link>
              </div>

              <div className="mt-5 text-xs text-neutral-500 flex items-center justify-between">
                <span>Secure sign-in</span>
                <Link
                  to="/"
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

export default LoginPage;
