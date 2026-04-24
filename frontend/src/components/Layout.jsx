import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  ChevronRight,
  Building2,
  FolderKanban,
  Upload,
  UsersRound,
  Map,
  Clock,
  Inbox,
  Shield,
  Settings,
  Handshake,
  Train,
  Wrench,
  Target,
} from "lucide-react";
import { teamsAPI, timesheetsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantConfig } from "@/contexts/TenantConfigContext";
import { usePermissions } from "@/hooks/usePermissions";

// ── Entrées principales ─────────────────────────────────────────────
// perm: permission requise (string) ou [p1,p2] (OR logique)
const MAIN_NAV = [
  { to: "/dashboard",  icon: LayoutDashboard, label: "Tableau de bord", perm: "dashboard.view" },
  { to: "/programmes", icon: FolderKanban,     label: "Programmes",     perm: "portfolio.view" },
  { to: "/portfolio",  icon: Briefcase,        label: "Portefeuille",   perm: "portfolio.view" },
  { to: "/teams",      icon: UsersRound,       label: "Équipes",        perm: "teams.view" },
  {
    to: "/resources",
    icon: Users,
    label: "Ressources",
    perm: ["resources.view", "resources.edit", "resources.create"],
  },
  { to: "/governance", icon: ShieldCheck,  label: "Gouvernance",  perm: "governance.view" },
];

// Entrées conditionnelles par module + permission
const MODULE_NAV = [
  { to: "/roadmap",    icon: Map,         label: "Roadmap",    perm: "roadmap.view",    mod: "roadmap" },
  { to: "/scope",      icon: Target,      label: "Scope",      perm: ["scope.arbitrate", "scope.freeze", "scope.receive"], mod: null },
  { to: "/conformite", icon: ShieldAlert, label: "Conformité", perm: "compliance.view", mod: "compliance" },
  {
    to: "/demands",
    icon: Inbox,
    label: "Demandes",
    perm: ["demands.view_own", "demands.submit", "demands.qualify"],
    mod: "demands",
  },
  {
    to: "/timesheets",
    icon: Clock,
    label: "Timesheets",
    perm: ["timesheets.submit", "timesheets.validate_step2", "timesheets.validate_step3", "timesheets.view_all"],
    mod: "timesheets",
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isModuleEnabled } = useTenantConfig();
  const { hasPermission, hasAnyPermission, canAccessNav } = usePermissions();
  const navigate = useNavigate();
  const [alertCount, setAlertCount]     = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    teamsAPI.capacityAlerts().then((r) => {
      setAlertCount(r.data.filter((a) => a.level === "critique" || a.level === "rouge").length);
    }).catch(() => {});
    if (hasAnyPermission("timesheets.validate_step2", "timesheets.validate_step3", "timesheets.submit")) {
      timesheetsAPI.getPendingCount().then((r) => setPendingCount(r.data.count || 0)).catch(() => {});
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Filtre les entrées selon permissions + modules
  const visibleMain = MAIN_NAV.filter(({ perm }) =>
    Array.isArray(perm) ? hasAnyPermission(...perm) : hasPermission(perm)
  );
  const visibleModules = MODULE_NAV.filter(({ perm, mod }) =>
    canAccessNav(perm, mod)
  );

  // Profil affiché : profile_name si dispo, sinon fallback role
  const profileLabel = user?.profile_name || user?.role || "";

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

          {/* Entrées principales filtrées par permission */}
          {visibleMain.map(({ to, icon: Icon, label }) => (
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
                <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1" data-testid="sidebar-alert-badge">
                  {alertCount}
                </span>
              )}
            </NavLink>
          ))}

          {/* Entrées modules filtrées par permission + module activé */}
          {visibleModules.map(({ to, icon: Icon, label }) => (
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
              {label === "Timesheets" && pendingCount > 0 && (
                <span className="ml-auto flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1" data-testid="sidebar-ts-badge">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}

          {/* SAFe — trains.view + module safe */}
          {canAccessNav("trains.view", "safe") && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold">SAFe</div>
              <NavLink to="/safe/trains" data-testid="nav-trains-safe" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`}>
                <Train size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span>Trains SAFe</span>
              </NavLink>
            </>
          )}

          {/* Achats / Finances — vendors.view + module vendors */}
          {canAccessNav("vendors.view", "vendors") && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold">Achats / Finances</div>
              <NavLink to="/vendors" data-testid="nav-suivi-fournisseurs" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`}>
                <Handshake size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span>Suivi Fournisseurs</span>
              </NavLink>
            </>
          )}

          {/* Outils — import.csv */}
          {hasPermission("import.csv") && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold">Outils</div>
              <NavLink to="/import" data-testid="nav-import" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`}>
                <Upload size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span>Import CSV</span>
              </NavLink>
            </>
          )}

          {/* Administration — admin.* */}
          {hasAnyPermission("admin.profiles", "admin.users", "admin.config", "*") &&
           (hasPermission("admin.profiles") || hasPermission("admin.users") || hasPermission("admin.config") || hasPermission("*")) && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold">Administration</div>
              {hasPermission("admin.profiles") && (
                <NavLink to="/admin/profiles" data-testid="nav-admin-profils" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`}>
                  <Shield size={16} strokeWidth={1.75} className="flex-shrink-0" /><span>Profils</span>
                </NavLink>
              )}
              {hasPermission("admin.users") && (
                <NavLink to="/admin/users" data-testid="nav-admin-utilisateurs" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`}>
                  <Settings size={16} strokeWidth={1.75} className="flex-shrink-0" /><span>Utilisateurs</span>
                </NavLink>
              )}
              {hasPermission("admin.config") && (
                <NavLink to="/admin/config" data-testid="nav-admin-configuration" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`}>
                  <Wrench size={16} strokeWidth={1.75} className="flex-shrink-0" /><span>Configuration</span>
                </NavLink>
              )}
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
              <div className="text-[10px] text-slate-400 truncate" data-testid="sidebar-profile-label">
                {profileLabel}
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
            <span
              className="text-xs font-mono-data text-slate-500 bg-slate-100 px-2 py-0.5 rounded"
              data-testid="header-profile-badge"
            >
              {profileLabel}
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
