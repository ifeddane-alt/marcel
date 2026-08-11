import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Briefcase, DollarSign, UsersRound, Users,
  ShieldCheck, Map, TrendingUp, ShieldAlert, Inbox, Clock,
  CalendarClock, AlertTriangle, ClipboardCheck, ArrowRight, History, CalendarDays,
} from "lucide-react";
import { homeAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { getRecentProjects } from "@/utils/recentProjects";

const QUICK_NAV = [
  { to: "/dashboard",  icon: LayoutDashboard, label: "Tableau de bord", desc: "KPIs et vue synthétique",        perm: "dashboard.view" },
  { to: "/portfolio",  icon: Briefcase,       label: "Portefeuille",    desc: "Tous les projets en tuiles",     perm: "portfolio.view" },
  { to: "/programmes", icon: FolderKanban,    label: "Programmes",      desc: "Vues consolidées par programme", perm: "portfolio.view" },
  { to: "/budget",     icon: DollarSign,      label: "Budget",          desc: "CAPEX/OPEX, EAC et RAF",         perm: "budget.view" },
  { to: "/teams",      icon: UsersRound,      label: "Équipes",         desc: "Capacité et charge par équipe",  perm: "teams.view" },
  { to: "/resources",  icon: Users,           label: "Ressources",      desc: "Référentiel et allocations",     perm: ["resources.view", "resources.edit", "resources.create"] },
  { to: "/governance", icon: ShieldCheck,     label: "Gouvernance",     desc: "Décisions, risques, comités",    perm: "governance.view" },
  { to: "/roadmap",    icon: Map,             label: "Roadmap",         desc: "Frise multi-projets et jalons",  perm: "roadmap.view", mod: "roadmap" },
  { to: "/arbitrage",  icon: TrendingUp,      label: "Arbitrage",       desc: "Scoring et scénarios",           perm: ["arbitrage.view", "arbitrage.edit", "arbitrage.simulate"] },
  { to: "/conformite", icon: ShieldAlert,     label: "Conformité",      desc: "Jalons réglementaires",          perm: "compliance.view", mod: "compliance" },
  { to: "/demands",    icon: Inbox,           label: "Demandes",        desc: "Qualification des demandes",     perm: ["demands.view_own", "demands.submit", "demands.qualify"], mod: "demands" },
  { to: "/timesheets", icon: Clock,           label: "Timesheets",      desc: "Saisie et validation des temps", perm: ["timesheets.submit", "timesheets.validate_step2", "timesheets.validate_step3", "timesheets.view_all"], mod: "timesheets" },
];

const RAG_DOT = { green: "#16a34a", orange: "#f59e0b", red: "#dc2626" };

const COMMITTEE_LABELS = { copil: "COPIL", coproj: "COPROJ", comex: "COMEX", codir: "CODIR", steering: "Steering", autre: "Autre" };
const COMMITTEE_COLORS = {
  copil: "bg-blue-50 text-blue-700 border-blue-200",
  coproj: "bg-violet-50 text-violet-700 border-violet-200",
  comex: "bg-rose-50 text-rose-700 border-rose-200",
  codir: "bg-amber-50 text-amber-700 border-amber-200",
  steering: "bg-emerald-50 text-emerald-700 border-emerald-200",
  autre: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

const fmtEuro = (v) => `${Math.round(v).toLocaleString("fr-FR")} €`;

const fmtDate = (iso) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
};

function MilestoneRow({ m, late }) {
  return (
    <Link
      to={m.project_id ? `/projects/${m.project_id}` : "/roadmap"}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#f7f6fb] transition-colors"
      data-testid={`home-milestone-${m.milestone_id}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${late ? "bg-[#dc2626]" : "bg-[#352c6e]"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[#26243a] truncate">{m.name}</div>
        <div className="text-[11px] text-[#8a87a0] truncate">
          {m.project_code ? `${m.project_code} · ` : ""}{m.project_name}
        </div>
      </div>
      <span className={`font-mono text-[11.5px] font-semibold flex-shrink-0 ${late ? "text-[#dc2626]" : "text-[#5d5a75]"}`}>
        {fmtDate(m.date)}
      </span>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { canAccessNav, hasAnyPermission } = usePermissions();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    homeAPI.summary().then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  const firstName = summary?.first_name || (user?.name || "").split(" ")[0] || "";
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const recent = getRecentProjects(user?.user_id).slice(0, 5);
  const tiles = QUICK_NAV.filter(({ perm, mod }) => canAccessNav(perm, mod));
  const ctx = summary?.context;
  const ms = summary?.milestones;
  const canValidate = hasAnyPermission("timesheets.validate_step2", "timesheets.validate_step3", "timesheets.view_all");
  const canSubmitTs = hasAnyPermission("timesheets.submit");

  return (
    <div className="space-y-7" data-testid="home-page">
      {/* ── En-tête ── */}
      <div>
        <div className="text-[12px] text-[#8a87a0] font-semibold capitalize" data-testid="home-date">{dateStr}</div>
        <h1 className="font-heading text-[26px] font-extrabold text-[#26243a] tracking-tight mt-0.5" data-testid="home-greeting">
          Bonjour {firstName}
        </h1>
        {ctx && (
          <p className="text-[13.5px] text-[#5d5a75] mt-1" data-testid="home-context">
            <span className="font-semibold text-[#352c6e]">{ctx.active_projects}</span> projet{ctx.active_projects > 1 ? "s" : ""} actif{ctx.active_projects > 1 ? "s" : ""}
            {" · "}
            <span className={`font-semibold ${ctx.red_projects > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{ctx.red_projects}</span> en alerte
            {" · "}
            <span className="font-semibold text-[#352c6e]">{ctx.programs}</span> programme{ctx.programs > 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* ── Accès rapides ── */}
      <div>
        <h2 className="font-heading text-[13px] font-bold text-[#8a87a0] uppercase tracking-wider mb-3">Accès rapides</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tiles.map(({ to, icon: Icon, label, desc }) => (
            <Link
              key={to}
              to={to}
              className="group bg-white border border-[#e8e6f0] rounded-xl p-4 hover:border-[#352c6e] hover:shadow-md transition-all"
              data-testid={`home-quicknav-${to.replace("/", "")}`}
            >
              <div className="w-9 h-9 rounded-lg bg-[#f0eff8] group-hover:bg-[#352c6e] flex items-center justify-center transition-colors">
                <Icon size={17} className="text-[#352c6e] group-hover:text-white transition-colors" />
              </div>
              <div className="font-heading text-[13.5px] font-bold text-[#26243a] mt-2.5">{label}</div>
              <div className="text-[11.5px] text-[#8a87a0] mt-0.5 leading-snug">{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Actions en attente + projets récents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Mes actions en attente */}
        <div className="bg-white border border-[#e8e6f0] rounded-xl p-5" data-testid="home-actions">
          <h2 className="font-heading text-[15px] font-extrabold text-[#26243a] mb-4">Mes actions en attente</h2>
          <div className="space-y-3">
            {(summary?.envelope_overruns || []).length > 0 && (
              <div className="border border-[#fecaca] bg-[#fef2f2] rounded-lg p-3" data-testid="home-overrun-alerts">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle size={13} className="text-[#dc2626]" />
                  <span className="text-[12px] font-bold text-[#dc2626]">
                    Dépassement d'enveloppe — plan pluriannuel
                  </span>
                </div>
                <div className="space-y-1">
                  {summary.envelope_overruns.map((o) => (
                    <Link key={o.year} to="/budget"
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/70 transition-colors"
                      data-testid={`home-overrun-${o.year}`}>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[#26243a]">Exercice {o.year}</div>
                        <div className="text-[11px] text-[#8a87a0]">
                          {fmtEuro(o.planned)} planifiés / enveloppe {fmtEuro(o.envelope)}
                        </div>
                      </div>
                      <span className="font-mono text-[11.5px] font-bold text-[#dc2626] flex-shrink-0">
                        +{fmtEuro(o.overrun)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {summary?.timesheet && canSubmitTs && (
              <Link
                to="/timesheets"
                className="flex items-center gap-3 p-3 rounded-lg border border-[#e8e6f0] hover:border-[#352c6e] transition-colors"
                data-testid="home-timesheet-card"
              >
                <div className="w-8 h-8 rounded-lg bg-[#eef4ff] flex items-center justify-center flex-shrink-0">
                  <Clock size={15} className="text-[#2563eb]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#26243a]">Ma feuille de temps</div>
                  <div className="text-[11.5px] text-[#8a87a0]">
                    Semaine du {fmtDate(summary.timesheet.week_start)} — <span className="font-mono font-semibold">{summary.timesheet.jh_entered}</span> JH saisis
                  </div>
                </div>
                {summary.timesheet.jh_entered === 0 && (
                  <span className="text-[10.5px] font-bold text-[#b45309] bg-[#fef3c7] rounded-full px-2 py-0.5 flex-shrink-0">À saisir</span>
                )}
                <ArrowRight size={14} className="text-[#a39fb8] flex-shrink-0" />
              </Link>
            )}

            {canValidate && summary?.pending_validations > 0 && (
              <Link
                to="/timesheets"
                className="flex items-center gap-3 p-3 rounded-lg border border-[#e8e6f0] hover:border-[#352c6e] transition-colors"
                data-testid="home-validations-card"
              >
                <div className="w-8 h-8 rounded-lg bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
                  <ClipboardCheck size={15} className="text-[#b45309]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#26243a]">Timesheets à valider</div>
                  <div className="text-[11.5px] text-[#8a87a0]">
                    <span className="font-mono font-semibold">{summary.pending_validations}</span> en attente de votre validation
                  </div>
                </div>
                <ArrowRight size={14} className="text-[#a39fb8] flex-shrink-0" />
              </Link>
            )}

            {ms && ms.late_count > 0 && (
              <div className="border border-[#fde3e3] bg-[#fef7f7] rounded-lg p-3" data-testid="home-milestones-late">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle size={13} className="text-[#dc2626]" />
                  <span className="text-[12px] font-bold text-[#dc2626]">
                    {ms.late_count} jalon{ms.late_count > 1 ? "s" : ""} en retard
                  </span>
                </div>
                <div className="-mx-1">
                  {ms.late.map((m) => <MilestoneRow key={m.milestone_id} m={m} late />)}
                </div>
              </div>
            )}

            {ms && ms.upcoming_count > 0 && (
              <div className="border border-[#e8e6f0] rounded-lg p-3" data-testid="home-milestones-upcoming">
                <div className="flex items-center gap-2 mb-1.5">
                  <CalendarClock size={13} className="text-[#352c6e]" />
                  <span className="text-[12px] font-bold text-[#352c6e]">
                    {ms.upcoming_count} jalon{ms.upcoming_count > 1 ? "s" : ""} dans les 21 jours
                  </span>
                </div>
                <div className="-mx-1">
                  {ms.upcoming.map((m) => <MilestoneRow key={m.milestone_id} m={m} />)}
                </div>
              </div>
            )}

            {summary && !summary.timesheet && summary.pending_validations === 0 && ms?.late_count === 0 && ms?.upcoming_count === 0 && (summary.envelope_overruns || []).length === 0 && (
              <p className="text-[13px] text-[#8a87a0]" data-testid="home-actions-empty">Rien en attente — tout est à jour.</p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* Comités à venir */}
          {summary?.committees !== null && summary?.committees !== undefined && (
            <div className="bg-white border border-[#e8e6f0] rounded-xl p-5" data-testid="home-committees">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarDays size={15} className="text-[#8a87a0]" />
                  <h2 className="font-heading text-[15px] font-extrabold text-[#26243a]">Comités à venir</h2>
                </div>
                <Link to="/governance" className="text-[11.5px] font-semibold text-[#352c6e] hover:underline flex-shrink-0" data-testid="home-committees-link">
                  Gouvernance →
                </Link>
              </div>
              {summary.committees.length === 0 ? (
                <div className="text-[13px] text-[#8a87a0]" data-testid="home-committees-empty">
                  Aucun comité planifié.{" "}
                  <Link to="/governance" className="text-[#352c6e] font-semibold hover:underline">Planifier une instance →</Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {summary.committees.map((c) => (
                    <Link key={c.governance_id} to="/governance"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f7f6fb] transition-colors"
                      data-testid={`home-committee-${c.governance_id}`}>
                      <span className={`text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-full border flex-shrink-0 ${COMMITTEE_COLORS[c.type] || COMMITTEE_COLORS.autre}`}>
                        {COMMITTEE_LABELS[c.type] || c.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-[#26243a] truncate">{c.name}</div>
                      </div>
                      <span className="font-mono text-[11.5px] font-semibold text-[#5d5a75] flex-shrink-0">
                        {fmtDate((c.date_scheduled || "").slice(0, 10))}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Derniers projets consultés */}
          <div className="bg-white border border-[#e8e6f0] rounded-xl p-5" data-testid="home-recent-projects">
          <div className="flex items-center gap-2 mb-4">
            <History size={15} className="text-[#8a87a0]" />
            <h2 className="font-heading text-[15px] font-extrabold text-[#26243a]">Derniers projets consultés</h2>
          </div>
          {recent.length === 0 ? (
            <div className="text-[13px] text-[#8a87a0]" data-testid="home-recent-empty">
              Aucun projet consulté récemment.{" "}
              <Link to="/portfolio" className="text-[#352c6e] font-semibold hover:underline">Ouvrir le portefeuille →</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recent.map((p) => (
                <Link
                  key={p.project_id}
                  to={`/projects/${p.project_id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f7f6fb] transition-colors"
                  data-testid={`home-recent-item-${p.project_id}`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: RAG_DOT[p.status_rag] || "#a39fb8" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-[#26243a] truncate">{p.name}</div>
                    {p.code && <div className="font-mono text-[10.5px] text-[#8a87a0]">{p.code}</div>}
                  </div>
                  <ArrowRight size={14} className="text-[#a39fb8] flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
