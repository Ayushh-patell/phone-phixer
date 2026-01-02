import React from "react";

const HowItWorks = () => {
  const steps = [
    {
      n: 1,
      text: "Choose your protection plan based on your mobile price range.",
      accent: true,
    },
    {
      n: 2,
      text: "Complete quick online registration and secure your PhonePhixer ID.",
      accent: false,
    },
    {
      n: 3,
      text: "When your phone has an issue, call or WhatsApp us for pickup or in-store visit.",
      accent: true,
    },
    {
      n: 4,
      text: "Expert technicians fix your device; you pay zero labour charges, only parts if needed.",
      accent: false,
    },
  ];

  return (
    <section className="w-full bg-slate-50 py-16 md:py-20">
      <div className="w-full px-6 md:px-10 2xl:px-24">
        <h2 className="text-center text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
          How It Works
        </h2>

        <p className="mx-auto mt-3 max-w-3xl text-center text-base text-slate-700 md:text-lg">
          Registration valid for 1 year from activation. Plans are for one device only.
        </p>

        <div className="mt-12 grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {steps.map((s) => (
            <div
              key={s.n}
              className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(0,0,0,0.22)]"
            >
              {/* subtle bg sheen */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primDark/10 via-transparent to-black/5" />

              <div className="relative flex flex-col items-center text-center">
                {/* Number badge */}
                <div
                  className={[
                    "flex h-16 w-16 items-center justify-center rounded-full text-3xl font-extrabold",
                    s.accent ? "bg-primDark text-white" : "bg-slate-900 text-white",
                  ].join(" ")}
                >
                  {s.n}
                </div>

                <p className="mt-6 text-lg font-semibold leading-snug text-slate-900">
                  {s.text}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default HowItWorks;
