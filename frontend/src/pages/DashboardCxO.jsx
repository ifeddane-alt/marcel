import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Gauge, Settings2, RefreshCw, Briefcase, FolderKanban, AlertTriangle,
  DollarSign, Flag, TrendingUp, X, Check,
} from "lucide-react";
import { dashboardAPI } from "@/api";
import RAGBadge from "@/components/RAGBadge";
import { formatEuro } from "@/utils/format";

const WIDGET_LABELS = {
  kpis: "Indicateurs clés",
  rag: "Répartition RAG",
  budget: "Budget consolidé",
  milestones: "Jalons",
  risks: "Risques",
  top_projects: "Top projets",
};

function KpiCard({ icon: Icon, label, value, accent = "text-slate-800", testid }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3" data-testid={testid}>
      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-[#0052CC]" />
      </div>
      <div>
        <p className={`font-mono-data text-2xl font-bold leading-none ${accent}`}>{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function RagBar({ rag }) {
  const total = rag.green + rag.orange + rag.red || 1;
  const seg = (n, color) => (
    <div className={`h-full ${color}`} style={{ width: `${(n / total) * 100}%` }} />
  );
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="cxo-widget-rag">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Santé du portefeuille (RAG)</h3>
      <div className="h-4 rounded-full overflow-hidden flex bg-gray-100">
        {seg(rag.green, "bg-emerald-500")}
        {seg(rag.orange, "bg-amber-400")}
        {seg(rag.red, "bg-rose-500")}
      </div>
      <div className="flex gap-5 mt-3 text-xs text-slate-600">
        <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />Vert : {rag.green}</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1.5" />Orange : {rag.orange}</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1.5" />Rouge : {rag.red}</span>
      </div>
    </div>
  );
}

function BudgetWidget({ budget }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="cxo-widget-budget">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Budget consolidé</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500">Total</p>
          <p className="font-mono-data text-lg font-bold text-slate-800">{formatEuro(budget.total)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Consommé</p>
          <p className="font-mono-data text-lg font-bold text-slate-800">{formatEuro(budget.consumed)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Atterrissage</p>
          <p className="font-mono-data text-lg font-bold text-slate-800">{formatEuro(budget.forecast)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Dépassement prévu</p>
          <p className={`font-mono-data text-lg font-bold ${budget.overrun > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {budget.overrun > 0 ? `+${formatEuro(budget.overrun)}` : "—"}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${budget.consumption_rate > 90 ? "bg-rose-500" : "bg-[#0052CC]"}`}
            style={{ width: `${Math.min(budget.consumption_rate, 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1 text-right">{budget.consumption_rate}% consommé</p>
      </div>
    </div>
  );
}

function MilestonesWidget({ milestones }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="cxo-widget-milestones">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Jalons — taux à l'heure</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={milestones.on_time_rate >= 80 ? "#10b981" : milestones.on_time_rate >= 60 ? "#f59e0b" : "#f43f5e"}
              strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${milestones.on_time_rate} 100`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono-data text-sm font-bold text-slate-800">
            {milestones.on_time_rate}%
          </span>
        </div>
        <div className="text-sm text-slate-600">
          <p><strong>{milestones.on_time}</strong> jalons à l'heure sur <strong>{milestones.total}</strong></p>
          <p className="text-xs text-slate-400 mt-1">Forecast ≤ Baseline ou jalon atteint</p>
        </div>
      </div>
    </div>
  );
}

function RisksWidget({ kpis }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="cxo-widget-risks">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Risques</h3>
      <div className="flex items-center gap-6">
        <div>
          <p className="font-mono-data text-3xl font-bold text-rose-600">{kpis.critical_risks}</p>
          <p className="text-xs text-slate-500">critiques (criticité ≥ 9)</p>
        </div>
        <div>
          <p className="font-mono-data text-3xl font-bold text-slate-800">{kpis.total_risks}</p>
          <p className="text-xs text-slate-500">risques au total</p>
        </div>
      </div>
    </div>
  );
}

function TopProjectsWidget({ projects }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2" data-testid="cxo-widget-top-projects">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Top 5 projets par budget</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-gray-100">
            <th className="py-2">Projet</th>
            <th className="py-2 text-right">Budget</th>
            <th className="py-2 text-right">Consommé</th>
            <th className="py-2 text-right">RAG</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.project_id} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5">
                <Link to={`/projects/${p.project_id}`} className="text-[#0052CC] hover:underline font-medium">
                  {p.name}
                </Link>
              </td>
              <td className="py-2.5 text-right font-mono-data">{formatEuro(p.budget_total)}</td>
              <td className="py-2.5 text-right font-mono-data">{formatEuro(p.budget_consumed)}</td>
              <td className="py-2.5 text-right"><RAGBadge status={p.status_rag} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardCxO() {
  const [data, setData] = useState(null);
  const [widgets, setWidgets] = useState(null);
  const [available, setAvailable] = useState([]);
  const [customizing, setCustomizing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [cxoRes, prefRes] = await Promise.all([
      dashboardAPI.cxo(),
      dashboardAPI.getCxoPreferences(),
    ]);
    setData(cxoRes.data);
    setWidgets(prefRes.data.widgets);
    setAvailable(prefRes.data.available);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const toggleWidget = (w) => {
    setWidgets((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]));
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await dashboardAPI.updateCxoPreferences({ widgets });
      setCustomizing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!data || !widgets) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw size={18} className="animate-spin mr-2" /> Chargement du dashboard CxO…
      </div>
    );
  }

  const show = (w) => widgets.includes(w);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto" data-testid="cxo-dashboard-page">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#0052CC] rounded flex items-center justify-center">
            <Gauge size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-slate-800">Dashboard CxO</h1>
            <p className="text-xs text-slate-400">Vue consolidée du portefeuille — personnalisable</p>
          </div>
        </div>
        <button
          data-testid="cxo-customize-btn"
          onClick={() => setCustomizing((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-slate-600 hover:bg-gray-50 transition-colors"
        >
          <Settings2 size={14} /> Personnaliser
        </button>
      </div>

      {customizing && (
        <div className="mb-6 bg-white border border-[#0052CC]/30 rounded-xl p-4" data-testid="cxo-customize-panel">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">Widgets affichés</p>
            <div className="flex gap-2">
              <button
                data-testid="cxo-prefs-save-btn"
                onClick={savePrefs}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#0052CC] text-white rounded-lg disabled:opacity-50"
              >
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />} Enregistrer
              </button>
              <button onClick={() => setCustomizing(false)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {available.map((w) => (
              <button
                key={w}
                data-testid={`cxo-widget-toggle-${w}`}
                onClick={() => toggleWidget(w)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  widgets.includes(w)
                    ? "bg-[#EBF2FF] border-[#0052CC] text-[#0052CC]"
                    : "bg-white border-gray-200 text-slate-400"
                }`}
              >
                {WIDGET_LABELS[w] || w}
              </button>
            ))}
          </div>
        </div>
      )}

      {show("kpis") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="cxo-widget-kpis">
          <KpiCard icon={Briefcase} label="Projets" value={data.kpis.total_projects} testid="cxo-kpi-projects" />
          <KpiCard icon={FolderKanban} label="Programmes" value={data.kpis.total_programs} testid="cxo-kpi-programs" />
          <KpiCard icon={TrendingUp} label="Projets actifs" value={data.kpis.active_projects} testid="cxo-kpi-active" />
          <KpiCard icon={AlertTriangle} label="Risques critiques" value={data.kpis.critical_risks} accent="text-rose-600" testid="cxo-kpi-risks" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {show("rag") && <RagBar rag={data.rag} />}
        {show("budget") && <BudgetWidget budget={data.budget} />}
        {show("milestones") && <MilestonesWidget milestones={data.milestones} />}
        {show("risks") && <RisksWidget kpis={data.kpis} />}
        {show("top_projects") && <TopProjectsWidget projects={data.top_projects} />}
      </div>
    </div>
  );
}
