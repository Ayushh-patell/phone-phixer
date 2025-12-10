import axios from "axios";
import React, { useEffect, useState } from "react";

// TEMP: hardcoded JWT for testing (fallback)
const TEST_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjVhYWFjMjY4N2UwY2I3N2E0ZjdkZCIsImVtYWlsIjoiYXl1c2gucGF0ZWwuY29kZUBnbWFpbC5jb20iLCJhZG1pbiI6ZmFsc2UsImlhdCI6MTc2NDMyNjQ3OCwiZXhwIjoxNzY0OTMxMjc4fQ.AaRuR27ugUpD3DOhRM54-OtEaSONxUWzezrsCWOYW9A";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

// Razorpay minimum chargeable amount (in INR, not paise)
const RAZORPAY_MIN_AMOUNT = 1;

// ========== SERVICES COMPONENT ==========
const ServicesSection = () => {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);

  const [useWallet, setUseWallet] = useState(true);

  const [error, setError] = useState("");
  const [paymentLoadingId, setPaymentLoadingId] = useState(null);

  // Device info (from /users/me, but editable by user)
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceImei, setDeviceImei] = useState("");

  // Auth config: prefer localStorage token, fallback to TEST_JWT
  const authConfig = () => {
    const token = localStorage.getItem("token") || TEST_JWT;
    return token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : { headers: {} };
  };

  // Fetch services from backend
  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      setError("");

      const res = await axios.get(`${API_BASE_URL}/service`, authConfig());
      setServices(res.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Failed to load services. Please try again."
      );
    } finally {
      setLoadingServices(false);
    }
  };

  // Fetch wallet balance and device info from /users/me
  const fetchWalletBalance = async () => {
    try {
      setWalletLoading(true);
      const res = await axios.get(`${API_BASE_URL}/users/me`, authConfig());
      const user = res.data || {};
      setWalletBalance(Number(user.walletBalance || 0));

      // pull device info and set as defaults
      setDeviceBrand(user.deviceBrand || "");
      setDeviceModel(user.deviceModel || "");
      setDeviceImei(user.deviceImei || "");
    } catch (err) {
      console.error("Failed to fetch wallet balance:", err);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchWalletBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      description: service.name,
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
          // 2. Tell backend to verify payment + create Purchase record
          await axios.post(
            `${API_BASE_URL}/payments/verify`,
            {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              serviceId: service._id,
              // device data always sent to verify
              deviceBrand,
              deviceModel,
              deviceImei,
              ...extraVerifyPayload,
            },
            authConfig()
          );

          alert("Payment successful (test mode).");
          // After successful payment, wallet may have changed (partial wallet use)
          fetchWalletBalance();
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

  const handlePurchase = async (service) => {
    try {
      setPaymentLoadingId(service._id);
      setError("");

      const price = Number(service.price || 0); // in INR

      if (price <= 0) {
        setError("Invalid service price.");
        return;
      }

      // basic device info validation (required)
      if (!deviceBrand.trim() || !deviceModel.trim() || !deviceImei.trim()) {
        setError("Please enter device brand, model, and IMEI before purchase.");
        return;
      }

      if (!useWallet) {
        // Full amount via Razorpay
        await startRazorpayPayment({
          service,
          payAmountInRupees: price,
          extraVerifyPayload: {
            deviceBrand,
            deviceModel,
            deviceImei,
          },
        });
        return;
      }

      // Use wallet balance if enabled
      const currentWallet = Number(walletBalance || 0);

      // 1) Wallet can cover full price -> wallet-only payment
      if (currentWallet >= price) {
        try {
          const res = await axios.post(
            `${API_BASE_URL}/payments/pay-with-wallet`,
            {
              serviceId: service._id,
              amount: price,
              // send device info for wallet payments too
              deviceBrand,
              deviceModel,
              deviceImei,
            },
            authConfig()
          );

          alert(
            res.data?.message ||
              "Service purchased using wallet balance successfully."
          );

          // Refresh wallet balance after wallet-only payment
          fetchWalletBalance();
        } catch (err) {
          console.error(err);
          setError(
            err.response?.data?.message ||
              "Failed to complete wallet payment. Please try again."
          );
        }
        return;
      }

      // 2) Partial wallet + Razorpay
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
          useWallet: true,
          walletToUse, // how much we *intend* to use from wallet
          originalPrice: price,
        },
        extraVerifyPayload: {
          useWallet: true,
          walletUsed: walletToUse, // backend: deduct this after successful Razorpay payment
          originalPrice: price,
          deviceBrand,
          deviceModel,
          deviceImei,
        },
      });
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Unable to start payment. Please try again."
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
            Services
          </h1>
          <p className="text-sm text-slate-400">
            Choose a service and pay using your wallet balance and/or Razorpay.
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
          <label className="flex items-center gap-2 text-xs text-slate-900 cursor-pointer">
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              className="h-3 w-3 rounded border-slate-500 bg-slate-900 text-sky-400"
            />
            <span>Use wallet balance for purchases</span>
          </label>
        </div>
      </div>

      {/* Device details form (required) */}
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-900">
            Device Brand <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={deviceBrand}
            onChange={(e) => setDeviceBrand(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
            placeholder="e.g. Samsung"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-900">
            Device Model <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={deviceModel}
            onChange={(e) => setDeviceModel(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
            placeholder="e.g. Galaxy S24"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-900">
            Device IMEI <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={deviceImei}
            onChange={(e) => setDeviceImei(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500"
            placeholder="IMEI number"
            required
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-700 bg-red-900/40 px-4 py-2 text-sm text-red-100">
          {error}
        </div>
      )}

      {loadingServices ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-sky-400" />
        </div>
      ) : services.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          No services available right now.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {services.map((service) => (
            <div
              key={service._id}
              className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm"
            >
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-50">
                  {service.name}
                </h2>
                {service.description && (
                  <p className="mt-2 text-sm text-slate-300">
                    {service.description}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 font-medium text-slate-100">
                    ₹ {service.price}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-sky-900/40 px-3 py-1 font-medium text-sky-300 border border-sky-700/60">
                    UV: {service.uv}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-900/40 px-3 py-1 font-medium text-emerald-300 border border-emerald-700/60">
                    Valid for {service.validityDays} days
                  </span>
                </div>

                {useWallet && (
                  <p className="mt-2 text-[11px] text-slate-400">
                    Wallet is applied first. For partial payments, wallet is
                    used until at least ₹{RAZORPAY_MIN_AMOUNT.toFixed(2)} is left
                    for Razorpay.
                  </p>
                )}
              </div>

              <button
                onClick={() => handlePurchase(service)}
                disabled={paymentLoadingId === service._id}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-sky-500/70"
              >
                {paymentLoadingId === service._id
                  ? "Processing..."
                  : useWallet
                  ? "Buy "
                  : "Buy"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesSection;
