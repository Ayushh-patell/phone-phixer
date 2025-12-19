import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import {
  FiCreditCard,
  FiSmartphone,
  FiHash,
  FiShield,
  FiCheckCircle,
  FiAlertTriangle,
  FiZap,
} from "react-icons/fi";

// TEMP: hardcoded JWT for testing (fallback)
const TEST_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjVhYWFjMjY4N2UwY2I3N2E0ZjdkZCIsImVtYWlsIjoiYXl1c2gucGF0ZWwuY29kZUBnbWFpbC5jb20iLCJhZG1pbiI6ZmFsc2UsImlhdCI6MTc2NDMyNjQ3OCwiZXhwIjoxNzY0OTMxMjc4fQ.AaRuR27ugUpD3DOhRM54-OtEaSONxUWzezrsCWOYW9A";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

// Razorpay minimum chargeable amount (in INR, not paise)
const RAZORPAY_MIN_AMOUNT = 1;

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

  const inputClass = useMemo(
    () =>
      [
        "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900",
        "placeholder:text-neutral-400 shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-prim/40 focus:border-prim",
      ].join(" "),
    []
  );

  const authConfig = () => {
    const token = localStorage.getItem("token") || TEST_JWT;
    return token ? { headers: { Authorization: `Bearer ${token}` } } : { headers: {} };
  };

  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      setError("");
      const res = await axios.get(`${API_BASE_URL}/service`, authConfig());
      setServices(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load services.");
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      setWalletLoading(true);
      const res = await axios.get(`${API_BASE_URL}/users/me`, authConfig());
      const user = res.data || {};
      setWalletBalance(Number(user.walletBalance || 0));

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
        amount: payAmountInRupees, // backend should multiply by 100
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
      description: service.name,
      order_id: orderId,
      prefill: {
        name: user?.name || "User",
        email: user?.email || "test@example.com",
        contact: user?.phone || "9999999999",
      },
      // If you want exact match, set this to your prim hex value
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
              deviceBrand,
              deviceModel,
              deviceImei,
              ...extraVerifyPayload,
            },
            authConfig()
          );

          alert("Payment successful.");
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

      const price = Number(service.price || 0);

      if (price <= 0) {
        setError("Invalid service price.");
        return;
      }

      if (!deviceBrand.trim() || !deviceModel.trim() || !deviceImei.trim()) {
        setError("Enter device brand, model, and IMEI before purchase.");
        return;
      }

      if (!useWallet) {
        await startRazorpayPayment({
          service,
          payAmountInRupees: price,
          extraVerifyPayload: { deviceBrand, deviceModel, deviceImei },
        });
        return;
      }

      const currentWallet = Number(walletBalance || 0);

      // Wallet-only
      if (currentWallet >= price) {
        try {
          const res = await axios.post(
            `${API_BASE_URL}/payments/pay-with-wallet`,
            {
              serviceId: service._id,
              amount: price,
              deviceBrand,
              deviceModel,
              deviceImei,
            },
            authConfig()
          );

          alert(res.data?.message || "Purchased using wallet.");
          fetchWalletBalance();
        } catch (err) {
          console.error(err);
          setError(err.response?.data?.message || "Wallet payment failed.");
        }
        return;
      }

      // Partial wallet + Razorpay
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
          useWallet: true,
          walletToUse,
          originalPrice: price,
        },
        extraVerifyPayload: {
          useWallet: true,
          walletUsed: walletToUse,
          originalPrice: price,
          deviceBrand,
          deviceModel,
          deviceImei,
        },
      });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Unable to start payment.");
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
                Services
              </div>
              <h1 className="mt-1 text-lg md:text-xl font-semibold text-neutral-900">
                Choose a service and pay
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Wallet first (optional), Razorpay for the rest.
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

              <label className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 shadow-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => setUseWallet(e.target.checked)}
                  className="h-4 w-4 accent-prim"
                />
                Use wallet
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Device details */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-prim/20 ring-1 ring-prim/30">
                <FiSmartphone className="h-5 w-5 text-neutral-900" />
              </div>
              <div>
                <div className="text-sm font-semibold text-neutral-900">
                  Device details
                </div>
                <div className="text-xs text-neutral-500">
                  Required for purchase
                </div>
              </div>
            </div>

            <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700">
              <FiShield className="h-4 w-4" />
              Stored with your order
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-700">
                Brand <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deviceBrand}
                onChange={(e) => setDeviceBrand(e.target.value)}
                className={inputClass}
                placeholder="e.g. Samsung"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-700">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                className={inputClass}
                placeholder="e.g. Galaxy S24"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-700">
                IMEI <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={deviceImei}
                  onChange={(e) => setDeviceImei(e.target.value)}
                  className={`${inputClass} pl-11`}
                  placeholder="IMEI number"
                  required
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <FiHash className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          {useWallet && (
            <div className="mt-3 text-[11px] text-neutral-600">
              Wallet is used first. Razorpay will charge at least ₹{RAZORPAY_MIN_AMOUNT.toFixed(2)}.
            </div>
          )}
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

      {/* Services list */}
      {loadingServices ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-prim" />
        </div>
      ) : services.length === 0 ? (
        <div className="py-16 text-center text-neutral-600">
          No services available right now.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {services.map((service) => {
            const isPaying = paymentLoadingId === service._id;
            return (
              <div
                key={service._id}
                className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-prim" />
                <div className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-prim/18 blur-3xl" />

                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-neutral-900">
                    {service.name}
                  </h2>

                  {service.description && (
                    <p className="mt-2 text-sm text-neutral-600">
                      {service.description}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-semibold text-neutral-900">
                      ₹ {service.price}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-full border border-prim/40 bg-prim/15 px-3 py-1 font-semibold text-neutral-900">
                      <FiZap className="h-3.5 w-3.5" />
                      UV {service.uv}
                    </span>

                    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-700">
                      Valid {service.validityDays} days
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handlePurchase(service)}
                  disabled={isPaying}
                  className={[
                    "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                    "focus:outline-none focus:ring-2 focus:ring-prim/40",
                    isPaying
                      ? "bg-neutral-200 text-neutral-600 cursor-not-allowed"
                      : "bg-prim text-neutral-900 hover:opacity-95",
                  ].join(" ")}
                >
                  {isPaying ? (
                    "Processing…"
                  ) : (
                    <>
                      <FiCheckCircle className="h-4.5 w-4.5" />
                      Buy for ₹{Number(service.price || 0).toFixed(0)}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ServicesSection;
