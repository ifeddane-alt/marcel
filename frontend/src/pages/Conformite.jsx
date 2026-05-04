import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert, Download, Filter, RefreshCw, AlertTriangle,
  CheckCircle, Clock, TrendingDown, ChevronUp, ChevronDown,
} from "lucide-react";
import { milestonesAPI, projectsAPI, programsAPI } from "@/api";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const COLOR_CFG = {
  red:     { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-200",    label: "≤ 30j" },
  orange:  { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   label: "31-90j" },
  green:   { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", label: "> 90j" },
  overdue: { bg: "bg-gray-100",    text: "text-gray-400 line-through", border: "border-gray-200", label: "Retard" },
  done:    { bg: "bg-slate-50",    text: "text-slate-400",   border: "border-slate-200",   label: "Terminé" },
  grey:    { bg: "bg-gray-50",     text: "text-gray-400",    border: "border-gray-200",    label: "—" },
};

function DaysChip({ days, color }) {
  const cfg = COLOR_CFG[color] ?? COLOR_CFG.grey;
  const label = color === "overdue"
    ? `${Math.abs(days)}j retard`
    : color === "done" ? "Terminé"
    : days === null ? "—"
    : `${days}j`;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
      ${type === "regulatory"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-orange-50 text-orange-700 border-orange-200"}`}>
      {type === "regulatory" ? "Réglementaire" : "Décommissionnement"}
    </span>
  );
}

function AttributeBadge({ attribute }) {
  if (!attribute) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border
      ${attribute === "critical"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-violet-50 text-violet-700 border-violet-200"}`}>
      {attribute === "critical" ? "Critique" : "Stratégique"}
    </span>
  );
}

function KpiCard({ label, value, icon: Icon, color, testId }) {
  const colors = {
    blue:    "bg-blue-50 border-blue-100 text-blue-700",
    red:     "bg-rose-50 border-rose-100 text-rose-700",
    amber:   "bg-amber-50 border-amber-100 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
  };
  return (
    <div className={`flex items-center gap-4 rounded-xl border p-4 ${colors[color]}`} data-testid={testId}>
      <div className="p-2 rounded-lg bg-white/60">
        <Icon size={18} />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-[11px] font-medium mt-0.5 opacity-80">{label}</div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Conformite() {
  const [milestones, setMilestones] = useState([]);
  const [kpis, setKpis]             = useState(null);
  const [projects, setProjects]     = useState([]);
  const [programs, setPrograms]     = useState([]);
  const [loading, setLoading]       = useState(false);

  // Filtres
  const [filterProgram,   setFilterProgram]   = useState("");
  const [filterProject,   setFilterProject]   = useState("");
  const [filterType,      setFilterType]      = useState("");
  const [filterAttribute, setFilterAttribute] = useState("");

  // Tri
  const [sortCol, setSortCol]   = useState("target_date");
  const [sortDir, setSortDir]   = useState("asc");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterProgram)   params.program_id     = filterProgram;
      if (filterProject)   params.project_id     = filterProject;
      if (filterType)      params.milestone_type = filterType;
      if (filterAttribute) params.attribute       = filterAttribute;

      const [msRes, kpiRes, projRes, progRes] = await Promise.all([
        milestonesAPI.regulatory(params),
        milestonesAPI.regulatoryKpis(),
        projectsAPI ? projectsAPI.list() : Promise.resolve({ data: [] }),
        programsAPI.list(),
      ]);
      setMilestones(msRes.data);
      setKpis(kpiRes.data);
      setProjects(projRes.data || []);
      setPrograms(progRes.data || []);
    } catch { toast.error("Erreur chargement conformité"); }
    finally { setLoading(false); }
  }, [filterProgram, filterProject, filterType, filterAttribute]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = [...milestones].sort((a, b) => {
    let va = a[sortCol] ?? ""; let vb = b[sortCol] ?? "";
    if (sortCol === "days_remaining") { va = a.days_remaining ?? 9999; vb = b.days_remaining ?? 9999; }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }) => sortCol !== col ? null :
    sortDir === "asc" ? <ChevronUp size={11} className="inline ml-1" /> : <ChevronDown size={11} className="inline ml-1" />;

  const handleCsvExport = async () => {
    try {
      const params = {};
      if (filterProgram)   params.program_id     = filterProgram;
      if (filterProject)   params.project_id     = filterProject;
      if (filterType)      params.milestone_type = filterType;
      if (filterAttribute) params.attribute       = filterAttribute;
      const r = await milestonesAPI.regulatoryCsv(params);
      const blob = new Blob([r.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "conformite_jalons.csv";
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Erreur export CSV"); }
  };

  const thCls = (col) =>
    `px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer hover:text-[#0052CC] whitespace-nowrap select-none`;

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="conformite-page">
      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert size={18} className="text-[#0052CC]" />
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] uppercase tracking-tight">Conformité</h1>
        </div>
        <p className="text-sm text-slate-500">
          Suivi des jalons réglementaires et de décommissionnement — portefeuille complet
        </p>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="kpi-cards">
          <KpiCard label="Jalons total" value={kpis.total} icon={ShieldAlert} color="blue" testId="kpi-total" />
          <KpiCard label="Échéances < 90j" value={kpis.within_90} icon={Clock} color="amber" testId="kpi-within-90" />
          <KpiCard label="En retard" value={kpis.overdue} icon={TrendingDown} color="red" testId="kpi-overdue" />
          <KpiCard label="Critiques non soldés" value={kpis.crit_open} icon={AlertTriangle} color="red" testId="kpi-crit-open" />
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-4 mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <Filter size={11} /> Filtres
          </div>
          <select value={filterProgram} onChange={(e) => { setFilterProgram(e.target.value); setFilterProject(""); }}
            data-testid="filter-programme"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#0052CC] bg-white text-slate-600 min-w-[160px]">
            <option value="">Tous les programmes</option>
            {programs.map((p) => (
              <option key={p.program_id} value={p.program_id}>{p.name?.slice(0, 35)}</option>
            ))}
          </select>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
            data-testid="filter-project"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#0052CC] bg-white text-slate-600 min-w-[160px]">
            <option value="">Tous les projets</option>
            {projects
              .filter((p) => !filterProgram || p.program_id === filterProgram)
              .map((p) => (
                <option key={p.project_id} value={p.project_id}>{p.name?.slice(0,30)}</option>
              ))}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            data-testid="filter-type"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#0052CC] bg-white text-slate-600">
            <option value="">Tous les types</option>
            <option value="regulatory">Réglementaire</option>
            <option value="decomm">Décommissionnement</option>
          </select>
          <select value={filterAttribute} onChange={(e) => setFilterAttribute(e.target.value)}
            data-testid="filter-attribute"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#0052CC] bg-white text-slate-600">
            <option value="">Tous les attributs</option>
            <option value="critical">Critique</option>
            <option value="strategic">Stratégique</option>
          </select>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50">
            {loading ? <RefreshCw size={11} className="animate-spin" /> : <Filter size={11} />}
            Actualiser
          </button>
          {milestones.length > 0 && (
            <button onClick={handleCsvExport} data-testid="export-csv-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-slate-600 text-xs font-semibold rounded hover:bg-gray-50 ml-auto">
              <Download size={11} /> Exporter CSV
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Chargement...</div>
      ) : sorted.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-lg text-slate-400 text-sm">
          Aucun jalon réglementaire ou décommissionnement trouvé
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto" data-testid="regulatory-table">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className={thCls("project_name")} onClick={() => handleSort("project_name")}>
                  Projet <SortIcon col="project_name" />
                </th>
                <th className={thCls("type")} onClick={() => handleSort("type")}>
                  Type <SortIcon col="type" />
                </th>
                <th className={thCls("name")} onClick={() => handleSort("name")}>
                  Libellé <SortIcon col="name" />
                </th>
                <th className={thCls("target_date")} onClick={() => handleSort("target_date")}>
                  Date cible <SortIcon col="target_date" />
                </th>
                <th className={thCls("owner_name")} onClick={() => handleSort("owner_name")}>
                  Owner <SortIcon col="owner_name" />
                </th>
                <th className={thCls("status")} onClick={() => handleSort("status")}>
                  Statut <SortIcon col="status" />
                </th>
                <th className={thCls("days_remaining")} onClick={() => handleSort("days_remaining")}>
                  Jours rest. <SortIcon col="days_remaining" />
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">Attribut</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.milestone_id}
                  className={`border-b border-gray-50 hover:bg-blue-50/20 ${m.urgency_color === "overdue" ? "opacity-75" : ""}`}
                  data-testid={`regulatory-row-${m.milestone_id}`}>
                  <td className="px-4 py-3 font-semibold text-slate-800 max-w-[160px] truncate" title={m.project_name}>
                    {m.project_name?.slice(0, 25)}
                  </td>
                  <td className="px-4 py-3"><TypeBadge type={m.type} /></td>
                  <td className="px-4 py-3 text-slate-700 max-w-[220px] truncate" title={m.name}>
                    <div className="flex items-center gap-1.5">
                      {m.is_blocking && <span className="text-rose-400" title="Bloquant">⚠</span>}
                      {m.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                    {m.target_date
                      ? new Date(m.target_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.owner_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border
                      ${m.status === "done" || m.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : m.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {m.status === "in_progress" ? "En cours"
                        : m.status === "done" || m.status === "completed" ? "Terminé"
                        : m.status === "planned" ? "Planifié"
                        : (m.status || "—")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <DaysChip days={m.days_remaining} color={m.urgency_color} />
                  </td>
                  <td className="px-4 py-3"><AttributeBadge attribute={m.attribute} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-[10px] text-slate-400 border-t border-gray-100">
            {sorted.length} jalon(s) affiché(s)
          </div>
        </div>
      )}
    </div>
  );
}
