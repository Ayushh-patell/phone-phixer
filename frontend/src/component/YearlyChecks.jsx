// src/components/YearlyChecksCompact.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const monthKeyUTC = (year, monthIndex0) =>
  `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;

const fmtINR = (n) => {
  const num = Number(n || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `₹ ${Math.round(num)}`;
  }
};

const YearlyChecksCompact = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [year, setYear] = useState(new Date().getFullYear());

  // Each month item: { checks, rspCreated, rspConvertedUnits, rspConvertedAmount }
  const [months, setMonths] = useState(
    Array.from({ length: 12 }, () => ({
      checks: 0,
      rspCreated: 0,
      rspConvertedUnits: 0,
      rspConvertedAmount: 0,
    }))
  );

  const fetchYear = async (y) => {
    try {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem("token");
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

      // Map "YYYY-MM" -> month stats
      const map = new Map();
      for (const s of stats) {
        const d = new Date(s.month);
        const k = monthKeyUTC(d.getUTCFullYear(), d.getUTCMonth());
        map.set(k, {
          checks: Number(s.checksCreated || 0),
          rspCreated: Number(s.rspCreated || 0),
          rspConvertedUnits: Number(s.rspConvertedUnits || 0),
          rspConvertedAmount: Number(s.rspConvertedAmount || 0),
        });
      }

      const out = Array.from({ length: 12 }, (_, i) => {
        const k = monthKeyUTC(y, i);
        return (
          map.get(k) || {
            checks: 0,
            rspCreated: 0,
            rspConvertedUnits: 0,
            rspConvertedAmount: 0,
          }
        );
      });

      setMonths(out);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load yearly stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYear(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const totals = useMemo(() => {
    return months.reduce(
      (acc, m) => {
        acc.checks += Number(m.checks || 0);
        acc.rspCreated += Number(m.rspCreated || 0);
        acc.rspConvertedUnits += Number(m.rspConvertedUnits || 0);
        acc.rspConvertedAmount += Number(m.rspConvertedAmount || 0);
        return acc;
      },
      { checks: 0, rspCreated: 0, rspConvertedUnits: 0, rspConvertedAmount: 0 }
    );
  }, [months]);

  const maxChecks = useMemo(
    () => Math.max(1, ...months.map((m) => Number(m.checks) || 0)),
    [months]
  );

  const maxRsp = useMemo(
    () => Math.max(1, ...months.map((m) => Number(m.rspCreated) || 0)),
    [months]
  );

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
              Checks & RSP (Year)
            </div>
            <div className="text-sm font-semibold text-slate-900 truncate">
              {year} • Checks: {totals.checks} • RSP: {totals.rspCreated}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              RSP converted: {totals.rspConvertedUnits} ({fmtINR(totals.rspConvertedAmount)})
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
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {months.map((m, i) => {
            const checks = Number(m.checks || 0);
            const rsp = Number(m.rspCreated || 0);

            const checksPct = Math.round((checks / maxChecks) * 100);
            const rspPct = Math.round((rsp / maxRsp) * 100);

            const title = [
              `${MONTHS[i]} ${year}`,
              `Checks: ${checks}`,
              `RSP created: ${rsp}`,
              `RSP converted: ${Number(m.rspConvertedUnits || 0)} (${fmtINR(m.rspConvertedAmount || 0)})`,
            ].join(" • ");

            return (
              <div
                key={`${year}-${i}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2"
                title={title}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">
                    {MONTHS[i]}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {year}
                  </span>
                </div>

                {/* Checks row */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Checks</span>
                  <span className="text-[11px] font-semibold text-slate-900">
                    {checks}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-white border border-slate-200 overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${checksPct}%` }} />
                </div>

                {/* RSP row */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">RSP</span>
                  <span className="text-[11px] font-semibold text-slate-900">
                    {rsp}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-white border border-slate-200 overflow-hidden">
                  <div className="h-full bg-prim" style={{ width: `${rspPct}%` }} />
                </div>

                {/* Conversion mini line */}
                <div className="mt-2 text-[10px] text-slate-500">
                  Converted:{" "}
                  <span className="text-slate-700 font-medium">
                    {Number(m.rspConvertedUnits || 0)}
                  </span>{" "}
                  <span className="text-slate-400">•</span>{" "}
                  <span className="text-slate-700 font-medium">
                    {fmtINR(m.rspConvertedAmount || 0)}
                  </span>
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
