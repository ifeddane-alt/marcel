import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Briefcase, TrendingUp, AlertTriangle, CheckCircle, ArrowRight, ShieldAlert, MapPin,
} from "lucide-react";import { dashboardAPI, programsAPI, projectsAPI, teamsAPI, milestonesAPI, arbitrageAPI } from "@/api";
import RAGBadge from "@/components/RAGBadge";
import RiskHeatmap from "@/components/RiskHeatmap";
import CapacityAlertBanner from "@/components/CapacityAlertBanner";
import { formatEuro, formatDate } from "@/utils/format";
import { usePermissions } from "@/hooks/usePermissions";

const RAG_COLORS = { green: "#10B981", orange: "#F59E0B", red: "#EF4444" };
const METHOD_COLORS = { waterfall: "#3B82F6", agile: "#8B5CF6", safe: "#6366F1" };

function MetricCard({ label, value, sub, icon: Icon, accent = "#0052CC", testId }) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-gray-200 rounded shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
      style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
        <Icon size={16} className="text-slate-300" strokeWidth={1.5} />
      </div>
      <div className="mt-3">
        <div className="font-heading text-3xl font-bold text-[#0F172A]">{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded shadow-lg p-3 text-xs">
        <div className="font-semibold text-slate-800 mb-1">{label}</div>
        {payload.map((p) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value >= 100000 ? formatEuro(p.value) : p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
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
  const [heatmapFilterProgram, setHeatmapFilterProgram] = useState("");
  const [heatmapFilterProject, setHeatmapFilterProject] = useState("");
  const [loading, setLoading] = useState(true);
  const [arbitrageData, setArbitrageData] = useState(null);

  useEffect(() => {
    Promise.all([
      dashboardAPI.summary(),
      dashboardAPI.topRisks(),
      dashboardAPI.heatmapRisks(),
      programsAPI.list(),
      projectsAPI.list(),
      teamsAPI.capacityAlerts(),
      milestonesAPI.regulatory({ milestone_type: undefined }),
    ]).then(([sRes, rRes, hrRes, pRes, projRes, caRes, regRes]) => {
        setSummary(sRes.data);
        setTopRisks(rRes.data);
        setHeatmapRisks(hrRes.data);
        setPrograms(pRes.data);
        setAllProjects(projRes.data);
        setCapacityAlerts(caRes.data);
        const upcomingReg = (regRes.data || [])
          .filter((m) => m.urgency_color !== "done" && m.target_date)
          .slice(0, 5);
        setRegulatoryAlerts(upcomingReg);
        setLoading(false);
      }).catch(() => setLoading(false));

    // Données arbitrage (envelopes + résumé)
    Promise.all([
      arbitrageAPI.getEnvelopes(),
      arbitrageAPI.getSummary(),
    ]).then(([envRes, sumRes]) => {
      const envelopes = envRes.data || [];
      const totals    = sumRes.data?.totals || {};
      if (envelopes.length > 0) {
        setArbitrageData({ envelopes, totals });
      }
    }).catch(() => {}); // silencieux si pas de données
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-slate-400 text-sm">
        Chargement du tableau de bord...
      </div>
    );
  }
  if (!summary) return null;

  const ragData = [
    { name: "Vert", value: summary.rag_counts.green, color: "#10B981" },
    { name: "Orange", value: summary.rag_counts.orange, color: "#F59E0B" },
    { name: "Rouge", value: summary.rag_counts.red, color: "#EF4444" },
  ];

  const methodData = Object.entries(summary.methodology_counts).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value: v,
  }));

  const budgetData = (summary.recent_projects || []).slice(0, 6).map((p) => ({
    name: p.name.split("—")[0].trim().slice(0, 20),
    Total: p.budget_total,
    Consommé: p.budget_consumed,
    Forecast: p.budget_forecast,
  }));

  return (
    <div className="p-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
          Tableau de Bord
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Groupe Altair Industries — Vue synthétique du portefeuille projets
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="metric-cards">
        <MetricCard
          testId="metric-total-projects"
          label="Projets totaux"
          value={summary.total_projects}
          sub="dans le portefeuille"
          icon={Briefcase}
          accent="#0052CC"
        />
        <MetricCard
          testId="metric-green"
          label="Projets verts"
          value={summary.rag_counts.green}
          sub="dans les délais et budget"
          icon={CheckCircle}
          accent="#10B981"
        />
        <MetricCard
          testId="metric-at-risk"
          label="Projets à risque"
          value={summary.rag_counts.orange + summary.rag_counts.red}
          sub={`${summary.rag_counts.orange} orange, ${summary.rag_counts.red} rouge`}
          icon={AlertTriangle}
          accent="#EF4444"
        />
        <MetricCard
          testId="metric-budget"
          label="Budget total"
          value={formatEuro(summary.budget.total)}
          sub={`${summary.budget.consumption_rate}% consommé`}
          icon={TrendingUp}
          accent="#F59E0B"
        />
      </div>

      {/* Budget detail row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Budget consommé", value: formatEuro(summary.budget.consumed), pct: summary.budget.consumption_rate, color: "bg-[#0052CC]" },
          { label: "Budget forecast", value: formatEuro(summary.budget.forecast), pct: Math.round((summary.budget.forecast / summary.budget.total) * 100), color: "bg-amber-500" },
          { label: "JH consommés / planifiés", value: `${summary.jh.consumed.toLocaleString("fr-FR")} / ${summary.jh.planned.toLocaleString("fr-FR")}`, pct: Math.round((summary.jh.consumed / summary.jh.planned) * 100), color: "bg-indigo-500" },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">{item.label}</div>
            <div className="font-mono-data text-xl font-bold text-[#0F172A]">{item.value}</div>
            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all duration-700`}
                style={{ width: `${Math.min(item.pct, 100)}%` }}
              />
            </div>
            <div className="text-xs text-slate-400 mt-1">{item.pct}% du budget total</div>
          </div>
        ))}
      </div>

      {/* Alertes capacité — widget compact (avant les graphiques) */}
      {capacityAlerts.length > 0 && (
        <div className="mb-6" data-testid="capacity-alerts-section">
          <CapacityAlertBanner alerts={capacityAlerts} compact={true} />
        </div>
      )}

      {/* Widget Alertes réglementaires */}
      {regulatoryAlerts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded shadow-sm mb-6" data-testid="regulatory-alerts-widget">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-[#0052CC]" />
              <span className="text-sm font-bold text-slate-800">Alertes réglementaires</span>
              <span className="text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                {regulatoryAlerts.filter((m) => m.urgency_color === "red" || m.urgency_color === "overdue").length} urgent(s)
              </span>
            </div>
            <Link to="/conformite" className="text-xs text-[#0052CC] hover:underline flex items-center gap-1">
              Voir tout <ArrowRight size={11} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {regulatoryAlerts.map((m) => {
              const colorMap = {
                overdue: "text-gray-400 line-through",
                red:     "text-rose-700 font-bold",
                orange:  "text-amber-700 font-semibold",
                green:   "text-emerald-600",
              };
              const bgMap = {
                overdue: "",
                red:     "bg-rose-50/30",
                orange:  "bg-amber-50/30",
                green:   "",
              };
              const daysLabel = m.urgency_color === "overdue"
                ? `${Math.abs(m.days_remaining)}j retard`
                : `${m.days_remaining}j`;
              return (
                <div key={m.milestone_id} className={`flex items-center justify-between px-5 py-2.5 ${bgMap[m.urgency_color] || ""}`}
                  data-testid={`reg-alert-${m.milestone_id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border
                      ${m.type === "regulatory" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-orange-50 text-orange-600 border-orange-200"}`}>
                      {m.type === "regulatory" ? "RÉGL." : "DÉCOM."}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-800 truncate block">{m.name}</span>
                      <span className="text-[10px] text-slate-400 truncate">{m.project_name?.slice(0, 25)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                      {m.target_date ? new Date(m.target_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}
                    </span>
                    <span className={`text-[11px] min-w-[60px] text-right tabular-nums ${colorMap[m.urgency_color] || "text-slate-600"}`}>
                      {daysLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Widget Enveloppe Portefeuille — visible ADMIN, PORTFOLIO, CIO, FINANCE */}
      {canSeeEnvelope && arbitrageData && arbitrageData.envelopes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded shadow-sm mb-6" data-testid="envelope-portfolio-widget">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-[#0052CC]" />
              <span className="text-sm font-bold text-slate-800">Enveloppe Portefeuille</span>
              {arbitrageData.envelopes.some(e => {
                const cpx = (arbitrageData.totals.capex_planned || 0) / (e.capex_envelope || 1) > 1;
                const opx = (arbitrageData.totals.opex_planned || 0)  / (e.opex_envelope  || 1) > 1;
                return cpx || opx;
              }) && (
                <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={9} /> Dépassement
                </span>
              )}
            </div>
            <Link to="/arbitrage" className="text-xs text-[#0052CC] hover:underline flex items-center gap-1">
              Détails <ArrowRight size={11} />
            </Link>
          </div>
          <div className="px-5 py-4 space-y-3">
            {arbitrageData.envelopes.map(env => {
              const capexUsed  = arbitrageData.totals.capex_planned || 0;
              const opexUsed   = arbitrageData.totals.opex_planned  || 0;
              const capexPct   = env.capex_envelope > 0 ? (capexUsed / env.capex_envelope) * 100 : 0;
              const opexPct    = env.opex_envelope  > 0 ? (opexUsed  / env.opex_envelope)  * 100 : 0;
              const capexOver  = capexPct > 100;
              const opexOver   = opexPct  > 100;
              return (
                <div key={env.envelope_id}>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    {env.label} — {env.year}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* CAPEX */}
                    <div data-testid="dashboard-capex-bar">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600 font-medium">CAPEX</span>
                        <span className={`text-xs font-semibold ${capexOver ? "text-red-600" : "text-slate-600"}`}>
                          {formatEuro(capexUsed)} / {formatEuro(env.capex_envelope)}
                          <span className="ml-1 text-slate-400">({Math.round(capexPct)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${capexOver ? "bg-red-500" : capexPct > 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(capexPct, 100)}%` }}
                        />
                      </div>
                      {capexOver && (
                        <p className="text-[10px] text-red-500 mt-0.5">
                          +{formatEuro(capexUsed - env.capex_envelope)} ({Math.round(capexPct - 100)}% dépassement)
                        </p>
                      )}
                    </div>
                    {/* OPEX */}
                    <div data-testid="dashboard-opex-bar">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-600 font-medium">OPEX</span>
                        <span className={`text-xs font-semibold ${opexOver ? "text-red-600" : "text-slate-600"}`}>
                          {formatEuro(opexUsed)} / {formatEuro(env.opex_envelope)}
                          <span className="ml-1 text-slate-400">({Math.round(opexPct)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${opexOver ? "bg-red-500" : opexPct > 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(opexPct, 100)}%` }}
                        />
                      </div>
                      {opexOver && (
                        <p className="text-[10px] text-red-500 mt-0.5">
                          +{formatEuro(opexUsed - env.opex_envelope)} ({Math.round(opexPct - 100)}% dépassement)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        {/* Budget bar chart */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-gray-200 rounded shadow-sm p-5">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4">
            Budget par projet (€)
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={budgetData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Total" fill="#CBD5E1" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Consommé" fill="#0052CC" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Forecast" fill="#F59E0B" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* RAG Pie */}
        <div className="col-span-12 lg:col-span-4 bg-white border border-gray-200 rounded shadow-sm p-5">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4">
            Distribution RAG
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={ragData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value">
                {ragData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v} projets`]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {ragData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-mono-data font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Methodology */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
              Méthodologies
            </div>
            <div className="space-y-1.5">
              {methodData.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{m.name}</span>
                  <span className="font-mono-data font-bold text-slate-800">{m.value} proj.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent projects */}
      <div className="bg-white border border-gray-200 rounded shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
            Projets récents
          </div>
          <Link
            to="/portfolio"
            className="flex items-center gap-1 text-xs text-[#0052CC] hover:text-[#0047B3] font-medium"
            data-testid="view-all-projects-link"
          >
            Voir tous
            <ArrowRight size={13} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="recent-projects-table">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["Projet", "Méthodo", "Statut", "Budget total", "Consommé", "Fin prévue"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-600 border-b border-gray-200">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(summary.recent_projects || []).map((p) => (
                <tr
                  key={p.project_id}
                  className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors"
                  data-testid={`recent-project-row-${p.project_id}`}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/projects/${p.project_id}`}
                      className="text-[#0052CC] hover:text-[#0047B3] font-medium text-sm"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-slate-600 capitalize">{p.methodology}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <RAGBadge status={p.status_rag} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-xs text-slate-700">
                    {formatEuro(p.budget_total)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-data text-xs text-slate-700">
                    {formatEuro(p.budget_consumed)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">
                    {formatDate(p.end_date_forecast)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 risques critiques portefeuille */}
      {topRisks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded shadow-sm mb-6" data-testid="top-risks-widget">

          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <ShieldAlert size={13} className="text-rose-400" />
              Top risques critiques — Portefeuille
            </div>
            <span className="text-[10px] text-slate-400 font-mono-data">{topRisks.length} risques prioritaires</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="top-risks-table">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {["Crit.", "Risque", "Catégorie", "Projet", "Statut", "Échéance"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-600 border-b border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topRisks.map((r) => {
                  const critCls = r.criticality >= 16
                    ? "bg-rose-100 text-rose-700 border-rose-300"
                    : r.criticality >= 7
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-emerald-100 text-emerald-700 border-emerald-200";
                  const catColors = {
                    technique: "text-blue-600", budget: "text-violet-600", planning: "text-sky-600",
                    ressource: "text-indigo-600", externe: "text-slate-500", "conformité": "text-teal-600",
                  };
                  const statusCls = { identifié: "text-blue-600", traité: "text-amber-600", clos: "text-emerald-600", accepté: "text-slate-500" };
                  return (
                    <tr
                      key={r.risk_id}
                      className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors"
                      data-testid={`top-risk-row-${r.risk_id}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${critCls}`}>
                          {r.criticality}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-xs">
                        <div className="font-medium text-xs text-slate-800 line-clamp-2 leading-snug">{r.title}</div>
                        {r.owner && <div className="text-[10px] text-slate-400 mt-0.5">{r.owner}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold capitalize ${catColors[r.category] || "text-slate-500"}`}>
                          {r.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/projects/${r.project_id}`}
                          className="text-[#0052CC] hover:text-[#0047B3] text-xs font-medium line-clamp-1"
                          data-testid={`top-risk-project-link-${r.risk_id}`}
                        >
                          {r.project_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold capitalize ${statusCls[r.status] || "text-slate-500"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {r.due_date ? formatDate(r.due_date) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cartographie des risques P × I — portefeuille */}
      {heatmapRisks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="dashboard-heatmap-section">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <MapPin size={13} className="text-rose-400" />
              Cartographie des risques P × I
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={heatmapFilterProgram}
                onChange={(e) => { setHeatmapFilterProgram(e.target.value); setHeatmapFilterProject(""); }}
                className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white"
                data-testid="heatmap-filter-programme"
              >
                <option value="">Tous programmes</option>
                {programs.map((p) => (
                  <option key={p.program_id} value={p.program_id}>{p.name}</option>
                ))}
              </select>
              <select
                value={heatmapFilterProject}
                onChange={(e) => setHeatmapFilterProject(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white"
                data-testid="heatmap-filter-project"
              >
                <option value="">Tous projets</option>
                {allProjects
                  .filter((p) => !heatmapFilterProgram || p.program_id === heatmapFilterProgram)
                  .map((p) => (
                    <option key={p.project_id} value={p.project_id}>
                      {p.name.split("—")[0].trim().slice(0, 45)}
                    </option>
                  ))}
              </select>
              {(heatmapFilterProgram || heatmapFilterProject) && (
                <button
                  onClick={() => { setHeatmapFilterProgram(""); setHeatmapFilterProject(""); }}
                  className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 border border-gray-200 rounded"
                  data-testid="heatmap-filter-reset"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

          {(() => {
            const filtered = heatmapRisks.filter((r) => {
              if (heatmapFilterProject) return r.project_id === heatmapFilterProject;
              if (heatmapFilterProgram) return r.program_id === heatmapFilterProgram;
              return true;
            });
            const critical = filtered.filter((r) => r.criticality >= 16);
            const moderate = filtered.filter((r) => r.criticality >= 7 && r.criticality < 16);
            const low = filtered.filter((r) => r.criticality < 7);
            return (
              <div className="p-5 grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-5" data-testid="dashboard-heatmap">
                  <RiskHeatmap risks={filtered} showProjectName={!heatmapFilterProject} />
                </div>
                <div className="col-span-12 lg:col-span-7">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">
                    Distribution criticité — {filtered.length} risque{filtered.length !== 1 ? "s" : ""}
                    {(heatmapFilterProgram || heatmapFilterProject) && (
                      <span className="ml-2 text-[#0052CC] normal-case font-normal">
                        (filtre actif)
                      </span>
                    )}
                  </div>
                  {[
                    { label: "Élevés (16-25)", count: critical.length, color: "bg-rose-500", textColor: "text-rose-700" },
                    { label: "Modérés (7-15)", count: moderate.length, color: "bg-amber-400", textColor: "text-amber-700" },
                    { label: "Faibles (1-6)",  count: low.length,      color: "bg-emerald-500", textColor: "text-emerald-700" },
                  ].map(({ label, count, color, textColor }) => {
                    const pct = filtered.length ? Math.round((count / filtered.length) * 100) : 0;
                    return (
                      <div key={label} className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`font-semibold ${textColor}`}>{label}</span>
                          <span className="font-mono-data text-slate-700">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}

                  {critical.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
                        Risques critiques (top 3)
                      </div>
                      {critical.slice(0, 3).map((r) => (
                        <div key={r.risk_id} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 flex-shrink-0">
                            {r.criticality}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs text-slate-700 font-medium line-clamp-1">{r.title}</div>
                            <Link
                              to={`/projects/${r.project_id}`}
                              className="text-[10px] text-[#0052CC] hover:underline"
                            >
                              {r.project_name}
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
