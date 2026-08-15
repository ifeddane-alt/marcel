import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Users, TrendingUp, Briefcase, ChevronRight,
  UserCircle, AlertTriangle, CheckCircle, Clock,
} from "lucide-react";
import { teamsAPI } from "@/api";
import RAGBadge from "@/components/RAGBadge";
import KpiTile from "@/components/KpiTile";

// ── Utility helpers ──────────────────────────────────────────
function utilBadge(pct) {
  if (pct > 85) return "bg-rose-100 text-rose-700 border-rose-200";
  if (pct > 70) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}
function utilBarColor(pct) {
  if (pct > 85) return "#cc4f45";
  if (pct > 70) return "#e0a800";
  return "#3f8a34";
}
function fmtK(v) {
  if (!v) return "—";
  return `${Math.round(v / 1000).toLocaleString("fr-FR")} K€`;
}
function fmtJH(v) {
  if (!v) return "0";
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}
const PHASE_LABELS = {
  analyse: "Analyse", conception: "Conception", implementation: "Implémentation",
  review: "Review", test: "Test", hypercare: "Hypercare",
};

const TH = ({ children, right }) => (
  <th className={`px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-m-muted bg-m-bg border-b border-m-border whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
    {children}
  </th>
);
const TD = ({ children, right, mono, dim, bold }) => (
  <td className={`px-3 py-2.5 text-xs border-b border-zinc-50 ${right ? "text-right" : ""} ${mono ? "font-mono-data tabular-nums" : ""} ${dim ? "text-zinc-400" : "text-zinc-700"} ${bold ? "font-semibold" : ""}`}>
    {children}
  </td>
);

// ── Component ────────────────────────────────────────────────
export default function TeamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusMonth = searchParams.get("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openProjects, setOpenProjects] = useState({});

  useEffect(() => {
    teamsAPI.get(id)
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => { setError("Équipe introuvable"); setLoading(false); });
  }, [id]);

  if (loading) return <div className="p-8 text-zinc-400 text-sm">Chargement de l'équipe...</div>;
  if (error)   return <div className="p-8 text-rose-600 text-sm">{error}</div>;

  const { team, members, project_allocations, monthly_load } = data;

  const toggleProject = (pid) =>
    setOpenProjects((s) => ({ ...s, [pid]: !(s[pid] !== false) }));

  const grandTotal = project_allocations.reduce(
    (acc, p) => {
      acc.planned_md       += p.total.planned_md;
      acc.consumed_md      += p.total.consumed_md;
      acc.raf_md           += p.total.raf_md;
      acc.consumed_cost_eur+= p.total.consumed_cost_eur;
      acc.raf_cost_eur     += p.total.raf_cost_eur;
      return acc;
    },
    { planned_md: 0, consumed_md: 0, raf_md: 0, consumed_cost_eur: 0, raf_cost_eur: 0 }
  );

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="team-detail-page">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-m-muted mb-4">
        <span>Accueil</span>
        <span>/</span>
        <Link to="/teams" className="hover:text-m-blue">Équipes</Link>
        <span>/</span>
        <span className="text-m-primary font-semibold">{team.name}</span>
      </nav>

      {/* ── 1. EN-TÊTE ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 mb-6" data-testid="team-header">
        <div className="w-14 h-14 rounded-xl bg-m-primary flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-white font-heading">
            {team.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl sm:text-[28px] font-extrabold text-m-ink leading-tight" data-testid="team-name">
            {team.name}
          </h1>
          <div className="text-sm text-m-ink-soft mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {team.manager_name && (
              <span className="flex items-center gap-1">
                <UserCircle size={12} /> Manager : <b>{team.manager_name}</b>
              </span>
            )}
            {team.train_id && <span className="text-xs text-m-muted">Train SAFe : {team.train_id}</span>}
          </div>
        </div>
      </div>

      {/* KPI tuiles */}
      {(() => {
        const curUtil = Math.round(monthly_load?.[1]?.utilization_pct || 0);
        const utilColor = curUtil > 85 ? "#cc4f45" : curUtil > 70 ? "#e0a800" : "#3f8a34";
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6" data-testid="team-kpi-tiles">
            <KpiTile testId="team-kpi-members" label="Membres" value={team.member_count} sub="dans l'équipe" />
            <KpiTile testId="team-kpi-capacity" label="Capacité totale" value={`${team.total_capacity_jhm} JH`} sub="par mois (effective)" />
            <KpiTile testId="team-kpi-projects" label="Projets actifs" value={project_allocations.length} sub="avec affectation" />
            <KpiTile
              testId="team-kpi-utilization"
              label="Utilisation"
              value={`${curUtil}%`}
              sub="mois en cours"
              pct={curUtil}
              ringColor={utilColor}
              ringLabel="Utilisation"
              ringCaption="mois"
              valueClass={curUtil > 85 ? "text-m-red" : "text-m-ink"}
            />
          </div>
        );
      })()}

      {/* ── 2. MEMBRES ─────────────────────────────────────── */}
      <section className="mb-6" data-testid="members-section">
        <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2">
            <Users size={14} className="text-m-blue" />
            <span className="font-heading text-[13px] font-bold text-m-ink">
              Membres de l'équipe
            </span>
            <span className="ml-1 bg-m-blue/10 text-m-blue text-[10px] font-bold rounded-full px-2 py-0.5">
              {members.length}
            </span>
          </div>
          {members.length === 0 ? (
            <div className="px-5 py-8 text-sm text-zinc-400 text-center">Aucun membre dans cette équipe</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <TH>Nom</TH>
                    <TH>Rôle</TH>
                    <TH right>TJM €</TH>
                    <TH right>Dispo %</TH>
                    <TH right>Capa eff. JH/mois</TH>
                    <TH right>Charge mois en cours</TH>
                    <TH right>Taux util. %</TH>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.resource_id} className="hover:bg-blue-50/20 transition-colors" data-testid={`member-row-${m.resource_id}`}>
                      <TD>
                        <Link
                          to={`/resources/${m.resource_id}`}
                          className="font-semibold text-zinc-800 hover:text-m-blue transition-colors"
                          title="Voir fiche ressource"
                          data-testid={`member-link-${m.resource_id}`}
                        >
                          {m.name}
                        </Link>
                      </TD>
                      <TD dim>{m.role || "—"}</TD>
                      <TD right mono>{m.tjm_eur ? `${m.tjm_eur.toLocaleString("fr-FR")} €` : "—"}</TD>
                      <TD right mono>{m.availability_rate}%</TD>
                      <TD right mono bold>{fmtJH(m.capacity_jhm)}</TD>
                      <TD right mono>{fmtJH(m.current_month_jh)}</TD>
                      <TD right>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${utilBadge(m.utilization_pct)}`}
                          data-testid={`util-badge-${m.resource_id}`}
                        >
                          {m.utilization_pct > 85 ? <AlertTriangle size={9} /> : m.utilization_pct > 70 ? <Clock size={9} /> : <CheckCircle size={9} />}
                          {m.utilization_pct}%
                        </span>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── 3. AFFECTATIONS PAR PROJET ─────────────────────── */}
      <section className="mb-6" data-testid="project-allocations-section">
        <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2">
            <Briefcase size={14} className="text-m-blue" />
            <span className="font-heading text-[13px] font-bold text-m-ink">
              Affectations par projet
            </span>
            <span className="ml-1 bg-m-blue/10 text-m-blue text-[10px] font-bold rounded-full px-2 py-0.5">
              {project_allocations.length}
            </span>
          </div>

          {project_allocations.length === 0 ? (
            <div className="px-5 py-8 text-sm text-zinc-400 text-center">Aucune affectation enregistrée</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <TH>Projet / Phase</TH>
                    <TH>RAG</TH>
                    <TH right>JH prévus</TH>
                    <TH right>JH consommés</TH>
                    <TH right>RAF JH</TH>
                    <TH right>Coût consommé</TH>
                    <TH right>RAF €</TH>
                  </tr>
                </thead>
                <tbody>
                  {project_allocations.map((p) => {
                    const isOpen = openProjects[p.project_id] !== false; // open by default
                    return (
                      <React.Fragment key={p.project_id}>
                        {/* Project row */}
                        <tr
                          className="bg-zinc-50 cursor-pointer hover:bg-zinc-100 transition-colors"
                          onClick={() => toggleProject(p.project_id)}
                          data-testid={`project-alloc-row-${p.project_id}`}
                        >
                          <TD bold>
                            <div className="flex items-center gap-1.5">
                              <ChevronRight
                                size={12}
                                className={`text-zinc-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}
                              />
                              <Link
                                to={`/projects/${p.project_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-m-blue transition-colors font-semibold text-zinc-800 truncate max-w-[260px]"
                              >
                                {p.project_name}
                              </Link>
                            </div>
                          </TD>
                          <TD><RAGBadge status={p.status_rag} /></TD>
                          <TD right mono bold>{fmtJH(p.total.planned_md)}</TD>
                          <TD right mono bold>{fmtJH(p.total.consumed_md)}</TD>
                          <TD right mono bold>{fmtJH(p.total.raf_md)}</TD>
                          <TD right mono bold>{fmtK(p.total.consumed_cost_eur)}</TD>
                          <TD right mono bold>{fmtK(p.total.raf_cost_eur)}</TD>
                        </tr>
                        {/* Phase sub-rows */}
                        {isOpen && p.phases.map((ph) => (
                          <tr key={ph.phase} className="hover:bg-blue-50/10" data-testid={`phase-row-${p.project_id}-${ph.phase}`}>
                            <TD>
                              <span className="ml-7 text-zinc-500 text-[11px]">
                                {PHASE_LABELS[ph.phase] || ph.phase}
                              </span>
                            </TD>
                            <TD dim>—</TD>
                            <TD right mono dim>{fmtJH(ph.planned_md)}</TD>
                            <TD right mono dim>{fmtJH(ph.consumed_md)}</TD>
                            <TD right mono dim>{fmtJH(ph.raf_md)}</TD>
                            <TD right mono dim>{fmtK(ph.consumed_cost_eur)}</TD>
                            <TD right mono dim>{fmtK(ph.raf_cost_eur)}</TD>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}

                  {/* Grand total row */}
                  <tr className="bg-blue-50 border-t-2 border-m-blue/20" data-testid="grand-total-row">
                    <TD bold><span className="text-m-blue font-bold uppercase text-[10px] tracking-widest ml-2">Total équipe</span></TD>
                    <TD>—</TD>
                    <TD right mono bold>{fmtJH(grandTotal.planned_md)}</TD>
                    <TD right mono bold>{fmtJH(grandTotal.consumed_md)}</TD>
                    <TD right mono bold>{fmtJH(grandTotal.raf_md)}</TD>
                    <TD right mono bold><span className="text-m-blue">{fmtK(grandTotal.consumed_cost_eur)}</span></TD>
                    <TD right mono bold><span className="text-m-blue">{fmtK(grandTotal.raf_cost_eur)}</span></TD>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. CHARGE MENSUELLE ─────────────────────────────── */}
      <section data-testid="monthly-load-section">
        <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2">
            <TrendingUp size={14} className="text-m-blue" />
            <span className="font-heading text-[13px] font-bold text-m-ink">
              Charge mensuelle — 6 mois glissants
            </span>
          </div>
          <div className="p-5">
            {team.total_capacity_jhm === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-4">Aucune capacité définie pour cette équipe</p>
            ) : (
              <div className="flex items-end gap-3" data-testid="monthly-chart">
                {monthly_load.map((m, i) => {
                  const fillPct = Math.min(m.utilization_pct, 120);
                  const color   = utilBarColor(m.utilization_pct);
                  const isNow   = i === 1; // index 1 = mois courant (car on commence -1 mois)
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5" data-testid={`month-bar-${m.month}`}>
                      {/* Percent label */}
                      <span className={`text-[11px] font-bold ${isNow ? "text-zinc-800" : "text-zinc-400"}`}>
                        {m.utilization_pct > 0 ? `${m.utilization_pct}%` : "—"}
                      </span>
                      {/* Bar */}
                      <div className="w-full rounded-t overflow-hidden bg-zinc-100 relative" style={{ height: 80 }}>
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-500"
                          style={{
                            height: `${fillPct}%`,
                            backgroundColor: color,
                            opacity: isNow ? 1 : 0.65,
                          }}
                        />
                        {/* 85% marker */}
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-zinc-400/50 pointer-events-none"
                          style={{ bottom: "70.8%" }}
                          title="Seuil 85%"
                        />
                      </div>
                      {/* Labels */}
                      <div className="text-center">
                        <div className={`text-[10px] font-semibold uppercase ${isNow ? "text-m-blue" : "text-zinc-500"}`}>
                          {new Date(m.month + "-01").toLocaleDateString("fr-FR", { month: "short" })}
                        </div>
                        <div className="text-[9px] text-zinc-400">{m.allocated_jh > 0 ? `${m.allocated_jh} JH` : "0 JH"}</div>
                      </div>
                      {isNow && (
                        <div className="text-[9px] text-m-blue font-bold bg-blue-50 rounded-lg px-1" data-testid={`month-focus-${m.month}`}>
                          {focusMonth ? "Mois sélectionné" : "Mois en cours"}
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Legend */}
                <div className="flex flex-col gap-1.5 pl-4 border-l border-zinc-100 ml-2 flex-shrink-0">
                  <div className="text-[9px] text-zinc-400 uppercase tracking-widest font-semibold mb-1">Légende</div>
                  {[
                    { color: "#3f8a34", label: "< 70%" },
                    { color: "#e0a800", label: "70–85%" },
                    { color: "#cc4f45", label: "> 85%" },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[10px] text-zinc-500">{label}</span>
                    </div>
                  ))}
                  <div className="mt-2 text-[9px] text-zinc-400 border-t border-dashed border-zinc-300 pt-1.5">
                    Capa. : {team.total_capacity_jhm} JH/mois
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
