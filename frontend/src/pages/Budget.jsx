import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, Download, RefreshCw,
  ChevronDown, ChevronRight, X, Edit2, ChevronUp,
} from "lucide-react";
import { budgetAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) =>
  n == null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const fmtK = (n) => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} K€`;
  return `${n} €`;
};

const ragBadge = (rag) => {
  const map = { red: "bg-red-100 text-red-700", orange: "bg-amber-100 text-amber-700", green: "bg-emerald-100 text-emerald-700" };
  const label = { red: "Rouge", orange: "Orange", green: "Vert" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[rag] || "bg-gray-100 text-gray-600"}`}>{label[rag] || rag}</span>;
};

const ecartColor = (pct) => {
  if (pct > 15) return "text-red-600 font-semibold";
  if (pct > 5) return "text-amber-600 font-semibold";
  if (pct < -1) return "text-emerald-600 font-semibold";
  return "text-emerald-600";
};

const ecartBg = (pct) => {
  if (pct > 15) return "bg-red-50";
  if (pct > 5) return "bg-amber-50";
  return "bg-emerald-50";
};

const EcartIcon = ({ pct }) => {
  if (pct > 5) return <TrendingUp size={12} className="inline mr-0.5" />;
  if (pct < -1) return <TrendingDown size={12} className="inline mr-0.5" />;
  return <Minus size={12} className="inline mr-0.5" />;
};

