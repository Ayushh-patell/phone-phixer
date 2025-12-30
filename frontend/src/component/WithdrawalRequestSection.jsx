// components/WithdrawalRequestSection.jsx
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
  FiCreditCard,
} from "react-icons/fi";

// TEMP: hardcoded JWT for testing (fallback)
const TEST_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjVhYWFjMjY4N2UwY2I3N2E0ZjdkZCIsImVtYWlsIjoiYXl1c2gucGF0ZWwuY29kZUBnbWFpbC5jb20iLCJhZG1pbiI6ZmFsc2UsImlhdCI6MTc2NDMyNjQ3OCwiZXhwIjoxNzY0OTMxMjc4fQ.AaRuR27ugUpD3DOhRM54-OtEaSONxUWzezrsCWOYW9A";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const statusMeta = {
  pending_approval: {
    label: "Pending approval",
    icon: FiClock,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800",
  },
  approved: {
    label: "Approved",
    icon: FiCheckCircle,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700",
  },
  processing: {
    label: "Processing",
    icon: FiRefreshCw,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800",
  },
  processed: {
    label: "Processed",
    icon: FiCheckCircle,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700",
  },
  cancelled: {
    label: "Cancelled",
    icon: FiXCircle,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700",
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
  reversed: {
    label: "Reversed",
    icon: FiAlertTriangle,
    badge:
      "inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700",
  },
};

