// components/RequestSection.jsx
import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
  FiClipboard,
  FiAlertTriangle,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiSearch,
  FiRefreshCw,
  FiShield,
  FiUser,
  FiHash,
  FiDollarSign,
} from "react-icons/fi";

// TEMP: hardcoded JWT for testing (fallback)
const TEST_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjVhYWFjMjY4N2UwY2I3N2E0ZjdkZCIsImVtYWlsIjoiYXl1c2gucGF0ZWwuY29kZUBnbWFpbC5jb20iLCJhZG1pbiI6ZmFsc2UsImlhdCI6MTc2NDMyNjQ3OCwiZXhwIjoxNzY0OTMxMjc4fQ.AaRuR27ugUpD3DOhRM54-OtEaSONxUWzezrsCWOYW9A";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const statusMeta = {
  pending: {
    label: "Pending",
    icon: FiClock,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800",
  },
  processing: {
    label: "Processing",
    icon: FiRefreshCw,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800",
  },
  completed: {
    label: "Completed",
    icon: FiCheckCircle,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700",
  },
  approved: {
    label: "Approved",
    icon: FiCheckCircle,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    icon: FiXCircle,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700",
  },
  failed: {
    label: "Failed",
    icon: FiAlertTriangle,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700",
  },
};

const RequestSection = ({ user }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  const isAdmin = !!(user?.admin || user?.isAdmin || user?.role === "admin");

  const authConfig = () => {
    const token = sessionStorage.getItem("token") || TEST_JWT;
    return token ? { headers: { Authorization: `Bearer ${token}` } } : { headers: {} };
  };

  const pill = useMemo(
    () =>
      "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 shadow-sm",
    []
  );

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const normalize = (s) => (s || "").toString().toLowerCase();

  const localFilter = (list) => {
    const qq = normalize(q).trim();
    if (!qq) return list;
    return list.filter((it) => {
      const purchase = it.purchaseId || {};
      const hay = [
        it._id,
        it.status,
        it.reason,
        it.adminComment,
        it.razorpayRefundId,
        it.failureReason,
        purchase._id,
        purchase.razorpayPaymentId,
        purchase.razorpayOrderId,
        purchase.deviceBrand,
        purchase.deviceModel,
        purchase.deviceImei,
      ]
        .filter(Boolean)
        .map((x) => x.toString())
        .join(" ");
      return normalize(hay).includes(qq);
    });
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError("");

      // Backend routes assumed from earlier:
      // user:  GET /api/refunds/my?status=&page=&limit=
      // admin: GET /api/refunds/admin/pending  (we'll use this + optional status filter client side)
      //
      // NOTE: if you later add GET /api/refunds/admin/all, replace logic to use it.

      if (isAdmin) {
        // admin route returns { items }
        const res = await axios.get(`${API_BASE_URL}/refunds/admin/pending`, authConfig());
        let list = res.data?.items || [];

        // If admin wants non-pending, we currently don't have an API.
        // We'll still let them search/filter within pending list to avoid breaking UI.
        // Recommended later: create GET /api/refunds/admin/all?status=&page=&limit=
        if (statusFilter !== "all" && statusFilter !== "pending") {
          // can't fetch other statuses without backend endpoint
          list = [];
        }

        const filtered = localFilter(list);
        setItems(filtered);
        setTotalPages(1);
        setPage(1);
        return;
      }

      // User route supports pagination + status
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await axios.get(`${API_BASE_URL}/refunds/my?${params.toString()}`, authConfig());
      const list = res.data?.items || [];
      setItems(localFilter(list));
      setTotalPages(Number(res.data?.totalPages || 1));
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, statusFilter, page]);

  // For admin actions (approve/reject)
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [adminComment, setAdminComment] = useState("");

  const adminApprove = async (id) => {
    try {
      setActionLoadingId(id);
      setError("");
      await axios.post(
        `${API_BASE_URL}/refunds/admin/${id}/approve`,
        { adminComment },
        authConfig()
      );
      await fetchRequests();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Approve failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const adminReject = async (id) => {
    try {
      setActionLoadingId(id);
      setError("");
      await axios.post(
        `${API_BASE_URL}/refunds/admin/${id}/reject`,
        { adminComment },
        authConfig()
      );
      await fetchRequests();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Reject failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const StatusBadge = ({ status }) => {
    const meta = statusMeta[status] || statusMeta.pending;
    const Icon = meta.icon || FiClock;
    return (
      <span className={meta.badge}>
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="h-1.5 w-full bg-prim" />
        <div className="p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                Requests
              </div>
              <h1 className="mt-1 text-lg md:text-xl font-semibold text-neutral-900">
                {isAdmin ? "All refund requests (Pending)" : "My refund requests"}
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Track request status and actions in one place.
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className={pill}>
                <FiShield className="h-4 w-4" />
                <span>{isAdmin ? "Admin view" : "User view"}</span>
              </div>

              <button
                onClick={() => fetchRequests()}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                <FiRefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
              <FiSearch className="h-4 w-4 text-neutral-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchRequests();
                }}
                placeholder="Search by id, reason, payment id, device…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
              />
            </label>

            <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
              <FiClipboard className="h-4 w-4 text-neutral-500" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-sm outline-none"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {isAdmin && (
              <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <FiUser className="h-4 w-4 text-neutral-500" />
                <input
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder="Admin comment (for approve/reject)"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
                />
              </label>
            )}

            <button
              onClick={() => {
                setPage(1);
                fetchRequests();
              }}
              className="md:col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-prim px-4 py-2.5 text-xs font-semibold text-neutral-900 hover:opacity-95"
            >
              <FiSearch className="h-4 w-4" />
              Apply
            </button>

            {isAdmin && statusFilter !== "all" && statusFilter !== "pending" && (
              <div className="md:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <FiAlertTriangle className="mt-0.5 h-4 w-4" />
                  <div>
                    Admin API currently returns <b>pending</b> only. To browse other statuses,
                    create backend endpoint: <b>GET /api/refunds/admin/all</b>.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <FiAlertTriangle className="mt-0.5 h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-prim" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-neutral-600">
          No requests found.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {items.map((reqItem) => {
            const purchase = reqItem.purchaseId || {};
            const isActing = actionLoadingId === reqItem._id;

            return (
              <div
                key={reqItem._id}
                className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-prim" />
                <div className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-prim/18 blur-3xl" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-neutral-500">Refund request</div>
                    <h2 className="mt-1 text-sm font-semibold text-neutral-900 truncate">
                      <FiHash className="inline-block mr-2 h-4 w-4 text-neutral-500" />
                      {reqItem._id}
                    </h2>
                    <div className="mt-1 text-xs text-neutral-600">
                      Created{" "}
                      <span className="font-semibold text-neutral-900">
                        {formatDateTime(reqItem.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StatusBadge status={reqItem.status} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-900">
                    <FiDollarSign className="h-3.5 w-3.5" />
                    ₹ {Number(reqItem.amountInr || 0).toFixed(2)}
                  </span>

                  <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-700">
                    Method:{" "}
                    <span className="ml-1 font-semibold text-neutral-900">
                      {reqItem.paymentMethodSnapshot || purchase.paymentMethod || "-"}
                    </span>
                  </span>

                  {reqItem.razorpayRefundId && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                      RefundId: {reqItem.razorpayRefundId}
                    </span>
                  )}
                </div>

                {(reqItem.reason || reqItem.adminComment || reqItem.failureReason) && (
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-700">
                    {reqItem.reason && (
                      <div>
                        <span className="text-neutral-500">Reason:</span>{" "}
                        <span className="font-semibold text-neutral-900">
                          {reqItem.reason}
                        </span>
                      </div>
                    )}
                    {reqItem.adminComment && (
                      <div className="mt-1">
                        <span className="text-neutral-500">Admin comment:</span>{" "}
                        <span className="font-semibold text-neutral-900">
                          {reqItem.adminComment}
                        </span>
                      </div>
                    )}
                    {reqItem.failureReason && (
                      <div className="mt-1">
                        <span className="text-neutral-500">Failure:</span>{" "}
                        <span className="font-semibold text-red-700">
                          {reqItem.failureReason}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3 text-[11px] text-neutral-700">
                  <div className="text-xs font-semibold text-neutral-900 mb-2">
                    Purchase snapshot
                  </div>

                  <div className="grid gap-1">
                    <div>
                      <span className="text-neutral-500">Purchase:</span>{" "}
                      <span className="font-mono font-semibold text-neutral-900">
                        {purchase._id || reqItem.purchaseId || "-"}
                      </span>
                    </div>

                    {purchase.razorpayPaymentId && (
                      <div>
                        <span className="text-neutral-500">Razorpay Payment:</span>{" "}
                        <span className="font-mono font-semibold text-neutral-900">
                          {purchase.razorpayPaymentId}
                        </span>
                      </div>
                    )}

                    {(purchase.deviceBrand || purchase.deviceModel) && (
                      <div>
                        <span className="text-neutral-500">Device:</span>{" "}
                        <span className="font-semibold text-neutral-900">
                          {purchase.deviceBrand} {purchase.deviceModel}
                        </span>
                      </div>
                    )}

                    {purchase.deviceImei && (
                      <div>
                        <span className="text-neutral-500">IMEI:</span>{" "}
                        <span className="font-mono font-semibold text-neutral-900">
                          {purchase.deviceImei}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-neutral-500">Purchased:</span>{" "}
                      <span className="font-semibold text-neutral-900">
                        {formatDateTime(purchase.renewedAt || purchase.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {isAdmin && reqItem.status === "pending" && (
                  <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                      onClick={() => adminReject(reqItem._id)}
                      disabled={isActing}
                      className={[
                        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition",
                        "focus:outline-none focus:ring-2 focus:ring-red-400/30",
                        isActing
                          ? "bg-neutral-200 text-neutral-600 cursor-not-allowed"
                          : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                      ].join(" ")}
                    >
                      <FiXCircle className="h-4 w-4" />
                      Reject
                    </button>

                    <button
                      onClick={() => adminApprove(reqItem._id)}
                      disabled={isActing}
                      className={[
                        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition",
                        "focus:outline-none focus:ring-2 focus:ring-prim/40",
                        isActing
                          ? "bg-neutral-200 text-neutral-600 cursor-not-allowed"
                          : "bg-prim text-neutral-900 hover:opacity-95",
                      ].join(" ")}
                    >
                      <FiCheckCircle className="h-4 w-4" />
                      {isActing ? "Processing…" : "Approve & Refund"}
                    </button>
                  </div>
                )}

                {!isAdmin && (
                  <div className="mt-4 text-[11px] text-neutral-600">
                    <FiClock className="inline-block mr-2 h-3.5 w-3.5 text-neutral-500" />
                    Updates will appear here once reviewed.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination (user only) */}
      {!isAdmin && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={[
              "rounded-xl px-4 py-2 text-xs font-semibold",
              page <= 1
                ? "cursor-not-allowed bg-neutral-200 text-neutral-600"
                : "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
            ].join(" ")}
          >
            Prev
          </button>

          <span className="text-xs text-neutral-700">
            Page <span className="font-semibold">{page}</span> of{" "}
            <span className="font-semibold">{totalPages}</span>
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={[
              "rounded-xl px-4 py-2 text-xs font-semibold",
              page >= totalPages
                ? "cursor-not-allowed bg-neutral-200 text-neutral-600"
                : "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
            ].join(" ")}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default RequestSection;