// ── Progress bar ──────────────────────────────────────────────────────────
function ProgressBar({ value, max, label }) {
  const pct = max ? Math.min((value / max) * 100, 110) : 0;
  const color = pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{label}</span>
        <span>{pct.toFixed(0)}% de l'enveloppe ({fmtK(max)})</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "blue" }) {
  const colors = {
    blue: "border-l-[#0052CC] bg-white",
    green: "border-l-emerald-500 bg-emerald-50",
    amber: "border-l-amber-500 bg-amber-50",
    red: "border-l-red-500 bg-red-50",
    violet: "border-l-violet-500 bg-violet-50",
    slate: "border-l-slate-400 bg-slate-50",
  };
  return (
    <div className={`rounded-lg border border-gray-200 border-l-4 p-4 ${colors[color]}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{fmtK(value)}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Modal révision budget ────────────────────────────────────────────────
function RevisionModal({ project, onClose, onSave }) {
  const [capex, setCapex] = useState(project.capex_planned || 0);
  const [opex, setOpex] = useState(project.opex_planned || 0);
  const [eac, setEac] = useState(project.eac || 0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!reason.trim()) { setError("Le motif est obligatoire"); return; }
    if (!eac) { setError("L'EAC est obligatoire"); return; }
    setSaving(true);
    try {
      await budgetAPI.revise(project.project_id, {
        capex_planned: parseFloat(capex),
        opex_planned: parseFloat(opex),
        eac: parseFloat(eac),
        reason: reason.trim(),
      });
      onSave();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg">Modifier le budget</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4 font-medium">{project.name}</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">CAPEX Prévu (€)</label>
            <input type="number" value={capex} onChange={(e) => setCapex(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">OPEX Prévu (€)</label>
            <input type="number" value={opex} onChange={(e) => setOpex(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-slate-500 mb-1">EAC — Estimation à Fin (€) <span className="text-red-500">*</span></label>
          <input type="number" value={eac} onChange={(e) => setEac(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="mb-4">
          <label className="block text-xs text-slate-500 mb-1">Motif de modification <span className="text-red-500">*</span></label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="Expliquez la raison de cette révision..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-[#0052CC] text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panneau détail projet ─────────────────────────────────────────────────
function BudgetDrawer({ project, onClose, onRevise, canEdit }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    budgetAPI.projectRevisions(project.project_id)
      .then((r) => setDetail(r.data))
      .finally(() => setLoading(false));
  }, [project.project_id]);

  const budget = detail ? (detail.capex_planned + detail.opex_planned) : 0;
  const consumed = detail ? (detail.capex_consumed + detail.opex_consumed) : 0;
  const raf = detail ? Math.max((detail.eac || 0) - consumed, 0) : 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between z-10">
          <div>
            <h2 className="font-bold text-slate-800 text-base leading-tight">{project.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{project.program_name}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {canEdit && (
              <button onClick={onRevise}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#0052CC] text-white rounded-lg hover:bg-blue-700">
                <Edit2 size={12} /> Modifier
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-10 text-slate-400">Chargement…</div>
          ) : detail ? (
            <>
              {/* Synthèse financière */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Synthèse financière</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: "Budget initial", v: budget, c: "bg-slate-50" },
                    { l: "EAC (révision actuelle)", v: detail.eac, c: "bg-blue-50" },
                    { l: "Consommé", v: consumed, c: "bg-amber-50" },
                    { l: "RAF", v: raf, c: "bg-emerald-50" },
                  ].map(({ l, v, c }) => (
                    <div key={l} className={`rounded-lg p-3 ${c}`}>
                      <p className="text-[10px] text-slate-500 uppercase">{l}</p>
                      <p className="text-lg font-bold text-slate-800">{fmtK(v)}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="rounded-lg p-3 bg-slate-50">
                    <p className="text-[10px] text-slate-500 uppercase">CAPEX Prévu</p>
                    <p className="font-semibold text-slate-700">{fmtK(detail.capex_planned)}</p>
                    <p className="text-xs text-slate-400">consommé : {fmtK(detail.capex_consumed)}</p>
                  </div>
                  <div className="rounded-lg p-3 bg-slate-50">
                    <p className="text-[10px] text-slate-500 uppercase">OPEX Prévu</p>
                    <p className="font-semibold text-slate-700">{fmtK(detail.opex_planned)}</p>
                    <p className="text-xs text-slate-400">consommé : {fmtK(detail.opex_consumed)}</p>
                  </div>
                </div>
              </section>

              {/* Historique révisions */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Historique révisions ({detail.revisions?.length || 0})
                </h3>
                {!detail.revisions?.length ? (
                  <p className="text-sm text-slate-400 italic">Aucune révision enregistrée</p>
                ) : (
                  <div className="space-y-2">
                    {detail.revisions.map((rev, i) => (
                      <div key={i} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-slate-600">{rev.date}</span>
                          <span className="text-xs text-slate-400">{rev.author}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500">{fmtK(rev.old_eac)}</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-semibold text-slate-800">{fmtK(rev.new_eac)}</span>
                          {rev.new_eac > rev.old_eac
                            ? <TrendingUp size={12} className="text-red-500" />
                            : <TrendingDown size={12} className="text-emerald-500" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 italic">"{rev.reason}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <p className="text-slate-400 text-sm">Données indisponibles</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Composant tri colonne ─────────────────────────────────────────────────
function SortIcon({ active, dir }) {
  if (!active) return <ChevronDown size={12} className="text-slate-300 inline ml-0.5" />;
  return dir === "asc"
    ? <ChevronUp size={12} className="text-blue-600 inline ml-0.5" />
    : <ChevronDown size={12} className="text-blue-600 inline ml-0.5" />;
}

// ── Page principale ────────────────────────────────────────────────────────
export default function BudgetPage() {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("budget.edit") || hasPermission("budget.revise_eac") || hasPermission("*");

  const [data, setData] = useState(null);
  const [byProgram, setByProgram] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("projets"); // projets | programmes | graphiques
  const [filterProgram, setFilterProgram] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [sortCol, setSortCol] = useState("ecart_pct");
  const [sortDir, setSortDir] = useState("desc");
  const [groupByProgram, setGroupByProgram] = useState(false);
  const [expandedPrograms, setExpandedPrograms] = useState({});

  const [selectedProject, setSelectedProject] = useState(null);
  const [revisionProject, setRevisionProject] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterProgram) params.program_id = filterProgram;
      if (filterStatus) params.status = filterStatus;
      const [c, bp] = await Promise.all([
        budgetAPI.consolidated(params),
        budgetAPI.byProgram(),
      ]);
      setData(c.data);
      setByProgram(bp.data);
    } finally {
      setLoading(false);
    }
  }, [filterProgram, filterStatus]);

  useEffect(() => { load(); }, [load]);

  // Programmes disponibles pour le filtre
  const programs = useMemo(() => {
    if (!byProgram.length) return [];
    return byProgram.map((p) => ({ id: p.program_id, name: p.program_name }));
  }, [byProgram]);

  // Tri du tableau projets
  const sortedProjects = useMemo(() => {
    if (!data?.projects) return [];
    return [...data.projects].sort((a, b) => {
      const va = a[sortCol] ?? 0;
      const vb = b[sortCol] ?? 0;
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [data, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  // Groupement par programme
  const grouped = useMemo(() => {
    if (!groupByProgram) return null;
    const map = {};
    for (const p of sortedProjects) {
      const key = p.program_name || "—";
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [groupByProgram, sortedProjects]);

  const toggleProgram = (name) =>
    setExpandedPrograms((prev) => ({ ...prev, [name]: !prev[name] }));

  const thClass = "px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:text-slate-800 whitespace-nowrap";
  const tdClass = "px-3 py-2.5 text-sm text-slate-700 whitespace-nowrap";

  // Données graphiques
  const chartProjets = useMemo(() =>
    (data?.projects || []).map((p) => ({
      name: p.name.slice(0, 18) + (p.name.length > 18 ? "…" : ""),
      "Prévu": Math.round((p.capex_planned + p.opex_planned) / 1000),
      "Consommé": Math.round((p.capex_consumed + p.opex_consumed) / 1000),
      "EAC": Math.round(p.eac / 1000),
    })), [data]);

  const chartPrograms = useMemo(() =>
    byProgram.map((p) => ({
      name: p.program_name.slice(0, 20) + (p.program_name.length > 20 ? "…" : ""),
      "CAPEX (K€)": Math.round(p.capex_total / 1000),
      "OPEX (K€)": Math.round(p.opex_total / 1000),
    })), [byProgram]);

  const kpis = data?.kpis;
  const envelope = data?.envelope;

  const ProjectRow = ({ p, rowClass = "" }) => (
    <tr
      key={p.project_id}
      className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${ecartBg(p.ecart_pct)} ${rowClass}`}
      onClick={() => setSelectedProject(p)}
      data-testid={`budget-row-${p.project_id}`}
    >
      <td className={tdClass}>
        <span className="font-medium text-slate-800">{p.name}</span>
      </td>
      <td className={tdClass}><span className="text-slate-500 text-xs">{p.program_name}</span></td>
      <td className={`${tdClass} text-center`}>{ragBadge(p.status_rag)}</td>
      <td className={`${tdClass} text-right`}>{fmtK(p.capex_planned)}</td>
      <td className={`${tdClass} text-right`}>{fmtK(p.capex_consumed)}</td>
      <td className={`${tdClass} text-right`}>{fmtK(p.opex_planned)}</td>
      <td className={`${tdClass} text-right`}>{fmtK(p.opex_consumed)}</td>
      <td className={`${tdClass} text-right font-semibold`}>{fmtK(p.eac)}</td>
      <td className={`${tdClass} text-right`}>{fmtK(p.raf)}</td>
      <td className={`${tdClass} text-right`}>
        <span className={ecartColor(p.ecart_pct)}>
          <EcartIcon pct={p.ecart_pct} />
          {p.ecart_pct > 0 ? "+" : ""}{p.ecart_pct.toFixed(1)}%
        </span>
      </td>
      <td className={`${tdClass} text-center`}>
        <span className="text-xs text-slate-500">{p.nb_revisions}</span>
      </td>
    </tr>
  );

  const TotalRow = ({ projects }) => {
    const tot = projects.reduce((acc, p) => ({
      capex_planned: acc.capex_planned + p.capex_planned,
      capex_consumed: acc.capex_consumed + p.capex_consumed,
      opex_planned: acc.opex_planned + p.opex_planned,
      opex_consumed: acc.opex_consumed + p.opex_consumed,
      eac: acc.eac + p.eac,
      raf: acc.raf + p.raf,
    }), { capex_planned: 0, capex_consumed: 0, opex_planned: 0, opex_consumed: 0, eac: 0, raf: 0 });
    const budget = tot.capex_planned + tot.opex_planned;
    const ecartTot = budget ? (tot.eac - budget) / budget * 100 : 0;
    return (
      <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
        <td className={tdClass} colSpan={3}>TOTAL</td>
        <td className={`${tdClass} text-right`}>{fmtK(tot.capex_planned)}</td>
        <td className={`${tdClass} text-right`}>{fmtK(tot.capex_consumed)}</td>
        <td className={`${tdClass} text-right`}>{fmtK(tot.opex_planned)}</td>
        <td className={`${tdClass} text-right`}>{fmtK(tot.opex_consumed)}</td>
        <td className={`${tdClass} text-right`}>{fmtK(tot.eac)}</td>
        <td className={`${tdClass} text-right`}>{fmtK(tot.raf)}</td>
        <td className={`${tdClass} text-right ${ecartColor(ecartTot)}`}>
          {ecartTot > 0 ? "+" : ""}{ecartTot.toFixed(1)}%
        </td>
        <td className={tdClass} />
      </tr>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 min-h-screen bg-[#F8F9FA]">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" data-testid="budget-page-title">Budget Portefeuille</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suivi financier consolidé — CAPEX · OPEX · EAC · RAF</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => budgetAPI.exportExcel().then((r) => {
            const url = window.URL.createObjectURL(new Blob([r.data]));
            const a = document.createElement("a"); a.href = url;
            a.download = "budget_portefeuille.xlsx"; a.click();
          })} data-testid="export-excel-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-slate-600">
            <Download size={14} /> Excel
          </button>
          <button onClick={() => budgetAPI.exportPdf().then((r) => {
            const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
            window.open(url, "_blank");
          })} data-testid="export-pdf-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-slate-600">
            <Download size={14} /> PDF
          </button>
          <button onClick={load} data-testid="refresh-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#0052CC] text-white rounded-lg hover:bg-blue-700">
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Chargement des données budgétaires…</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="budget-kpis">
            <KpiCard label="CAPEX Prévu" value={kpis?.capex_planned} color="blue" />
            <KpiCard label="CAPEX Consommé" value={kpis?.capex_consumed} color="amber"
              sub={kpis?.capex_planned ? `${(kpis.capex_consumed / kpis.capex_planned * 100).toFixed(0)}% du prévu` : ""} />
            <KpiCard label="OPEX Prévu" value={kpis?.opex_planned} color="blue" />
            <KpiCard label="OPEX Consommé" value={kpis?.opex_consumed} color="amber"
              sub={kpis?.opex_planned ? `${(kpis.opex_consumed / kpis.opex_planned * 100).toFixed(0)}% du prévu` : ""} />
            <KpiCard label="EAC Total" value={kpis?.eac_total} color="violet"
              sub="Estimation à Fin" />
            <KpiCard label="RAF Total" value={kpis?.raf_total} color="slate"
              sub="Reste à Faire" />
          </div>

          {/* Barres progression vs enveloppe */}
          {envelope?.capex_envelope && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Consommation vs Enveloppe 2026</h3>
              <ProgressBar value={kpis?.capex_consumed} max={envelope.capex_envelope}
                label={`CAPEX — ${fmtK(kpis?.capex_consumed)} consommé`} />
              <ProgressBar value={kpis?.opex_consumed} max={envelope.opex_envelope}
                label={`OPEX — ${fmtK(kpis?.opex_consumed)} consommé`} />
            </div>
          )}

          {/* Filtres */}
          <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 p-4">
            <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}
              data-testid="filter-program"
              className="border rounded-lg px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
              <option value="">Tous les programmes</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              data-testid="filter-status"
              className="border rounded-lg px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
              <option value="">Tous les statuts</option>
              <option value="actif">Actif</option>
              <option value="en_pause">En pause</option>
              <option value="termine">Terminé</option>
            </select>
            {(filterProgram || filterStatus) && (
              <button onClick={() => { setFilterProgram(""); setFilterStatus(""); }}
                className="text-xs text-blue-600 hover:underline">
                Réinitialiser
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {[
              { id: "projets", label: "Projets" },
              { id: "programmes", label: "Par programme" },
              { id: "graphiques", label: "Graphiques" },
            ].map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                data-testid={`tab-${t.id}`}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === t.id
                    ? "border-[#0052CC] text-[#0052CC]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB : Projets ────────────────────────────────────────────── */}
          {activeTab === "projets" && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-slate-600">
                  {sortedProjects.length} projets
                </span>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={groupByProgram}
                    onChange={(e) => setGroupByProgram(e.target.checked)}
                    data-testid="toggle-group-program"
                    className="rounded" />
                  Grouper par programme
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="budget-table">
                  <thead className="bg-slate-50 border-b border-gray-100">
                    <tr>
                      {[
                        { key: "name", label: "Projet" },
                        { key: "program_name", label: "Programme" },
                        { key: "status_rag", label: "RAG" },
                        { key: "capex_planned", label: "CAPEX Prévu" },
                        { key: "capex_consumed", label: "CAPEX Conso." },
                        { key: "opex_planned", label: "OPEX Prévu" },
                        { key: "opex_consumed", label: "OPEX Conso." },
                        { key: "eac", label: "EAC" },
                        { key: "raf", label: "RAF" },
                        { key: "ecart_pct", label: "Écart EAC (%)" },
                        { key: "nb_revisions", label: "Révisions" },
                      ].map(({ key, label }) => (
                        <th key={key} className={thClass} onClick={() => handleSort(key)}>
                          {label}<SortIcon active={sortCol === key} dir={sortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {groupByProgram && grouped ? (
                      Object.entries(grouped).map(([prog, projs]) => (
                        <React.Fragment key={prog}>
                          <tr className="bg-slate-100 cursor-pointer hover:bg-slate-200"
                            onClick={() => toggleProgram(prog)}>
                            <td colSpan={11} className="px-3 py-2 font-semibold text-sm text-slate-700">
                              {expandedPrograms[prog]
                                ? <ChevronDown size={14} className="inline mr-2" />
                                : <ChevronRight size={14} className="inline mr-2" />}
                              {prog} <span className="text-slate-400 font-normal text-xs">({projs.length} projets)</span>
                            </td>
                          </tr>
                          {expandedPrograms[prog] && projs.map((p) => (
                            <ProjectRow key={p.project_id} p={p} rowClass="pl-6" />
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      sortedProjects.map((p) => <ProjectRow key={p.project_id} p={p} />)
                    )}
                    <TotalRow projects={sortedProjects} />
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB : Par programme ──────────────────────────────────────── */}
          {activeTab === "programmes" && (
            <div className="space-y-3">
              {byProgram.map((pg) => (
                <div key={pg.program_id || pg.program_name}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                  data-testid={`prog-block-${pg.program_id}`}>
                  <div
                    className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50"
                    onClick={() => toggleProgram(pg.program_name)}>
                    <div className="flex items-center gap-3">
                      {expandedPrograms[pg.program_name]
                        ? <ChevronDown size={16} className="text-slate-400" />
                        : <ChevronRight size={16} className="text-slate-400" />}
                      <div>
                        <p className="font-semibold text-slate-800">{pg.program_name}</p>
                        <p className="text-xs text-slate-400">{pg.nb_projects} projets</p>
                      </div>
                    </div>
                    <div className="flex gap-6 text-right text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Prévu</p>
                        <p className="font-medium">{fmtK(pg.capex_total + pg.opex_total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">EAC</p>
                        <p className="font-medium">{fmtK(pg.eac_total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Écart</p>
                        <p className={`font-semibold ${ecartColor(pg.ecart_pct)}`}>
                          {pg.ecart_pct > 0 ? "+" : ""}{pg.ecart_pct.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Barre empilée contribution projets */}
                  <div className="px-5 pb-2">
                    <div className="flex h-2 rounded-full overflow-hidden">
                      {pg.projects?.map((p, i) => {
                        const pct = pg.eac_total ? (p.eac / pg.eac_total) * 100 : 0;
                        const colors = ["#0052CC", "#0070F3", "#338EF7", "#66AAF9", "#99C4FB", "#CCE2FD", "#E5F0FF", "#F0F7FF"];
                        return <div key={p.project_id} style={{ width: `${pct}%`, background: colors[i % colors.length] }} title={p.name} />;
                      })}
                    </div>
                  </div>

                  {/* Projets détaillés (expandable) */}
                  {expandedPrograms[pg.program_name] && (
                    <div className="border-t divide-y divide-gray-50">
                      {pg.projects?.map((p) => (
                        <div key={p.project_id}
                          className="flex items-center justify-between px-8 py-2.5 hover:bg-blue-50/40 cursor-pointer text-sm"
                          onClick={() => setSelectedProject({ ...p, program_name: pg.program_name })}
                          data-testid={`prog-proj-${p.project_id}`}>
                          <div className="flex items-center gap-3">
                            {ragBadge(p.status_rag)}
                            <span className="text-slate-700">{p.name}</span>
                          </div>
                          <div className="flex gap-4 text-xs text-slate-500">
                            <span>Prévu {fmtK(p.capex_planned + p.opex_planned)}</span>
                            <span>EAC {fmtK(p.eac)}</span>
                            <span className={ecartColor(p.ecart_pct)}>
                              {p.ecart_pct > 0 ? "+" : ""}{p.ecart_pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── TAB : Graphiques ─────────────────────────────────────────── */}
          {activeTab === "graphiques" && (
            <div className="space-y-6">
              {/* Graphique 1 — CAPEX/OPEX par programme */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Répartition CAPEX / OPEX par programme (K€)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartPrograms} margin={{ left: 20, right: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v} K€`]} />
                    <Legend />
                    <Bar dataKey="CAPEX (K€)" fill="#0052CC" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="OPEX (K€)" fill="#66AAF9" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Graphique 2 — Prévu vs Consommé vs EAC par projet */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Prévu vs Consommé vs EAC par projet (K€)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartProjets} margin={{ left: 20, right: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v} K€`]} />
                    <Legend />
                    <Bar dataKey="Prévu" fill="#0052CC" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Consommé" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="EAC" fill="#EF4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Graphique 3 — EAC vs Budget initial (courbe) */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Dérive EAC par rapport au budget initial</h3>
                <p className="text-xs text-slate-400 mb-4">Projets triés par écart croissant</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={[...chartProjets].sort((a, b) => (a.EAC - a["Prévu"]) - (b.EAC - b["Prévu"]))}
                    margin={{ left: 20, right: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v} K€`]} />
                    <Legend />
                    <Line type="monotone" dataKey="Prévu" stroke="#0052CC" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="EAC" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* Panneau latéral détail */}
      {selectedProject && (
        <BudgetDrawer
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onRevise={() => { setRevisionProject(selectedProject); setSelectedProject(null); }}
          canEdit={canEdit}
        />
      )}

      {/* Modal révision */}
      {revisionProject && (
        <RevisionModal
          project={revisionProject}
          onClose={() => setRevisionProject(null)}
          onSave={() => { load(); setRevisionProject(null); }}
        />
      )}
    </div>
  );
}