const WithdrawalRequestSection = ({ user }) => {
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

  const normalize = (s) => (s || "").toString().toLowerCase();

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

  const localFilter = (list) => {
    const qq = normalize(q).trim();
    if (!qq) return list;

    return list.filter((it) => {
      const dest = it.destination || {};
      const rp = it.razorpay || {};
      const appr = it.approval || {};
      const fail = it.failure || {};

      const hay = [
        it._id,
        it.status,
        it.currency,
        it.amountPaise,
        dest.type,
        dest.name,
        dest.ifsc,
        dest.lastFour,
        dest.vpa,
        rp.contactId,
        rp.fundAccountId,
        rp.payoutId,
        appr.rejectionReason,
        fail.reason,
        fail.description,
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

      if (isAdmin) {
        // Admin endpoint (recommended server behavior):
        // GET /api/withdrawals/admin/list?status=pending_approval
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);

        const res = await axios.get(
          `${API_BASE_URL}/withdrawals/admin/list?${params.toString()}`,
          authConfig()
        );

        const list = res.data?.items || [];
        setItems(localFilter(list));
        setTotalPages(1);
        setPage(1);
        return;
      }

      // User endpoint:
      // GET /api/withdrawals/my
      // (your backend currently returns last 200, no pagination)
      // We'll still keep page UI; if you later add pagination, plug it in here.
      const res = await axios.get(`${API_BASE_URL}/withdrawals/my`, authConfig());
      let list = res.data?.items || [];

      if (statusFilter !== "all") list = list.filter((x) => x.status === statusFilter);

      const filtered = localFilter(list);

      // Fake pagination client-side (optional)
      const start = (page - 1) * limit;
      const paged = filtered.slice(start, start + limit);

      setItems(paged);
      setTotalPages(Math.max(1, Math.ceil(filtered.length / limit)));
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load withdrawal requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, statusFilter, page]);

  // Admin actions + user cancel
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [adminComment, setAdminComment] = useState("");

  const adminApprove = async (id) => {
    try {
      setActionLoadingId(id);
      setError("");
      await axios.post(`${API_BASE_URL}/withdrawals/admin/${id}/approve`, {}, authConfig());
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
        `${API_BASE_URL}/withdrawals/admin/${id}/reject`,
        { reason: adminComment },
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

  const userCancel = async (id) => {
    try {
      setActionLoadingId(id);
      setError("");
      await axios.post(`${API_BASE_URL}/withdrawals/${id}/cancel`, {}, authConfig());
      await fetchRequests();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Cancel failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const StatusBadge = ({ status }) => {
    const meta = statusMeta[status] || statusMeta.pending_approval;
    const Icon = meta.icon || FiClock;
    return (
      <span className={meta.badge}>
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </span>
    );
  };

  const formatInr = (amountPaise) => {
    const n = Number(amountPaise || 0);
    return (n / 100).toFixed(2);
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
                Withdrawals
              </div>
              <h1 className="mt-1 text-lg md:text-xl font-semibold text-neutral-900">
                {isAdmin ? "All withdrawal requests" : "My withdrawal requests"}
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Track withdrawal status and actions in one place.
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
                placeholder="Search by id, payout id, IFSC, last4…"
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
                <option value="pending_approval">Pending approval</option>
                <option value="approved">Approved</option>
                <option value="processing">Processing</option>
                <option value="processed">Processed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="failed">Failed</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>

            {isAdmin && (
              <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                <FiUser className="h-4 w-4 text-neutral-500" />
                <input
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder="Admin comment (for reject)"
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
        <div className="py-16 text-center text-neutral-600">No withdrawal requests found.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {items.map((it) => {
            const dest = it.destination || {};
            const rp = it.razorpay || {};
            const appr = it.approval || {};
            const fail = it.failure || {};
            const isActing = actionLoadingId === it._id;

            return (
              <div
                key={it._id}
                className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-prim" />
                <div className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-prim/18 blur-3xl" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-neutral-500">Withdrawal request</div>
                    <h2 className="mt-1 text-sm font-semibold text-neutral-900 truncate">
                      <FiHash className="inline-block mr-2 h-4 w-4 text-neutral-500" />
                      {it._id}
                    </h2>
                    <div className="mt-1 text-xs text-neutral-600">
                      Created{" "}
                      <span className="font-semibold text-neutral-900">
                        {formatDateTime(it.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <StatusBadge status={it.status} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-900">
                    <FiDollarSign className="h-3.5 w-3.5" />
                    ₹ {formatInr(it.amountPaise)}
                  </span>

                  <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-700">
                    Dest:{" "}
                    <span className="ml-1 font-semibold text-neutral-900">
                      {dest.type === "bank_account"
                        ? `****${dest.lastFour || "----"}`
                        : dest.vpa || "-"}
                    </span>
                  </span>

                  {dest.ifsc && (
                    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-700">
                      IFSC: <span className="ml-1 font-semibold text-neutral-900">{dest.ifsc}</span>
                    </span>
                  )}

                  {rp.payoutId && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                      <FiCreditCard className="mr-1 h-3.5 w-3.5" />
                      Payout: {rp.payoutId}
                    </span>
                  )}
                </div>

                {(appr.rejectionReason || fail.description || fail.reason) && (
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-700">
                    {appr.rejectionReason && (
                      <div>
                        <span className="text-neutral-500">Admin:</span>{" "}
                        <span className="font-semibold text-neutral-900">{appr.rejectionReason}</span>
                      </div>
                    )}
                    {(fail.reason || fail.description) && (
                      <div className="mt-1">
                        <span className="text-neutral-500">Failure:</span>{" "}
                        <span className="font-semibold text-red-700">
                          {[fail.reason, fail.description].filter(Boolean).join(" • ")}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {isAdmin && it.status === "pending_approval" && (
                  <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                      onClick={() => adminReject(it._id)}
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
                      onClick={() => adminApprove(it._id)}
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
                      {isActing ? "Processing…" : "Approve & Pay"}
                    </button>
                  </div>
                )}

                {!isAdmin && it.status === "pending_approval" && (
                  <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                      onClick={() => userCancel(it._id)}
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
                      {isActing ? "Cancelling…" : "Cancel request"}
                    </button>
                  </div>
                )}

                {!isAdmin && it.status !== "pending_approval" && (
                  <div className="mt-4 text-[11px] text-neutral-600">
                    <FiClock className="inline-block mr-2 h-3.5 w-3.5 text-neutral-500" />
                    Updates will appear here once reviewed/processed.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination (client-side for user, admin is typically small queue) */}
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

export default WithdrawalRequestSection;
