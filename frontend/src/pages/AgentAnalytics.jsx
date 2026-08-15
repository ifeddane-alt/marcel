import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  MessageSquare, Zap, DollarSign, Clock, Shield, Activity,
  TrendingUp, RefreshCw, BarChart2,
} from "lucide-react";
import { agentAPI, insightsAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

function KpiCard({ icon: Icon, label, value, sub, color = "blue" }) {
  const colorMap = {
    blue:   { bg: "bg-blue-50",   border: "border-l-blue-500",   text: "text-blue-700" },
    indigo: { bg: "bg-indigo-50", border: "border-l-indigo-500", text: "text-indigo-700" },
    green:  { bg: "bg-emerald-50",border: "border-l-emerald-500",text: "text-emerald-700" },
    amber:  { bg: "bg-amber-50",  border: "border-l-amber-500",  text: "text-amber-700" },
    purple: { bg: "bg-violet-50", border: "border-l-violet-500", text: "text-violet-700" },
    slate:  { bg: "bg-zinc-50",  border: "border-l-slate-400",  text: "text-zinc-700" },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`${c.bg} border border-zinc-200 border-l-4 ${c.border} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={15} className={c.text} />
        <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">{label}</span>
      </div>
      <div className={`text-2xl font-heading font-bold ${c.text}`} data-testid={`kpi-${label}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function AgentAnalytics() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission("admin.config") || hasPermission("*");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);

  const loadInsights = () => insightsAPI.list(8).then((r) => setInsights(r.data)).catch(() => {});
  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const r = await insightsAPI.analyze();
      toast.success(`Analyse terminée : ${r.data.anomalies?.length || 0} anomalie(s), ${r.data.new_count} nouvelle(s)`);
      loadInsights();
    } catch { toast.error("Échec de l'analyse"); }
    setAnalyzing(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await agentAPI.getAgentAnalytics();
      setData(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (canView) { load(); loadInsights(); } }, [canView]);

  if (!canView) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-zinc-400 text-sm">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="agent-analytics-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs text-m-muted mb-0.5">Accueil / Administration / <span className="text-m-primary font-semibold">Analytics IA</span></div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-m-ink tracking-tight">
            Analytics Agent IA
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Tableau de bord d&apos;adoption et d&apos;usage de l&apos;Agent PMO
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          data-testid="analytics-refresh-btn"
          className="flex items-center gap-2 text-xs px-3 py-2 border border-zinc-200 rounded-lg hover:border-zinc-300 hover:bg-zinc-50 text-zinc-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-400 text-sm gap-2">
          <RefreshCw size={14} className="animate-spin" /> Chargement des analytics…
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-24 text-zinc-400 text-sm">
          Données non disponibles.
        </div>
      ) : (
        <>
          {/* Socle IA — analyse proactive */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 mb-6" data-testid="insights-section">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-amber-500" />
                <h2 className="font-semibold text-zinc-800 text-sm">Analyse proactive quotidienne (socle IA à coût fixe)</h2>
              </div>
              <button onClick={runAnalysis} disabled={analyzing} data-testid="insights-analyze-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-m-blue text-white text-xs font-semibold rounded-lg hover:bg-m-blue-dark disabled:opacity-60">
                <RefreshCw size={12} className={analyzing ? "animate-spin" : ""} />
                {analyzing ? "Analyse…" : "Analyser maintenant"}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mb-3">
              Règles déterministes exécutées chaque jour à 06h15 (dépassements budgets, risques critiques, jalons en retard, vulnérabilités, incidents P1, budgets run). L'IA ne rédige une synthèse que s'il y a de nouvelles anomalies.
            </p>
            {insights.length === 0 ? (
              <div className="text-xs text-zinc-400 py-3">Aucune analyse exécutée pour l'instant.</div>
            ) : (
              <div className="space-y-2" data-testid="insights-list">
                {insights.map((ins) => (
                  <div key={ins.insight_id} className="px-3 py-2.5 bg-zinc-50 rounded-lg" data-testid={`insight-${ins.insight_id}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono-data text-[10px] text-zinc-400">{new Date(ins.run_at).toLocaleString("fr-FR")}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-lg border ${ins.critical_count > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                        {ins.anomalies?.length || 0} anomalie{(ins.anomalies?.length || 0) > 1 ? "s" : ""}
                      </span>
                      {ins.new_count > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-lg border bg-amber-50 text-amber-700 border-amber-200">{ins.new_count} nouvelle{ins.new_count > 1 ? "s" : ""}</span>}
                      {ins.resolved_count > 0 && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-lg border bg-blue-50 text-blue-700 border-blue-200">{ins.resolved_count} résolue{ins.resolved_count > 1 ? "s" : ""}</span>}
                      <span className={`ml-auto text-[9px] font-bold ${ins.llm_used ? "text-violet-600" : "text-zinc-400"}`}>{ins.llm_used ? "LLM" : "0 appel LLM"}</span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-1">{ins.synthesis}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <KpiCard icon={MessageSquare} label="Messages" value={data.total_messages?.toLocaleString("fr-FR")} color="blue" />
            <KpiCard icon={Activity} label="Sessions" value={data.total_sessions?.toLocaleString("fr-FR")} color="indigo" />
            <KpiCard icon={Zap} label="Tokens (~)" value={data.total_tokens_estimated?.toLocaleString("fr-FR")} sub="Estimation 4 chars/token" color="purple" />
            <KpiCard icon={DollarSign} label="Coût estimé" value={`$${data.cost_estimate_usd}`} sub="~$9/MTok moyen" color="amber" />
            <KpiCard icon={Clock} label="Tps réponse moy." value={`${(data.avg_response_ms / 1000).toFixed(1)}s`} color="slate" />
            <KpiCard icon={Shield} label="Guardrails OK" value={`${data.verified_rate_pct}%`} sub={`${data.simulation_count} simulations`} color="green" />
          </div>

          {/* Chart 30 jours */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} className="text-m-blue" />
              <h2 className="font-semibold text-zinc-800 text-sm">Activité 30 derniers jours</h2>
            </div>
            {data.daily_usage?.length > 0 ? (
              <div className="h-36 sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily_usage} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    tickFormatter={(v) => v?.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} width={28} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E2E8F0" }}
                    labelFormatter={(v) => `Date : ${v}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="messages" name="Messages" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="simulations" name="Simulations" fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">
                Aucune activité sur les 30 derniers jours.
              </div>
            )}
          </div>

          {/* Top 10 Questions */}
          <div className="bg-white border border-zinc-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-m-blue" />
              <h2 className="font-semibold text-zinc-800 text-sm">
                Top {data.top_questions?.length || 0} questions les plus posées
              </h2>
            </div>
            {data.top_questions?.length > 0 ? (
              <div className="space-y-2" data-testid="top-questions-list">
                {data.top_questions.map((q, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-zinc-50 rounded-lg">
                    <span className="text-xs font-bold text-zinc-400 w-5 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-xs text-zinc-700 truncate">{q.question}</span>
                    <span className="flex-shrink-0 text-xs font-bold text-m-blue bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                      ×{q.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-400 text-sm text-center py-8">
                Aucune question enregistrée pour l&apos;instant.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
