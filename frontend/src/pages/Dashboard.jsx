import React, { useEffect, useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Settings2, RefreshCw, Check, X, Eye, EyeOff, Move, RotateCcw } from "lucide-react";
import { dashboardAPI, programsAPI, projectsAPI, teamsAPI, milestonesAPI, arbitrageAPI, agentAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import {
  MetricsWidget, BudgetDetailWidget, CapacityWidget, RegulatoryWidget,
  EnvelopeWidget, RecommendationsWidget, ChartsWidget, MilestonesGaugeWidget,
  UpcomingMilestonesWidget, TopProjectsWidget, PendingTimesheetsWidget,
  RecentDecisionsWidget, RecentProjectsWidget, TopRisksWidget, HeatmapWidget,
  TeamLoadWidget,
} from "@/components/dashboard/DashboardWidgets";

const ResponsiveGridLayout = WidthProvider(Responsive);

const WIDGET_LABELS = {
  metrics: "Indicateurs clés",
  budget_detail: "Détail budget & JH",
  capacity: "Alertes capacité",
  regulatory: "Alertes réglementaires",
  envelope: "Enveloppe portefeuille",
  ai_recommendations: "Recommandations IA",
  upcoming_milestones: "Jalons à venir (30j)",
  team_load: "Charge équipes",
  charts: "Graphiques budget & RAG",
  milestones_gauge: "Taux jalons à l'heure",
  top_projects: "Top 5 projets budget",
  pending_timesheets: "Timesheets à valider",
  recent_decisions: "Dernières décisions",
  recent_projects: "Projets récents",
  top_risks: "Top risques",
  heatmap: "Cartographie risques",
};

// Grille par défaut (12 colonnes, rowHeight 40)
const DEFAULT_GRID = {
  metrics:             { x: 0, y: 0,  w: 12, h: 4, minW: 4, minH: 3 },
  budget_detail:       { x: 0, y: 4,  w: 12, h: 4, minW: 4, minH: 3 },
  capacity:            { x: 0, y: 8,  w: 12, h: 3, minW: 4, minH: 2 },
  regulatory:          { x: 0, y: 11, w: 6,  h: 8, minW: 4, minH: 4 },
  envelope:            { x: 6, y: 11, w: 6,  h: 8, minW: 4, minH: 4 },
  ai_recommendations:  { x: 0, y: 19, w: 6,  h: 8, minW: 4, minH: 4 },
  upcoming_milestones: { x: 6, y: 19, w: 6,  h: 8, minW: 4, minH: 4 },
  team_load:           { x: 0, y: 27, w: 6,  h: 9, minW: 4, minH: 4 },
  milestones_gauge:    { x: 6, y: 27, w: 6,  h: 4, minW: 3, minH: 3 },
  top_projects:        { x: 6, y: 31, w: 6,  h: 5, minW: 4, minH: 4 },
  charts:              { x: 0, y: 36, w: 12, h: 9, minW: 6, minH: 6 },
  pending_timesheets:  { x: 0, y: 45, w: 6,  h: 6, minW: 3, minH: 4 },
  recent_decisions:    { x: 6, y: 45, w: 6,  h: 6, minW: 4, minH: 4 },
  recent_projects:     { x: 0, y: 51, w: 12, h: 8, minW: 6, minH: 4 },
  top_risks:           { x: 0, y: 59, w: 12, h: 9, minW: 6, minH: 4 },
  heatmap:             { x: 0, y: 68, w: 12, h: 12, minW: 6, minH: 6 },
};

function buildDefaultLayout(widgets) {
  return widgets.map((w) => ({ i: w, ...DEFAULT_GRID[w] }));
}

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
  const [teamLoad, setTeamLoad] = useState([]);
  const [loading, setLoading] = useState(true);

  // Personnalisation
  const [widgets, setWidgets] = useState(null);
  const [available, setAvailable] = useState([]);
  const [layouts, setLayouts] = useState(null);
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
      teamsAPI.capacityHeatmap(3),
    ]).then(([sRes, rRes, hrRes, pRes, projRes, caRes, regRes, cxoRes, exRes, prefRes, tlRes]) => {
      setSummary(sRes.data);
      setTopRisks(rRes.data);
      setHeatmapRisks(hrRes.data);
      setPrograms(pRes.data);
      setAllProjects(projRes.data);
      setCapacityAlerts(caRes.data);
      setRegulatoryAlerts((regRes.data || []).filter((m) => m.urgency_color !== "done" && m.target_date).slice(0, 5));
      setCxo(cxoRes.data);
      setExtras(exRes.data);
      setTeamLoad(tlRes.data || []);
      setWidgets(prefRes.data.widgets);
      setAvailable(prefRes.data.available);
      setLayouts(prefRes.data.layouts || { lg: buildDefaultLayout(prefRes.data.widgets) });
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

  const resetLayout = () => setLayouts({ lg: buildDefaultLayout(widgets) });

  const savePrefs = async () => {
    setSaving(true);
    try {
      await dashboardAPI.updateDashboardPreferences({ widgets, layouts });
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
  if (!summary || !widgets || !layouts) return null;

  const RENDERERS = {
    metrics: () => <MetricsWidget summary={summary} />,
    budget_detail: () => <BudgetDetailWidget summary={summary} />,
    capacity: () => <CapacityWidget capacityAlerts={capacityAlerts} />,
    regulatory: () => <RegulatoryWidget regulatoryAlerts={regulatoryAlerts} />,
    envelope: () => (canSeeEnvelope ? <EnvelopeWidget arbitrageData={arbitrageData} /> : null),
    ai_recommendations: () => (canSeeEnvelope ? <RecommendationsWidget recommendations={recommendations} /> : null),
    upcoming_milestones: () => <UpcomingMilestonesWidget extras={extras} />,
    team_load: () => <TeamLoadWidget teamLoad={teamLoad} />,
    charts: () => <ChartsWidget summary={summary} />,
    milestones_gauge: () => <MilestonesGaugeWidget cxo={cxo} />,
    top_projects: () => <TopProjectsWidget cxo={cxo} />,
    pending_timesheets: () => <PendingTimesheetsWidget extras={extras} />,
    recent_decisions: () => <RecentDecisionsWidget extras={extras} />,
    recent_projects: () => <RecentProjectsWidget summary={summary} />,
    top_risks: () => <TopRisksWidget topRisks={topRisks} />,
    heatmap: () => <HeatmapWidget heatmapRisks={heatmapRisks} programs={programs} allProjects={allProjects} />,
  };

  const visible = widgets.filter((w) => RENDERERS[w]);

  const HAS_CONTENT = {
    capacity: capacityAlerts.length > 0,
    regulatory: regulatoryAlerts.length > 0,
    envelope: canSeeEnvelope && !!arbitrageData?.envelopes?.length,
    ai_recommendations: canSeeEnvelope && recommendations.length > 0,
    upcoming_milestones: (extras?.upcoming_milestones || []).length > 0,
    team_load: teamLoad.length > 0,
    pending_timesheets: (extras?.pending_timesheets?.count || 0) > 0,
    recent_decisions: (extras?.recent_decisions || []).length > 0,
    top_risks: topRisks.length > 0,
    heatmap: heatmapRisks.length > 0,
  };
  const hasContent = (w) => HAS_CONTENT[w] !== false;
  // Hors édition : ne pas laisser de cases vides pour les widgets sans données
  const gridWidgets = customizing ? visible : visible.filter(hasContent);

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
        <div className="flex items-center gap-2 shrink-0">
          {customizing && (
            <button
              data-testid="dashboard-reset-layout-btn"
              onClick={resetLayout}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white rounded-lg text-sm text-slate-500 hover:bg-gray-50 transition-colors"
              title="Réinitialiser la disposition"
            >
              <RotateCcw size={13} /> <span className="hidden sm:inline">Réinitialiser</span>
            </button>
          )}
          <button
            data-testid="dashboard-customize-btn"
            onClick={() => setCustomizing((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${customizing ? "bg-[#0052CC] border-[#0052CC] text-white" : "bg-white border-gray-200 text-slate-600 hover:bg-gray-50"}`}
          >
            <Settings2 size={14} /> <span className="hidden sm:inline">{customizing ? "Mode édition" : "Personnaliser"}</span>
          </button>
        </div>
      </div>

      {/* Panneau de personnalisation */}
      {customizing && (
        <div className="mb-5 bg-white border border-[#0052CC]/30 rounded-xl p-4" data-testid="dashboard-customize-panel">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Move size={14} className="text-[#0052CC]" /> Mode édition actif
              </p>
              <p className="text-[11px] text-slate-400">
                Glissez-déposez les widgets pour les repositionner, tirez le coin bas-droit pour les redimensionner.
                Activez/désactivez les blocs ci-dessous, puis Enregistrer.
              </p>
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
          <div className="flex flex-wrap gap-1.5">
            {available.map((w) => {
              const on = widgets.includes(w);
              return (
                <button
                  key={w}
                  data-testid={`dashboard-widget-toggle-${w}`}
                  onClick={() => toggleWidget(w)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? "bg-[#EBF2FF] border-[#0052CC] text-[#0052CC]" : "bg-white border-gray-200 text-slate-400"}`}
                >
                  {on ? <Eye size={11} /> : <EyeOff size={11} />}
                  {WIDGET_LABELS[w] || w}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grille matricielle */}
      <ResponsiveGridLayout
        className={customizing ? "dashboard-grid-editing" : ""}
        layouts={layouts}
        breakpoints={{ lg: 996, md: 768, sm: 480, xs: 0 }}
        cols={{ lg: 12, md: 8, sm: 4, xs: 2 }}
        rowHeight={40}
        margin={[14, 14]}
        containerPadding={[0, 0]}
        isDraggable={customizing}
        isResizable={customizing}
        draggableCancel="a, button, select, input, textarea"
        onLayoutChange={(_cur, allLayouts) => { if (customizing) setLayouts(allLayouts); }}
        compactType="vertical"
      >
        {gridWidgets.map((w) => (
          <div
            key={w}
            data-grid={{ i: w, ...DEFAULT_GRID[w] }}
            className={`h-full overflow-y-auto overflow-x-hidden rounded ${customizing ? "ring-2 ring-[#0052CC]/30 ring-offset-2 cursor-move bg-white/50" : ""}`}
            data-testid={`grid-item-${w}`}
          >
            {customizing && (
              <div className="sticky top-0 z-10 flex items-center gap-1.5 px-2 py-1 bg-[#0052CC] text-white text-[10px] font-semibold rounded-t">
                <Move size={10} /> {WIDGET_LABELS[w]}
              </div>
            )}
            {hasContent(w) ? RENDERERS[w]() : (
              <div className="h-full flex items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded text-xs text-slate-400 p-4 text-center">
                {WIDGET_LABELS[w]} — aucune donnée actuellement (masqué hors édition)
              </div>
            )}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
