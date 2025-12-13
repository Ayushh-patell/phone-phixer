import axios from "axios";
import React, { useEffect, useState } from "react";

// TEMP: hardcoded JWT for testing (fallback)
const TEST_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjVhYWFjMjY4N2UwY2I3N2E0ZjdkZCIsImVtYWlsIjoiYXl1c2gucGF0ZWwuY29kZUBnbWFpbC5jb20iLCJhZG1pbiIsZmFsc2UsImlhdCI6MTc2NDMyNjQ3OCwiZXhwIjoxNzY0OTMxMjc4fQ.AaRuR27ugUpD3DOhRM54-OtEaSONxUWzezrsCWOYW9A";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

// Razorpay minimum chargeable amount (in INR, not paise)
const RAZORPAY_MIN_AMOUNT = 1;

// ========== PURCHASES COMPONENT ==========
const PurchasesSection = () => {
  const [purchases, setPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [error, setError] = useState("");

  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [useWallet, setUseWallet] = useState(true);
  const [paymentLoadingId, setPaymentLoadingId] = useState(null);

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

  // Fetch wallet balance from /users/me
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

  // Razorpay helpers
  const isRazorpayLoaded = () =>
    typeof window !== "undefined" && window.Razorpay;

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (isRazorpayLoaded()) return resolve(true);

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  /**
   * Wrapper to start Razorpay payment.
   * - extraOrderPayload is sent to /payments/create-order
   * - extraVerifyPayload is sent to /payments/verify
   */
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

    // 1. Ask backend to create Razorpay order for the given amount
    const orderRes = await axios.post(
      `${API_BASE_URL}/payments/create-order`,
      {
        amount: payAmountInRupees, // backend should multiply by 100
        serviceId: service._id,
        ...extraOrderPayload,
      },
      authConfig()
    );

    const { orderId, amount, currency, user } = orderRes.data;

    const options = {
      key: RAZORPAY_KEY_ID,
      amount, // already in paise (from backend)
      currency: currency || "INR",
      name: "phone-phixer",
      description: service.name || "Service renewal",
      order_id: orderId,
      prefill: {
        name: user?.name || "Test User",
        email: user?.email || "test@example.com",
        contact: user?.phone || "9999999999",
      },
      theme: {
        color: "#38bdf8",
      },
      handler: async function (response) {
        try {
          // 2. Tell backend to verify payment + create/renew Purchase record
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
          // After successful payment, wallet + purchases may have changed
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

  const handleRenew = async (purchase) => {
    try {
      setPaymentLoadingId(purchase._id);
      setError("");

      const service = purchase.serviceId || {};
      const price = Number(service.price || purchase.amountPaid || 0); // in INR

      if (!service._id) {
        setError("Service information missing for this purchase. Cannot renew.");
        return;
      }

      if (price <= 0) {
        setError("Invalid service price for renewal.");
        return;
      }

      // mark this flow as renew for backend
      const renewExtraBase = {
        isRenew: true,
        previousPurchaseId: purchase._id,
      };

      // device info comes from purchase
      const devicePayload = {
        deviceBrand: purchase.deviceBrand,
        deviceModel: purchase.deviceModel,
        deviceImei: purchase.deviceImei,
      };

      if (!useWallet) {
        // Full amount via Razorpay for renewal
        await startRazorpayPayment({
          service,
          payAmountInRupees: price,
          extraOrderPayload: {
            ...renewExtraBase,
          },
          extraVerifyPayload: {
            ...renewExtraBase,
            ...devicePayload,
          },
        });
        return;
      }

      // Use wallet balance if enabled
      const currentWallet = Number(walletBalance || 0);

      // 1) Wallet can cover full price -> wallet-only renewal
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

          alert(
            res.data?.message ||
              "Service renewed using wallet balance successfully."
          );

          // Refresh wallet + purchases after wallet-only renewal
          fetchWalletBalance();
          fetchPurchases();
        } catch (err) {
          console.error(err);
          setError(
            err.response?.data?.message ||
              "Failed to complete wallet payment. Please try again."
          );
        }
        return;
      }

      // 2) Partial wallet + Razorpay for renewal
      const maxWalletUsableForPartial = Math.max(
        0,
        price - RAZORPAY_MIN_AMOUNT
      );
      const walletToUse = Math.min(currentWallet, maxWalletUsableForPartial);
      const remainingPrice = price - walletToUse; // guaranteed >= min

      if (remainingPrice < RAZORPAY_MIN_AMOUNT) {
        setError(
          "Remaining amount is below Razorpay's minimum. Please adjust the payment."
        );
        return;
      }

      await startRazorpayPayment({
        service,
        payAmountInRupees: remainingPrice,
        extraOrderPayload: {
          ...renewExtraBase,
          useWallet: true,
          walletToUse, // how much we *intend* to use from wallet
          originalPrice: price,
        },
        extraVerifyPayload: {
          ...renewExtraBase,
          ...devicePayload,
          useWallet: true,
          walletUsed: walletToUse, // backend: deduct this after successful Razorpay payment
          originalPrice: price,
        },
      });
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Unable to start renewal payment. Please try again."
      );
    } finally {
      setPaymentLoadingId(null);
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

        <div className="flex flex-col items-start sm:items-end gap-1">
          <div className="inline-flex items-center rounded-full bg-slate-900/60 border border-slate-700 px-3 py-1 text-xs text-slate-100">
            <span className="mr-1 text-slate-50">Wallet balance:</span>
            {walletLoading ? (
              <span className="italic text-slate-300">Loading…</span>
            ) : (
              <span className="font-semibold">
                ₹ {walletBalance.toFixed(2)}
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              className="h-3 w-3 rounded border-slate-500 bg-slate-900 text-sky-400"
            />
            <span>Use wallet balance for renewals</span>
          </label>
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
                    Purchased{purchase.renewedAt ? " / renewed" : ""} on{" "}
                    <span className="text-slate-200">
                      {formatDate(purchase.renewedAt || purchase.createdAt)}
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

                  {/* Show stored device info from purchase, if present */}
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
                      disabled={paymentLoadingId === purchase._id}
                      className="inline-flex items-center justify-center rounded-xl bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-sky-500/70"
                    >
                      {paymentLoadingId === purchase._id
                        ? "Processing..."
                        : "Renew"}
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
