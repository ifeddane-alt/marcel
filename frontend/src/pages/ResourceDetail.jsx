import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, ChevronDown, User, Building2, FileText } from "lucide-react";
import { resourcesAPI, allocationsAPI, projectsAPI } from "@/api";

const TYPE_CONFIG = {
  interne:         { label: "INTERNE", Icon: User,      bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  externe_regie:   { label: "RÉGIE",   Icon: Building2, bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  externe_forfait: { label: "FORFAIT", Icon: FileText,  bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
};

const fmtMonth = (m) =>
  m ? new Date(`${m.slice(0, 7)}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—";

function Donut({ pct, color, children }) {
  const p = Math.min(Math.max(pct || 0, 0), 100);
  return (
    <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: `conic-gradient(${color} 0 ${p}%, #ece9f4 ${p}%)` }}>
      <div className="w-[40px] h-[40px] rounded-full bg-white flex items-center justify-center font-heading text-[11.5px] font-extrabold text-[#26243a]">
        {children}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, donut }) {
  return (
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4 flex items-center gap-3.5">
      {donut}
      <div className="min-w-0">
        <div className="text-[10.5px] font-bold text-[#8a87a0] uppercase tracking-wide truncate">{label}</div>
        <div className="font-heading text-[24px] font-extrabold text-[#26243a] leading-tight truncate">{value}</div>
        {sub && <div className="text-[11px] text-[#8a87a0] truncate">{sub}</div>}
      </div>
    </div>
  );
}

export default function ResourceDetail() {
  const { resourceId } = useParams();
  const [resource, setResource] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    Promise.all([resourcesAPI.list(), allocationsAPI.list(), projectsAPI.list()])
      .then(([rRes, aRes, pRes]) => {
        setResource(rRes.data.find((r) => r.resource_id === resourceId) || null);
        setAllocations(aRes.data.filter((a) => a.resource_id === resourceId));
        setProjects(pRes.data);
      })
      .finally(() => setLoading(false));
  }, [resourceId]);

  const byProject = useMemo(() => {
    const map = new Map();
    for (const a of allocations) {
      if (!map.has(a.project_id)) map.set(a.project_id, []);
      map.get(a.project_id).push(a);
    }
    return [...map.entries()]
      .map(([pid, rows]) => {
        const project = projects.find((p) => p.project_id === pid);
        rows.sort((x, y) => (x.period_month || "").localeCompare(y.period_month || ""));
        return {
          projectId: pid,
          project,
          rows,
          allocated: rows.reduce((s, a) => s + (a.jh_allocated || 0), 0),
          consumed: rows.reduce((s, a) => s + (a.jh_consumed || 0), 0),
          from: rows[0]?.period_month,
          to: rows[rows.length - 1]?.period_month,
        };
      })
      .sort((a, b) => b.allocated - a.allocated);
  }, [allocations, projects]);

  if (loading) return <div className="p-8 text-zinc-400 text-sm">Chargement de la ressource...</div>;
  if (!resource) {
    return (
      <div className="p-8">
        <div className="text-sm text-zinc-500">Ressource introuvable.</div>
        <Link to="/resources" className="text-sm text-[#2e5fe8] font-semibold hover:underline mt-2 inline-block">← Retour aux ressources</Link>
      </div>
    );
  }

  const cfg = TYPE_CONFIG[resource.resource_type || "interne"];
  const availRate = resource.availability_rate != null ? resource.availability_rate : 100;
  const capaEffective = Math.round((resource.capacity_jh_month || 0) * availRate / 100);
  const totalAllocated = allocations.reduce((s, a) => s + (a.jh_allocated || 0), 0);
  const totalConsumed = allocations.reduce((s, a) => s + (a.jh_consumed || 0), 0);
  const months = new Set(allocations.map((a) => a.period_month).filter(Boolean)).size;
  const chargeRate = capaEffective && months ? Math.round((totalAllocated / (capaEffective * months)) * 100) : 0;
  const initials = resource.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const toggle = (pid) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="resource-detail-page">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1.5 text-xs text-[#8a87a0] mb-4">
        <span>Accueil</span>
        <span>/</span>
        <Link to="/resources" className="hover:text-[#2e5fe8]">
          Ressources
        </Link>
        <span>/</span>
        <span className="text-[#352c6e] font-semibold">{resource.name}</span>
      </nav>

      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl bg-[#352c6e] flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-white font-heading">{initials}</span>
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl sm:text-[28px] font-extrabold text-[#26243a] leading-tight flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="resource-detail-name">
            {resource.name}
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <cfg.Icon size={10} />
              {cfg.label}
            </span>
          </h1>
          <div className="text-sm text-[#5d5a75] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold">{resource.role}</span>
            {resource.team && <span className="text-xs bg-[#f0eefc] text-[#3d3564] px-2 py-0.5 rounded-lg border border-[#e7e3f2]">{resource.team}</span>}
            {resource.tjm_eur != null && <span className="font-mono-data text-xs">TJM {resource.tjm_eur.toLocaleString("fr-FR")} €</span>}
            <span className="text-xs text-[#8a87a0]">Disponibilité {availRate}%</span>
            {resource.entry_date && (
              <span className="text-xs text-[#8a87a0]" data-testid="resource-entry-date">
                Entrée le <b className="font-mono-data text-[#5d5a75]">{new Date(resource.entry_date).toLocaleDateString("fr-FR")}</b>
              </span>
            )}
            {resource.contract_ref && (
              <span className="font-mono-data text-[10.5px] font-semibold text-[#3d3564] bg-[#f0eefc] border border-[#e7e3f2] px-1.5 py-px rounded" data-testid="resource-contract-ref">
                {resource.contract_ref}
              </span>
            )}
            {resource.contract_end && (() => {
              const days = Math.ceil((new Date(resource.contract_end) - Date.now()) / 86400000);
              const d = new Date(resource.contract_end).toLocaleDateString("fr-FR");
              return days < 0 ? (
                <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200" data-testid="resource-contract-expiry">Contrat expiré · {d}</span>
              ) : days <= 60 ? (
                <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200" data-testid="resource-contract-expiry">Contrat jusqu'au {d} · J-{days}</span>
              ) : (
                <span className="text-xs text-[#8a87a0]" data-testid="resource-contract-expiry">Contrat jusqu'au <b className="font-mono-data text-[#5d5a75]">{d}</b></span>
              );
            })()}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="Capacité effective" value={`${capaEffective} JH`} sub="par mois"
          donut={<Donut pct={availRate} color="#2e5fe8">{availRate}%</Donut>} />
        <Kpi label="JH alloués" value={`${totalAllocated} JH`} sub={`sur ${months} mois`}
          donut={<Donut pct={totalAllocated ? Math.round((totalConsumed / totalAllocated) * 100) : 0} color="#3f8a34">{totalAllocated ? Math.round((totalConsumed / totalAllocated) * 100) : 0}%</Donut>} />
        <Kpi label="Taux de charge" value={`${chargeRate}%`} sub="alloué / capacité"
          donut={<Donut pct={chargeRate} color={chargeRate > 90 ? "#cc4f45" : "#e0a800"}>{chargeRate}%</Donut>} />
        <Kpi label="Projets" value={byProject.length} sub="avec allocation"
          donut={<Donut pct={100} color="#6d28d9">{byProject.length}</Donut>} />
      </div>

      {/* Frise de charge mensuelle */}
      {(() => {
        const byMonth = new Map();
        for (const a of allocations) {
          const m = (a.period_month || "").slice(0, 7);
          if (!m) continue;
          byMonth.set(m, (byMonth.get(m) || 0) + (a.jh_allocated || 0));
        }
        const monthly = [...byMonth.entries()]
          .sort((x, y) => x[0].localeCompare(y[0]))
          .map(([month, jh]) => ({ month, jh, pct: capaEffective ? Math.round((jh / capaEffective) * 100) : 0 }));
        const SCALE = Math.max(130, ...monthly.map((m) => m.pct));
        const colorOf = (pct) => (pct > 90 ? "#cc4f45" : pct >= 70 ? "#e0a800" : "#3f8a34");
        return (
          <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] mb-6 overflow-hidden" data-testid="resource-load-timeline">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-[#f0eff6]">
              <span className="font-heading text-[13px] font-bold text-[#26243a]">Charge mensuelle</span>
              <div className="flex items-center gap-3 text-[10.5px] font-semibold text-[#8a87a0]">
                <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "#3f8a34" }} /> &lt; 70%</span>
                <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "#e0a800" }} /> 70–90%</span>
                <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "#cc4f45" }} /> &gt; 90% / surcharge</span>
                <span className="text-[#a39fb8]">Capacité effective : {capaEffective} JH/mois</span>
              </div>
            </div>
            {monthly.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-400">Aucune allocation mensuelle.</div>
            ) : (
              <div className="flex items-end gap-4 px-5 pt-4 pb-3 overflow-x-auto">
                {monthly.map((m) => (
                  <div key={m.month} className="flex flex-col items-center gap-1 min-w-[54px]" data-testid={`load-month-${m.month}`}>
                    <span className="text-[10.5px] font-extrabold font-heading" style={{ color: colorOf(m.pct) }}>
                      {m.pct}%{m.pct > 100 && " ⚠"}
                    </span>
                    <div className="relative h-24 w-9 bg-[#f0eefc] rounded-md overflow-hidden flex items-end">
                      <div
                        className="absolute left-0 right-0 border-t border-dashed border-[#a39fb8] z-10"
                        style={{ bottom: `${(100 / SCALE) * 100}%` }}
                        title={`Capacité : ${capaEffective} JH`}
                      />
                      <div className="w-full rounded-t-sm transition-all" style={{ height: `${(m.pct / SCALE) * 100}%`, background: colorOf(m.pct) }} />
                    </div>
                    <span className="font-mono-data text-[10px] font-semibold text-[#26243a]">{m.jh} JH</span>
                    <span className="text-[9.5px] text-[#8a87a0] capitalize whitespace-nowrap">{fmtMonth(m.month)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Allocations par projet */}
      <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-hidden" data-testid="resource-allocations-section">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0eff6]">
          <span className="font-heading text-[13px] font-bold text-[#26243a]">Allocations par projet ({byProject.length})</span>
        </div>
        {byProject.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-400">Aucune allocation pour cette ressource.</div>
        ) : (
          <table className="w-full text-sm" data-testid="resource-allocations-table">
            <thead>
              <tr className="bg-[#fbfaff] border-b border-[#e8e6f0] text-left">
                {["", "Projet", "Période", "Mois", "JH alloués", "JH consommés", "Consommation"].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-[10.5px] uppercase tracking-wider font-bold text-[#8a87a0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byProject.map((g) => {
                const consumedRate = g.allocated ? Math.round((g.consumed / g.allocated) * 100) : 0;
                const isOpen = expanded.has(g.projectId);
                return (
                  <React.Fragment key={g.projectId}>
                    <tr
                      className="border-b border-[#f0eff6] hover:bg-[#fbfaff] transition-colors cursor-pointer"
                      onClick={() => toggle(g.projectId)}
                      data-testid={`resource-alloc-project-${g.projectId}`}
                    >
                      <td className="pl-4 py-3 w-6 text-[#8a87a0]">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {g.project?.code && (
                            <span className="font-mono-data text-[10.5px] font-semibold text-[#3d3564] bg-[#f0eefc] border border-[#e7e3f2] px-1.5 py-px rounded flex-shrink-0">
                              {g.project.code}
                            </span>
                          )}
                          {g.project ? (
                            <Link
                              to={`/projects/${g.projectId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-[#26243a] hover:text-[#2e5fe8] hover:underline truncate"
                              data-testid={`resource-alloc-link-${g.projectId}`}
                            >
                              {g.project.name}
                            </Link>
                          ) : (
                            <span className="text-zinc-400">Projet supprimé</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5d5a75] whitespace-nowrap">
                        {fmtMonth(g.from)} → {fmtMonth(g.to)}
                      </td>
                      <td className="px-4 py-3 font-mono-data text-xs text-[#5d5a75]">{g.rows.length}</td>
                      <td className="px-4 py-3 font-mono-data text-sm font-bold text-[#26243a]">{g.allocated} JH</td>
                      <td className="px-4 py-3 font-mono-data text-sm text-[#5d5a75]">{g.consumed} JH</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 bg-[#ece9f4] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${consumedRate > 100 ? "bg-rose-500" : "bg-[#2e5fe8]"}`} style={{ width: `${Math.min(consumedRate, 100)}%` }} />
                          </div>
                          <span className="font-mono-data text-xs font-semibold text-[#5d5a75]">{consumedRate}%</span>
                        </div>
                      </td>
                    </tr>
                    {isOpen && g.rows.map((a) => (
                      <tr key={a.allocation_id} className="border-b border-[#f0eff6] bg-[#fbfaff]/60" data-testid={`resource-alloc-month-${a.allocation_id}`}>
                        <td />
                        <td className="px-4 py-2 pl-10 text-xs text-[#8a87a0]">Détail mensuel</td>
                        <td className="px-4 py-2 text-xs text-[#5d5a75] capitalize">{fmtMonth(a.period_month)}</td>
                        <td className="px-4 py-2 font-mono-data text-xs text-[#8a87a0]">{a.allocation_rate != null ? `${a.allocation_rate}%` : "—"}</td>
                        <td className="px-4 py-2 font-mono-data text-xs text-[#26243a]">{a.jh_allocated} JH</td>
                        <td className="px-4 py-2 font-mono-data text-xs text-[#5d5a75]">{a.jh_consumed ?? 0} JH</td>
                        <td />
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
