import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
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
  TrendingUp,
  Plug,
  BotMessageSquare,
  Bell,
  Lightbulb,
  BarChart2,
  X,
  DollarSign,
  Database,
} from "lucide-react";
import { teamsAPI, timesheetsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantConfig } from "@/contexts/TenantConfigContext";
import { usePermissions } from "@/hooks/usePermissions";
import AgentDrawer from "@/components/AgentDrawer";
import NotificationBell from "@/components/NotificationBell";
import { useTranslation } from "react-i18next";

function LanguageToggle() {
  const { i18n } = useTranslation();
  const isEN = i18n.language?.startsWith("en");
  return (
    <button
      onClick={() => i18n.changeLanguage(isEN ? "fr" : "en")}
      data-testid="lang-toggle"
      className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border border-gray-200 text-slate-600 hover:bg-gray-50 transition-colors"
      title={isEN ? "Passer en français" : "Switch to English"}
    >
      <span className="text-sm leading-none">{isEN ? "🇬🇧" : "🇫🇷"}</span>
      <span>{isEN ? "EN" : "FR"}</span>
    </button>
  );
}

// ── Entrées principales ─────────────────────────────────────────────
// perm: permission requise (string) ou [p1,p2] (OR logique)
const MAIN_NAV = [
  { to: "/dashboard",  icon: LayoutDashboard, label: "Tableau de bord", perm: "dashboard.view" },
  { to: "/programmes", icon: FolderKanban,     label: "Programmes",     perm: "portfolio.view" },
  { to: "/portfolio",  icon: Briefcase,        label: "Portefeuille",   perm: "portfolio.view" },
  { to: "/budget",     icon: DollarSign,       label: "Budget",         perm: "budget.view" },
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
  { to: "/arbitrage",  icon: TrendingUp,  label: "Arbitrage",  perm: ["arbitrage.view", "arbitrage.edit", "arbitrage.simulate"], mod: null },
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

  // Mobile drawer : fermé par défaut
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const location = useLocation();

  // Fermer le drawer mobile au changement de route
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Fermer le drawer si on redimensionne vers tablette/desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileDrawerOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Contenu commun de la sidebar (nav + footer)
  const SidebarContent = ({ isDrawer = false }) => (
    <>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded bg-[#0052CC] flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-white" strokeWidth={2} />
          </div>
          <div className={isDrawer ? "block" : "hidden md:block xl:block"}>
            <div className="font-heading text-white text-base font-bold tracking-wide leading-none whitespace-nowrap">
              PROJETENNE
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-wider uppercase">
              {user?.name?.split(" ")[0] || "Groupe"}
            </div>
          </div>
        </div>
        {/* Bouton fermeture drawer (mobile uniquement) */}
        {isDrawer && (
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="text-slate-500 hover:text-white ml-2 flex-shrink-0"
            data-testid="sidebar-close-btn"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <div className={`text-[10px] uppercase tracking-widest text-slate-500 px-3 mb-2 font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:opacity-0 md:group-hover:opacity-100 xl:opacity-100"}`}>
          Navigation
        </div>

        {visibleMain.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? "sidebar-item-active" : ""}`
            }
            title={label}
          >
            <Icon size={16} strokeWidth={1.75} className="flex-shrink-0" />
            <span className={`flex-1 whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>{label}</span>
            {label === "Équipes" && alertCount > 0 && (
              <span className={`ml-auto flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1 ${isDrawer ? "block" : "md:hidden md:group-hover:flex xl:flex"}`} data-testid="sidebar-alert-badge">
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}

        {visibleModules.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? "sidebar-item-active" : ""}`
            }
            title={label}
          >
            <Icon size={16} strokeWidth={1.75} className="flex-shrink-0" />
            <span className={`flex-1 whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>{label}</span>
            {label === "Timesheets" && pendingCount > 0 && (
              <span className={`ml-auto flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1 ${isDrawer ? "block" : "md:hidden md:group-hover:flex xl:flex"}`} data-testid="sidebar-ts-badge">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}

        {(hasPermission("agent.chat") || hasPermission("agent.recommend") || hasPermission("*")) && (
          <>
            <div className={`text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:opacity-0 md:group-hover:opacity-100 xl:opacity-100"}`}>Agent IA</div>
            {(hasPermission("agent.recommend") || hasPermission("*")) && (
              <NavLink to="/agent/recommandations" data-testid="nav-agent-recommandations" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Recommandations">
                <Lightbulb size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Recommandations</span>
              </NavLink>
            )}
            {(hasPermission("agent.alerts") || hasPermission("agent.chat") || hasPermission("*")) && (
              <NavLink to="/agent/alertes" data-testid="nav-agent-alertes" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Mes alertes">
                <Bell size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Mes alertes</span>
              </NavLink>
            )}
          </>
        )}

        {canAccessNav("trains.view", "safe") && (
          <>
            <div className={`text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:opacity-0 md:group-hover:opacity-100 xl:opacity-100"}`}>SAFe</div>
            <NavLink to="/safe/trains" data-testid="nav-trains-safe" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Trains SAFe">
              <Train size={16} strokeWidth={1.75} className="flex-shrink-0" />
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Trains SAFe</span>
            </NavLink>
          </>
        )}

        {canAccessNav("vendors.view", "vendors") && (
          <>
            <div className={`text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:opacity-0 md:group-hover:opacity-100 xl:opacity-100"}`}>Achats / Finances</div>
            <NavLink to="/vendors" data-testid="nav-suivi-fournisseurs" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Suivi Fournisseurs">
              <Handshake size={16} strokeWidth={1.75} className="flex-shrink-0" />
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Suivi Fournisseurs</span>
            </NavLink>
          </>
        )}

        {hasPermission("import.csv") && (
          <>
            <div className={`text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:opacity-0 md:group-hover:opacity-100 xl:opacity-100"}`}>Outils</div>
            <NavLink to="/import" data-testid="nav-import" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Import CSV">
              <Upload size={16} strokeWidth={1.75} className="flex-shrink-0" />
              <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Import CSV</span>
            </NavLink>
          </>
        )}

        {hasAnyPermission("admin.profiles", "admin.users", "admin.config", "*") &&
         (hasPermission("admin.profiles") || hasPermission("admin.users") || hasPermission("admin.config") || hasPermission("*")) && (
          <>
            <div className={`text-[10px] uppercase tracking-widest text-slate-500 px-3 pt-3 pb-1 font-semibold whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:opacity-0 md:group-hover:opacity-100 xl:opacity-100"}`}>Administration</div>
            {hasPermission("admin.profiles") && (
              <NavLink to="/admin/profiles" data-testid="nav-admin-profils" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Profils">
                <Shield size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Profils</span>
              </NavLink>
            )}
            {hasPermission("admin.users") && (
              <NavLink to="/admin/users" data-testid="nav-admin-utilisateurs" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Utilisateurs">
                <Settings size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Utilisateurs</span>
              </NavLink>
            )}
            {hasPermission("admin.config") && (
              <NavLink to="/admin/config" data-testid="nav-admin-configuration" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Configuration">
                <Wrench size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Configuration</span>
              </NavLink>
            )}
            {hasPermission("admin.config") && (
              <NavLink to="/admin/connectors" data-testid="nav-admin-connectors" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Connecteurs">
                <Plug size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Connecteurs</span>
              </NavLink>
            )}
            {(hasPermission("admin.config") || hasPermission("*")) && (
              <NavLink to="/admin/agent-analytics" data-testid="nav-admin-agent-analytics" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Analytics IA">
                <BarChart2 size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Analytics IA</span>
              </NavLink>
            )}
            {(hasPermission("admin.config") || hasPermission("*")) && (
              <NavLink to="/admin/powerbi" data-testid="nav-admin-powerbi" className={({ isActive }) => `sidebar-item ${isActive ? "sidebar-item-active" : ""}`} title="Connecteur Power BI">
                <Database size={16} strokeWidth={1.75} className="flex-shrink-0" />
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Power BI</span>
              </NavLink>
            )}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-2 pb-3 border-t border-white/10 pt-3 flex-shrink-0">
        <div className={`flex items-center gap-3 px-2 py-2 ${isDrawer ? "flex" : "md:justify-center md:group-hover:justify-start xl:justify-start"}`}>
          <div className="w-8 h-8 rounded bg-[#0052CC]/40 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">
              {user?.name?.slice(0, 2).toUpperCase() || "?"}
            </span>
          </div>
          <div className={`flex-1 min-w-0 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>
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
          title="Déconnexion"
        >
          <LogOut size={15} strokeWidth={1.75} />
          <span className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${isDrawer ? "block" : "md:hidden md:group-hover:block xl:block"}`}>Déconnexion</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FA]">

      {/* ── Overlay mobile (drawer ouvert) ─────────────────── */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
          data-testid="mobile-overlay"
        />
      )}

      {/* ── Sidebar Mobile : drawer overlay (<768px) ──────── */}
      <aside
        data-testid="sidebar-mobile"
        className={`
          fixed top-0 left-0 h-full z-30 w-72 bg-[#0F172A] flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"}
          md:hidden
        `}
      >
        <SidebarContent isDrawer={true} />
      </aside>

      {/* ── Sidebar Tablette / Desktop (≥768px) ───────────── */}
      <aside
        data-testid="sidebar"
        className="
          hidden md:flex flex-col flex-shrink-0 bg-[#0F172A]
          w-[60px] xl:w-60
          hover:w-60 transition-all duration-200 ease-in-out
          overflow-hidden group
        "
      >
        <SidebarContent isDrawer={false} />
      </aside>

      {/* ── Main content ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center px-3 md:px-4 lg:px-6 flex-shrink-0">
          {/* Hamburger — mobile uniquement */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            data-testid="sidebar-open-btn"
            className="mr-3 text-slate-500 hover:text-slate-700 md:hidden flex-shrink-0"
            aria-label="Ouvrir le menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex items-center gap-1 text-sm text-slate-500 min-w-0">
            <span className="text-slate-800 font-medium truncate text-xs sm:text-sm">Groupe Altair Industries</span>
            <ChevronRight size={14} className="text-slate-400 flex-shrink-0 hidden sm:block" />
            <span className="text-slate-500 truncate hidden sm:block text-xs">Portefeuille Projets</span>
          </div>

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <LanguageToggle />
            <NotificationBell />
            <span
              className="text-xs font-mono-data text-slate-500 bg-slate-100 px-2 py-0.5 rounded hidden md:block"
              data-testid="header-profile-badge"
            >
              {profileLabel}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Agent IA PMO — Drawer flottant */}
      <AgentDrawer />
    </div>
  );
}
