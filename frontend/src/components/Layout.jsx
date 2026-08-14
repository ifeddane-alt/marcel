import React, { useEffect, useState } from "react";
import { Outlet, NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  History,
  Briefcase,
  Users,
  ShieldCheck,
  ShieldAlert,
  LogOut,
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
  Goal,
  TrendingUp,
  Plug,
  Bell,
  Lightbulb,
  BarChart2,
  X,
  DollarSign,
  Database,
  Layers,
  Activity,
  Home as HomeIcon,
  AppWindow,
  ServerCog,
  ShieldHalf,
  Network,
  Gauge,
  HandCoins,
  ClipboardCheck,
  Moon,
  Sun,
  CalendarDays,
  Layers3,
} from "lucide-react";
import { teamsAPI, timesheetsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantConfig } from "@/contexts/TenantConfigContext";
import { usePermissions } from "@/hooks/usePermissions";
import AgentDrawer from "@/components/AgentDrawer";
import { OnboardingTour } from "@/components/OnboardingTour";
import NotificationBell from "@/components/NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";
import { useTranslation } from "react-i18next";

// (Sélecteur de langue retiré — l'interface est uniquement en français tant que la traduction n'est pas complète)

// ── Entrées principales ─────────────────────────────────────────────
const MAIN_NAV = [
  { to: "/home",       icon: HomeIcon,         label: "Accueil",        tKey: "nav.home",       perm: null },
  { to: "/dashboard",  icon: LayoutDashboard, label: "Tableau de bord", tKey: "nav.dashboard",  perm: "dashboard.view" },
  { to: "/programmes", icon: FolderKanban,     label: "Programmes",     tKey: "nav.programs",   perm: "portfolio.view" },
  { to: "/portfolio",  icon: Briefcase,        label: "Portefeuille",   tKey: "nav.portfolio",  perm: "portfolio.view" },
  { to: "/pilotage",   icon: Gauge,            label: "Pilotage",       tKey: "nav.pilotage",   perm: "portfolio.view" },
  { to: "/objectifs",  icon: Goal,             label: "Objectifs",      tKey: "nav.objectives", perm: "portfolio.view" },
  { to: "/budget",     icon: DollarSign,       label: "Budget",         tKey: "nav.budget",     perm: "budget.view" },
  { to: "/teams",      icon: UsersRound,       label: "Équipes",        tKey: "nav.teams",      perm: "teams.view" },
  {
    to: "/resources",
    icon: Users,
    label: "Ressources",
    tKey: "nav.resources",
    perm: ["resources.view", "resources.edit", "resources.create"],
  },
  { to: "/governance", icon: ShieldCheck,  label: "Gouvernance",  tKey: "nav.governance", perm: "governance.view" },
  { to: "/calendrier", icon: CalendarDays, label: "Calendrier",   tKey: "nav.calendar",   perm: "portfolio.view" },
  { to: "/capacite",   icon: Layers3,      label: "Capacité",     tKey: "nav.capacity",   perm: ["resources.view", "resources.edit"] },
  {
    to: "/validations",
    icon: ClipboardCheck,
    label: "Validations",
    tKey: "nav.validations",
    perm: ["lifecycle.request", "lifecycle.review_architecture", "lifecycle.review_security", "lifecycle.review_pmo", "lifecycle.decide"],
  },
];

