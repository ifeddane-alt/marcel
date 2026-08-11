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
import ExcelToolbar from "@/components/ExcelToolbar";
import MultiYearPlan from "@/components/MultiYearPlan";
import { Ring } from "@/components/ProjectTile";
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
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${map[rag] || "bg-zinc-100 text-zinc-600"}`}>{label[rag] || rag}</span>;
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
  const color = pct > 100 ? "bg-[#cc4f45]" : pct > 80 ? "bg-[#a3891a]" : "bg-[#3f8a34]";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#5d5a75]">{label}</span>
        <span className="font-mono-data text-[11px] text-[#8a87a0]">{pct.toFixed(0)}% de l'enveloppe ({fmtK(max)})</span>
      </div>
      <div className="h-2 bg-[#eeecf6] rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

// ── KPI Card (style tuile) ────────────────────────────────────────────────
function KpiCard({ label, value, sub, pct, ringColor, ringLabel, ringCaption, testId }) {
  return (
    <div
      className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4 flex items-center justify-between gap-3"
      data-testid={testId}
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{label}</div>
        <div className="font-mono-data text-[22px] font-bold text-[#26243a] mt-1">{fmtK(value)}</div>
        {sub && <div className="text-[10.5px] text-[#8a87a0] mt-0.5 truncate">{sub}</div>}
      </div>
      {pct != null && (
        <div className="flex-shrink-0">
          <Ring pct={pct} color={ringColor} label={ringLabel} caption={ringCaption} />
        </div>
      )}
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
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl w-full max-h-screen sm:max-h-[90vh] overflow-y-auto sm:max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-zinc-800 text-lg">Modifier le budget</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
        </div>
        <p className="text-sm text-zinc-500 mb-4 font-medium">{project.name}</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">CAPEX Prévu (€)</label>
            <input type="number" value={capex} onChange={(e) => setCapex(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">OPEX Prévu (€)</label>
            <input type="number" value={opex} onChange={(e) => setOpex(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-zinc-500 mb-1">EAC — Estimation à Fin (€) <span className="text-red-500">*</span></label>
          <input type="number" value={eac} onChange={(e) => setEac(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="mb-4">
          <label className="block text-xs text-zinc-500 mb-1">Motif de modification <span className="text-red-500">*</span></label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="Expliquez la raison de cette révision..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border rounded-lg hover:bg-zinc-50">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
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
            <h2 className="font-heading font-bold text-[#26243a] text-base leading-tight">{project.name}</h2>
            <p className="text-xs text-[#8a87a0] mt-0.5">{project.program_name}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {canEdit && (
              <button onClick={onRevise}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Edit2 size={12} /> Modifier
              </button>
            )}
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-10 text-zinc-400">Chargement…</div>
          ) : detail ? (
            <>
              {/* Synthèse financière */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Synthèse financière</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: "Budget initial", v: budget, c: "bg-zinc-50" },
                    { l: "EAC (révision actuelle)", v: detail.eac, c: "bg-blue-50" },
                    { l: "Consommé", v: consumed, c: "bg-amber-50" },
                    { l: "RAF", v: raf, c: "bg-emerald-50" },
                  ].map(({ l, v, c }) => (
                    <div key={l} className={`rounded-lg p-3 ${c}`}>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">{l}</p>
                      <p className="font-mono-data text-lg font-bold text-[#26243a]">{fmtK(v)}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="rounded-lg p-3 bg-zinc-50">
                    <p className="text-[10px] text-zinc-500 uppercase">CAPEX Prévu</p>
                    <p className="font-semibold text-zinc-700">{fmtK(detail.capex_planned)}</p>
                    <p className="text-xs text-zinc-400">consommé : {fmtK(detail.capex_consumed)}</p>
                  </div>
                  <div className="rounded-lg p-3 bg-zinc-50">
                    <p className="text-[10px] text-zinc-500 uppercase">OPEX Prévu</p>
                    <p className="font-semibold text-zinc-700">{fmtK(detail.opex_planned)}</p>
                    <p className="text-xs text-zinc-400">consommé : {fmtK(detail.opex_consumed)}</p>
                  </div>
                </div>
              </section>

              {/* Historique révisions */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                  Historique révisions ({detail.revisions?.length || 0})
                </h3>
                {!detail.revisions?.length ? (
                  <p className="text-sm text-zinc-400 italic">Aucune révision enregistrée</p>
                ) : (
                  <div className="space-y-2">
                    {detail.revisions.map((rev, i) => (
                      <div key={i} className="border rounded-lg p-3 bg-zinc-50">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-zinc-600">{rev.date}</span>
                          <span className="text-xs text-zinc-400">{rev.author}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-zinc-500">{fmtK(rev.old_eac)}</span>
                          <span className="text-zinc-400">→</span>
                          <span className="font-semibold text-zinc-800">{fmtK(rev.new_eac)}</span>
                          {rev.new_eac > rev.old_eac
                            ? <TrendingUp size={12} className="text-red-500" />
                            : <TrendingDown size={12} className="text-emerald-500" />}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 italic">"{rev.reason}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <p className="text-zinc-400 text-sm">Données indisponibles</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Composant tri colonne ─────────────────────────────────────────────────
function SortIcon({ active, dir }) {
  if (!active) return <ChevronDown size={12} className="text-zinc-300 inline ml-0.5" />;
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

  const thClass = "px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-[#8a87a0] cursor-pointer select-none hover:text-[#2e5fe8] whitespace-nowrap";
  const tdClass = "px-3 py-2 text-sm text-zinc-700 whitespace-nowrap";
  const tdNum = "px-3 py-2 font-mono-data text-xs text-zinc-700 whitespace-nowrap text-right";

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

  const pctCapex = kpis?.capex_planned ? Math.round((kpis.capex_consumed / kpis.capex_planned) * 100) : 0;
  const pctOpex = kpis?.opex_planned ? Math.round((kpis.opex_consumed / kpis.opex_planned) * 100) : 0;
  const budgetTotal = (kpis?.capex_planned || 0) + (kpis?.opex_planned || 0);
  const pctEac = budgetTotal ? Math.round(((kpis?.eac_total || 0) / budgetTotal) * 100) : 0;
  const pctRaf = kpis?.eac_total ? Math.round(((kpis?.raf_total || 0) / kpis.eac_total) * 100) : 0;

  const ProjectRow = ({ p, rowClass = "" }) => (
    <tr
      key={p.project_id}
      className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${ecartBg(p.ecart_pct)} ${rowClass}`}
      onClick={() => setSelectedProject(p)}
      data-testid={`budget-row-${p.project_id}`}
    >
      <td className={tdClass}>
        <span className="font-medium text-zinc-800">{p.name}</span>
      </td>
      <td className={tdClass}><span className="text-zinc-500 text-xs">{p.program_name}</span></td>
      <td className={`${tdClass} text-center`}>{ragBadge(p.status_rag)}</td>
      <td className={tdNum}>{fmtK(p.capex_planned)}</td>
      <td className={tdNum}>{fmtK(p.capex_consumed)}</td>
      <td className={tdNum}>{fmtK(p.opex_planned)}</td>
      <td className={tdNum}>{fmtK(p.opex_consumed)}</td>
      <td className={`${tdNum} font-bold text-[#26243a]`}>{fmtK(p.eac)}</td>
      <td className={tdNum}>{fmtK(p.raf)}</td>
      <td className={`${tdNum}`}>
        <span className={ecartColor(p.ecart_pct)}>
          <EcartIcon pct={p.ecart_pct} />
          {p.ecart_pct > 0 ? "+" : ""}{p.ecart_pct.toFixed(1)}%
        </span>
      </td>
      <td className={`${tdClass} text-center`}>
        <span className="font-mono-data text-xs text-zinc-500">{p.nb_revisions}</span>
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
      <tr className="bg-[#f7f6fb] font-semibold border-t-2 border-[#dcd9ea]">
        <td className={`${tdClass} font-bold text-[#352c6e] text-xs uppercase tracking-wider`} colSpan={3}>Total</td>
        <td className={tdNum}>{fmtK(tot.capex_planned)}</td>
        <td className={tdNum}>{fmtK(tot.capex_consumed)}</td>
        <td className={tdNum}>{fmtK(tot.opex_planned)}</td>
        <td className={tdNum}>{fmtK(tot.opex_consumed)}</td>
        <td className={`${tdNum} font-bold`}>{fmtK(tot.eac)}</td>
        <td className={tdNum}>{fmtK(tot.raf)}</td>
        <td className={`${tdNum} ${ecartColor(ecartTot)}`}>
          {ecartTot > 0 ? "+" : ""}{ecartTot.toFixed(1)}%
        </td>
        <td className={tdClass} />
      </tr>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[#8a87a0] mb-0.5">Accueil / <span className="text-[#352c6e] font-semibold">Budget</span></div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#26243a] tracking-tight" data-testid="budget-page-title">Budget Portefeuille</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Suivi financier consolidé — CAPEX · OPEX · EAC · RAF</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExcelToolbar entity="budget" onImported={load} />
          <button onClick={() => budgetAPI.exportExcel().then((r) => {
            const url = window.URL.createObjectURL(new Blob([r.data]));
            const a = document.createElement("a"); a.href = url;
            a.download = "budget_portefeuille.xlsx"; a.click();
          })} data-testid="export-excel-btn"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 text-zinc-600 transition-colors">
            <Download size={14} /> Excel détaillé
          </button>
          <button onClick={() => budgetAPI.exportPdf().then((r) => {
            const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
            window.open(url, "_blank");
          })} data-testid="export-pdf-btn"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 text-zinc-600 transition-colors">
            <Download size={14} /> PDF
          </button>
          <button onClick={load} data-testid="refresh-btn"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-400">Chargement des données budgétaires…</div>
      ) : (
        <>
          {/* KPI Cards style tuiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="budget-kpis">
            <KpiCard label="CAPEX Prévu" value={kpis?.capex_planned}
              sub={`Consommé ${fmtK(kpis?.capex_consumed)}`}
              pct={pctCapex} ringColor={pctCapex > 90 ? "#cc4f45" : "#2e5fe8"} ringLabel="Conso" ringCaption="capex"
              testId="kpi-capex" />
            <KpiCard label="OPEX Prévu" value={kpis?.opex_planned}
              sub={`Consommé ${fmtK(kpis?.opex_consumed)}`}
              pct={pctOpex} ringColor={pctOpex > 90 ? "#cc4f45" : "#2e5fe8"} ringLabel="Conso" ringCaption="opex"
              testId="kpi-opex" />
            <KpiCard label="EAC Total" value={kpis?.eac_total}
              sub={`Budget prévu ${fmtK(budgetTotal)}`}
              pct={pctEac} ringColor={pctEac > 100 ? "#cc4f45" : "#3f8a34"} ringLabel="EAC" ringCaption="prévu"
              testId="kpi-eac" />
            <KpiCard label="RAF Total" value={kpis?.raf_total}
              sub="Reste à faire"
              pct={pctRaf} ringColor="#352c6e" ringLabel="RAF" ringCaption="eac"
              testId="kpi-raf" />
          </div>

          {/* Barres progression vs enveloppe */}
          {envelope?.capex_envelope && (
            <div className="bg-white rounded-xl border border-[#e8e6f0] shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-5">
              <h3 className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-3">Consommation vs Enveloppe 2026</h3>
              <ProgressBar value={kpis?.capex_consumed} max={envelope.capex_envelope}
                label={`CAPEX — ${fmtK(kpis?.capex_consumed)} consommé`} />
              <ProgressBar value={kpis?.opex_consumed} max={envelope.opex_envelope}
                label={`OPEX — ${fmtK(kpis?.opex_consumed)} consommé`} />
            </div>
          )}

          {/* Filtres */}
          <div className="flex flex-wrap gap-3 items-center">
            <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}
              data-testid="filter-program"
              className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-600">
              <option value="">Tous les programmes</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              data-testid="filter-status"
              className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-600">
              <option value="">Tous les statuts</option>
              <option value="actif">Actif</option>
              <option value="en_pause">En pause</option>
              <option value="termine">Terminé</option>
            </select>
            {(filterProgram || filterStatus) && (
              <button onClick={() => { setFilterProgram(""); setFilterStatus(""); }}
                className="text-xs text-[#2e5fe8] hover:underline font-semibold">
                Réinitialiser
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[#e7e3f2]">
            {[
              { id: "projets", label: "Projets", count: sortedProjects.length },
              { id: "programmes", label: "Par programme", count: byProgram.length },
              { id: "graphiques", label: "Graphiques" },
              { id: "pluriannuel", label: "Plan pluriannuel" },
            ].map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                data-testid={`tab-${t.id}`}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold transition-colors border-b-[3px] -mb-px ${
                  activeTab === t.id
                    ? "text-[#2e5fe8] border-[#2e5fe8]"
                    : "text-[#8a87a0] border-transparent hover:text-[#26243a]"
                }`}>
                {t.label}
                {t.count != null && (
                  <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${activeTab === t.id ? "bg-[#e9effe] text-[#2e5fe8]" : "bg-[#f0eefc] text-[#8a87a0]"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── TAB : Projets ────────────────────────────────────────────── */}
          {activeTab === "projets" && (
            <div className="bg-white rounded-xl border border-[#e8e6f0] shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0eff6]">
                <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
                  {sortedProjects.length} projets
                </span>
                <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                  <input type="checkbox" checked={groupByProgram}
                    onChange={(e) => setGroupByProgram(e.target.checked)}
                    data-testid="toggle-group-program"
                    className="rounded" />
                  Grouper par programme
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="budget-table">
                  <thead className="bg-[#fbfaff] border-b border-[#e8e6f0]">
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
                  <tbody className="divide-y divide-zinc-50">
                    {groupByProgram && grouped ? (
                      Object.entries(grouped).map(([prog, projs]) => (
                        <React.Fragment key={prog}>
                          <tr className="bg-zinc-100 cursor-pointer hover:bg-zinc-200"
                            onClick={() => toggleProgram(prog)}>
                            <td colSpan={11} className="px-3 py-2 font-semibold text-sm text-zinc-700">
                              {expandedPrograms[prog]
                                ? <ChevronDown size={14} className="inline mr-2" />
                                : <ChevronRight size={14} className="inline mr-2" />}
                              {prog} <span className="text-zinc-400 font-normal text-xs">({projs.length} projets)</span>
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
          {activeTab === "pluriannuel" && (
            <MultiYearPlan canEdit={canEdit} />
          )}

          {/* ── TAB : Programmes ─────────────────────────────────────────── */}
          {activeTab === "programmes" && (
            <div className="space-y-3">
              {byProgram.map((pg) => (
                <div key={pg.program_id || pg.program_name}
                  className="bg-white rounded-xl border border-[#e8e6f0] shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-hidden"
                  data-testid={`prog-block-${pg.program_id}`}>
                  <div
                    className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[#fbfaff]"
                    onClick={() => toggleProgram(pg.program_name)}>
                    <div className="flex items-center gap-3">
                      {expandedPrograms[pg.program_name]
                        ? <ChevronDown size={16} className="text-zinc-400" />
                        : <ChevronRight size={16} className="text-zinc-400" />}
                      <div>
                        <p className="font-heading font-bold text-[#26243a]">{pg.program_name}</p>
                        <p className="text-xs text-[#8a87a0]">{pg.nb_projects} projets</p>
                      </div>
                    </div>
                    <div className="flex gap-6 text-right text-sm">
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-semibold">Prévu</p>
                        <p className="font-mono-data font-semibold text-[#26243a]">{fmtK(pg.capex_total + pg.opex_total)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-semibold">EAC</p>
                        <p className="font-mono-data font-semibold text-[#26243a]">{fmtK(pg.eac_total)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-zinc-400 font-semibold">Écart</p>
                        <p className={`font-mono-data font-bold ${ecartColor(pg.ecart_pct)}`}>
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
                        const colors = ["#2563eb", "#0070F3", "#338EF7", "#66AAF9", "#99C4FB", "#CCE2FD", "#E5F0FF", "#F0F7FF"];
                        return <div key={p.project_id} style={{ width: `${pct}%`, background: colors[i % colors.length] }} title={p.name} />;
                      })}
                    </div>
                  </div>

                  {/* Projets détaillés (expandable) */}
                  {expandedPrograms[pg.program_name] && (
                    <div className="border-t divide-y divide-zinc-50">
                      {pg.projects?.map((p) => (
                        <div key={p.project_id}
                          className="flex items-center justify-between px-8 py-2.5 hover:bg-blue-50/40 cursor-pointer text-sm"
                          onClick={() => setSelectedProject({ ...p, program_name: pg.program_name })}
                          data-testid={`prog-proj-${p.project_id}`}>
                          <div className="flex items-center gap-3">
                            {ragBadge(p.status_rag)}
                            <span className="text-zinc-700">{p.name}</span>
                          </div>
                          <div className="flex gap-4 text-xs text-[#8a87a0]">
                            <span>Prévu <b className="font-mono-data text-[#26243a]">{fmtK(p.capex_planned + p.opex_planned)}</b></span>
                            <span>EAC <b className="font-mono-data text-[#26243a]">{fmtK(p.eac)}</b></span>
                            <span className={`font-mono-data font-bold ${ecartColor(p.ecart_pct)}`}>
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
              <div className="bg-white rounded-xl border border-zinc-200 p-5">
                <h3 className="text-sm font-semibold text-zinc-700 mb-4">Répartition CAPEX / OPEX par programme (K€)</h3>
                <div className="h-48 sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartPrograms} margin={{ left: 20, right: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v} K€`]} />
                    <Legend />
                    <Bar dataKey="CAPEX (K€)" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="OPEX (K€)" fill="#66AAF9" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>

              {/* Graphique 2 — Prévu vs Consommé vs EAC par projet */}
              <div className="bg-white rounded-xl border border-zinc-200 p-5">
                <h3 className="text-sm font-semibold text-zinc-700 mb-4">Prévu vs Consommé vs EAC par projet (K€)</h3>
                <div className="h-48 sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartProjets} margin={{ left: 20, right: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v} K€`]} />
                    <Legend />
                    <Bar dataKey="Prévu" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Consommé" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="EAC" fill="#EF4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </div>

              {/* Graphique 3 — EAC vs Budget initial (courbe) */}
              <div className="bg-white rounded-xl border border-zinc-200 p-5">
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">Dérive EAC par rapport au budget initial</h3>
                <p className="text-xs text-zinc-400 mb-4">Projets triés par écart croissant</p>
                <div className="h-44 sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...chartProjets].sort((a, b) => (a.EAC - a["Prévu"]) - (b.EAC - b["Prévu"]))}
                    margin={{ left: 20, right: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`${v} K€`]} />
                    <Legend />
                    <Line type="monotone" dataKey="Prévu" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="EAC" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                </div>
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
