import React from "react";
import { Link } from "react-router";

const AboutPhonePhixer = () => {
  return (
    <section className="w-full bg-white">
      {/* Title row with full-width line behind */}
      <div className="relative w-full overflow-hidden border-b border-slate-200">
        {/* full-width line */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-slate-200" />

        <div className="mx-auto w-full px-6 py-12 md:px-10 2xl:px-24">
          <div className="relative flex items-center justify-center">
            {/* Title sits on top and "cuts" the line */}
            <h2 className="bg-white px-6 text-center text-5xl font-black tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
              About PhonePhixer
            </h2>
          </div>

          <p className="mx-auto mt-4 max-w-3xl text-center text-base text-slate-600 md:text-lg">
            Jaipur-based mobile care for everyday users and small businesses.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="w-full">
        <div className="mx-auto w-full px-6 py-14 md:px-10 lg:py-20 2xl:px-24">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main copy */}
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-6 md:p-8">
                {/* subtle corner highlight */}
                <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primDark/15 blur-3xl" />

                <p className="relative text-base leading-relaxed text-slate-700 md:text-lg">
                  <span className="font-semibold text-slate-900">PhonePhixer</span> is a Jaipur-based
                  mobile care brand that offers affordable annual protection plans, expert repairs,
                  and refurbished devices for everyday users and small businesses. Powered by{" "}
                  <span className="font-semibold text-slate-900">KS Mobile Point</span>, we combine
                  years of hands-on repair experience with customer-friendly pricing so that your
                  smartphone is always ready when you need it most.
                </p>

                <p className="relative mt-5 text-base leading-relaxed text-slate-700 md:text-lg">
                  Since our inception, the team has repaired thousands of phones across leading
                  brands, from budget handsets to premium flagships. With doorstep pickup &amp; drop,
                  transparent communication, and quick turnaround, PhonePhixer aims to remove the
                  stress, confusion, and hidden charges people usually face in traditional repair
                  shops.
                </p>

                <div className="relative mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link to="/dashboard" className="w-full sm:w-auto">
                    <button
                      type="button"
                      className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                    >
                      Explore Plans
                      <span className="ml-2 text-lg">→</span>
                    </button>
                  </Link>

                  <Link
                    to="/"
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    Talk to Support
                  </Link>
                </div>
              </div>
            </div>

            {/* Highlights */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-slate-900">What we do</h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-700">
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primDark" />
                    Affordable annual protection plans
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primDark" />
                    Expert repairs with quick turnaround
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primDark" />
                    Refurbished devices you can trust
                  </li>
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-slate-900">Why people choose us</h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-700">
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-900" />
                    Doorstep pickup &amp; drop
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-900" />
                    Transparent updates &amp; pricing
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-900" />
                    No hidden charges
                  </li>
                </ul>
              </div>

            </div>
          </div>

          {/* bottom full-width divider */}
          <div className="mt-14 h-px w-full bg-slate-200" />
        </div>
      </div>
    </section>
  );
};

export default AboutPhonePhixer;
