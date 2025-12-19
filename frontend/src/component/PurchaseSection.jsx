import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
  FiCreditCard,
  FiCheckCircle,
  FiAlertTriangle,
  FiZap,
  FiClock,
  FiShield,
  FiSmartphone,
  FiHash,
  FiRefreshCw,
} from "react-icons/fi";

// TEMP: hardcoded JWT for testing (fallback)
const TEST_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjVhYWFjMjY4N2UwY2I3N2E0ZjdkZCIsImVtYWlsIjoiYXl1c2gucGF0ZWwuY29kZUBnbWFpbC5jb20iLCJhZG1pbiI6ZmFsc2UsImlhdCI6MTc2NDMyNjQ3OCwiZXhwIjoxNzY0OTMxMjc4fQ.AaRuR27ugUpD3DOhRM54-OtEaSONxUWzezrsCWOYW9A";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

// Razorpay minimum chargeable amount (in INR, not paise)
const RAZORPAY_MIN_AMOUNT = 1;

const PurchasesSection = () => {
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [error, setError] = useState("");

  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [useWallet, setUseWallet] = useState(true);
  const [paymentLoadingId, setPaymentLoadingId] = useState(null);

  const authConfig = () => {
    const token = localStorage.getItem("token") || TEST_JWT;
    return token ? { headers: { Authorization: `Bearer ${token}` } } : { headers: {} };
  };

  const pill = useMemo(
    () =>
      "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 shadow-sm",
    []
  );

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

  const fetchPurchases = async () => {
    try {
      setLoadingPurchases(true);
      setError("");
      const res = await axios.get(`${API_BASE_URL}/purchases/me`, authConfig());
      setPurchases(res.data?.purchases || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load purchases.");
    } finally {
      setLoadingPurchases(false);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      setWalletLoading(true);
      const res = await axios.get(`${API_BASE_URL}/users/me`, authConfig());
      const user = res.data || {};
      setWalletBalance(Number(user.walletBalance || 0));
    } catch (err) {
      console.error("Failed to fetch wallet balance:", err);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
    fetchWalletBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRazorpayLoaded = () => typeof window !== "undefined" && window.Razorpay;

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (isRazorpayLoaded()) return resolve(true);

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const startRazorpayPayment = async ({
    service,
    payAmountInRupees,
    extraOrderPayload = {},
    extraVerifyPayload = {},
  }) => {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError("Razorpay SDK failed to load. Check your connection.");
      return;
    }

    const orderRes = await axios.post(
      `${API_BASE_URL}/payments/create-order`,
      {
        amount: payAmountInRupees,
        serviceId: service._id,
        ...extraOrderPayload,
      },
      authConfig()
    );

    const { orderId, amount, currency, user } = orderRes.data;

    const options = {
      key: RAZORPAY_KEY_ID,
      amount,
      currency: currency || "INR",
      name: "phone-phixer",
      description: service.name || "Service renewal",
      order_id: orderId,
      prefill: {
        name: user?.name || "User",
        email: user?.email || "test@example.com",
        contact: user?.phone || "9999999999",
      },
      theme: { color: "#A5F3FC" },
      handler: async function (response) {
        try {
          await axios.post(
            `${API_BASE_URL}/payments/verify`,
            {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              serviceId: service._id,
              ...extraVerifyPayload,
            },
            authConfig()
          );

          alert("Payment successful.");
          fetchWalletBalance();
          fetchPurchases();
        } catch (err) {
          console.error(err);
          alert(
            err.response?.data?.message ||
              "Payment captured but verification failed on server."
          );
        }
      },
      modal: {
        ondismiss: function () {
          console.log("Razorpay popup closed.");
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const getValidityBadge = (purchase) => {
    const validity = purchase.validity || {};
    const expired = !!validity.expired;
    const daysLeft = Number(validity.daysLeft ?? 0);

    if (expired || daysLeft <= 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
          <FiAlertTriangle className="h-3.5 w-3.5" />
          Expired
        </span>
      );
    }

    if (daysLeft <= 5) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          <FiClock className="h-3.5 w-3.5" />
          {daysLeft} day{daysLeft === 1 ? "" : "s"} left
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <FiCheckCircle className="h-3.5 w-3.5" />
        {daysLeft} days left
      </span>
    );
  };

  const handleRenew = async (purchase) => {
    try {
      setPaymentLoadingId(purchase._id);
      setError("");

      const service = purchase.serviceId || {};
      const price = Number(service.price || purchase.amountPaid || 0);

      if (!service._id) {
        setError("Service info missing for this purchase.");
        return;
      }

      if (price <= 0) {
        setError("Invalid service price for renewal.");
        return;
      }

      const renewExtraBase = {
        isRenew: true,
        previousPurchaseId: purchase._id,
      };

      const devicePayload = {
        deviceBrand: purchase.deviceBrand,
        deviceModel: purchase.deviceModel,
        deviceImei: purchase.deviceImei,
      };

      if (!useWallet) {
        await startRazorpayPayment({
          service,
          payAmountInRupees: price,
          extraOrderPayload: { ...renewExtraBase },
          extraVerifyPayload: { ...renewExtraBase, ...devicePayload },
        });
        return;
      }

      const currentWallet = Number(walletBalance || 0);

      if (currentWallet >= price) {
        try {
          const res = await axios.post(
            `${API_BASE_URL}/payments/pay-with-wallet`,
            {
              serviceId: service._id,
              amount: price,
              ...devicePayload,
              ...renewExtraBase,
            },
            authConfig()
          );

          alert(res.data?.message || "Renewed using wallet.");
          fetchWalletBalance();
          fetchPurchases();
        } catch (err) {
          console.error(err);
          setError(err.response?.data?.message || "Wallet renewal failed.");
        }
        return;
      }

      const maxWalletUsableForPartial = Math.max(0, price - RAZORPAY_MIN_AMOUNT);
      const walletToUse = Math.min(currentWallet, maxWalletUsableForPartial);
      const remainingPrice = price - walletToUse;

      if (remainingPrice < RAZORPAY_MIN_AMOUNT) {
        setError("Remaining amount is below Razorpay minimum.");
        return;
      }

      await startRazorpayPayment({
        service,
        payAmountInRupees: remainingPrice,
        extraOrderPayload: {
          ...renewExtraBase,
          useWallet: true,
          walletToUse,
          originalPrice: price,
        },
        extraVerifyPayload: {
          ...renewExtraBase,
          ...devicePayload,
          useWallet: true,
          walletUsed: walletToUse,
          originalPrice: price,
        },
      });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to start renewal payment.");
    } finally {
      setPaymentLoadingId(null);
    }
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
                Purchases
              </div>
              <h1 className="mt-1 text-lg md:text-xl font-semibold text-neutral-900">
                My purchases
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Renew expired services anytime.
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-prim/40 bg-prim/15 px-3 py-1.5 text-xs font-semibold text-neutral-900">
                <FiCreditCard className="h-4 w-4" />
                {walletLoading ? (
                  <span className="text-neutral-700">Loading…</span>
                ) : (
                  <span>Wallet ₹ {walletBalance.toFixed(2)}</span>
                )}
              </div>

              <label className={pill + " cursor-pointer"}>
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => setUseWallet(e.target.checked)}
                  className="h-4 w-4 accent-prim"
                />
                Use wallet for renewals
              </label>
            </div>
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
      {loadingPurchases ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-prim" />
        </div>
      ) : purchases.length === 0 ? (
        <div className="py-16 text-center text-neutral-600">
          You don&apos;t have any purchases yet.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {purchases.map((purchase) => {
            const service = purchase.serviceId || {};
            const validity = purchase.validity || {};
            const expired = !!validity.expired;
            const daysLeft = Number(validity.daysLeft ?? 0);
            const isPaying = paymentLoadingId === purchase._id;

            return (
              <div
                key={purchase._id}
                className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-prim" />
                <div className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-prim/18 blur-3xl" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-neutral-900 truncate">
                      {service.name || "Service"}
                    </h2>

                    <div className="mt-1 text-xs text-neutral-500">
                      Purchased{purchase.renewedAt ? " / renewed" : ""}{" "}
                      <span className="text-neutral-800 font-medium">
                        {formatDate(purchase.renewedAt || purchase.createdAt)}
                      </span>
                    </div>

                    {validity.expiresAt && (
                      <div className="mt-0.5 text-xs text-neutral-500">
                        Expires{" "}
                        <span className="text-neutral-800 font-medium">
                          {formatDate(validity.expiresAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">{getValidityBadge(purchase)}</div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-900">
                    ₹ {purchase.amountPaid ?? service.price ?? "-"}
                  </span>

                  {typeof service.uv !== "undefined" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-prim/40 bg-prim/15 px-3 py-1 font-semibold text-neutral-900">
                      <FiZap className="h-3.5 w-3.5" />
                      UV {service.uv}
                    </span>
                  )}

                  {typeof validity.validityDays !== "undefined" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-700">
                      <FiShield className="h-3.5 w-3.5" />
                      {validity.validityDays} days
                    </span>
                  )}
                </div>

                {(purchase.deviceBrand || purchase.deviceModel || purchase.deviceImei) && (
                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] text-neutral-700">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 mb-2">
                      <FiSmartphone className="h-4 w-4" />
                      Device used
                    </div>
                    {(purchase.deviceBrand || purchase.deviceModel) && (
                      <div>
                        <span className="text-neutral-500">Device:</span>{" "}
                        <span className="font-semibold text-neutral-900">
                          {purchase.deviceBrand} {purchase.deviceModel}
                        </span>
                      </div>
                    )}
                    {purchase.deviceImei && (
                      <div className="mt-0.5 flex items-center gap-2">
                        <FiHash className="h-4 w-4 text-neutral-500" />
                        <span className="text-neutral-500">IMEI:</span>{" "}
                        <span className="font-mono font-semibold text-neutral-900">
                          {purchase.deviceImei}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-neutral-600">
                    Status:{" "}
                    {expired || daysLeft <= 0 ? (
                      <span className="font-semibold text-red-700">Expired</span>
                    ) : (
                      <span className="font-semibold text-emerald-700">Active</span>
                    )}
                  </div>

                  {expired && (
                    <button
                      onClick={() => handleRenew(purchase)}
                      disabled={isPaying}
                      className={[
                        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition",
                        "focus:outline-none focus:ring-2 focus:ring-prim/40",
                        isPaying
                          ? "bg-neutral-200 text-neutral-600 cursor-not-allowed"
                          : "bg-prim text-neutral-900 hover:opacity-95",
                      ].join(" ")}
                    >
                      <FiRefreshCw className="h-4 w-4" />
                      {isPaying ? "Processing…" : "Renew"}
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
