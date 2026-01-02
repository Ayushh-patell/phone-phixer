import React from "react";

const ContactSection = () => {
  return (
    <section className="w-full bg-white py-16 md:py-20">
      <div className="w-full px-6 md:px-10 2xl:px-24">
        <div className="relative grid w-full gap-10 lg:grid-cols-2 lg:items-center">
          {/* LEFT */}
          <div className="w-full">
            <h2 className="text-5xl font-extrabold tracking-tight text-primDark md:text-6xl">
              Contact Us
            </h2>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-700 md:text-lg">
              Whether you have questions about our services, need support, or want to share your
              feedback, our dedicated team is here to assist you every step of the way.
            </p>

            <div className="mt-8 h-px w-full bg-slate-200" />

            <div className="mt-8 space-y-6">
              {/* Website */}
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primDark/20 ring-1 ring-primDark/30">
                  {/* globe */}
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-slate-800" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
                    <path d="M2 12h20" />
                    <path d="M12 2c3.2 3.7 3.2 16.3 0 20" />
                    <path d="M12 2c-3.2 3.7-3.2 16.3 0 20" />
                  </svg>
                </div>

                <div className="w-full">
                  <div className="text-2xl font-extrabold text-primDark">Website</div>
                  <div className="mt-1 text-base text-slate-700">phonephixer.in</div>
                </div>
              </div>

              <div className="h-px w-full bg-slate-200" />

              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primDark/20 ring-1 ring-primDark/30">
                  {/* mail */}
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-slate-800" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16v12H4z" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                </div>

                <div className="w-full">
                  <div className="text-2xl font-extrabold text-primDark">Email</div>
                  <div className="mt-1 text-base text-slate-700">support@phonephixer.in</div>
                </div>
              </div>

              <div className="h-px w-full bg-slate-200" />

              {/* Phone */}
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primDark/20 ring-1 ring-primDark/30">
                  {/* phone */}
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-slate-800" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.5 19.5 0 0 1 3.2 10.8 19.8 19.8 0 0 1 .1 2.2 2 2 0 0 1 2.1 0h3a2 2 0 0 1 2 1.7 12.7 12.7 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L6.2 7.7a16 16 0 0 0 6.1 6.1l1.1-1.1a2 2 0 0 1 2.1-.5 12.7 12.7 0 0 0 2.8.7 2 2 0 0 1 1.7 2Z" />
                  </svg>
                </div>

                <div className="w-full">
                  <div className="text-2xl font-extrabold text-primDark">Phone</div>
                  <div className="mt-1 text-base text-slate-700">+91 XXXXX XXXXX</div>
                </div>
              </div>

              <div className="h-px w-full bg-slate-200" />

              {/* Location */}
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primDark/20 ring-1 ring-primDark/30">
                  {/* location */}
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-slate-800" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 21s7-4.4 7-11a7 7 0 0 0-14 0c0 6.6 7 11 7 11Z" />
                    <path d="M12 10a2.5 2.5 0 1 0 0 .1Z" />
                  </svg>
                </div>

                <div className="w-full">
                  <div className="text-2xl font-extrabold text-primDark">Location</div>
                  <div className="mt-1 text-base text-slate-700">
                    Jaipur, Rajasthan (Doorstep pickup available)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT (form card) */}
          <div className="relative w-full">
            {/* black slab behind (like screenshot) */}
            <div className="absolute -right-6 md:-right-10 2xl:-right-24 -top-8 hidden h-[calc(100%+4rem)] w-[45vw] bg-black lg:block" />

            <div className="relative overflow-hidden rounded-[40px] bg-linear-to-br from-primDark via-[#1b7f8f] to-[#0b4452] p-8 shadow-2xl shadow-black/30 md:p-10">
              <h3 className="text-center text-5xl font-extrabold tracking-tight text-white md:text-6xl">
                Get in touch.
              </h3>

              <form className="mt-10 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/90">Your Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    className="w-full rounded-2xl bg-white/90 px-5 py-4 text-sm text-slate-900 outline-none ring-1 ring-white/40 placeholder:text-slate-500 focus:ring-2 focus:ring-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/90">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="w-full rounded-2xl bg-white/90 px-5 py-4 text-sm text-slate-900 outline-none ring-1 ring-white/40 placeholder:text-slate-500 focus:ring-2 focus:ring-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/90">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="Enter your phone"
                    className="w-full rounded-2xl bg-white/90 px-5 py-4 text-sm text-slate-900 outline-none ring-1 ring-white/40 placeholder:text-slate-500 focus:ring-2 focus:ring-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/90">Message</label>
                  <textarea
                    rows={5}
                    placeholder="Write your message"
                    className="w-full resize-none rounded-2xl bg-white/90 px-5 py-4 text-sm text-slate-900 outline-none ring-1 ring-white/40 placeholder:text-slate-500 focus:ring-2 focus:ring-white"
                  />
                </div>

                <button
                  type="button"
                  className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-extrabold text-slate-900 shadow-lg shadow-black/20 transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                  Submit
                </button>

                <p className="text-center text-xs text-white/70">
                  We typically respond within a few hours during working days.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
