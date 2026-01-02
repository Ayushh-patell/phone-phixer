import React from "react";
import { Link } from "react-router";

const HeroSection = () => {
  return (
    <section className="relative w-full h-dvh overflow-hidden bg-primDark">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        {/* soft blobs */}
        <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-28 -right-28 h-[520px] w-[520px] rounded-full bg-black/15 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 h-[380px] w-[380px] -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />

        {/* subtle vignette */}
        <div className="absolute inset-0 bg-linear-to-tr from-black/20 via-transparent to-white/10" />

        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(0,0,0,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.25) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        {/* tiny noise-ish overlay (very subtle) */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:18px_18px] opacity-[0.12]" />
      </div>

      <div className="relative w-full h-full flex flex-col md:flex-row-reverse items-center justify-between px-6 md:px-10 2xl:px-24">
        {/* Image */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex items-center justify-center">
          <img
            src="/hero.png"
            alt="Mobile repair service"
            className="w-full h-full object-contain object-center"
          />
        </div>

        {/* Text */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex items-center">
          <div className="w-full space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/10 px-4 py-2 text-sm text-slate-900 ring-1 ring-black/10">
              <span className="h-2 w-2 rounded-full bg-slate-900" />
              Trusted protection + fast repairs
            </div>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-7xl">
              Annual mobile protection <span className="text-slate-800">&amp;</span>{" "}
              repair plans
            </h1>

            <p className="text-lg text-slate-800 md:text-xl">
              Starting at <span className="font-semibold text-slate-900">₹1,199</span>/year only
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/dashboard" className="w-full sm:w-auto">
                <button
                  type="button"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 focus:ring-offset-[#00bbb8]"
                >
                  Get your plan now
                  <span className="ml-2 text-lg">→</span>
                </button>
              </Link>

              <div className="text-sm text-slate-900">
                Instant support
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2 text-sm text-slate-900">
              <span className="rounded-lg bg-black/10 px-3 py-2 ring-1 ring-black/10">
                Screen &amp; battery support
              </span>
              <span className="rounded-lg bg-black/10 px-3 py-2 ring-1 ring-black/10">
                All year
              </span>
              <span className="rounded-lg bg-black/10 px-3 py-2 ring-1 ring-black/10">
                Priority service
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
