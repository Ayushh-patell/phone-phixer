import axios from 'axios';
import React from 'react'
import { useEffect } from 'react';
import { useState } from 'react';

// TEMP: hardcoded JWT for testing (fallback)
const TEST_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MjVhYWFjMjY4N2UwY2I3N2E0ZjdkZCIsImVtYWlsIjoiYXl1c2gucGF0ZWwuY29kZUBnbWFpbC5jb20iLCJhZG1pbiI6ZmFsc2UsImlhdCI6MTc2NDMyNjQ3OCwiZXhwIjoxNzY0OTMxMjc4fQ.AaRuR27ugUpD3DOhRM54-OtEaSONxUWzezrsCWOYW9A";


  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

// ========== SERVICES COMPONENT ==========
const ServicesSection = () => {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [error, setError] = useState("");
  const [paymentLoadingId, setPaymentLoadingId] = useState(null);

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

  useEffect(() => {
    fetchServices();
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

  const handlePurchase = async (service) => {
    try {
      setPaymentLoadingId(service._id);
      setError("");

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Razorpay SDK failed to load. Check your connection.");
        return;
      }

      // 1. Ask backend to create Razorpay order
      const orderRes = await axios.post(
        `${API_BASE_URL}/payments/create-order`,
        {
          amount: service.price, // backend should multiply by 100
          serviceId: service._id,
        },
        authConfig()
      );

      const { orderId, amount, currency, user } = orderRes.data;

      const options = {
        key: RAZORPAY_KEY_ID,
        amount, // already in paise
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
              },
              authConfig()
            );

            alert("Payment successful (test mode).");
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
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-50 mb-1">
          Services
        </h1>
        <p className="text-sm text-slate-400">
          Choose a service and complete the payment with Razorpay (test mode).
        </p>
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
              </div>

              <button
                onClick={() => handlePurchase(service)}
                disabled={paymentLoadingId === service._id}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-sky-500/70"
              >
                {paymentLoadingId === service._id
                  ? "Processing..."
                  : "Buy with Razorpay (Test)"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ServicesSection; 
