// src/components/YearlyChecksCompact.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const monthKeyUTC = (year, monthIndex0) =>
  `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;

const YearlyChecksCompact = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState(Array(12).fill(0)); // index 0..11 => checks

  const fetchYear = async (y) => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      if (!token) {
        setError("No auth token found. Please log in again.");
        setLoading(false);
        return;
      }

      const from = `${y}-01`;
      const res = await axios.get(`${API_BASE_URL}/checks/me`, {
        params: { months: 12, from },
        headers: { Authorization: `Bearer ${token}` },
      });

      const stats = res.data?.stats || [];

      // Map "YYYY-MM" -> checksCreated
      const map = new Map();
      for (const s of stats) {
        const d = new Date(s.month);
        const k = monthKeyUTC(d.getUTCFullYear(), d.getUTCMonth());
        map.set(k, Number(s.checksCreated || 0));
      }

      const out = Array.from({ length: 12 }, (_, i) => {
        const k = monthKeyUTC(y, i);
        return map.get(k) ?? 0;
      });

      setMonths(out);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load yearly checks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYear(year);
  }, [year]);

  const total = useMemo(
    () => months.reduce((sum, n) => sum + (Number(n) || 0), 0),
    [months]
  );

  const max = useMemo(() => Math.max(1, ...months.map((n) => Number(n) || 0)), [months]);
  const currentYear = new Date().getFullYear();

  if (loading) {
    return (
      <section className="mb-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-4">
        <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">
              Checks (Year)
            </div>
            <div className="text-sm font-semibold text-slate-900 truncate">
              {year} • Total: {total}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Prev
            </button>

            <button
              type="button"
              onClick={() => fetchYear(year)}
              className="rounded-lg bg-sky-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-600 transition"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setYear((y) => Math.min(currentYear, y + 1))}
              disabled={year >= currentYear}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {/* Compact grid */}
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {months.map((val, i) => {
            const pct = Math.round(((Number(val) || 0) / max) * 100);
            return (
              <div
                key={`${year}-${i}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2"
                title={`${MONTHS[i]} ${year}: ${val} checks`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">
                    {MONTHS[i]}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-900">
                    {val}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-white border border-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-sky-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default YearlyChecksCompact;