const MODULE_NAV = [
  { to: "/roadmap",    icon: Map,         label: "Roadmap",    tKey: "nav.roadmap",    perm: "roadmap.view",    mod: "roadmap" },
  { to: "/scope",      icon: Target,      label: "Scope",      tKey: "nav.scope",      perm: ["scope.arbitrate", "scope.freeze", "scope.receive"], mod: null },
  { to: "/arbitrage",  icon: TrendingUp,  label: "Arbitrage",  tKey: "nav.arbitrage",  perm: ["arbitrage.view", "arbitrage.edit", "arbitrage.simulate"], mod: null },
  { to: "/conformite", icon: ShieldAlert, label: "Conformité", tKey: "nav.compliance", perm: "compliance.view", mod: "compliance" },
  {
    to: "/demands",
    icon: Inbox,
    label: "Demandes",
    tKey: "nav.demands",
    perm: ["demands.view_own", "demands.submit", "demands.qualify"],
    mod: "demands",
  },
  {
    to: "/timesheets",
    icon: Clock,
    label: "Timesheets",
    tKey: "nav.timesheets",
    perm: ["timesheets.submit", "timesheets.validate_step2", "timesheets.validate_step3", "timesheets.view_all"],
    mod: "timesheets",
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isModuleEnabled } = useTenantConfig();
  const { hasPermission, hasAnyPermission, canAccessNav } = usePermissions();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [alertCount, setAlertCount]     = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem("marcel_theme") || "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("marcel_theme", theme);
  }, [theme]);

  const toggleLang = () => i18n.changeLanguage(i18n.language?.startsWith("en") ? "fr" : "en");

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

  const visibleMain = MAIN_NAV.filter(({ perm }) =>
    perm === null ? true : Array.isArray(perm) ? hasAnyPermission(...perm) : hasPermission(perm)
  );
  const visibleModules = MODULE_NAV.filter(({ perm, mod }) =>
    canAccessNav(perm, mod)
  );

  // ── Sections agent / SAFe / achats / outils / admin ──
  const agentItems = [];
  if (hasPermission("agent.chat") || hasPermission("agent.recommend") || hasPermission("*")) {
    if (hasPermission("agent.recommend") || hasPermission("*"))
      agentItems.push({ to: "/agent/recommandations", icon: Lightbulb, label: "Recommandations", tKey: "nav.recommendations" });
    if (hasPermission("agent.alerts") || hasPermission("agent.chat") || hasPermission("*"))
      agentItems.push({ to: "/agent/alertes", icon: Bell, label: "Mes alertes", tKey: "nav.my_alerts" });
  }
  const dsiItems = (hasPermission("portfolio.view") || hasPermission("*"))
    ? [
        { to: "/applications", icon: AppWindow, label: "Applications", tKey: "nav.applications" },
        { to: "/run", icon: ServerCog, label: "Run & Exploitation", tKey: "nav.run" },
        { to: "/securite", icon: ShieldHalf, label: "Sécurité", tKey: "nav.security" },
        { to: "/architecture", icon: Network, label: "Architecture", tKey: "nav.architecture" },
      ] : [];
  const safeItems = canAccessNav("trains.view", "safe")
    ? [
        { to: "/safe/trains", icon: Train, label: "Trains SAFe", tKey: "nav.safe_trains" },
        { to: "/pb", icon: HandCoins, label: "Budget participatif", tKey: "nav.pb" },
      ] : [];
  const vendorItems = canAccessNav("vendors.view", "vendors")
    ? [{ to: "/vendors", icon: Handshake, label: "Suivi Fournisseurs", tKey: "nav.vendors" }] : [];
  const toolItems = hasPermission("import.csv")
    ? [{ to: "/import", icon: Upload, label: "Import CSV", tKey: "nav.import_csv" }] : [];
  const adminItems = [];
  if (hasAnyPermission("admin.profiles", "admin.users", "admin.config", "*")) {
    if (hasPermission("admin.profiles")) adminItems.push({ to: "/admin/profiles", icon: Shield, label: "Profils", tKey: "nav.profiles", tid: "nav-admin-profils" });
    if (hasPermission("admin.users")) adminItems.push({ to: "/admin/users", icon: Settings, label: "Utilisateurs", tKey: "nav.users", tid: "nav-admin-utilisateurs" });
    if (hasPermission("admin.config")) adminItems.push({ to: "/admin/config", icon: Wrench, label: "Configuration", tKey: "nav.configuration", tid: "nav-admin-configuration" });
    if (hasPermission("admin.config")) adminItems.push({ to: "/admin/connectors", icon: Plug, label: "Connecteurs", tKey: "nav.connectors", tid: "nav-admin-connectors" });
    if (hasPermission("admin.config") || hasPermission("*")) adminItems.push({ to: "/admin/agent-analytics", icon: BarChart2, label: "Analytics IA", tKey: "nav.agent_analytics", tid: "nav-admin-agent-analytics" });
    if (hasPermission("admin.config") || hasPermission("*")) adminItems.push({ to: "/admin/powerbi", icon: Database, label: "Power BI", tKey: "nav.powerbi", tid: "nav-admin-powerbi" });
    if (hasPermission("admin.templates") || hasPermission("*")) adminItems.push({ to: "/admin/templates", icon: Layers, label: "Templates", tKey: "nav.templates", tid: "nav-admin-templates" });
    if (hasPermission("admin.config") || hasPermission("*")) adminItems.push({ to: "/admin/monitoring", icon: Activity, label: "Monitoring", tKey: "nav.monitoring", tid: "nav-admin-monitoring" });
    if (hasPermission("admin.config") || hasPermission("*")) adminItems.push({ to: "/admin/audit", icon: History, label: "Journal d'audit", tKey: "nav.audit_log", tid: "nav-admin-audit" });
  }

  const sections = [
    { title: t("sections.pilotage"), items: visibleMain },
    { title: t("sections.modules"), items: visibleModules },
    { title: t("sections.dsi"), items: dsiItems },
    { title: t("sections.agent"), items: agentItems },
    { title: t("sections.safe"), items: safeItems },
    { title: t("sections.finance"), items: vendorItems },
    { title: t("sections.tools"), items: toolItems },
    { title: t("sections.admin"), items: adminItems },
  ].filter((s) => s.items.length > 0);

  const profileLabel = user?.profile_name || user?.role || "";

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileDrawerOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Badge count par entrée (Équipes / Timesheets)
  const badgeFor = (label) => {
    if (label === "Équipes" && alertCount > 0) return { count: alertCount, cls: "bg-rose-500", tid: "sidebar-alert-badge" };
    if (label === "Timesheets" && pendingCount > 0) return { count: pendingCount, cls: "bg-amber-500", tid: "sidebar-ts-badge" };
    return null;
  };

  // ── Item du rail (icône + libellé visible à l'expansion) ──
  const RailItem = ({ to, icon: Icon, label, tKey, tid, isDrawer }) => {
    const badge = badgeFor(label);
    const display = tKey ? t(tKey, label) : label;
    return (
      <NavLink
        key={to}
        to={to}
        data-testid={tid || `nav-${label.toLowerCase().replace(/ /g, "-")}`}
        className={({ isActive }) =>
          `rail-item ${isActive ? "rail-item-active" : ""} ${isDrawer ? "px-3 py-2" : "px-[9px] py-2"}`
        }
        title={display}
      >
        <span className="relative flex-shrink-0 flex items-center justify-center w-[22px]">
          <Icon size={17} strokeWidth={1.75} />
          {badge && (
            <span className={`absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full ${badge.cls} ${isDrawer ? "hidden" : "group-hover:hidden"}`} />
          )}
        </span>
        <span className={`flex-1 whitespace-nowrap overflow-hidden ${isDrawer ? "block" : "hidden group-hover:block"}`}>{display}</span>
        {badge && (
          <span
            className={`ml-auto flex-shrink-0 min-w-[18px] h-[18px] items-center justify-center rounded-full ${badge.cls} text-white text-[10px] font-bold px-1 ${isDrawer ? "flex" : "hidden group-hover:flex"}`}
            data-testid={badge.tid}
          >
            {badge.count}
          </span>
        )}
      </NavLink>
    );
  };

  // ── Contenu du rail / drawer ──
  const RailContent = ({ isDrawer = false }) => (
    <>
      {isDrawer && (
        <div className="px-4 py-4 border-b border-[#f0eff6] flex items-center justify-between flex-shrink-0">
          <Link to="/home" onClick={() => setMobileDrawerOpen(false)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" data-testid="drawer-brand-link" aria-label="Accueil MARCEL">
            <div className="w-8 h-8 rounded-lg bg-[#352c6e] flex items-center justify-center text-white font-heading font-extrabold text-base">M</div>
            <span className="font-heading text-[#352c6e] text-base font-extrabold tracking-tight">MARCEL</span>
          </Link>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="text-[#a39fb8] hover:text-[#26243a] ml-2 flex-shrink-0"
            data-testid="sidebar-close-btn"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <nav className="flex-1 py-2.5 space-y-0.5 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
        {sections.map((section, si) => (
          <React.Fragment key={section.title}>
            {si > 0 && <div className="mx-3 my-2 border-t border-[#f0eff6]" />}
            <div className={`text-[9.5px] uppercase tracking-widest text-[#a39fb8] px-3 pb-1 font-bold whitespace-nowrap overflow-hidden ${isDrawer ? "block" : "hidden group-hover:block"}`}>
              {section.title}
            </div>
            {section.items.map((item) => (
              <RailItem key={item.to} {...item} isDrawer={isDrawer} />
            ))}
          </React.Fragment>
        ))}
      </nav>

      {/* Footer utilisateur */}
      <div className="pb-2.5 border-t border-[#f0eff6] pt-2 flex-shrink-0">
        <Link to="/account" data-testid="nav-account" title="Mon compte"
          className={`flex items-center gap-2.5 mx-1.5 px-[7px] py-1.5 rounded-lg hover:bg-[#f7f6fb] transition-colors ${isDrawer ? "" : ""}`}>
          <div className="w-[26px] h-[26px] rounded-full bg-[#352c6e] flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-white">
              {user?.name?.slice(0, 2).toUpperCase() || "?"}
            </span>
          </div>
          <div className={`flex-1 min-w-0 ${isDrawer ? "block" : "hidden group-hover:block"}`}>
            <div className="text-[12.5px] text-[#26243a] font-semibold truncate">{user?.name}</div>
            <div className="text-[10px] text-[#a39fb8] truncate" data-testid="sidebar-profile-label">
              {profileLabel}
            </div>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          data-testid="logout-btn"
          className={`rail-item w-[calc(100%-12px)] mt-0.5 text-[#8a87a0] hover:text-rose-600 hover:bg-rose-50 ${isDrawer ? "px-3 py-2" : "px-[9px] py-2"}`}
          title="Déconnexion"
        >
          <span className="flex-shrink-0 flex items-center justify-center w-[22px]"><LogOut size={16} strokeWidth={1.75} /></span>
          <span className={`whitespace-nowrap overflow-hidden ${isDrawer ? "block" : "hidden group-hover:block"}`}>{t("auth.logout", "Déconnexion")}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f7f6fb]">

      {/* ── Barre d'application ───────────────────────────── */}
      <header className="h-[50px] bg-white border-b border-[#e8e6f0] flex items-center px-3 md:px-4 flex-shrink-0 z-30">
        {/* Hamburger — mobile uniquement */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          data-testid="sidebar-open-btn"
          className="mr-3 text-[#5d5a75] hover:text-[#26243a] md:hidden flex-shrink-0"
          aria-label="Ouvrir le menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <Link to="/home" className="flex items-center gap-2.5 flex-shrink-0 mr-4 hover:opacity-80 transition-opacity" data-testid="topbar-brand-link" aria-label="Accueil MARCEL">
          <div className="w-[30px] h-[30px] rounded-lg bg-[#352c6e] flex items-center justify-center text-white font-heading font-extrabold text-[15px]">M</div>
          <span className="font-heading text-[#352c6e] text-[17px] font-extrabold tracking-tight hidden sm:block">MARCEL</span>
        </Link>

        <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#8a87a0] min-w-0 border-l border-[#e8e6f0] pl-4">
          <Building2 size={13} className="flex-shrink-0" />
          <span className="text-[#5d5a75] font-semibold truncate">Groupe Altair Industries</span>
        </div>

        <GlobalSearch />

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleLang}
            data-testid="lang-toggle-btn"
            title={i18n.language?.startsWith("en") ? "Passer en français" : "Switch to English"}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-[#5d5a75] hover:bg-[#f0eefc] transition-colors"
          >
            {i18n.language?.startsWith("en") ? "EN" : "FR"}
          </button>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            data-testid="theme-toggle-btn"
            title={theme === "dark" ? t("theme.light", "Mode clair") : t("theme.dark", "Mode sombre")}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5d5a75] hover:bg-[#f0eefc] transition-colors"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <NotificationBell />
          <span
            className="text-[11px] font-mono-data text-[#5d5a75] bg-[#f0eefc] px-2 py-0.5 rounded-lg hidden md:block"
            data-testid="header-profile-badge"
          >
            {profileLabel}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Overlay mobile ───────────────────────────────── */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileDrawerOpen(false)}
            data-testid="mobile-overlay"
          />
        )}

        {/* ── Drawer mobile (<768px) ───────────────────────── */}
        <aside
          data-testid="sidebar-mobile"
          className={`
            fixed top-0 left-0 h-full z-50 w-72 bg-white border-r border-[#e8e6f0] flex flex-col
            transform transition-transform duration-300 ease-in-out
            ${mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"}
            md:hidden
          `}
        >
          <RailContent isDrawer={true} />
        </aside>

        {/* ── Rail d'icônes desktop (≥768px) — s'étend au survol ── */}
        <div className="hidden md:block relative w-[54px] flex-shrink-0">
          <aside
            data-testid="sidebar"
            className="
              absolute inset-y-0 left-0 z-30 w-[54px] hover:w-[236px]
              bg-white border-r border-[#e8e6f0] flex flex-col
              transition-[width] duration-200 ease-out overflow-hidden group
              hover:shadow-[8px_0_30px_-12px_rgba(53,44,110,0.18)]
            "
          >
            <RailContent isDrawer={false} />
          </aside>
        </div>

        {/* ── Contenu ──────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 pb-28">
          <Outlet />
        </main>
      </div>

      {/* Agent IA PMO — Drawer flottant */}
      <AgentDrawer />
      <OnboardingTour />
    </div>
  );
}
