// src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyToken } from "./api/auth";
import OverviewSection from "./component/OverviewSection";
import ServicesSection from "./component/ServiceSection";
import PurchasesSection from "./component/PurchaseSection";
import StarsSection from "./component/StarsSection";
import {
  FiRefreshCw,
  FiStar,
  FiLogOut,
  FiGrid,
  FiTool,
  FiShoppingBag,
  FiAward,
  FiMenu,
  FiX,
} from "react-icons/fi";

function Dashboard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const data = await verifyToken(token);

        if (data.needAadhaar) {
          navigate(
            `/verify-aadhaar?userId=${encodeURIComponent(data.user.id)}`,
            { replace: true }
          );
          return;
        }

        if (data.valid) {
          setUser(data.user || null);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
        }
      } catch (err) {
        console.error(err);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
      } finally {
        setChecking(false);
      }
    }

    checkAuth();
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  const tabTitle = useMemo(() => {
    if (activeTab === "overview") return "Overview";
    if (activeTab === "services") return "Services";
    if (activeTab === "purchases") return "Purchases";
    if (activeTab === "stars") return "Stars";
    return "Dashboard";
  }, [activeTab]);

  const NavButton = ({ id, label, Icon }) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => {
          setActiveTab(id);
          setMobileNavOpen(false);
        }}
        className={[
          "w-full rounded-xl px-3 py-2.5 text-left text-sm transition",
          "flex items-center justify-between gap-3",
          active
            ? "bg-prim/20 text-neutral-900 ring-1 ring-prim/40"
            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
        ].join(" ")}
      >
        <span className="flex items-center gap-3">
          <span
            className={[
              "grid h-9 w-9 place-items-center rounded-xl ring-1",
              active ? "bg-prim/25 ring-prim/40" : "bg-neutral-50 ring-neutral-200",
            ].join(" ")}
          >
            <Icon className={active ? "h-4.5 w-4.5 text-neutral-900" : "h-4.5 w-4.5 text-neutral-700"} />
          </span>
          <span className="font-semibold">{label}</span>
        </span>

        {active ? <span className="h-2 w-2 rounded-full bg-prim" /> : null}
      </button>
    );
  };

  const Badge = ({ children, Icon }) => (
    <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 shadow-sm">
      <Icon className="h-4 w-4 text-neutral-700" />
      <span className="truncate max-w-[160px]">{children}</span>
    </div>
  );

  if (checking) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white px-6 py-5 text-sm text-neutral-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-neutral-200 border-t-prim" />
            Checking your session…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Mobile top strip */}
      <div className="md:hidden sticky top-0 z-20 border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-prim/25 ring-1 ring-prim/40 font-bold text-neutral-900">
              PP
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold tracking-[0.25em] uppercase text-neutral-700">
                phone-phixer
              </div>
              <div className="text-[11px] text-neutral-500">{tabTitle}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            {mobileNavOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="px-4 pb-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
              <div className="mb-3 text-[11px] uppercase tracking-wider text-neutral-500">
                Menu
              </div>
              <div className="space-y-2">
                <NavButton id="overview" label="Overview" Icon={FiGrid} />
                <NavButton id="services" label="Services" Icon={FiTool} />
                <NavButton id="purchases" label="Purchases" Icon={FiShoppingBag} />
                <NavButton id="stars" label="Stars" Icon={FiAward} />
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-[11px] text-neutral-500">Signed in</div>
                <div className="mt-0.5 text-sm font-semibold text-neutral-900 truncate">
                  {user?.name || user?.email || "User"}
                </div>

                <button
                  onClick={handleLogout}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  <FiLogOut className="h-4.5 w-4.5" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex md:flex-col w-72 border-r border-neutral-200 bg-white">
          {/* Brand */}
          <div className="px-5 py-4 border-b border-neutral-200">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-prim/25 ring-1 ring-prim/40 font-bold text-neutral-900">
                PP
              </div>
              <div>
                <div className="text-xs font-semibold tracking-[0.28em] uppercase text-neutral-800">
                  phone-phixer
                </div>
                <div className="text-[11px] text-neutral-500">Dashboard</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-2">
            <NavButton id="overview" label="Overview" Icon={FiGrid} />
            <NavButton id="services" label="Services" Icon={FiTool} />
            <NavButton id="purchases" label="Purchases" Icon={FiShoppingBag} />
            <NavButton id="stars" label="Stars" Icon={FiAward} />
          </nav>

          {/* User */}
          <div className="px-4 py-4 border-t border-neutral-200">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                Signed in
              </div>
              <div className="mt-1 text-sm font-semibold text-neutral-900 truncate">
                {user?.name || user?.email || "User"}
              </div>
              <button
                onClick={handleLogout}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
              >
                <FiLogOut className="h-4.5 w-4.5" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">


          {/* Content */}
          <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
            {/* subtle page header card */}
            <div className="mb-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <div className="h-1.5 w-full bg-prim" />
              <div className="p-4 md:p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                      {tabTitle}
                    </div>
                    <div className="mt-1 text-sm md:text-base font-semibold text-neutral-900">
                      {activeTab === "overview"
                        ? "Your account at a glance."
                        : activeTab === "services"
                        ? "Manage and track services."
                        : activeTab === "purchases"
                        ? "Your purchases and history."
                        : "Your star level and benefits."}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-prim/40 bg-prim/15 px-3 py-1.5 text-xs font-semibold text-neutral-900">
                      <span className="h-2 w-2 rounded-full bg-prim" />
                      {user?.email || user?.name || "User"}
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700">
                      <FiRefreshCw className="h-4 w-4" />
                      {user?.rsp || "0"} RSP
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700">
                      <FiStar className="h-4 w-4" />
                      {user?.star?.name || "Star"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {activeTab === "overview" && <OverviewSection user={user} />}
            {activeTab === "services" && <ServicesSection />}
            {activeTab === "purchases" && <PurchasesSection />}
            {activeTab === "stars" && <StarsSection />}
          </main>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
