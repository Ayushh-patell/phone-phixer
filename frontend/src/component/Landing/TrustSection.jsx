import React from "react";

const TrustSection = () => {
  const cards = [
    {
      title: "Expert Technicians",
      img: "/expert.jpg", // replace
      tone: "light",
    },
    {
      title: "Original Premium-Grade Parts",
      img: "/repair.jpg", // replace
      tone: "accent",
    },
    {
      title: "Service Within 24 Hours",
      img: "/support.jpg", // replace
      tone: "light",
    },
  ];

  return (
    <section className="relative w-full overflow-hidden bg-slate-900 py-16 md:py-20">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/25" />
        <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-[#00bbb8]/18 blur-3xl" />
        <div className="absolute -bottom-28 -right-28 h-[520px] w-[520px] rounded-full bg-white/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "70px 70px",
          }}
        />
      </div>

      {/* FULL WIDTH container (no max-w) */}
      <div className="relative w-full px-6 md:px-10 2xl:px-24">
        {/* Big title (keep the look) */}
        <h2 className="text-center text-3xl font-semibold tracking-tight text-[#7fe8e6] md:text-4xl lg:text-5xl">
          Powered by KS Mobile Point – 20+ years of repair experience
        </h2>

        {/* Cards */}
        <div className="mt-12 grid w-full gap-6 md:grid-cols-3 md:gap-8">
          {cards.map((c, idx) => (
            <div
              key={idx}
              className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-2xl shadow-black/35 transition hover:-translate-y-1 hover:border-white/20"
            >
              {/* Image */}
              <div className="relative h-64 w-full md:h-72">
                <img
                  src={c.img}
                  alt={c.title.replaceAll("\n", " ")}
                  className="h-full w-full object-cover object-center"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent opacity-80 transition group-hover:opacity-70" />
              </div>

              {/* Label */}
              <div
                className={[
                  "flex min-h-[120px] items-center justify-center px-6 py-7 text-center",
                  c.tone === "accent"
                    ? "bg-[#00bbb8] text-slate-900"
                    : "bg-white text-slate-900",
                ].join(" ")}
              >
                <p className="whitespace-pre-line text-2xl font-extrabold leading-snug tracking-tight md:text-[28px]">
                  {c.title}
                </p>
              </div>

              {/* Hover ring */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                <div className="absolute inset-0 rounded-[28px] ring-1 ring-[#00bbb8]/40" />
              </div>
            </div>
          ))}
        </div>

        {/* Small trust pills */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm text-white/70">
          <span className="rounded-full bg-white/10 px-4 py-2 ring-1 ring-white/10">
            Doorstep pickup &amp; drop
          </span>
          <span className="rounded-full bg-white/10 px-4 py-2 ring-1 ring-white/10">
            Transparent communication
          </span>
          <span className="rounded-full bg-white/10 px-4 py-2 ring-1 ring-white/10">
            Quick turnaround
          </span>
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
