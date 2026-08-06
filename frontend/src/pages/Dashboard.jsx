import React, { useEffect, useState } from "react";
import { Settings2, RefreshCw, Check, X, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { dashboardAPI, programsAPI, projectsAPI, teamsAPI, milestonesAPI, arbitrageAPI, agentAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import {
  MetricsWidget, BudgetDetailWidget, CapacityWidget, RegulatoryWidget,
  EnvelopeWidget, RecommendationsWidget, ChartsWidget, MilestonesGaugeWidget,
  UpcomingMilestonesWidget, TopProjectsWidget, PendingTimesheetsWidget,
  RecentDecisionsWidget, RecentProjectsWidget, TopRisksWidget, HeatmapWidget,
} from "@/components/dashboard/DashboardWidgets";

const WIDGET_LABELS = {
  metrics: "Indicateurs clés",
  budget_detail: "Détail budget & JH",
  capacity: "Alertes capacité",
  regulatory: "Alertes réglementaires",
  envelope: "Enveloppe portefeuille",
  ai_recommendations: "Recommandations IA",
  upcoming_milestones: "Jalons à venir (30j)",
  charts: "Graphiques budget & RAG",
  milestones_gauge: "Taux jalons à l'heure",
  top_projects: "Top 5 projets budget",
  pending_timesheets: "Timesheets à valider",
  recent_decisions: "Dernières décisions",
  recent_projects: "Projets récents",
  top_risks: "Top risques",
  heatmap: "Cartographie risques",
};

export default function Dashboard() {
  const { hasPermission } = usePermissions();
  const canSeeEnvelope = hasPermission("arbitrage.view") || hasPermission("*");

  const [summary, setSummary] = useState(null);
  const [topRisks, setTopRisks] = useState([]);
  const [heatmapRisks, setHeatmapRisks] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [capacityAlerts, setCapacityAlerts] = useState([]);
  const [regulatoryAlerts, setRegulatoryAlerts] = useState([]);
  const [arbitrageData, setArbitrageData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [cxo, setCxo] = useState(null);
  const [extras, setExtras] = useState(null);
  const [loading, setLoading] = useState(true);

  // Personnalisation
  const [widgets, setWidgets] = useState(null);
  const [available, setAvailable] = useState([]);
  const [customizing, setCustomizing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      dashboardAPI.summary(),
      dashboardAPI.topRisks(),
      dashboardAPI.heatmapRisks(),
      programsAPI.list(),
      projectsAPI.list(),
      teamsAPI.capacityAlerts(),
      milestonesAPI.regulatory({ milestone_type: undefined }),
      dashboardAPI.cxo(),
      dashboardAPI.extras(),
      dashboardAPI.getDashboardPreferences(),
    ]).then(([sRes, rRes, hrRes, pRes, projRes, caRes, regRes, cxoRes, exRes, prefRes]) => {
      setSummary(sRes.data);
      setTopRisks(rRes.data);
      setHeatmapRisks(hrRes.data);
      setPrograms(pRes.data);
      setAllProjects(projRes.data);
      setCapacityAlerts(caRes.data);
      setRegulatoryAlerts((regRes.data || []).filter((m) => m.urgency_color !== "done" && m.target_date).slice(0, 5));
      setCxo(cxoRes.data);
      setExtras(exRes.data);
      setWidgets(prefRes.data.widgets);
      setAvailable(prefRes.data.available);
      setLoading(false);
    }).catch(() => setLoading(false));

    if (canSeeEnvelope) {
      agentAPI.getRecommendations().then(r => setRecommendations((r.data || []).slice(0, 5))).catch(() => {});
      Promise.all([arbitrageAPI.getEnvelopes(), arbitrageAPI.getSummary()]).then(([envRes, sumRes]) => {
        const envelopes = envRes.data || [];
        if (envelopes.length > 0) setArbitrageData({ envelopes, totals: sumRes.data?.totals || {} });
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleWidget = (w) =>
    setWidgets((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]));

  const moveWidget = (w, dir) =>
    setWidgets((cur) => {
      const i = cur.indexOf(w);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const savePrefs = async () => {
    setSaving(true);
    try {
      await dashboardAPI.updateDashboardPreferences({ widgets });
      setCustomizing(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-slate-400 text-sm">
        Chargement du tableau de bord...
      </div>
    );
  }
  if (!summary || !widgets) return null;

  const RENDERERS = {
    metrics: () => <MetricsWidget summary={summary} />,
    budget_detail: () => <BudgetDetailWidget summary={summary} />,
    capacity: () => <CapacityWidget capacityAlerts={capacityAlerts} />,
    regulatory: () => <RegulatoryWidget regulatoryAlerts={regulatoryAlerts} />,
    envelope: () => (canSeeEnvelope ? <EnvelopeWidget arbitrageData={arbitrageData} /> : null),
    ai_recommendations: () => (canSeeEnvelope ? <RecommendationsWidget recommendations={recommendations} /> : null),
    upcoming_milestones: () => <UpcomingMilestonesWidget extras={extras} />,
    charts: () => <ChartsWidget summary={summary} />,
    milestones_gauge: () => <MilestonesGaugeWidget cxo={cxo} />,
    top_projects: () => <TopProjectsWidget cxo={cxo} />,
    pending_timesheets: () => <PendingTimesheetsWidget extras={extras} />,
    recent_decisions: () => <RecentDecisionsWidget extras={extras} />,
    recent_projects: () => <RecentProjectsWidget summary={summary} />,
    top_risks: () => <TopRisksWidget topRisks={topRisks} />,
    heatmap: () => <HeatmapWidget heatmapRisks={heatmapRisks} programs={programs} allProjects={allProjects} />,
  };

  // Ordre : préférences d'abord, widgets connus uniquement
  const ordered = widgets.filter((w) => RENDERERS[w]);
  // Panneau : widgets visibles dans l'ordre + widgets masqués à la fin
  const panelList = [...ordered, ...available.filter((w) => !ordered.includes(w))];

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
            Tableau de Bord
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Vue synthétique du portefeuille projets — personnalisable
          </p>
        </div>
        <button
          data-testid="dashboard-customize-btn"
          onClick={() => setCustomizing((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-slate-600 hover:bg-gray-50 transition-colors shrink-0"
        >
          <Settings2 size={14} /> <span className="hidden sm:inline">Personnaliser</span>
        </button>
      </div>

      {/* Panneau de personnalisation */}
      {customizing && (
        <div className="mb-6 bg-white border border-[#0052CC]/30 rounded-xl p-4" data-testid="dashboard-customize-panel">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Widgets du tableau de bord</p>
              <p className="text-[11px] text-slate-400">Affichez, masquez et réordonnez les widgets. Les préférences sont propres à votre compte.</p>
            </div>
            <div className="flex gap-2">
              <button
                data-testid="dashboard-prefs-save-btn"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {panelList.map((w) => {
              const visible = ordered.includes(w);
              const idx = ordered.indexOf(w);
              return (
                <div
                  key={w}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${visible ? "bg-[#EBF2FF]/50 border-[#0052CC]/30" : "bg-gray-50 border-gray-200 text-slate-400"}`}
                  data-testid={`dashboard-widget-row-${w}`}
                >
                  <button
                    data-testid={`dashboard-widget-toggle-${w}`}
                    onClick={() => toggleWidget(w)}
                    className={visible ? "text-[#0052CC]" : "text-slate-300"}
                    title={visible ? "Masquer" : "Afficher"}
                  >
                    {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <span className={`flex-1 font-medium ${visible ? "text-slate-700" : ""}`}>{WIDGET_LABELS[w] || w}</span>
                  {visible && (
                    <div className="flex gap-0.5">
                      <button
                        data-testid={`dashboard-widget-up-${w}`}
                        onClick={() => moveWidget(w, -1)}
                        disabled={idx === 0}
                        className="p-0.5 text-slate-400 hover:text-[#0052CC] disabled:opacity-30"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        data-testid={`dashboard-widget-down-${w}`}
                        onClick={() => moveWidget(w, 1)}
                        disabled={idx === ordered.length - 1}
                        className="p-0.5 text-slate-400 hover:text-[#0052CC] disabled:opacity-30"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Widgets dans l'ordre des préférences */}
      {ordered.map((w) => (
        <React.Fragment key={w}>{RENDERERS[w]()}</React.Fragment>
      ))}
    </div>
  );
}
