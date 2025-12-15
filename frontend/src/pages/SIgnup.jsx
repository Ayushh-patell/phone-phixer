// src/pages/Signup.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api/auth";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if(form.deviceImei.length !== 15) {
      setError("IMEI Number incorrect");
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
        deviceImei: form.deviceImei.trim() || undefined,
      };

      const data = await registerUser(payload);

      const userId = data.userId;

      // Step 2: Email verification page
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-lg p-8">
        {/* Brand */}
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-[0.35em] uppercase text-sky-600">
            phone-phixer
          </div>
          <p className="mt-2 text-sm text-slate-500">Create your account.</p>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Sign up</h2>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={form.name}
              onChange={handleChange}
              placeholder="Jane Doe"
              required
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Phone (optional)
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={form.phone}
              onChange={handleChange}
              placeholder="9876543210"
            />
          </div>

          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Address
            </label>
            <textarea
              id="address"
              name="address"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={form.address}
              onChange={handleChange}
              placeholder="House / Flat, Street, City, PIN"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="deviceBrand"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Device brand
              </label>
              <input
                id="deviceBrand"
                name="deviceBrand"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={form.deviceBrand}
                onChange={handleChange}
                placeholder="Samsung, Apple…"
              />
            </div>
            <div>
              <label
                htmlFor="deviceModel"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Device model
              </label>
              <input
                id="deviceModel"
                name="deviceModel"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={form.deviceModel}
                onChange={handleChange}
                placeholder="S23, iPhone 15…"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="deviceImei"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Device IMEI
            </label>
            <input
              id="deviceImei"
              name="deviceImei"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={form.deviceImei}
              onChange={handleChange}
              placeholder="IMEI number"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
          <span>Already have an account?</span>
          <Link
            to="/login"
            className="font-medium text-sky-600 hover:text-sky-700 hover:underline"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
