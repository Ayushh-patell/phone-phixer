// src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyToken } from "./api/auth";
import OverviewSection from "./component/OverviewSection";
import ServicesSection from "./component/ServiceSection";


// ========== MAIN DASHBOARD APP ==========
function App() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "services"

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const data = await verifyToken(token);

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

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-4 text-sm text-slate-200 shadow-xl">
          Checking your session…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 border-r border-slate-800 bg-slate-950/95">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
          <div className="h-9 w-9 rounded-xl bg-sky-400 flex items-center justify-center text-xs font-bold text-slate-950">
            PP
          </div>
          <div>
            <div className="text-xs font-semibold tracking-[0.25em] uppercase text-sky-400">
              phone-phixer
            </div>
            <div className="text-[11px] text-slate-400">Dashboard</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition ${
              activeTab === "overview"
                ? "bg-slate-800 text-slate-50"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
            }`}
          >
            <span>Overview</span>
            {activeTab === "overview" && (
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("services")}
            className={`w-full text-left px-3 py-2 rounded-lg transition ${
              activeTab === "services"
                ? "bg-slate-800 text-slate-50"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
            }`}
          >
            Services
          </button>
        </nav>

        <div className="px-4 py-4 border-t border-slate-800 text-xs text-slate-500">
          <div className="mb-1">Logged in as</div>
          <div className="text-slate-200 text-sm truncate">
            {user?.name || user?.email}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              {activeTab === "overview" ? "Overview" : "Services"}
            </span>
            <span className="text-sm md:text-base font-semibold">
              Welcome back{user?.name ? `, ${user.name}` : ""}.
            </span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[140px]">
                  {user.email || user.name}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
          {activeTab === "overview" && <OverviewSection user={user} />}
          {activeTab === "services" && <ServicesSection />}
        </main>
      </div>
    </div>
  );
}



export default App;
