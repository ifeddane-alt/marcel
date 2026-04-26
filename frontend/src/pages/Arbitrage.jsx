import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import {
  Target, TrendingUp, BarChart2, Sliders, Save, RotateCcw,
  PlayCircle, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp,
  Plus, Trash2, Edit3, X, Check, FileDown, GitCompare, Eye, ArrowRight,
} from "lucide-react";
import { arbitrageAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { formatEuro } from "@/utils/format";
import { toast } from "sonner";

/* ─── Constantes ────────────────────────────────────────────────────────────── */
const RAG_COLORS = { green: "#10B981", orange: "#F59E0B", red: "#EF4444" };
const STATUS_LABELS = {
  actif: "Actif", en_pause: "En pause", terminé: "Terminé", en_preparation: "En préparation",
};
const SCORE_COLOR = (s) => {
  if (s >= 70) return "text-emerald-600";
  if (s >= 50) return "text-amber-600";
  return "text-red-500";
};
const SCORE_BG = (s) => {
  if (s >= 70) return "bg-emerald-50 border-emerald-200";
  if (s >= 50) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
};

const CRITERIA_LABELS = [
  { key: "strategic_alignment", label: "Alignement Strat.", color: "#6366F1", abbr: "ALI" },
  { key: "business_value",      label: "Valeur Business",   color: "#10B981", abbr: "VAL" },
  { key: "roi_estimated",       label: "ROI Estimé",        color: "#3B82F6", abbr: "ROI" },
  { key: "urgency",             label: "Urgence",            color: "#F59E0B", abbr: "URG" },
  { key: "risk_score",          label: "Risque",             color: "#EF4444", abbr: "RSK" },
  { key: "complexity",          label: "Complexité",         color: "#8B5CF6", abbr: "CPX" },
];

const WEIGHT_KEYS = [
  { key: "w1", label: "Alignement Stratégique", sign: "+" },
  { key: "w2", label: "Valeur Business",         sign: "+" },
  { key: "w3", label: "ROI Estimé",              sign: "+" },
  { key: "w4", label: "Urgence",                 sign: "+" },
  { key: "w5", label: "Risque",                  sign: "−" },
  { key: "w6", label: "Complexité",              sign: "−" },
];

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function formatPct(val, total) {
  if (!total) return "0%";
  return `${Math.round((val / total) * 100)}%`;
}

function CriteriaBar({ value }) {
  const pct = ((value || 0) / 5) * 100;
  return (
    <div className="flex items-center gap-1">
      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-500 w-4">{value || "—"}</span>
    </div>
  );
}

function ScoreBadge({ score }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${SCORE_BG(score)}`}>
      <span className={SCORE_COLOR(score)}>{score}</span>
    </span>
  );
}

/* ─── Composant principal ─────────────────────────────────────────────────────── */
export default function Arbitrage() {
  const { hasPermission } = usePermissions();
  const canEdit     = hasPermission("arbitrage.edit") || hasPermission("*");
  const canSimulate = hasPermission("arbitrage.simulate") || hasPermission("*");

  const [activeTab, setActiveTab]       = useState("scoring");
  const [summary, setSummary]           = useState(null);
  const [envelopes, setEnvelopes]       = useState([]);
  const [scenarios, setScenarios]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showWeightsModal, setShowWeightsModal] = useState(false);
  const [weights, setWeights]           = useState(null);
  const [pendingWeights, setPendingWeights] = useState(null);
  const [savingWeights, setSavingWeights] = useState(false);

  // Inline editing state
  const [editingCell, setEditingCell]   = useState(null); // {projectId, field}
  const [editingValue, setEditingValue] = useState("");

  // Simulateur sandbox state
  const [sandbox, setSandbox]           = useState(null);  // cloned projects
  const [sandboxDirty, setSandboxDirty] = useState(false);
  const [saveScenarioModal, setSaveScenarioModal] = useState(false);
  const [scenarioName, setScenarioName] = useState("");

  // Scénarios tab state
  const [detailScenario, setDetailScenario]   = useState(null);
  const [compareA, setCompareA]               = useState(null);
  const [compareB, setCompareB]               = useState(null);
  const [compareMode, setCompareMode]         = useState(false);
  const [scenarioDesc, setScenarioDesc] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  // Envelope modal
  const [envModal, setEnvModal]         = useState(false);
  const [envForm, setEnvForm]           = useState({ year: 2026, capex_envelope: 0, opex_envelope: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, envRes, scRes] = await Promise.all([
        arbitrageAPI.getSummary(),
        arbitrageAPI.getEnvelopes(),
        arbitrageAPI.getScenarios(),
      ]);
      setSummary(sumRes.data);
      setWeights(sumRes.data.weights);
      setPendingWeights({ ...sumRes.data.weights });
      setEnvelopes(envRes.data);
      setScenarios(scRes.data);
      // Init sandbox avec les projets réels
      setSandbox(sumRes.data.projects.map(p => ({ ...p })));
    } catch {
      toast.error("Erreur lors du chargement des données d'arbitrage");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Scoring inline edit ──────────────────────────────────────────────────────

  const handleCellEdit = (projectId, field, currentValue) => {
    if (!canEdit) return;
    setEditingCell({ projectId, field });
    setEditingValue(String(currentValue || 3));
  };

  const handleCellSave = async () => {
    if (!editingCell) return;
    const { projectId, field } = editingCell;
    const val = Math.max(1, Math.min(5, parseInt(editingValue) || 3));
    try {
      await arbitrageAPI.patchScoring(projectId, { [field]: val });
      setSummary(prev => {
        const projects = prev.projects.map(p =>
          p.project_id === projectId ? { ...p, [field]: val } : p
        );
        return { ...prev, projects };
      });
      // Recompute scores
      await load();
      toast.success("Score mis à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
    setEditingCell(null);
  };

  // ── Poids ────────────────────────────────────────────────────────────────────

  const handleSaveWeights = async () => {
    setSavingWeights(true);
    try {
      await arbitrageAPI.updateWeights(pendingWeights);
      setWeights({ ...pendingWeights });
      await load();
      setShowWeightsModal(false);
      toast.success("Poids mis à jour");
    } catch {
      toast.error("Erreur lors de la sauvegarde des poids");
    } finally {
      setSavingWeights(false);
    }
  };

  // ── Export PDF ───────────────────────────────────────────────────────────────

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const { REACT_APP_BACKEND_URL } = process.env;
      const token = localStorage.getItem("projetenne_token") || sessionStorage.getItem("projetenne_token");
      const res = await fetch(`${REACT_APP_BACKEND_URL}/api/arbitrage/export-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur export PDF");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "scorecard_arbitrage.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF téléchargé");
    } catch {
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Enveloppes ───────────────────────────────────────────────────────────────

  const handleUpsertEnvelope = async () => {
    try {
      await arbitrageAPI.upsertEnvelope(envForm);
      const envRes = await arbitrageAPI.getEnvelopes();
      setEnvelopes(envRes.data);
      setEnvModal(false);
      toast.success("Enveloppe sauvegardée");
    } catch {
      toast.error("Erreur lors de la sauvegarde de l'enveloppe");
    }
  };

  // ── Simulateur ───────────────────────────────────────────────────────────────

  const handleSandboxChange = (projectId, field, value) => {
    setSandbox(prev => prev.map(p =>
      p.project_id === projectId ? { ...p, [field]: value } : p
    ));
    setSandboxDirty(true);
  };

  const resetSandbox = () => {
    setSandbox(summary?.projects.map(p => ({ ...p })) || []);
    setSandboxDirty(false);
    toast("Simulateur réinitialisé");
  };

  const computeSandboxScore = (project) => {
    if (!weights) return 0;
    const { w1 = 0.20, w2 = 0.25, w3 = 0.15, w4 = 0.15, w5 = 0.15, w6 = 0.10 } = weights;
    const a = parseFloat(project.strategic_alignment || 3);
    const b = parseFloat(project.business_value || 3);
    const r = parseFloat(project.roi_estimated || 3);
    const u = parseFloat(project.urgency || 3);
    const k = parseFloat(project.risk_score || 3);
    const c = parseFloat(project.complexity || 3);
    const raw = w1*a + w2*b + w3*r + w4*u - w5*k - w6*c;
    const posW = w1+w2+w3+w4, negW = w5+w6;
    const maxR = posW*5 - negW*1, minR = posW*1 - negW*5;
    if (maxR === minR) return 50;
    return Math.round(Math.max(0, Math.min(100, (raw - minR) / (maxR - minR) * 100)) * 10) / 10;
  };

  const sandboxImpact = useMemo(() => {
    if (!summary || !sandbox) return null;
    const origCapex = summary.totals.capex_planned;
    const origOpex  = summary.totals.opex_planned;
    const newCapex  = sandbox.reduce((s, p) => s + (parseFloat(p.capex_planned) || 0), 0);
    const newOpex   = sandbox.reduce((s, p) => s + (parseFloat(p.opex_planned) || 0), 0);
    const outCount  = sandbox.filter(p => p.status === "terminé" || p.status === "en_pause").length;
    return {
      capexDelta: newCapex - origCapex,
      opexDelta:  newOpex  - origOpex,
      newCapex,
      newOpex,
      outCount,
    };
  }, [sandbox, summary]);

  const handleApplySandbox = async () => {
    if (!sandbox || !summary) return;
    const modifications = [];
    for (const sp of sandbox) {
      const orig = summary.projects.find(p => p.project_id === sp.project_id);
      if (!orig) continue;
      const mod = { project_id: sp.project_id };
      let changed = false;
      const FIELDS = ["status", "capex_planned", "opex_planned", "start_date", "end_date_forecast",
                      "strategic_alignment", "business_value", "roi_estimated", "urgency", "risk_score", "complexity"];
      for (const f of FIELDS) {
        if (sp[f] !== orig[f]) { mod[f] = sp[f]; changed = true; }
      }
      if (changed) modifications.push(mod);
    }
    if (!modifications.length) { toast("Aucune modification détectée"); return; }
    try {
      const scRes = await arbitrageAPI.saveScenario({
        name: `Application directe — ${new Date().toLocaleDateString("fr-FR")}`,
        modifications,
        summary: sandboxImpact,
      });
      await arbitrageAPI.applyScenario(scRes.data.scenario_id);
      await load();
      setSandboxDirty(false);
      toast.success(`${modifications.length} projet(s) mis à jour`);
    } catch {
      toast.error("Erreur lors de l'application du scénario");
    }
  };

  const handleSaveScenario = async () => {
    if (!sandbox || !summary || !scenarioName) return;
    const modifications = [];
    for (const sp of sandbox) {
      const orig = summary.projects.find(p => p.project_id === sp.project_id);
      if (!orig) continue;
      const mod = { project_id: sp.project_id };
      let changed = false;
      const FIELDS = ["status", "capex_planned", "opex_planned", "start_date", "end_date_forecast",
                      "strategic_alignment", "business_value", "roi_estimated", "urgency", "risk_score", "complexity"];
      for (const f of FIELDS) {
        if (sp[f] !== orig[f]) { mod[f] = sp[f]; changed = true; }
      }
      if (changed) modifications.push(mod);
    }
    try {
      await arbitrageAPI.saveScenario({
        name: scenarioName,
        description: scenarioDesc,
        modifications,
        summary: sandboxImpact,
      });
      const scRes = await arbitrageAPI.getScenarios();
      setScenarios(scRes.data);
      setSaveScenarioModal(false);
      setScenarioName(""); setScenarioDesc("");
      toast.success("Scénario sauvegardé");
    } catch {
      toast.error("Erreur lors de la sauvegarde du scénario");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Chargement de l'arbitrage...</div>
      </div>
    );
  }

  const projects = summary?.projects || [];
  const totals   = summary?.totals   || {};

  return (
    <div className="p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-heading">Arbitrage Portefeuille</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Scoring multi-critères · Enveloppes budgétaires · Simulateur What-if
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            data-testid="btn-export-pdf"
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            <FileDown size={14} />
            {exportingPdf ? "Export..." : "Export PDF"}
          </button>
          {canEdit && (
            <button
              onClick={() => setShowWeightsModal(true)}
              data-testid="btn-configure-weights"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Sliders size={14} /> Configurer les poids
            </button>
          )}
        </div>
      </div>

      {/* ── KPI rapides ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="kpi-projects-count">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Projets</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{projects.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="kpi-avg-score">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Score moyen</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">
            {projects.length ? Math.round(projects.reduce((s, p) => s + p.score, 0) / projects.length) : "—"}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="kpi-total-capex">
          <div className="text-xs text-slate-500 uppercase tracking-wider">CAPEX total</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{formatEuro(totals.capex_planned)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="kpi-total-opex">
          <div className="text-xs text-slate-500 uppercase tracking-wider">OPEX total</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{formatEuro(totals.opex_planned)}</div>
        </div>
      </div>

      {/* ── Onglets ── */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: "scoring",    icon: Target,      label: "Scoring Projets" },
          { key: "envelopes",  icon: BarChart2,   label: "Enveloppes Budget" },
          { key: "simulator",  icon: PlayCircle,  label: "Simulateur What-if" },
          { key: "scenarios",  icon: Save,        label: `Scénarios (${scenarios.length})` },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            data-testid={`tab-${key}`}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeTab === key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1 — SCORING PROJETS
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "scoring" && (
        <div className="space-y-5">
          {/* Table Scoring */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Matrice de scoring — cliquer une cellule pour éditer</span>
                {canEdit && (
                  <span className="ml-2 text-xs text-slate-400">(Scale 1–5 · cliquer pour éditer)</span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="scoring-table">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left">Projet</th>
                    {CRITERIA_LABELS.map(c => (
                      <th key={c.key} className="px-2 py-2.5 text-center whitespace-nowrap">
                        <span style={{ color: c.color }}>{c.sign === "−" ? "−" : "+"}</span> {c.abbr}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projects.map((proj, idx) => (
                    <tr key={proj.project_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400 w-4">#{idx + 1}</span>
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: RAG_COLORS[proj.status_rag] || "#94A3B8" }}
                          />
                          <span className="font-medium text-slate-700 truncate max-w-[200px]" title={proj.name}>
                            {proj.name}
                          </span>
                        </div>
                      </td>
                      {CRITERIA_LABELS.map(c => {
                        const isEditing = editingCell?.projectId === proj.project_id && editingCell?.field === c.key;
                        return (
                          <td key={c.key} className="px-2 py-2.5 text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <input
                                  type="number"
                                  min="1" max="5"
                                  value={editingValue}
                                  onChange={e => setEditingValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") handleCellSave(); if (e.key === "Escape") setEditingCell(null); }}
                                  autoFocus
                                  className="w-12 text-center border border-blue-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                />
                                <button onClick={handleCellSave} className="text-emerald-600 hover:text-emerald-700">
                                  <Check size={12} />
                                </button>
                                <button onClick={() => setEditingCell(null)} className="text-slate-400 hover:text-red-500">
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleCellEdit(proj.project_id, c.key, proj[c.key])}
                                className={`inline-flex items-center justify-center w-8 h-7 rounded text-xs font-semibold transition-colors
                                  ${canEdit ? "hover:ring-2 hover:ring-offset-1 cursor-pointer" : "cursor-default"}
                                  ${proj[c.key] ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-400"}`}
                                style={proj[c.key] ? { borderLeft: `2px solid ${c.color}` } : {}}
                                data-testid={`score-cell-${proj.project_id}-${c.key}`}
                              >
                                {proj[c.key] || "—"}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-center">
                        <ScoreBadge score={proj.score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bubble Chart */}
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={14} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Carte Valeur vs Risque</span>
              <span className="text-xs text-slate-400">(X = Valeur Business · Y = Risque · Taille = Budget total · Couleur = RAG)</span>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number" dataKey="x" name="Valeur Business"
                  domain={[0.5, 5.5]} ticks={[1, 2, 3, 4, 5]}
                  label={{ value: "Valeur Business →", position: "insideBottom", offset: -10, fontSize: 11, fill: "#94a3b8" }}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <YAxis
                  type="number" dataKey="y" name="Risque"
                  domain={[0.5, 5.5]} ticks={[1, 2, 3, 4, 5]}
                  label={{ value: "Risque ↑", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#94a3b8" }}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <ZAxis type="number" dataKey="z" range={[200, 1200]} name="Budget" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
                        <div className="font-semibold text-slate-800 mb-1 truncate">{d?.name}</div>
                        <div className="space-y-0.5 text-slate-600">
                          <div>Valeur Business : <span className="font-medium">{d?.x}</span></div>
                          <div>Risque : <span className="font-medium">{d?.y}</span></div>
                          <div>Budget : <span className="font-medium">{formatEuro(d?.rawBudget)}</span></div>
                          <div>Score : <span className={`font-bold ${SCORE_COLOR(d?.score)}`}>{d?.score}</span></div>
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine x={3} stroke="#cbd5e1" strokeDasharray="4 4" />
                <ReferenceLine y={3} stroke="#cbd5e1" strokeDasharray="4 4" />
                <Scatter
                  data={projects.map(p => ({
                    x: p.business_value || 3,
                    y: p.risk_score || 3,
                    z: Math.max(200, Math.sqrt(p.budget_total || 0) / 30),
                    name: p.name,
                    rawBudget: p.budget_total,
                    score: p.score,
                    rag: p.status_rag,
                  }))}
                >
                  {projects.map((p, i) => (
                    <Cell key={i} fill={RAG_COLORS[p.status_rag] || "#94a3b8"} fillOpacity={0.75} stroke={RAG_COLORS[p.status_rag]} strokeWidth={1.5} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 justify-center flex-wrap">
              {Object.entries(RAG_COLORS).map(([k, c]) => (
                <div key={k} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                  <span>{{green:"Vert",orange:"Orange",red:"Rouge"}[k]}</span>
                </div>
              ))}
              <span className="text-xs text-slate-400">· Taille ∝ Budget total</span>
            </div>
            {/* Quadrants label */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-400">
              <div className="text-right pr-3 text-emerald-600">◤ Haute valeur / Faible risque → Priorité absolue</div>
              <div className="text-left pl-3 text-amber-600">◥ Haute valeur / Haut risque → Gérer activement</div>
              <div className="text-right pr-3 text-slate-400">◣ Faible valeur / Faible risque → Quick wins</div>
              <div className="text-left pl-3 text-red-500">◢ Faible valeur / Haut risque → Reconsidérer</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2 — ENVELOPPES BUDGÉTAIRES
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "envelopes" && (
        <div className="space-y-4">
          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={() => { setEnvForm({ year: 2026, capex_envelope: 0, opex_envelope: 0 }); setEnvModal(true); }}
                data-testid="btn-add-envelope"
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={14} /> Ajouter / Modifier enveloppe
              </button>
            </div>
          )}

          {envelopes.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-400">
              <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune enveloppe définie.</p>
              {canEdit && <p className="text-xs mt-1">Cliquez "Ajouter / Modifier enveloppe" pour créer une enveloppe 2026.</p>}
            </div>
          ) : (
            envelopes.map(env => {
              const capexUsed  = totals.capex_planned || 0;
              const opexUsed   = totals.opex_planned  || 0;
              const capexPct   = env.capex_envelope > 0 ? (capexUsed / env.capex_envelope) * 100 : 0;
              const opexPct    = env.opex_envelope  > 0 ? (opexUsed  / env.opex_envelope)  * 100 : 0;
              const capexOver  = capexPct > 100;
              const opexOver   = opexPct > 100;
              const totalUsed  = capexUsed + opexUsed;
              const totalPct   = env.total_envelope > 0 ? (totalUsed / env.total_envelope) * 100 : 0;

              return (
                <div key={env.envelope_id} className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid={`envelope-card-${env.year}`}>
                  {/* Header */}
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-700">{env.label}</h3>
                      <p className="text-xs text-slate-400">Exercice {env.year}</p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => { setEnvForm({ year: env.year, capex_envelope: env.capex_envelope, opex_envelope: env.opex_envelope }); setEnvModal(true); }}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Edit3 size={13} />
                      </button>
                    )}
                  </div>

                  <div className="p-5 space-y-5">
                    {/* CAPEX */}
                    <div data-testid="envelope-capex-section">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">CAPEX</span>
                          {capexOver && (
                            <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={10} /> Dépassement
                            </span>
                          )}
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <span className={`font-semibold text-sm ${capexOver ? "text-red-600" : "text-slate-700"}`}>
                            {formatEuro(capexUsed)}
                          </span>
                          <span className="text-slate-400"> / {formatEuro(env.capex_envelope)}</span>
                          <span className={`ml-2 font-bold ${capexOver ? "text-red-600" : "text-emerald-600"}`}>
                            ({Math.round(capexPct)}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${capexOver ? "bg-red-500" : capexPct > 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(capexPct, 100)}%` }}
                          data-testid="capex-progress-bar"
                        />
                      </div>
                      {capexOver && (
                        <p className="text-xs text-red-500 mt-1">
                          Dépassement de {formatEuro(capexUsed - env.capex_envelope)} ({Math.round(capexPct - 100)}%)
                        </p>
                      )}
                    </div>

                    {/* OPEX */}
                    <div data-testid="envelope-opex-section">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">OPEX</span>
                          {opexOver && (
                            <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={10} /> Dépassement
                            </span>
                          )}
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <span className={`font-semibold text-sm ${opexOver ? "text-red-600" : "text-slate-700"}`}>
                            {formatEuro(opexUsed)}
                          </span>
                          <span className="text-slate-400"> / {formatEuro(env.opex_envelope)}</span>
                          <span className={`ml-2 font-bold ${opexOver ? "text-red-600" : "text-emerald-600"}`}>
                            ({Math.round(opexPct)}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${opexOver ? "bg-red-500" : opexPct > 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(opexPct, 100)}%` }}
                          data-testid="opex-progress-bar"
                        />
                      </div>
                      {opexOver && (
                        <p className="text-xs text-red-500 mt-1">
                          Dépassement de {formatEuro(opexUsed - env.opex_envelope)} ({Math.round(opexPct - 100)}%)
                        </p>
                      )}
                    </div>

                    {/* Détail par projet */}
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Répartition par projet
                      </div>
                      <div className="rounded-lg border border-slate-100 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-2 text-left">Projet</th>
                              <th className="px-3 py-2 text-right">CAPEX</th>
                              <th className="px-3 py-2 text-right">OPEX</th>
                              <th className="px-3 py-2 text-right">Total</th>
                              <th className="px-3 py-2 text-right">% enveloppe</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {projects.map(p => (
                              <tr key={p.project_id} className="hover:bg-slate-50">
                                <td className="px-3 py-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RAG_COLORS[p.status_rag] }} />
                                    <span className="truncate max-w-[180px]" title={p.name}>{p.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-1.5 text-right text-slate-600">{formatEuro(p.capex_planned)}</td>
                                <td className="px-3 py-1.5 text-right text-slate-600">{formatEuro(p.opex_planned)}</td>
                                <td className="px-3 py-1.5 text-right font-medium text-slate-700">{formatEuro(p.budget_total)}</td>
                                <td className="px-3 py-1.5 text-right text-slate-500">
                                  {formatPct(p.budget_total, env.total_envelope)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50 font-semibold text-slate-700">
                            <tr>
                              <td className="px-3 py-2">Total portefeuille</td>
                              <td className="px-3 py-2 text-right">{formatEuro(totals.capex_planned)}</td>
                              <td className="px-3 py-2 text-right">{formatEuro(totals.opex_planned)}</td>
                              <td className="px-3 py-2 text-right">{formatEuro(totals.budget_total)}</td>
                              <td className="px-3 py-2 text-right">{Math.round(totalPct)}%</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3 — SIMULATEUR WHAT-IF
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "simulator" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              {sandboxDirty && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                  <Info size={10} /> Modifications non appliquées
                </span>
              )}
              {!sandboxDirty && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                  <CheckCircle size={10} /> Synchronized with DB
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetSandbox}
                data-testid="btn-reset-sandbox"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <RotateCcw size={13} /> Réinitialiser
              </button>
              {canSimulate && (
                <>
                  <button
                    onClick={() => setSaveScenarioModal(true)}
                    disabled={!sandboxDirty}
                    data-testid="btn-save-scenario"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                  >
                    <Save size={13} /> Sauvegarder scénario
                  </button>
                  <button
                    onClick={handleApplySandbox}
                    disabled={!sandboxDirty}
                    data-testid="btn-apply-sandbox"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
                  >
                    <CheckCircle size={13} /> Appliquer
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Impact Panel */}
          {sandboxDirty && sandboxImpact && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="sandbox-impact-panel">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
                Impact des modifications
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <div className="text-xs text-amber-600">CAPEX nouveau</div>
                  <div className="font-semibold text-slate-700">{formatEuro(sandboxImpact.newCapex)}</div>
                </div>
                <div>
                  <div className="text-xs text-amber-600">Delta CAPEX</div>
                  <div className={`font-semibold ${sandboxImpact.capexDelta >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {sandboxImpact.capexDelta >= 0 ? "+" : ""}{formatEuro(sandboxImpact.capexDelta)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-amber-600">OPEX nouveau</div>
                  <div className="font-semibold text-slate-700">{formatEuro(sandboxImpact.newOpex)}</div>
                </div>
                <div>
                  <div className="text-xs text-amber-600">Delta OPEX</div>
                  <div className={`font-semibold ${sandboxImpact.opexDelta >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {sandboxImpact.opexDelta >= 0 ? "+" : ""}{formatEuro(sandboxImpact.opexDelta)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sandbox table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="simulator-table">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left">Projet</th>
                    <th className="px-3 py-2.5 text-center">Statut</th>
                    <th className="px-3 py-2.5 text-right">CAPEX planifié</th>
                    <th className="px-3 py-2.5 text-right">OPEX planifié</th>
                    <th className="px-3 py-2.5 text-center">Score simulé</th>
                    <th className="px-3 py-2.5 text-center">Δ Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(sandbox || []).map(sp => {
                    const orig = summary?.projects.find(p => p.project_id === sp.project_id);
                    const simScore = computeSandboxScore(sp);
                    const origScore = orig?.score || 0;
                    const delta = Math.round((simScore - origScore) * 10) / 10;
                    const isModified = JSON.stringify(sp) !== JSON.stringify(orig);
                    return (
                      <tr
                        key={sp.project_id}
                        className={`transition-colors ${isModified ? "bg-amber-50/40" : "hover:bg-slate-50"}`}
                        data-testid={`sim-row-${sp.project_id}`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RAG_COLORS[sp.status_rag] || "#94a3b8" }} />
                            <span className={`font-medium truncate max-w-[180px] ${isModified ? "text-amber-800" : "text-slate-700"}`} title={sp.name}>
                              {sp.name}
                            </span>
                            {isModified && <span className="text-xs text-amber-500">*</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <select
                            value={sp.status}
                            onChange={e => handleSandboxChange(sp.project_id, "status", e.target.value)}
                            className="text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                            data-testid={`sim-status-${sp.project_id}`}
                          >
                            {Object.entries(STATUS_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="number"
                            value={sp.capex_planned}
                            onChange={e => handleSandboxChange(sp.project_id, "capex_planned", parseFloat(e.target.value) || 0)}
                            className="text-xs text-right border border-slate-200 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            data-testid={`sim-capex-${sp.project_id}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="number"
                            value={sp.opex_planned}
                            onChange={e => handleSandboxChange(sp.project_id, "opex_planned", parseFloat(e.target.value) || 0)}
                            className="text-xs text-right border border-slate-200 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            data-testid={`sim-opex-${sp.project_id}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <ScoreBadge score={simScore} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {delta !== 0 ? (
                            <span className={`text-xs font-semibold ${delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {delta > 0 ? "+" : ""}{delta}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scénarios sauvegardés */}
          {scenarios.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Save size={13} className="text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Scénarios sauvegardés</span>
              </div>
              <div className="divide-y divide-slate-50">
                {scenarios.map(sc => (
                  <div key={sc.scenario_id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50" data-testid={`scenario-row-${sc.scenario_id}`}>
                    <div>
                      <div className="text-sm font-medium text-slate-700">{sc.name}</div>
                      {sc.description && <div className="text-xs text-slate-400">{sc.description}</div>}
                      <div className="text-xs text-slate-400 mt-0.5">
                        {sc.modifications?.length || 0} modification(s) · {new Date(sc.created_at).toLocaleDateString("fr-FR")}
                        {sc.status === "applied" && (
                          <span className="ml-2 text-emerald-600 font-medium">Appliqué</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 4 — SCÉNARIOS SAUVEGARDÉS + COMPARAISON
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "scenarios" && (
        <div className="space-y-4">
          {/* Header actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Save size={15} className="text-[#0052CC]" />
              <span className="text-sm font-semibold text-slate-800">
                {scenarios.length} scénario{scenarios.length > 1 ? "s" : ""} sauvegardé{scenarios.length > 1 ? "s" : ""}
              </span>
            </div>
            {!compareMode && scenarios.length >= 2 && (
              <button
                onClick={() => { setCompareMode(true); setCompareA(null); setCompareB(null); }}
                data-testid="btn-compare-mode"
                className="flex items-center gap-1.5 text-xs px-3 py-2 bg-[#0052CC] text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <GitCompare size={13} /> Comparer 2 scénarios
              </button>
            )}
            {compareMode && (
              <button
                onClick={() => { setCompareMode(false); setCompareA(null); setCompareB(null); }}
                className="flex items-center gap-1.5 text-xs px-3 py-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50"
              >
                <X size={13} /> Annuler comparaison
              </button>
            )}
          </div>

          {/* Compare mode banner */}
          {compareMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
              <GitCompare size={15} />
              Sélectionnez 2 scénarios ci-dessous pour les comparer.
              {compareA && compareB && (
                <span className="ml-2 font-medium">
                  ✓ {compareA.name} vs {compareB.name} — voir la comparaison en bas
                </span>
              )}
            </div>
          )}

          {scenarios.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg flex flex-col items-center justify-center py-16 text-center">
              <Save size={32} className="text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium">Aucun scénario sauvegardé</p>
              <p className="text-slate-400 text-xs mt-1">Créez un scénario depuis l&apos;onglet Simulateur</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="divide-y divide-slate-100">
                {scenarios.map(sc => {
                  const isSelectedA = compareA?.scenario_id === sc.scenario_id;
                  const isSelectedB = compareB?.scenario_id === sc.scenario_id;
                  const isSelected = isSelectedA || isSelectedB;
                  return (
                    <div
                      key={sc.scenario_id}
                      data-testid={`scenario-row-${sc.scenario_id}`}
                      className={`px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors
                        ${isSelectedA ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}
                        ${isSelectedB ? "bg-violet-50 border-l-4 border-l-violet-500" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{sc.name}</span>
                          {sc.status === "applied" && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                              Appliqué
                            </span>
                          )}
                          {isSelectedA && <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">A</span>}
                          {isSelectedB && <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">B</span>}
                        </div>
                        {sc.description && <div className="text-xs text-slate-400 mt-0.5 truncate">{sc.description}</div>}
                        <div className="text-xs text-slate-400 mt-1">
                          {sc.modifications?.length || 0} modification(s) ·{" "}
                          {new Date(sc.created_at).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        {compareMode ? (
                          <>
                            {!isSelectedA && !compareA && (
                              <button
                                onClick={() => setCompareA(sc)}
                                className="text-xs px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100"
                              >Sélect. A</button>
                            )}
                            {!isSelectedB && !compareB && compareA && compareA.scenario_id !== sc.scenario_id && (
                              <button
                                onClick={() => setCompareB(sc)}
                                className="text-xs px-2.5 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-100"
                              >Sélect. B</button>
                            )}
                            {isSelected && (
                              <button
                                onClick={() => {
                                  if (isSelectedA) setCompareA(null);
                                  if (isSelectedB) setCompareB(null);
                                }}
                                className="text-xs px-2 py-1.5 text-slate-400 hover:text-slate-600"
                              ><X size={12} /></button>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setDetailScenario(detailScenario?.scenario_id === sc.scenario_id ? null : sc)}
                              data-testid={`btn-detail-${sc.scenario_id}`}
                              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-1"
                            >
                              <Eye size={12} /> Détail
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Supprimer le scénario « ${sc.name} » ?`)) return;
                                try {
                                  await arbitrageAPI.deleteScenario(sc.scenario_id);
                                  setScenarios(prev => prev.filter(s => s.scenario_id !== sc.scenario_id));
                                  if (detailScenario?.scenario_id === sc.scenario_id) setDetailScenario(null);
                                  toast.success("Scénario supprimé");
                                } catch { toast.error("Erreur suppression"); }
                              }}
                              className="text-xs px-2 py-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            ><Trash2 size={12} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Détail scénario */}
          {detailScenario && !compareMode && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye size={15} className="text-[#0052CC]" />
                  <h3 className="font-semibold text-slate-800">Détail — {detailScenario.name}</h3>
                </div>
                <button onClick={() => setDetailScenario(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              {detailScenario.description && (
                <p className="text-xs text-slate-500 mb-3">{detailScenario.description}</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="scenario-detail-table">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-slate-500 font-semibold">Projet ID</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-semibold">Champ modifié</th>
                      <th className="text-left py-2 px-3 text-slate-500 font-semibold">Nouvelle valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailScenario.modifications || []).flatMap((mod, mi) =>
                      Object.entries(mod)
                        .filter(([k]) => k !== "project_id")
                        .map(([field, value], fi) => (
                          <tr key={`${mi}-${fi}`} className="border-b border-slate-50 hover:bg-slate-50">
                            {fi === 0 && (
                              <td className="py-2 px-3 font-mono text-slate-500" rowSpan={Object.keys(mod).length - 1}>
                                {mod.project_id?.slice(0, 8)}…
                              </td>
                            )}
                            <td className="py-2 px-3 text-slate-700">{field}</td>
                            <td className="py-2 px-3 font-medium text-[#0052CC]">{String(value)}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Comparaison côte à côte */}
          {compareMode && compareA && compareB && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <GitCompare size={15} className="text-[#0052CC]" />
                <h3 className="font-semibold text-slate-800">
                  Comparaison : {compareA.name} <ArrowRight size={13} className="inline" /> {compareB.name}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[{ sc: compareA, label: "A", borderColor: "border-l-blue-500", bg: "bg-blue-50" },
                  { sc: compareB, label: "B", borderColor: "border-l-violet-500", bg: "bg-violet-50" }].map(({ sc, label, borderColor, bg }) => {
                  // Compute mods map: project_id + field → value
                  const modsMap = {};
                  (sc.modifications || []).forEach(mod => {
                    Object.entries(mod).filter(([k]) => k !== "project_id").forEach(([field, val]) => {
                      modsMap[`${mod.project_id}__${field}`] = val;
                    });
                  });
                  // All keys
                  const allKeys = Object.keys(modsMap);
                  return (
                    <div key={label} className={`border border-slate-200 border-l-4 ${borderColor} rounded-lg p-4`}>
                      <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mb-3 ${bg}`}>
                        Scénario {label} — {sc.name}
                      </div>
                      <div className="space-y-1.5">
                        {allKeys.length === 0 ? (
                          <p className="text-xs text-slate-400">Aucune modification</p>
                        ) : allKeys.map(key => {
                          const [pid, field] = key.split("__");
                          const valA = compareA.modifications?.find(m => m.project_id === pid)?.[field];
                          const valB = compareB.modifications?.find(m => m.project_id === pid)?.[field];
                          const diff = label === "B" && valA !== undefined && valB !== undefined && valA !== valB;
                          const isHigher = label === "B" && typeof valA === "number" && typeof valB === "number" && valB > valA;
                          return (
                            <div key={key} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${diff ? (isHigher ? "bg-emerald-50" : "bg-rose-50") : "bg-slate-50"}`}>
                              <span className="text-slate-500 truncate flex-1">{field} <span className="text-[10px] text-slate-400">(…{pid?.slice(-4)})</span></span>
                              <span className={`font-mono font-semibold ml-2 ${diff ? (isHigher ? "text-emerald-700" : "text-rose-700") : "text-slate-700"}`}>
                                {String(modsMap[key])}
                                {diff && (
                                  <span className="ml-1 text-[9px] opacity-75">
                                    {isHigher ? "▲" : "▼"}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════════ */}

      {/* Modal Poids */}
      {showWeightsModal && pendingWeights && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" data-testid="weights-modal">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Configurer les poids de scoring</h3>
              <button onClick={() => setShowWeightsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Formule : Score = W1×Alignement + W2×Valeur + W3×ROI + W4×Urgence − W5×Risque − W6×Complexité
            </p>
            <div className="space-y-3">
              {WEIGHT_KEYS.map(({ key, label, sign }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-5 text-center text-xs font-bold text-slate-400">{sign}</div>
                  <label className="flex-1 text-sm text-slate-700">{label}</label>
                  <input
                    type="number"
                    step="0.01" min="0" max="1"
                    value={pendingWeights[key]}
                    onChange={e => setPendingWeights(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                    className="w-20 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    data-testid={`weight-input-${key}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setPendingWeights({ ...weights }); setShowWeightsModal(false); }} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Annuler
              </button>
              <button
                onClick={handleSaveWeights}
                disabled={savingWeights}
                data-testid="btn-save-weights"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {savingWeights ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enveloppe */}
      {envModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" data-testid="envelope-modal">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Enveloppe budgétaire</h3>
              <button onClick={() => setEnvModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 font-medium uppercase">Année</label>
                <input type="number" value={envForm.year}
                  onChange={e => setEnvForm(p => ({ ...p, year: parseInt(e.target.value) || 2026 }))}
                  className="mt-1 w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  data-testid="env-year-input"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium uppercase">Enveloppe CAPEX (€)</label>
                <input type="number" value={envForm.capex_envelope}
                  onChange={e => setEnvForm(p => ({ ...p, capex_envelope: parseFloat(e.target.value) || 0 }))}
                  className="mt-1 w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  data-testid="env-capex-input"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium uppercase">Enveloppe OPEX (€)</label>
                <input type="number" value={envForm.opex_envelope}
                  onChange={e => setEnvForm(p => ({ ...p, opex_envelope: parseFloat(e.target.value) || 0 }))}
                  className="mt-1 w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  data-testid="env-opex-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEnvModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Annuler</button>
              <button onClick={handleUpsertEnvelope} data-testid="btn-save-envelope" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sauvegarder Scénario */}
      {saveScenarioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" data-testid="save-scenario-modal">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Sauvegarder le scénario</h3>
              <button onClick={() => setSaveScenarioModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 font-medium uppercase">Nom du scénario *</label>
                <input
                  value={scenarioName}
                  onChange={e => setScenarioName(e.target.value)}
                  placeholder="Ex: Réduction budgétaire Q2 2026"
                  className="mt-1 w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  data-testid="scenario-name-input"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium uppercase">Description</label>
                <textarea
                  value={scenarioDesc}
                  onChange={e => setScenarioDesc(e.target.value)}
                  rows={2}
                  className="mt-1 w-full border border-slate-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                  data-testid="scenario-desc-input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setSaveScenarioModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Annuler</button>
              <button
                onClick={handleSaveScenario}
                disabled={!scenarioName}
                data-testid="btn-confirm-save-scenario"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
