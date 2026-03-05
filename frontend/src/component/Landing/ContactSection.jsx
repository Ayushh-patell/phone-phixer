import React, { useEffect, useState } from "react";
import axios from "axios";

// Assuming these are defined in your project constants or environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const authConfig = () => ({
  headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
});

const ContactSection = () => {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [error, setError] = useState("");

  // =============================
  // Fetch services list
  // =============================
  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      setError("");
      const res = await axios.get(`${API_BASE_URL}/service`, authConfig());
      setServices(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load services.");
    } finally {
      setLoadingServices(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return (
    <section id="contactSection" className="w-full bg-white py-16 md:py-20">
      <div className="w-full px-6 md:px-10 2xl:px-24">
        <div className="relative grid w-full gap-10 lg:grid-cols-2 lg:items-center">
          {/* LEFT (Contact Info) */}
          <div className="w-full">
            <h2 id="contactHomeForm" className="text-5xl font-extrabold tracking-tight text-primDark md:text-6xl">
              Contact Us
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-700 md:text-lg">
              Whether you have questions about our services, need support, or want to share your
              feedback, our dedicated team is here to assist you every step of the way.
            </p>

            <div className="mt-8 h-px w-full bg-slate-200" />

            <div className="mt-8 space-y-6">
              {/* Info Items (Website, Email, Phone, Location) */}
              {[
                { label: "Website", value: "phonephixer.in", icon: "globe" },
                { label: "Email", value: "phonephixerr@gmail.com", icon: "mail" },
                { label: "Phone", value: "9057213756", icon: "phone", link: "tel:9057213756" },
                { label: "Location", value: "24, Chetany Vihar, Trivani, 10B Scheme, Gopalpura, Durgapura, Jaipur, Rajasthan - 302018", icon: "location" },
              ].map((item, idx) => (
                <React.Fragment key={idx}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primDark/20 ring-1 ring-primDark/30 text-slate-800">
                       {/* SVG Icons based on item.icon would go here */}
                       <span className="capitalize text-lg font-bold">{item.label[0]}</span>
                    </div>
                    <div className="w-full">
                      <div className="text-2xl font-extrabold text-primDark">{item.label}</div>
                      <div className="mt-1 text-base text-slate-700">{item.link ? <a href={item.link}>{item.value}</a> : item.value}</div>
                    </div>
                  </div>
                  {idx !== 3 && <div className="h-px w-full bg-slate-200" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* RIGHT (Form Card) */}
          <div className="relative w-full">
            <div className="absolute -right-6 md:-right-10 2xl:-right-24 -top-8 hidden h-[calc(100%+4rem)] w-[45vw] bg-black lg:block" />

            <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-primDark via-[#1b7f8f] to-[#0b4452] p-8 shadow-2xl shadow-black/30 md:p-10">
              <h3 className="text-center text-5xl font-extrabold tracking-tight text-white md:text-6xl">
                Get in touch.
              </h3>

              <form className="mt-10 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/90">Your Name</label>
                    <input
                      type="text"
                      placeholder="Enter name"
                      className="w-full rounded-2xl bg-white/90 px-5 py-4 text-sm text-slate-900 outline-none ring-1 ring-white/40 focus:ring-2 focus:ring-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/90">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="Enter phone"
                      className="w-full rounded-2xl bg-white/90 px-5 py-4 text-sm text-slate-900 outline-none ring-1 ring-white/40 focus:ring-2 focus:ring-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/90">Service Required</label>
                  <select 
                    className="w-full rounded-2xl bg-white/90 px-5 py-4 text-sm text-slate-900 outline-none ring-1 ring-white/40 focus:ring-2 focus:ring-white appearance-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>Select a service</option>
                    
                    {/* Additional Options Requested */}
                    <option value="repair_phone">Repair Phone</option>
                    <option value="repair_tablet">Repair Tablet</option>

                    {/* Dynamic Services from API */}
                    {!loadingServices && services.map((s) => (
                      <option key={s._id} value={s.name}>{s.name}</option>
                    ))}

                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/90">Message</label>
                  <textarea
                    rows={4}
                    placeholder="Describe your issue..."
                    className="w-full resize-none rounded-2xl bg-white/90 px-5 py-4 text-sm text-slate-900 outline-none ring-1 ring-white/40 focus:ring-2 focus:ring-white"
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-extrabold text-slate-900 shadow-lg shadow-black/20 transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                  {loadingServices ? "Loading..." : "Submit Request"}
                </button>

                <p className="text-center text-xs text-white/70">
                  We typically respond within a few hours.
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