import { useEffect, useState } from "react";
import axios from "axios";
import YearlyChecksCompact from "./YearlyChecks";

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

        const token = localStorage.getItem("token");
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

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 leading-tight">
            My Star
          </h1>
          <p className="text-sm text-slate-400">
            Star level + upgrade eligibility.
          </p>
        </div>

        {/* Compact summary pill */}
        {!loading && !err && (
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm">
            <span className="font-semibold text-slate-900">
              Lvl {starLvl}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-700">{starName}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
          Loading...
        </div>
      ) : err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      ) : (
        <>
          {/* Compact grid */}
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-400">Star</p>
              <p className="text-sm font-semibold text-slate-900">
                {starLvl}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-400">Name</p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                {starName}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-400">Check Price</p>
              <p className="text-sm font-semibold text-slate-900">
                {checkPrice}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-400">RSP</p>
              <p className="text-sm font-semibold text-slate-900">
                {rsp}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-400">Total RSP</p>
              <p className="text-sm font-semibold text-slate-900">
                {totalRsp}
              </p>
            </div>
          </div>

          <YearlyChecksCompact />
        </>
      )}
    </div>
  );
};

export default StarsSection;
