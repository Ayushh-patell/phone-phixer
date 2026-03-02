import axios from "axios";
import React, { useEffect, useState } from "react";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiZap,
  FiClock,
  FiSmartphone,
  FiHash,
  FiRotateCcw,
  FiFilter,
  FiLayers,
} from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const PurchaseView = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const authConfig = () => {
    const token = sessionStorage.getItem("token");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : { headers: {} };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await axios.get(
        `${API_BASE_URL}/purchases/admin?${params.toString()}`, 
        authConfig()
      );
      setPurchases(res.data?.purchases || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load admin purchases.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const getStatusBadge = (purchase) => {
    const isRefunded = purchase?.refunded || purchase?.status === "refunded";
    const validity = purchase.validity || {};
    if (isRefunded) return <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-800"><FiRotateCcw className="h-3.5 w-3.5" /> Refunded</span>;
    if (validity.expired) return <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"><FiAlertTriangle className="h-3.5 w-3.5" /> Expired</span>;
    return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><FiCheckCircle className="h-3.5 w-3.5" /> Active</span>;
  };

  /**
   * Helper to render device info
   * Logic: Check devices array first, fallback to single fields if empty.
   */
  const renderDeviceSection = (purchase) => {
    const hasMultipleDevices = Array.isArray(purchase.devices) && purchase.devices.length > 0;
    
    // If array exists and isn't empty, map them
    if (hasMultipleDevices) {
      return (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-900">
            <FiLayers className="h-3.5 w-3.5 text-blue-500" />
            Registered Devices ({purchase.devices.length})
          </div>
          {purchase.devices.map((dev, idx) => (
            <div key={idx} className="rounded-xl bg-neutral-50 p-3 text-[11px] border border-neutral-100">
              <div className="font-semibold text-neutral-800">
                {dev.deviceBrand} {dev.deviceModel}
              </div>
              {dev.deviceImei && (
                <div className="mt-1 flex items-center gap-1 font-mono text-neutral-500">
                  <FiHash className="h-3 w-3" /> {dev.deviceImei}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Fallback logic for single device fields
    if (purchase.deviceBrand || purchase.deviceImei) {
      return (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-[11px] border border-neutral-100">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 mb-1">
            <FiSmartphone className="h-3.5 w-3.5 text-neutral-400" />
            Device Details
          </div>
          <div className="text-neutral-600">
            {purchase.deviceBrand} {purchase.deviceModel}
            {purchase.deviceImei && <span className="block font-mono mt-0.5 text-neutral-500">IMEI: {purchase.deviceImei}</span>}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className=" mx-auto p-4 md:p-6">
      {/* Filters Card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="h-1.5 w-full bg-prim" />
        <div className="p-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Admin Purchase View</h1>
              <p className="text-sm text-neutral-500">Monitoring all active and expired service subscriptions.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
              <button onClick={fetchPurchases} className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition">
                <FiFilter /> Filter
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {purchases.map((purchase) => (
            <div key={purchase._id} className="relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0">
                  <h2 className="font-bold text-neutral-900 truncate">{purchase.serviceId?.name || "Service"}</h2>
                  <div className="text-sm text-neutral-600 uppercase mt-1">User: {purchase.userId?.email || "Unknown"}</div>
                </div>
                {getStatusBadge(purchase)}
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-neutral-700 bg-neutral-50 rounded-lg p-2">
                <div className="flex items-center gap-1"><FiZap className="text-amber-500" /> ₹{purchase.amountPaid}</div>
                <div className="flex items-center gap-1"><FiClock className="text-blue-500" /> {formatDate(purchase.createdAt)}</div>
              </div>

              {/* Dynamic Device Section */}
              {renderDeviceSection(purchase)}

              <div className="mt-auto pt-4 text-xs text-neutral-600 border-t border-neutral-50 flex justify-between">
                <span>ID: ...{purchase._id.slice(-6)}</span>
                {purchase.validity?.expiresAt && <span>Expires: {formatDate(purchase.validity.expiresAt)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PurchaseView;