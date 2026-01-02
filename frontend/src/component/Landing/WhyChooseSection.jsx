import React from "react";

const WhyChoosePhonePhixer = () => {
  const items = [
    {
      title: "Expertise",
      desc: "20+ years of experience in mobile repair and chip-level services.",
      img: "/why-1.jpg", // replace with your image
      bullets: [
        "Thousands of phones repaired across leading brands",
        "From budget handsets to premium flagships",
        "Chip-level diagnosis & repairs",
      ],
    },
    {
      title: "Transparency",
      desc: "Transparent pricing: fixed annual fee, no surprise labour charges.",
      img: "/why-2.jpg", // replace with your image
      bullets: ["Clear estimates before work starts", "No hidden charges", "Regular status updates"],
    },
    {
      title: "Assurance",
      desc: "Refurbished mobiles and laptops available with warranty.",
      img: "/why-3.jpg", // replace with your image
      bullets: ["Doorstep pickup & drop", "Quick turnaround", "Support that actually responds"],
    },
  ];

  return (
    <section className="w-full bg-slate-50 py-16 md:py-20">
      <div className="w-full px-6 md:px-10 2xl:px-24">
        {/* Big title (kept) */}
        <h2 className="text-center text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
          Why choose PhonePhixer?
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-base text-slate-600 md:text-lg">
          Powered by KS Mobile Point — 20+ years of repair experience with customer-friendly pricing.
        </p>

        {/* Alternating rows */}
        <div className="mt-14 space-y-14 md:space-y-20">
          {items.map((item, idx) => {
            const reverse = idx % 2 === 1;

            return (
              <div
                key={item.title}
                className={[
                  "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
                  reverse ? "lg:[&>div:first-child]:order-2" : "",
                ].join(" ")}
              >
                {/* Text */}
                <div className="w-full">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primDark/15 px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-primDark/25">
                    <span className="h-2 w-2 rounded-full bg-primDark" />
                    Powered by KS Mobile Point
                  </div>

                  <h3 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                    {item.title}
                  </h3>

                  <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-700 md:text-lg">
                    {item.desc}
                  </p>

                  <ul className="mt-6 space-y-3 text-sm text-slate-700 md:text-base">
                    {item.bullets.map((b) => (
                      <li key={b} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primDark" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Image */}
                <div className="w-full">
                  <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    {/* soft background panel like design-2 */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primDark/10 via-transparent to-black/5" />
                    <img
                      src={item.img}
                      alt={item.title}
                      className="h-72 w-full object-cover object-center md:h-[420px]"
                      loading="lazy"
                    />
                  </div>

                  {/* small caption chip */}
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                    <span className="h-2 w-2 rounded-full bg-primDark" />
                    Doorstep pickup &amp; drop • Quick turnaround
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom divider */}
        <div className="mt-16 h-px w-full bg-slate-200" />
      </div>
    </section>
  );
};

export default WhyChoosePhonePhixer;
