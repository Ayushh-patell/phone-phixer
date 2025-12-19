// src/pages/Signup.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api/auth";
import {
  FiEye,
  FiEyeOff,
  FiUser,
  FiMail,
  FiPhone,
  FiMapPin,
  FiSmartphone,
  FiHash,
  FiAlertTriangle,
  FiCheckCircle,
} from "react-icons/fi";
import { HiOutlineDevicePhoneMobile } from "react-icons/hi2";

function SignupPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
    deviceBrand: "",
    deviceModel: "",
    deviceImei: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const labelClass = "block text-sm font-medium text-neutral-800 mb-1.5";

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const imei = form.deviceImei.trim();
    if (imei && imei.length !== 15) {
      setError("IMEI must be 15 digits.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        deviceBrand: form.deviceBrand.trim() || undefined,
        deviceModel: form.deviceModel.trim() || undefined,
        deviceImei: imei || undefined,
      };

      const data = await registerUser(payload);
      const userId = data.userId;

      navigate(
        `/verify-email?userId=${encodeURIComponent(
          userId
        )}&email=${encodeURIComponent(form.email.trim())}`
      );
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* soft prim backdrop */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-neutral-50 to-neutral-100" />
        <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-prim/20 blur-3xl" />
        <div className="absolute -bottom-56 right-[-200px] h-[680px] w-[680px] rounded-full bg-prim/18 blur-3xl" />
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
                      Create your account
                    </div>
                  </div>
                </div>

                <h1 className="mt-10 text-3xl font-semibold text-neutral-900 leading-tight">
                  Join in minutes.
                  <span className="text-neutral-900">
                    {" "}
                    Keep your <span className="text-prim">repairs</span> and{" "}
                    <span className="text-prim">devices</span> organized.
                  </span>
                </h1>

                <div className="mt-6 space-y-3 text-sm text-neutral-700">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>Save device details for faster check-ins.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>Get status updates in one place.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-prim" />
                    <p>Email verification keeps your account secure.</p>
                  </div>
                </div>

                {/* <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl bg-prim/20 ring-1 ring-prim/30 text-neutral-900">
                      <FiHash className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-neutral-600">
                      IMEI is optional, but helps identify your device faster
                      (15 digits).
                    </p>
                  </div>
                </div> */}
              </div>

              <div className="mt-10 text-xs text-neutral-500">
                Already have an account? Use the login link on the right.
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
                  <div className="text-xs text-neutral-500">Sign up</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  Account
                </div>
                <h2 className="mt-1 text-2xl font-semibold text-neutral-900">
                  Sign up
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Create your account to continue.
                </p>
              </div>

              {info && (
                <div className="mb-5 rounded-2xl border border-prim/30 bg-prim/15 px-3.5 py-3 text-sm text-neutral-800">
                  <div className="flex items-start gap-2">
                    <FiCheckCircle className="mt-0.5 h-4 w-4" />
                    <span>{info}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="mt-0.5 h-4 w-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="name" className={labelClass}>
                    Name
                  </label>
                  <div className="relative">
                    <input
                      id="name"
                      name="name"
                      className={`${inputClass} pl-11`}
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Jane Doe"
                      autoComplete="name"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                      <FiUser className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className={`${inputClass} pl-11`}
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                      <FiMail className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                {/* Phone + IMEI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className={labelClass}>
                      Phone <span className="text-neutral-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        className={`${inputClass} pl-11`}
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="9876543210"
                        autoComplete="tel"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                        <FiPhone className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="deviceImei" className={labelClass}>
                      Device IMEI{" "}
                      <span className="text-neutral-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        id="deviceImei"
                        name="deviceImei"
                        className={`${inputClass} pl-11`}
                        value={form.deviceImei}
                        onChange={handleChange}
                        placeholder="15-digit IMEI"
                        inputMode="numeric"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                        <FiHash className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label htmlFor="address" className={labelClass}>
                    Address <span className="text-neutral-400">(optional)</span>
                  </label>
                  <div className="relative">
                    <textarea
                      id="address"
                      name="address"
                      className={`${inputClass} pl-11`}
                      value={form.address}
                      onChange={handleChange}
                      placeholder="House / Flat, Street, City, PIN"
                      rows={2}
                      autoComplete="street-address"
                    />
                    <div className="absolute left-3 top-3.5 text-neutral-400">
                      <FiMapPin className="h-5 w-5" />
                    </div>
                  </div>
                </div>

                {/* Device Brand/Model */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="deviceBrand" className={labelClass}>
                      Device brand{" "}
                      <span className="text-neutral-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        id="deviceBrand"
                        name="deviceBrand"
                        className={`${inputClass} pl-11`}
                        value={form.deviceBrand}
                        onChange={handleChange}
                        placeholder="Samsung, Apple…"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                        <FiSmartphone className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="deviceModel" className={labelClass}>
                      Device model{" "}
                      <span className="text-neutral-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        id="deviceModel"
                        name="deviceModel"
                        className={`${inputClass} pl-11`}
                        value={form.deviceModel}
                        onChange={handleChange}
                        placeholder="S23, iPhone 15…"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                        <FiSmartphone className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      className={`${inputClass} pr-11`}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      minLength={6}
                      autoComplete="new-password"
                      required
                    />
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
                  <p className="mt-2 text-xs text-neutral-500">
                    Use at least 6 characters.
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className={labelClass}>
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      className={`${inputClass} pr-11`}
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      minLength={6}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-prim/35"
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
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
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-prim/35 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Creating…" : "Create account"}
                </button>

                <div className="pt-2 text-center text-sm text-neutral-600">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="font-semibold text-neutral-900 hover:underline"
                  >
                    Log in
                  </Link>
                </div>
              </form>

              <p className="mt-5 text-xs text-neutral-500">
                By continuing, you agree to our terms and acknowledge our privacy
                practices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
