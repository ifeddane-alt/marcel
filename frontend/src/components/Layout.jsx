import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Building2,
  FolderKanban,
  Upload,
  UsersRound,
  Map,
} from "lucide-react";
import { teamsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";

const ROLE_LABELS = {
  TENANT_ADMIN: "Administrateur",
  PMO_USER: "PMO",
  READ_ONLY: "Lecture seule",
};

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/programmes", icon: FolderKanban, label: "Programmes" },
  { to: "/portfolio", icon: Briefcase, label: "Portefeuille" },
  { to: "/roadmap", icon: Map, label: "Roadmap" },
  { to: "/resources", icon: Users, label: "Ressources" },
  { to: "/teams", icon: UsersRound, label: "Équipes" },
  { to: "/governance", icon: ShieldCheck, label: "Gouvernance" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    teamsAPI.capacityAlerts().then((r) => {
      setAlertCount(r.data.filter((a) => a.level === "critique" || a.level === "rouge").length);
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA]">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-[#0F172A] flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#0052CC] flex items-center justify-center flex-shrink-0">
              <Building2 size={14} className="text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-heading text-white text-lg font-bold tracking-wide leading-none">
                PROJETENNE
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-wider uppercase">
                {user?.name?.split(" ")[0] || "Groupe"}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 px-3 mb-2 font-semibold">
            Navigation
          </div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
              className={({ isActive }) =>
                `sidebar-item ${isActive ? "sidebar-item-active" : ""}`
              }
            >
              <Icon size={16} strokeWidth={1.75} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {label === "Équipes" && alertCount > 0 && (
                <span
                  className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1"
                  data-testid="sidebar-alert-badge"
                >
                  {alertCount}
                </span>
              )}
            </NavLink>
          ))}

          {/* Import — TENANT_ADMIN + PMO_USER uniquement */}
          {user?.role !== "READ_ONLY" && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold">
                Outils
              </div>
              <NavLink
                to="/import"
                data-testid="nav-import"
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? "sidebar-item-active" : ""}`
                }
              >
                <Upload size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span>Import CSV</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded bg-[#0052CC]/40 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {user?.name?.slice(0, 2).toUpperCase() || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-medium truncate">{user?.name}</div>
              <div className="text-[10px] text-slate-400 truncate">
                {ROLE_LABELS[user?.role] || user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="sidebar-item w-full mt-1 text-slate-400 hover:text-rose-300"
          >
            <LogOut size={15} strokeWidth={1.75} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0">
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <span className="text-slate-800 font-medium">Groupe Altair Industries</span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="text-slate-500">Portefeuille Projets</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs font-mono-data text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {user?.role}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
