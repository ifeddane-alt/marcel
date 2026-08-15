import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Settings2, RefreshCw, Check, X, Move, RotateCcw, Plus, GripVertical, FileDown, MonitorPlay } from "lucide-react";
import { dashboardAPI, programsAPI, projectsAPI, teamsAPI, milestonesAPI, arbitrageAPI, agentAPI, resourcesAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { IndicatorsPanel } from "@/components/IndicatorsPanel";
import PortfolioAiReport from "@/components/PortfolioAiReport";
import {
  MetricSingleWidget, BudgetSingleWidget, CapacityWidget, RegulatoryWidget,
  EnvelopeWidget, RecommendationsWidget, ChartBudgetWidget, ChartRagWidget,
  MilestonesGaugeWidget, UpcomingMilestonesWidget, TopProjectsWidget,
  PendingTimesheetsWidget, RecentDecisionsWidget, RecentProjectsWidget,
  TopRisksWidget, HeatmapWidget, TeamLoadWidget, ContractsExpiryWidget,
} from "@/components/dashboard/DashboardWidgets";

const ResponsiveGridLayout = WidthProvider(Responsive);

const WIDGET_LABELS = {
  metric_projects: "Projets totaux",
  metric_green: "Projets verts",
  metric_at_risk: "Projets à risque",
  metric_budget: "Budget total",
  budget_consumed: "Budget consommé",
  budget_forecast: "Budget forecast",
  jh_progress: "JH consommés",
  capacity: "Alertes capacité",
  regulatory: "Alertes réglementaires",
  envelope: "Enveloppe portefeuille",
  ai_recommendations: "Recommandations IA",
  upcoming_milestones: "Jalons à venir (30j)",
  team_load: "Charge équipes",
  chart_budget: "Graphique budget",
  chart_rag: "Distribution RAG",
  milestones_gauge: "Taux jalons à l'heure",
  top_projects: "Top 5 projets budget",
  pending_timesheets: "Timesheets à valider",
  recent_decisions: "Dernières décisions",
  recent_projects: "Projets récents",
  top_risks: "Top risques",
  heatmap: "Cartographie risques",
  contracts_expiry: "Contrats à renouveler (60j)",
};

// Grille par défaut (12 colonnes, rowHeight 40)
const DEFAULT_GRID = {
  metric_projects:     { x: 0, y: 0,  w: 3,  h: 3, minW: 2, minH: 2 },
  metric_green:        { x: 3, y: 0,  w: 3,  h: 3, minW: 2, minH: 2 },
  metric_at_risk:      { x: 6, y: 0,  w: 3,  h: 3, minW: 2, minH: 2 },
  metric_budget:       { x: 9, y: 0,  w: 3,  h: 3, minW: 2, minH: 2 },
  budget_consumed:     { x: 0, y: 3,  w: 4,  h: 4, minW: 2, minH: 3 },
  budget_forecast:     { x: 4, y: 3,  w: 4,  h: 4, minW: 2, minH: 3 },
  jh_progress:         { x: 8, y: 3,  w: 4,  h: 4, minW: 2, minH: 3 },
  capacity:            { x: 0, y: 7,  w: 12, h: 3, minW: 4, minH: 2 },
  regulatory:          { x: 0, y: 10, w: 6,  h: 5, minW: 4, minH: 3 },
  envelope:            { x: 6, y: 10, w: 6,  h: 5, minW: 4, minH: 3 },
  ai_recommendations:  { x: 0, y: 15, w: 6,  h: 7, minW: 4, minH: 4 },
  upcoming_milestones: { x: 6, y: 15, w: 6,  h: 7, minW: 4, minH: 4 },
  team_load:           { x: 0, y: 26, w: 6,  h: 9, minW: 4, minH: 4 },
  milestones_gauge:    { x: 6, y: 26, w: 6,  h: 4, minW: 3, minH: 3 },
  top_projects:        { x: 6, y: 30, w: 6,  h: 5, minW: 4, minH: 4 },
  contracts_expiry:    { x: 0, y: 30, w: 6,  h: 5, minW: 4, minH: 3 },
  chart_budget:        { x: 0, y: 35, w: 8,  h: 8, minW: 4, minH: 5 },
  chart_rag:           { x: 8, y: 35, w: 4,  h: 8, minW: 3, minH: 5 },
  pending_timesheets:  { x: 0, y: 43, w: 6,  h: 6, minW: 3, minH: 4 },
  recent_decisions:    { x: 6, y: 43, w: 6,  h: 6, minW: 4, minH: 4 },
  recent_projects:     { x: 0, y: 49, w: 12, h: 8, minW: 6, minH: 4 },
  top_risks:           { x: 0, y: 57, w: 12, h: 9, minW: 6, minH: 4 },
  heatmap:             { x: 0, y: 66, w: 12, h: 12, minW: 6, minH: 6 },
};

const ALL_WIDGETS = Object.keys(DEFAULT_GRID);

// Migration des anciens ids composites vers les éléments individuels
const LEGACY_MAP = {
  metrics: ["metric_projects", "metric_green", "metric_at_risk", "metric_budget"],
  budget_detail: ["budget_consumed", "budget_forecast", "jh_progress"],
  charts: ["chart_budget", "chart_rag"],
};

function migrateWidgets(list) {
  const out = [];
  for (const w of list) {
    if (LEGACY_MAP[w]) out.push(...LEGACY_MAP[w]);
    else if (DEFAULT_GRID[w]) out.push(w);
  }
  return [...new Set(out)];
}

function buildDefaultLayout(widgets) {
  return widgets.map((w) => ({ i: w, ...DEFAULT_GRID[w] }));
}

function migrateLayouts(layouts, widgets) {
  if (!layouts) return { lg: buildDefaultLayout(widgets) };
  const hasLegacy = Object.values(layouts).some((arr) => (arr || []).some((it) => LEGACY_MAP[it.i]));
  if (hasLegacy) return { lg: buildDefaultLayout(widgets) };
  return layouts;
}

export default function Dashboard() {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
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
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  const [widgets, setWidgets] = useState(null);
  const [layouts, setLayouts] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragWidget, setDragWidget] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [aiReportOpen, setAiReportOpen] = useState(false);

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await dashboardAPI.exportPdf();
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `MARCEL_Rapport_COMEX_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExportingPdf(false);
    }
  };

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
      const migrated = migrateWidgets(Array.isArray(prefRes.data.widgets) ? prefRes.data.widgets : ALL_WIDGETS);
      setWidgets(migrated);
      setLayouts(migrateLayouts(prefRes.data.layouts, migrated));
      setLoading(false);
    }).catch(() => setLoading(false));

    resourcesAPI.list().then((r) => setResources(r.data || [])).catch(() => {});

    if (canSeeEnvelope) {
      agentAPI.getRecommendations().then(r => setRecommendations((r.data || []).slice(0, 5))).catch(() => {});
      Promise.all([arbitrageAPI.getEnvelopes(), arbitrageAPI.getSummary()]).then(([envRes, sumRes]) => {
        const envelopes = envRes.data || [];
        if (envelopes.length > 0) setArbitrageData({ envelopes, totals: sumRes.data?.totals || {} });
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hideWidget = (w) => setWidgets((cur) => cur.filter((x) => x !== w));
  const showWidget = (w) => setWidgets((cur) => [...cur, w]);
  const resetLayout = () => {
    setWidgets([]);
    setLayouts({ lg: [] });
  };

  const savePrefs = async () => {
    setSaving(true);
    try {
      await dashboardAPI.updateDashboardPreferences({ widgets, layouts });
      setCustomizing(false);
    } finally {
      setSaving(false);
    }
  };

  // Drop d'un bloc depuis la barre de choix vers la grille (gestion HTML5 manuelle)
  const gridWrapRef = React.useRef(null);
  const COLS = 12, ROW_H = 40, MARGIN = 14;

  const handleGridDragOver = (e) => {
    if (dragWidget) e.preventDefault();
  };

  const handleGridDrop = (e) => {
    const id = dragWidget || e.dataTransfer?.getData("text/plain");
    if (!id || !DEFAULT_GRID[id]) return;
    e.preventDefault();
    setDragWidget(null);
    const rect = gridWrapRef.current?.getBoundingClientRect();
    const def = DEFAULT_GRID[id];
    let x = 0, y = 0;
    if (rect) {
      const colW = rect.width / COLS;
      x = Math.max(0, Math.min(COLS - def.w, Math.round((e.clientX - rect.left) / colW)));
      y = Math.max(0, Math.floor((e.clientY - rect.top) / (ROW_H + MARGIN)));
    }
    setLayouts((cur) => {
      const base = cur?.lg || buildDefaultLayout(widgets);
      const existing = base.find((l) => l.i === id);
      const lg = base.filter((l) => l.i !== id);
      return { ...cur, lg: [...lg, { i: id, x, y, w: existing?.w ?? def.w, h: existing?.h ?? def.h }] };
    });
    setWidgets((cur) => (cur.includes(id) ? cur : [...cur, id]));
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-zinc-400 text-sm">
        Chargement du tableau de bord...
      </div>
    );
  }
  if (!summary || !widgets || !layouts) return null;

  const RENDERERS = {
    metric_projects: () => <MetricSingleWidget summary={summary} kind="metric_projects" />,
    metric_green: () => <MetricSingleWidget summary={summary} kind="metric_green" />,
    metric_at_risk: () => <MetricSingleWidget summary={summary} kind="metric_at_risk" />,
    metric_budget: () => <MetricSingleWidget summary={summary} kind="metric_budget" />,
    budget_consumed: () => <BudgetSingleWidget summary={summary} kind="budget_consumed" />,
    budget_forecast: () => <BudgetSingleWidget summary={summary} kind="budget_forecast" />,
    jh_progress: () => <BudgetSingleWidget summary={summary} kind="jh_progress" />,
    capacity: () => <CapacityWidget capacityAlerts={capacityAlerts} />,
    regulatory: () => <RegulatoryWidget regulatoryAlerts={regulatoryAlerts} />,
    envelope: () => (canSeeEnvelope ? <EnvelopeWidget arbitrageData={arbitrageData} /> : null),
    ai_recommendations: () => (canSeeEnvelope ? <RecommendationsWidget recommendations={recommendations} /> : null),
    upcoming_milestones: () => <UpcomingMilestonesWidget extras={extras} />,
    team_load: () => <TeamLoadWidget teamLoad={teamLoad} />,
    chart_budget: () => <ChartBudgetWidget summary={summary} />,
    chart_rag: () => <ChartRagWidget summary={summary} />,
    milestones_gauge: () => <MilestonesGaugeWidget cxo={cxo} />,
    top_projects: () => <TopProjectsWidget cxo={cxo} />,
    pending_timesheets: () => <PendingTimesheetsWidget extras={extras} />,
    recent_decisions: () => <RecentDecisionsWidget extras={extras} />,
    recent_projects: () => <RecentProjectsWidget summary={summary} />,
    top_risks: () => <TopRisksWidget topRisks={topRisks} />,
    heatmap: () => <HeatmapWidget heatmapRisks={heatmapRisks} programs={programs} allProjects={allProjects} />,
    contracts_expiry: () => <ContractsExpiryWidget resources={resources} />,
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
    contracts_expiry: resources.some((r) => r.contract_end && (new Date(r.contract_end) - Date.now()) / 86400000 <= 60),
  };
  const hasContent = (w) => HAS_CONTENT[w] !== false;
  const gridWidgets = customizing ? visible : visible.filter(hasContent);

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[#8a87a0] mb-0.5">Accueil / <span className="text-[#352c6e] font-semibold">Tableau de bord</span></div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#26243a] tracking-tight">
            Tableau de Bord
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Vue synthétique du portefeuille projets — personnalisable
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!customizing && (
            <button
              data-testid="dashboard-ai-report-btn"
              onClick={() => setAiReportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-violet-200 bg-violet-50 rounded-lg text-sm text-violet-700 hover:bg-violet-100 transition-colors"
              title="Rapport IA consolidé du portefeuille"
            >
              <span className="text-[13px]">✦</span>
              <span className="hidden sm:inline">Rapport IA</span>
            </button>
          )}
          {!customizing && (
            <button
              data-testid="dashboard-presentation-btn"
              onClick={() => navigate("/presentation")}
              className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 bg-white rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              title="Mode présentation COMEX plein écran"
            >
              <MonitorPlay size={13} />
              <span className="hidden sm:inline">Présentation</span>
            </button>
          )}
          {!customizing && (
            <button
              data-testid="dashboard-export-pdf-btn"
              onClick={exportPdf}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 bg-white rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
              title="Exporter le rapport COMEX en PDF"
            >
              {exportingPdf ? <RefreshCw size={13} className="animate-spin" /> : <FileDown size={13} />}
              <span className="hidden sm:inline">PDF COMEX</span>
            </button>
          )}
          {customizing && (
            <>
              <button
                data-testid="dashboard-reset-layout-btn"
                onClick={resetLayout}
                className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 bg-white rounded-lg text-sm text-zinc-500 hover:bg-zinc-50 transition-colors"
                title="Tout désélectionner — retire tous les blocs du tableau de bord"
              >
                <RotateCcw size={13} /> <span className="hidden sm:inline">Réinitialiser</span>
              </button>
              <button
                data-testid="dashboard-prefs-save-btn"
                onClick={savePrefs}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg disabled:opacity-50 hover:bg-emerald-700 transition-colors"
              >
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Enregistrer
              </button>
            </>
          )}
          <button
            data-testid="dashboard-customize-btn"
            onClick={() => setCustomizing((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors ${customizing ? "bg-[#2e5fe8] border-[#2e5fe8] text-white" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
          >
            {customizing ? <X size={14} /> : <Settings2 size={14} />}
            <span className="hidden sm:inline">{customizing ? "Quitter l'édition" : "Personnaliser"}</span>
          </button>
        </div>
      </div>

      {/* Barre de choix des blocs */}
      {customizing && (
        <div className="mb-4 bg-white border border-blue-600/30 rounded-xl px-3 py-2.5" data-testid="dashboard-blocks-bar">
          <p className="text-[11px] font-semibold text-zinc-500 mb-2">
            Blocs du tableau de bord — cliquez pour afficher / masquer, ou <strong>glissez n'importe quel bloc vers l'emplacement voulu dans la grille</strong> :
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_WIDGETS.map((w) => {
              const on = widgets.includes(w);
              return (
                <button
                  key={w}
                  data-testid={`dashboard-widget-toggle-${w}`}
                  onClick={() => (on ? hideWidget(w) : showWidget(w))}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", w);
                    e.dataTransfer.effectAllowed = "move";
                    setDragWidget(w);
                  }}
                  onDragEnd={() => setDragWidget(null)}
                  title={on ? "Cliquer pour masquer, ou glisser pour repositionner dans la grille" : "Cliquer pour ajouter, ou glisser dans la grille"}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-grab active:cursor-grabbing ${on ? "bg-blue-50 border-blue-600 text-blue-600" : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-zinc-400"}`}
                >
                  {on ? <Check size={10} /> : <GripVertical size={10} />}
                  <GripVertical size={10} className={on ? "opacity-40" : "hidden"} /> {WIDGET_LABELS[w] || w}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {customizing && (
        <p className="mb-4 text-[11px] text-zinc-400 flex items-center gap-1.5" data-testid="dashboard-edit-hint">
          <Move size={11} className="text-blue-600" />
          Glissez-déposez chaque bloc pour le repositionner, tirez le coin bas-droit pour le redimensionner, croix pour masquer un bloc.
        </p>
      )}

      {!customizing && gridWidgets.length === 0 && (
        <div className="bg-white border border-dashed border-[#e8e6f0] rounded-xl p-10 text-center" data-testid="dashboard-empty-state">
          <p className="text-sm text-zinc-500 font-medium">Aucun bloc affiché sur le tableau de bord.</p>
          <p className="text-xs text-zinc-400 mt-1">Cliquez sur « Personnaliser » puis sélectionnez les blocs à afficher.</p>
        </div>
      )}
      {customizing && gridWidgets.length === 0 && (
        <div className="mb-4 border-2 border-dashed border-blue-300 bg-blue-50/40 rounded-xl p-8 text-center text-sm text-blue-500" data-testid="dashboard-empty-dropzone-hint">
          Grille vide — cliquez sur un bloc dans la barre ci-dessus ou glissez-le dans la grille.
        </div>
      )}

      <div className="mb-4">
        <IndicatorsPanel scope="dashboard" title="Mes indicateurs" />
      </div>

      {/* Grille matricielle */}
      <div
        ref={gridWrapRef}
        onDragOver={handleGridDragOver}
        onDrop={handleGridDrop}
        className={dragWidget ? "ring-2 ring-dashed ring-blue-600/50 rounded-xl" : ""}
        data-testid="dashboard-grid-dropzone"
      >
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
        onLayoutChange={(cur, allLayouts) => {
          if (!customizing) return;
          setLayouts((prev) =>
            JSON.stringify(prev) === JSON.stringify(allLayouts) ? prev : allLayouts
          );
        }}
        compactType="vertical"
      >
        {gridWidgets.map((w) => (
          <div
            key={w}
            data-grid={{ i: w, ...DEFAULT_GRID[w] }}
            className={`h-full rounded-lg flex flex-col ${customizing ? "ring-2 ring-blue-600/30 ring-offset-2 cursor-move bg-white/50" : ""}`}
            data-testid={`grid-item-${w}`}
          >
            {customizing && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-600 text-white text-[10px] font-semibold rounded-t shrink-0">
                <Move size={10} />
                <span className="flex-1 truncate">{WIDGET_LABELS[w]}</span>
                <button
                  data-testid={`dashboard-widget-hide-${w}`}
                  onClick={() => hideWidget(w)}
                  className="p-0.5 rounded-lg hover:bg-white/20 transition-colors"
                  title="Masquer ce bloc"
                >
                  <X size={11} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {hasContent(w) ? RENDERERS[w]() : (
                <div className="h-full flex items-center justify-center bg-zinc-50 border border-dashed border-zinc-200 rounded-lg text-xs text-zinc-400 p-4 text-center">
                  {WIDGET_LABELS[w]} — aucune donnée actuellement (masqué hors édition)
                </div>
              )}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
      </div>

      {aiReportOpen && <PortfolioAiReport onClose={() => setAiReportOpen(false)} />}
    </div>
  );
}
