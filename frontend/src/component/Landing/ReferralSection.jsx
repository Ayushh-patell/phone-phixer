import React from "react";
import { Link } from "react-router";

const PricingPlansGrid = () => {
  const plans = [
    { tier: 1, range: "₹6,000 – ₹10,000", fee: "₹1,199 / year", ideal: "Budget smartphones" },
    { tier: 2, range: "₹10,000 – ₹12,000", fee: "₹1,299 / year", ideal: "Entry mid-range" },
    { tier: 3, range: "₹12,000 – ₹15,000", fee: "₹1,399 / year", ideal: "Popular mid-range" },
    { tier: 4, range: "₹20,000 – ₹30,000", fee: "₹1,999 / year", ideal: "Upper mid-range" },
    { tier: 5, range: "₹30,000 – ₹40,000", fee: "₹1,999 / year", ideal: "High-end flagships" },
    { tier: 7, range: "₹40,000 – ₹50,000", fee: "₹2,299 / year", ideal: "Top-tier flagships" },
    { tier: 9, range: "₹60,000 – ₹1,00,000", fee: "₹2,799 / year", ideal: "Pro-level devices" },
  ];

  return (
    <section className="w-full bg-white py-16 md:py-20">
      <div className="w-full px-6 md:px-10 2xl:px-24">
        {/* Header */}
        <div className="flex w-full flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
              Plans &amp; pricing
            </h2>
            <p className="mt-3 text-base text-slate-600 md:text-lg">
              Pick your tier based on your phone’s price range. Simple pricing, clear coverage.
            </p>
          </div>

          <Link to="/dashboard" className="w-full md:w-auto">
            <button
              type="button"
              className="w-full md:w-auto rounded-xl bg-slate-900 px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800"
            >
              Get Started
              <span className="ml-2">→</span>
            </button>
          </Link>
        </div>

        {/* Cards */}
        <div className="mt-10 flex justify-center items-center flex-wrap w-full">
          {plans.map((p) => (
            <div key={p.tier} className="p-4 w-1/4">
                <div
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                {/* subtle header tint */}
                <div className="absolute inset-x-0 top-0 h-24 bg-primDark/10" />

                <div className="relative p-6">
                    <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-sm font-extrabold text-slate-700">Tier {p.tier}</div>
                        <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-800">
                        {p.fee}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">Annual fee</div>
                    </div>

                    {/* badge */}
                    <span className="inline-flex items-center rounded-full bg-primDark px-3 py-1 text-xs font-extrabold text-black">
                        {p.range}
                    </span>
                    </div>

                    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Ideal for
                    </div>
                    <div className="mt-2 text-sm font-semibold text-primDark">{p.ideal}</div>
                    </div>

                    <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-700">
                        Mobile range:
                        <div className="mt-1 text-base font-extrabold text-primDark">{p.range}</div>
                    </div>

                    <Link to="/dashboard">
                        <button
                        type="button"
                        className="rounded-xl bg-primDark px-4 py-2 text-xs font-extrabold text-black transition hover:bg-slate-800"
                        >
                        Choose
                        </button>
                    </Link>
                    </div>
                </div>

                <div className="h-px w-full bg-slate-200" />

                {/* bottom micro perks (keeps the “comparison design” vibe but per-card) */}
                <div className="p-5">
                    <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-primDark/10 px-3 py-1 text-xs font-bold text-slate-800">
                        No labour*
                    </span>
                    <span className="rounded-full bg-primDark/10 px-3 py-1 text-xs font-bold text-slate-800">
                        Priority support
                    </span>
                    <span className="rounded-full bg-primDark/10 px-3 py-1 text-xs font-bold text-slate-800">
                        1-year validity
                    </span>
                    </div>
                </div>
                </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">

        </div>
      </div>
    </section>
  );
};

export default PricingPlansGrid;
