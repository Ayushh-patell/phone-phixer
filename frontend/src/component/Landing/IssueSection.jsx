import React from "react";
import Marquee from "react-fast-marquee";

/**
 * What this does:
 * - 3 ROW marquees (horizontal) instead of 3 columns
 * - The whole marquee block is rotated ~80deg
 * - Each row is counter-rotated so the cards read straight
 * - Rows alternate direction: 1st ->, 2nd <-, 3rd ->
 */

const IssueCard = ({ text }) => {
  return (
    <div className="min-w-[220px] rounded-3xl border border-black/10 bg-white/70 px-6 py-6 text-center shadow-[0_18px_45px_rgba(0,0,0,0.12)] backdrop-blur-sm">
      <p className="text-sm font-semibold leading-snug text-black/80 md:text-base">
        {text}
      </p>
    </div>
  );
};

const MarqueeRow = ({ items, direction = "left", speed = 18 }) => {
  return (
    <div className="w-full">
      <Marquee
        direction={direction}
        speed={speed}
        gradient={false}
        className="w-full"
      >
        <div className="flex items-center gap-4 py-3 px-2">
          {items.concat(items).map((t, i) => (
            <IssueCard key={`${t}-${i}`} text={t} />
          ))}
        </div>
      </Marquee>
    </div>
  );
};

const FrequentIssuesSection = () => {
  const issues = [
    "Broken or damaged display",
    "Water and liquid damage",
    "Battery and fast-drain issues",
    "Charging port and cable detection problems",
    "Speaker or earpiece not working",
    "Microphone issues during calls or recordings",
    "Headphone jack / audio port faults",
    "Front or rear camera problems",
    "Software crashes, hanging, boot loops",
    "Network and SIM detection errors",
    "Overheating issues",
    "Low storage/memory problems",
    "Power button faults",
    "Volume button not responding",
    "Back panel or body damage",
  ];

  // split into 3 rows
  const row1 = issues.filter((_, i) => i % 3 === 0);
  const row2 = issues.filter((_, i) => i % 3 === 1);
  const row3 = issues.filter((_, i) => i % 3 === 2);

  return (
    <section className="relative w-full overflow-hidden bg-primDark py-16 md:py-20">
      {/* subtle background texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.22]">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="absolute -top-32 -left-32 h-[520px] w-[520px] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[620px] w-[620px] rounded-full bg-black/20 blur-3xl" />
      </div>

      <div className="relative w-full px-6 md:px-10 2xl:px-24">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2">
          {/* Left */}
          <div className="w-full">
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-black md:text-6xl">
              Frequent Mobile Issues PhonePhixer Fixes
            </h2>
            <p className="mt-4 max-w-xl text-base text-black/85 md:text-lg">
              If your issue is not listed, share details on WhatsApp and the team will confirm coverage.
            </p>
          </div>

          {/* Right: rotated 3-row marquee */}
          <div className="relative w-full">
            {/* container rotated */}
            <div className="relative origin-center rotate-[80deg]">
              {/* counter-rotate content so it reads straight */}
              <div className="rotate-[-80deg] space-y-5">
                <MarqueeRow items={row1} direction="left" speed={16} />
                <MarqueeRow items={row2} direction="right" speed={14} />
                <MarqueeRow items={row3} direction="left" speed={18} />
              </div>
            </div>

            {/* optional soft mask on edges so it fades nicely */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-primDark to-transparent" />
              <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-primDark to-transparent" />
              <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-primDark to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-primDark to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FrequentIssuesSection;
