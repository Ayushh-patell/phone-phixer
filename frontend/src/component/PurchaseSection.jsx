import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// TEMP: hardcoded JWT for testing (fallback)
const TEST_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjVhYWFjMjY4N2UwY2I3N2E0ZjdkZCIsImVtYWlsIjoiYXl1c2gucGF0ZWwuY29kZUBnbWFpbC5jb20iLCJhZG1pbiIsZmFsc2UsImlhdCI6MTc2NDMyNjQ3OCwiZXhwIjoxNzY0OTMxMjc4fQ.AaRuR27ugUpD3DOhRM54-OtEaSONxUWzezrsCWOYW9A";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ========== PURCHASES COMPONENT ==========
const PurchasesSection = () => {
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // Auth config: prefer localStorage token, fallback to TEST_JWT
  const authConfig = () => {
    const token = localStorage.getItem("token") || TEST_JWT;
    return token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : { headers: {} };
  };

  const fetchPurchases = async () => {
    try {
      setLoadingPurchases(true);
      setError("");

      const res = await axios.get(
        `${API_BASE_URL}/purchases/me`,
        authConfig()
      );

      // backend returns { count, purchases }
      setPurchases(res.data?.purchases || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Failed to load purchases. Please try again."
      );
    } finally {
      setLoadingPurchases(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getValidityBadge = (purchase) => {
    const validity = purchase.validity || {};
    const expired = !!validity.expired;
    const daysLeft = Number(validity.daysLeft ?? 0);

    if (expired || daysLeft <= 0) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-900/40 px-3 py-1 text-xs font-medium text-red-300 border border-red-700/60">
          Expired
        </span>
      );
    }

    if (daysLeft <= 5) {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-900/40 px-3 py-1 text-xs font-medium text-amber-300 border border-amber-700/60">
          {daysLeft} day{daysLeft === 1 ? "" : "s"} left
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-300 border border-emerald-700/60">
        {daysLeft} days left
      </span>
    );
  };

  const handleRenew = (purchase) => {
    const service = purchase.serviceId;
    // Simple behavior: take user to services page (optionally with query)
    if (service?._id) {
      navigate(`/services?serviceId=${service._id}`);
    } else {
      navigate("/services");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-50 mb-1">
            My Purchases
          </h1>
          <p className="text-sm text-slate-400">
            View your active and expired service purchases.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-700 bg-red-900/40 px-4 py-2 text-sm text-red-100">
          {error}
        </div>
      )}

      {loadingPurchases ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
        </div>
      ) : purchases.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          You don&apos;t have any purchases yet.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {purchases.map((purchase) => {
            const service = purchase.serviceId || {};
            const validity = purchase.validity || {};
            const expired = !!validity.expired;
            const daysLeft = Number(validity.daysLeft ?? 0);

            return (
              <div
                key={purchase._id}
                className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm"
              >
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-50">
                    {service.name || "Service"}
                  </h2>

                  <div className="mt-1 text-xs text-slate-400">
                    Purchased on{" "}
                    <span className="text-slate-200">
                      {formatDate(purchase.createdAt)}
                    </span>
                  </div>

                  {validity.expiresAt && (
                    <div className="mt-0.5 text-xs text-slate-400">
                      Expires on{" "}
                      <span className="text-slate-200">
                        {formatDate(validity.expiresAt)}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 font-medium text-slate-100">
                      ₹ {purchase.amountPaid ?? service.price ?? "-"}
                    </span>

                    {typeof service.uv !== "undefined" && (
                      <span className="inline-flex items-center rounded-full bg-sky-900/40 px-3 py-1 font-medium text-sky-300 border border-sky-700/60">
                        UV: {service.uv}
                      </span>
                    )}

                    {typeof validity.validityDays !== "undefined" && (
                      <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 font-medium text-slate-100">
                        Valid for {validity.validityDays} days
                      </span>
                    )}

                    {getValidityBadge(purchase)}
                  </div>

                  {/* Optional: show device info if present */}
                  {(purchase.deviceBrand ||
                    purchase.deviceModel ||
                    purchase.deviceImei) && (
                    <div className="mt-3 text-[11px] text-slate-400 space-y-0.5">
                      {purchase.deviceBrand && (
                        <div>
                          <span className="font-medium text-slate-300">
                            Device:
                          </span>{" "}
                          {purchase.deviceBrand} {purchase.deviceModel}
                        </div>
                      )}
                      {purchase.deviceImei && (
                        <div>
                          <span className="font-medium text-slate-300">
                            IMEI:
                          </span>{" "}
                          {purchase.deviceImei}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">
                    Status:{" "}
                    {expired || daysLeft <= 0 ? (
                      <span className="text-red-400 font-medium">
                        Expired
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-medium">
                        Active
                      </span>
                    )}
                  </div>

                  {expired && (
                    <button
                      onClick={() => handleRenew(purchase)}
                      className="inline-flex items-center justify-center rounded-xl bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-sky-300"
                    >
                      Renew
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PurchasesSection;
