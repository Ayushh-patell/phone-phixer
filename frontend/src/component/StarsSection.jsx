import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FiStar, FiTrendingUp, FiDollarSign, FiActivity, FiAlertTriangle } from "react-icons/fi";
import YearlyChecksCompact from "./YearlyChecks";
import StarEligibilitySection from "./StarEligibility";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const StarsSection = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const fetchMe = async () => {
      try {
        setLoading(true);
        setErr("");

        const token = sessionStorage.getItem("token");
        const res = await axios.get(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUser(res.data || {});
      } catch (e) {
        setErr(e?.response?.data?.message || e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  const starLvl = user?.star ?? 1;
  const starName = user?.starInfo?.name ?? "-";
  const checkPrice = user?.starInfo?.checkPrice ?? "-";
  const rsp = user?.rsp ?? 0;
  const totalRsp = user?.Totalrsp ?? 0;

  const StatCard = useMemo(
    () =>
      function StatCard({ label, value, Icon, accent = "prim" }) {
        const accentBar =
          accent === "prim"
            ? "bg-prim"
            : accent === "emerald"
            ? "bg-emerald-500"
            : accent === "amber"
            ? "bg-amber-500"
            : "bg-neutral-900";

        const badgeRing =
          accent === "prim"
            ? "bg-prim/20 ring-prim/30"
            : accent === "emerald"
            ? "bg-emerald-100 ring-emerald-200"
            : accent === "amber"
            ? "bg-amber-100 ring-amber-200"
            : "bg-neutral-100 ring-neutral-200";

        return (
          <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className={`absolute inset-x-0 top-0 h-1.5 ${accentBar}`} />
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-prim/16 blur-3xl" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                  {label}
                </div>
                <div className="mt-1 text-base font-semibold text-neutral-900 truncate">
                  {value}
                </div>
              </div>

              <div className={`grid h-10 w-10 place-items-center rounded-2xl ring-1 ${badgeRing}`}>
                <Icon className="h-5 w-5 text-neutral-900" />
              </div>
            </div>
          </div>
        );
      },
    []
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="h-1.5 w-full bg-prim" />
        <div className="p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                Stars
              </div>
              <h1 className="mt-1 text-lg md:text-xl font-semibold text-neutral-900">
                My star
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Level, pricing, and your RSP progress.
              </p>
            </div>

            {!loading && !err && (
              <div className="inline-flex items-center gap-2 rounded-full border border-prim/40 bg-prim/15 px-3 py-1.5 text-sm font-semibold text-neutral-900">
                <FiStar className="h-4 w-4" />
                Lvl {starLvl}
                <span className="text-neutral-400 font-normal">•</span>
                <span className="font-semibold text-neutral-800">{starName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-neutral-200 border-t-prim" />
            Loading…
          </div>
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 h-4 w-4" />
            <span>{err}</span>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Star level" value={`Lvl ${starLvl}`} Icon={FiStar} accent="prim" />
            <StatCard label="Name" value={starName} Icon={FiTrendingUp} accent="amber" />
            <StatCard
              label="Check price"
              value={checkPrice}
              Icon={FiDollarSign}
              accent="prim"
            />
            <StatCard label="RSP" value={rsp} Icon={FiActivity} accent="emerald" />
            <StatCard label="Total RSP" value={totalRsp} Icon={FiActivity} accent="prim" />
          </div>

          {/* Yearly checks */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <div className="h-1.5 w-full bg-prim" />
            <div className="p-4 md:p-5">
              <YearlyChecksCompact />
            </div>
          </div>

        </>
      )}
    </div>
  );
};

export default StarsSection;
