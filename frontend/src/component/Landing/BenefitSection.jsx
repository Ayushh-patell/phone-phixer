import React from "react";
import { Link } from "react-router";

const RegistrationBenefits = () => {
  const earlyOffer = [
    {
      title: "Free back cover",
      desc: "(for eligible models).",
      img: "/cover.jpg", // replace
    },
    {
      title: "Free screen guard",
      desc: "(for eligible models).",
      img: "/screen.png", // replace
    },
    {
      title: "Early registration offer",
      desc: "Reserved for the first 1000 registrations. T&C apply.",
      img: "/offer.jpg", // replace
    },
  ];

  const coreBenefits = [
    "No labour charges on all covered repairs for 1 year.",
    "Up to 10% off on mobile accessories for registered customers.",
    "10% discount on parts when any component needs replacement.",
    "Priority service with repairs usually completed within 24 hours (subject to spare availability).",
    "Free handset check-up and basic cleaning during each visit.",
  ];

  return (
    <section className="w-full bg-slate-900 text-white">
      {/* Header */}
      <div className="w-full px-6 py-14 md:px-10 lg:py-20 2xl:px-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Everything you get with PhonePhixer Annual Registration
            </h2>

            {/* accent line */}
            <div className="mt-4 h-[3px] w-40 rounded-full bg-primDark" />

            <p className="mt-4 text-lg text-white/85 md:text-xl">
              First 1000 / Early registration offer:
            </p>
          </div>

          <div className="w-full lg:w-auto">
            <Link to="/dashboard" className="inline-flex w-full lg:w-auto">
              <button
                type="button"
                className="w-full whitespace-nowrap lg:w-auto rounded-xl bg-primDark px-6 py-3 text-sm font-extrabold text-slate-900 shadow-lg shadow-black/25 transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primDark/70 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Register Now
              </button>
            </Link>
          </div>
        </div>

        {/* Early offer cards */}
        <div className="mt-10 grid w-full gap-6 md:grid-cols-3">
          {earlyOffer.map((o) => (
            <div
              key={o.title}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-white/20"
            >
              <div className="relative h-52 w-full md:h-56">
                <img
                  src={o.img}
                  alt={o.title}
                  className="h-full w-full object-cover object-center"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-90" />
              </div>

              <div className="p-6">
                <h3 className="text-xl font-extrabold tracking-tight">{o.title}</h3>
                <p className="mt-2 text-sm text-white/75">{o.desc}</p>

                <div className="mt-5 h-px w-full bg-white/10" />

                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white/80">
                  <span className="h-2 w-2 rounded-full bg-primDark" />
                  Included with annual registration
                </div>
              </div>

              {/* subtle glow */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primDark/20 blur-3xl" />
              </div>
            </div>
          ))}
        </div>

        {/* Core benefits (new design) */}
        <div className="mt-12 grid w-full gap-8 lg:grid-cols-2 lg:items-stretch">
          {/* Benefits panel */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primDark/10 via-transparent to-black/10" />

            <h3 className="relative text-2xl font-extrabold tracking-tight text-white md:text-3xl">
              Core benefits
            </h3>

            <ul className="relative mt-6 space-y-4 text-sm text-white/85 md:text-base">
              {coreBenefits.map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primDark" />
                  <span className="leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>

            <div className="relative mt-8 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10">
                Priority service
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10">
                No labour charges
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10">
                Discounts on parts
              </span>
            </div>
          </div>

          {/* Visual panel */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/30">
            {/* layered panels behind image (inspired, not copied) */}
            <div className="pointer-events-none absolute -right-10 top-10 hidden h-[85%] w-[85%] rounded-3xl bg-primDark/15 lg:block" />
            <div className="pointer-events-none absolute -right-2 top-0 hidden h-[85%] w-[85%] rounded-3xl bg-white/10 lg:block" />

            <div className="relative p-6 md:p-8">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/20">
                <img
                  src="/headset.jpg" // replace (can be accessories / repair / device)
                  alt="PhonePhixer annual registration benefits"
                  className="h-72 w-full object-cover object-center md:h-[420px]"
                  loading="lazy"
                />
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-white/80">
                  Offer valid for <span className="font-extrabold text-white">early registrations</span>. T&amp;C apply.
                </div>
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <button
                    type="button"
                    className="w-full sm:w-auto rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-slate-900 shadow-lg shadow-black/25 transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    Get Started
                    <span className="ml-2 text-base">→</span>
                  </button>
                </Link>
              </div>

              {/* decorative waves */}
              <div className="pointer-events-none absolute -bottom-24 left-0 right-0 h-40 opacity-50">
                <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(0,187,184,0.35),transparent_55%),radial-gradient(circle_at_80%_40%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(circle_at_50%_90%,rgba(0,0,0,0.35),transparent_55%)]" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom divider */}
        <div className="mt-14 h-px w-full bg-white/10" />
      </div>
    </section>
  );
};

export default RegistrationBenefits;
