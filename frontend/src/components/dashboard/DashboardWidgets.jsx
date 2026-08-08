import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Briefcase, TrendingUp, AlertTriangle, CheckCircle, ArrowRight, ShieldAlert, MapPin,
  BotMessageSquare, TrendingDown, Shield, Calendar, Users, Target, Flag, Clock, Gavel,
} from "lucide-react";
import RAGBadge from "@/components/RAGBadge";
import RiskHeatmap from "@/components/RiskHeatmap";
import CapacityAlertBanner from "@/components/CapacityAlertBanner";
import { formatEuro, formatDate } from "@/utils/format";

function MetricCard({ label, value, sub, icon: Icon, accent = "#2563eb", testId }) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-zinc-200 rounded-lg shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
      style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">{label}</div>
        <Icon size={16} className="text-zinc-300" strokeWidth={1.5} />
      </div>
      <div className="mt-3">
        <div className="font-heading text-3xl font-bold text-zinc-950">{value}</div>
        {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold text-zinc-800 mb-1">{label}</div>
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

function WidgetShell({ title, icon: Icon, badge, link, linkLabel = "Voir tout", children, testId }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm mb-5" data-testid={testId}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500 font-semibold">
          {Icon && <Icon size={13} className="text-blue-600" />}
          {title}
          {badge}
        </div>
        {link && (
          <Link to={link} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            {linkLabel} <ArrowRight size={11} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Widgets ──────────────────────────────────────────────────────────────────

export function MetricSingleWidget({ summary, kind }) {
  const M = {
    metric_projects: { label: "Projets totaux", value: summary.total_projects, sub: "dans le portefeuille", icon: Briefcase, accent: "#2563eb" },
    metric_green: { label: "Projets verts", value: summary.rag_counts.green, sub: "dans les délais et budget", icon: CheckCircle, accent: "#10B981" },
    metric_at_risk: { label: "Projets à risque", value: summary.rag_counts.orange + summary.rag_counts.red, sub: `${summary.rag_counts.orange} orange, ${summary.rag_counts.red} rouge`, icon: AlertTriangle, accent: "#EF4444" },
    metric_budget: { label: "Budget total", value: formatEuro(summary.budget.total), sub: `${summary.budget.consumption_rate}% consommé`, icon: TrendingUp, accent: "#F59E0B" },
  }[kind];
  if (!M) return null;
  return <div className="h-full [&>div]:h-full"><MetricCard testId={kind} {...M} /></div>;
}

export function BudgetSingleWidget({ summary, kind }) {
  const M = {
    budget_consumed: { label: "Budget consommé", value: formatEuro(summary.budget.consumed), pct: summary.budget.consumption_rate, color: "bg-blue-600" },
    budget_forecast: { label: "Budget forecast", value: formatEuro(summary.budget.forecast), pct: Math.round((summary.budget.forecast / summary.budget.total) * 100), color: "bg-amber-500" },
    jh_progress: { label: "JH consommés / planifiés", value: `${summary.jh.consumed.toLocaleString("fr-FR")} / ${summary.jh.planned.toLocaleString("fr-FR")}`, pct: Math.round((summary.jh.consumed / summary.jh.planned) * 100), color: "bg-indigo-500" },
  }[kind];
  if (!M) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-5 h-full" data-testid={`${kind}-widget`}>
      <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-2">{M.label}</div>
      <div className="font-mono-data text-xl font-bold text-zinc-950">{M.value}</div>
      <div className="mt-3 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full ${M.color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(M.pct, 100)}%` }} />
      </div>
      <div className="text-xs text-zinc-400 mt-1">{M.pct}% du budget total</div>
    </div>
  );
}

export function MetricsWidget({ summary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5" data-testid="metric-cards">
      <MetricCard testId="metric-total-projects" label="Projets totaux" value={summary.total_projects} sub="dans le portefeuille" icon={Briefcase} accent="#2563eb" />
      <MetricCard testId="metric-green" label="Projets verts" value={summary.rag_counts.green} sub="dans les délais et budget" icon={CheckCircle} accent="#10B981" />
      <MetricCard testId="metric-at-risk" label="Projets à risque" value={summary.rag_counts.orange + summary.rag_counts.red} sub={`${summary.rag_counts.orange} orange, ${summary.rag_counts.red} rouge`} icon={AlertTriangle} accent="#EF4444" />
      <MetricCard testId="metric-budget" label="Budget total" value={formatEuro(summary.budget.total)} sub={`${summary.budget.consumption_rate}% consommé`} icon={TrendingUp} accent="#F59E0B" />
    </div>
  );
}

export function BudgetDetailWidget({ summary }) {
  const items = [
    { label: "Budget consommé", value: formatEuro(summary.budget.consumed), pct: summary.budget.consumption_rate, color: "bg-blue-600" },
    { label: "Budget forecast", value: formatEuro(summary.budget.forecast), pct: Math.round((summary.budget.forecast / summary.budget.total) * 100), color: "bg-amber-500" },
    { label: "JH consommés / planifiés", value: `${summary.jh.consumed.toLocaleString("fr-FR")} / ${summary.jh.planned.toLocaleString("fr-FR")}`, pct: Math.round((summary.jh.consumed / summary.jh.planned) * 100), color: "bg-indigo-500" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-5" data-testid="budget-detail-widget">
      {items.map((item) => (
        <div key={item.label} className="bg-white border border-zinc-200 rounded-lg shadow-sm p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-2">{item.label}</div>
          <div className="font-mono-data text-xl font-bold text-zinc-950">{item.value}</div>
          <div className="mt-3 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
          </div>
          <div className="text-xs text-zinc-400 mt-1">{item.pct}% du budget total</div>
        </div>
      ))}
    </div>
  );
}

export function CapacityWidget({ capacityAlerts }) {
  if (!capacityAlerts?.length) return null;
  return (
    <div className="mb-5" data-testid="capacity-alerts-section">
      <CapacityAlertBanner alerts={capacityAlerts} compact={true} />
    </div>
  );
}

export function RegulatoryWidget({ regulatoryAlerts }) {
  if (!regulatoryAlerts?.length) return null;
  const urgent = regulatoryAlerts.filter((m) => m.urgency_color === "red" || m.urgency_color === "overdue").length;
  return (
    <WidgetShell
      title="Alertes réglementaires" icon={ShieldAlert} link="/conformite"
      badge={<span className="text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full normal-case tracking-normal">{urgent} urgent(s)</span>}
      testId="regulatory-alerts-widget"
    >
      <div className="divide-y divide-zinc-50">
        {regulatoryAlerts.map((m) => {
          const colorMap = { overdue: "text-zinc-400 line-through", red: "text-rose-700 font-bold", orange: "text-amber-700 font-semibold", green: "text-emerald-600" };
          const bgMap = { red: "bg-rose-50/30", orange: "bg-amber-50/30" };
          const daysLabel = m.urgency_color === "overdue" ? `${Math.abs(m.days_remaining)}j retard` : `${m.days_remaining}j`;
          return (
            <div key={m.milestone_id} className={`flex items-center justify-between px-5 py-2.5 ${bgMap[m.urgency_color] || ""}`} data-testid={`reg-alert-${m.milestone_id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border ${m.type === "regulatory" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-orange-50 text-orange-600 border-orange-200"}`}>
                  {m.type === "regulatory" ? "RÉGL." : "DÉCOM."}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-zinc-800 truncate block">{m.name}</span>
                  <span className="text-[10px] text-zinc-400 truncate">{m.project_name?.slice(0, 25)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">
                  {m.target_date ? new Date(m.target_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}
                </span>
                <span className={`text-[11px] min-w-[60px] text-right tabular-nums ${colorMap[m.urgency_color] || "text-zinc-600"}`}>{daysLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

export function EnvelopeWidget({ arbitrageData }) {
  if (!arbitrageData?.envelopes?.length) return null;
  const over = arbitrageData.envelopes.some(e =>
    (arbitrageData.totals.capex_planned || 0) / (e.capex_envelope || 1) > 1 ||
    (arbitrageData.totals.opex_planned || 0) / (e.opex_envelope || 1) > 1
  );
  return (
    <WidgetShell
      title="Enveloppe Portefeuille" icon={TrendingUp} link="/arbitrage" linkLabel="Détails"
      badge={over && <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full normal-case tracking-normal"><AlertTriangle size={9} /> Dépassement</span>}
      testId="envelope-portfolio-widget"
    >
      <div className="px-5 py-4 space-y-3">
        {arbitrageData.envelopes.map(env => {
          const rows = [
            { label: "CAPEX", used: arbitrageData.totals.capex_planned || 0, env: env.capex_envelope, testId: "dashboard-capex-bar" },
            { label: "OPEX", used: arbitrageData.totals.opex_planned || 0, env: env.opex_envelope, testId: "dashboard-opex-bar" },
          ];
          return (
            <div key={env.envelope_id}>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{env.label} — {env.year}</div>
              <div className="grid grid-cols-2 gap-4">
                {rows.map(({ label, used, env: envAmount, testId }) => {
                  const pct = envAmount > 0 ? (used / envAmount) * 100 : 0;
                  const isOver = pct > 100;
                  return (
                    <div key={label} data-testid={testId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-600 font-medium">{label}</span>
                        <span className={`text-xs font-semibold ${isOver ? "text-red-600" : "text-zinc-600"}`}>
                          {formatEuro(used)} / {formatEuro(envAmount)}
                          <span className="ml-1 text-zinc-400">({Math.round(pct)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      {isOver && <p className="text-[10px] text-red-500 mt-0.5">+{formatEuro(used - envAmount)} ({Math.round(pct - 100)}% dépassement)</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

export function RecommendationsWidget({ recommendations }) {
  if (!recommendations?.length) return null;
  const criticals = recommendations.filter(r => r.severity === "critical").length;
  const TYPE_ICONS = {
    eac_overrun: TrendingDown, unmitigated_risk: Shield, delayed_milestone: Calendar,
    envelope_breach: Target, red_project: AlertTriangle, team_overload: Users,
  };
  return (
    <WidgetShell
      title="Recommandations IA" icon={BotMessageSquare} link="/agent/recommandations"
      badge={criticals > 0 && <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full normal-case tracking-normal"><AlertTriangle size={9} /> {criticals} critique(s)</span>}
      testId="recommendations-widget"
    >
      <div className="divide-y divide-zinc-50">
        {recommendations.map(rec => {
          const Icon = TYPE_ICONS[rec.type] || AlertTriangle;
          const critical = rec.severity === "critical";
          return (
            <div key={rec.id} className={`flex items-start gap-3 px-5 py-3 ${critical ? "bg-rose-50/40" : "bg-amber-50/30"}`} data-testid={`dashboard-rec-${rec.id}`}>
              <Icon size={14} className={`${critical ? "text-rose-500" : "text-amber-500"} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-800 truncate">{rec.title}</span>
                  <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${critical ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-amber-100 text-amber-700 border-amber-100"}`}>
                    {critical ? "Critique" : "Attention"}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{rec.description}</p>
              </div>
              {rec.project_id && (
                <Link to={`/projects/${rec.project_id}`} className="flex-shrink-0 text-[10px] text-blue-600 hover:underline whitespace-nowrap">Voir →</Link>
              )}
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

export function ChartBudgetWidget({ summary }) {
  const budgetData = (summary.recent_projects || []).slice(0, 6).map((p) => ({
    name: p.name.split("—")[0].trim().slice(0, 20),
    Total: p.budget_total, Consommé: p.budget_consumed, Forecast: p.budget_forecast,
  }));
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4 md:p-5 h-full flex flex-col" data-testid="chart-budget-widget">
      <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">Budget par projet (€)</div>
      <div className="flex-1 min-h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={budgetData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94A3B8" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="Total" fill="#CBD5E1" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Consommé" fill="#2563eb" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Forecast" fill="#F59E0B" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ChartRagWidget({ summary }) {
  const ragData = [
    { name: "Vert", value: summary.rag_counts.green, color: "#10B981" },
    { name: "Orange", value: summary.rag_counts.orange, color: "#F59E0B" },
    { name: "Rouge", value: summary.rag_counts.red, color: "#EF4444" },
  ];
  const methodData = Object.entries(summary.methodology_counts).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v }));
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4 md:p-5 h-full" data-testid="chart-rag-widget">
      <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">Distribution RAG</div>
      <div className="h-28 sm:h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={ragData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value">
              {ragData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(v) => [`${v} projets`]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1.5">
        {ragData.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-zinc-600">{item.name}</span>
            </div>
            <span className="font-mono-data font-bold text-zinc-800">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-zinc-100">
        <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-2">Méthodologies</div>
        <div className="space-y-1.5">
          {methodData.map((m) => (
            <div key={m.name} className="flex items-center justify-between text-xs">
              <span className="text-zinc-600">{m.name}</span>
              <span className="font-mono-data font-bold text-zinc-800">{m.value} proj.</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChartsWidget({ summary }) {
  const ragData = [
    { name: "Vert", value: summary.rag_counts.green, color: "#10B981" },
    { name: "Orange", value: summary.rag_counts.orange, color: "#F59E0B" },
    { name: "Rouge", value: summary.rag_counts.red, color: "#EF4444" },
  ];
  const methodData = Object.entries(summary.methodology_counts).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v }));
  const budgetData = (summary.recent_projects || []).slice(0, 6).map((p) => ({
    name: p.name.split("—")[0].trim().slice(0, 20),
    Total: p.budget_total, Consommé: p.budget_consumed, Forecast: p.budget_forecast,
  }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 mb-5" data-testid="charts-widget">
      <div className="col-span-1 lg:col-span-8 bg-white border border-zinc-200 rounded-lg shadow-sm p-4 md:p-5">
        <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">Budget par projet (€)</div>
        <div className="h-36 sm:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budgetData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94A3B8" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Total" fill="#CBD5E1" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Consommé" fill="#2563eb" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Forecast" fill="#F59E0B" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="col-span-1 lg:col-span-4 bg-white border border-zinc-200 rounded-lg shadow-sm p-4 md:p-5">
        <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">Distribution RAG</div>
        <div className="h-28 sm:h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={ragData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value">
                {ragData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} projets`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 space-y-1.5">
          {ragData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-zinc-600">{item.name}</span>
              </div>
              <span className="font-mono-data font-bold text-zinc-800">{item.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-100">
          <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-2">Méthodologies</div>
          <div className="space-y-1.5">
            {methodData.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-xs">
                <span className="text-zinc-600">{m.name}</span>
                <span className="font-mono-data font-bold text-zinc-800">{m.value} proj.</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MilestonesGaugeWidget({ cxo }) {
  if (!cxo) return null;
  const m = cxo.milestones;
  const color = m.on_time_rate >= 80 ? "#10b981" : m.on_time_rate >= 60 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-5 mb-5" data-testid="milestones-gauge-widget">
      <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-4">Jalons — taux à l'heure</div>
      <div className="flex items-center gap-5">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${m.on_time_rate} 100`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono-data text-sm font-bold text-zinc-800">{m.on_time_rate}%</span>
        </div>
        <div className="text-sm text-zinc-600">
          <p><strong>{m.on_time}</strong> jalons à l'heure sur <strong>{m.total}</strong></p>
          <p className="text-xs text-zinc-400 mt-1">Forecast ≤ Baseline ou jalon atteint</p>
        </div>
      </div>
    </div>
  );
}

export function UpcomingMilestonesWidget({ extras }) {
  const items = extras?.upcoming_milestones || [];
  if (!items.length) return null;
  const lateCount = items.filter(m => m.late).length;
  return (
    <WidgetShell
      title="Jalons à venir (30 jours)" icon={Flag} link="/roadmap" linkLabel="Roadmap"
      badge={lateCount > 0 && <span className="text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full normal-case tracking-normal">{lateCount} en retard</span>}
      testId="upcoming-milestones-widget"
    >
      <div className="divide-y divide-zinc-50">
        {items.map((m) => (
          <div key={m.milestone_id} className={`flex items-center justify-between px-5 py-2.5 ${m.late ? "bg-rose-50/30" : ""}`} data-testid={`upcoming-ms-${m.milestone_id}`}>
            <div className="min-w-0">
              <span className={`text-xs font-semibold truncate block ${m.late ? "text-rose-700" : "text-zinc-800"}`}>{m.name}</span>
              <Link to={`/projects/${m.project_id}`} className="text-[10px] text-blue-600 hover:underline truncate">{m.project_name}</Link>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <span className="text-[10px] text-zinc-400 font-mono">{formatDate(m.date_forecast)}</span>
              <span className={`text-[11px] min-w-[62px] text-right tabular-nums ${m.days_remaining < 0 ? "text-rose-700 font-bold" : m.days_remaining <= 7 ? "text-amber-700 font-semibold" : "text-zinc-600"}`}>
                {m.days_remaining < 0 ? `${Math.abs(m.days_remaining)}j retard` : `J-${m.days_remaining}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function TopProjectsWidget({ cxo }) {
  const projects = cxo?.top_projects || [];
  if (!projects.length) return null;
  return (
    <WidgetShell title="Top 5 projets par budget" icon={Briefcase} link="/portfolio" testId="top-projects-widget">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 text-left">
              {["Projet", "Budget", "Consommé", "RAG"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.project_id} className="border-b border-zinc-100 hover:bg-zinc-50/60">
                <td className="px-4 py-2.5"><Link to={`/projects/${p.project_id}`} className="text-blue-600 hover:underline font-medium text-xs">{p.name}</Link></td>
                <td className="px-4 py-2.5 text-right font-mono-data text-xs">{formatEuro(p.budget_total)}</td>
                <td className="px-4 py-2.5 text-right font-mono-data text-xs">{formatEuro(p.budget_consumed)}</td>
                <td className="px-4 py-2.5"><RAGBadge status={p.status_rag} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}

export function PendingTimesheetsWidget({ extras }) {
  const pt = extras?.pending_timesheets;
  if (!pt || pt.count === 0) return null;
  return (
    <WidgetShell
      title="Timesheets à valider" icon={Clock} link="/timesheets"
      badge={<span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full normal-case tracking-normal">{pt.count} en attente · {pt.total_jh} JH</span>}
      testId="pending-timesheets-widget"
    >
      <div className="divide-y divide-zinc-50">
        {pt.items.map((t) => (
          <div key={t.timesheet_id} className="flex items-center justify-between px-5 py-2.5">
            <span className="text-xs font-semibold text-zinc-800">{t.resource_name}</span>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-zinc-400 font-mono">{formatDate(t.date)}</span>
              <span className="text-xs font-mono-data font-bold text-zinc-700">{t.jh_value} JH</span>
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function RecentDecisionsWidget({ extras }) {
  const items = extras?.recent_decisions || [];
  if (!items.length) return null;
  const STATUS_CLS = { "proposée": "bg-blue-50 text-blue-600 border-blue-200", "validée": "bg-emerald-50 text-emerald-600 border-emerald-200", "rejetée": "bg-rose-50 text-rose-600 border-rose-200" };
  return (
    <WidgetShell title="Dernières décisions" icon={Gavel} link="/gouvernance" testId="recent-decisions-widget">
      <div className="divide-y divide-zinc-50">
        {items.map((d) => (
          <div key={d.decision_id} className="flex items-center justify-between px-5 py-2.5">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-zinc-800 truncate block">{d.title}</span>
              <Link to={`/projects/${d.project_id}`} className="text-[10px] text-blue-600 hover:underline">{d.project_name}</Link>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg border capitalize ${STATUS_CLS[d.status] || "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>{d.status}</span>
              <span className="text-[10px] text-zinc-400 font-mono">{formatDate(d.decision_date)}</span>
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function TeamLoadWidget({ teamLoad }) {
  if (!teamLoad?.length) return null;
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const rows = teamLoad
    .map((t) => {
      const idx = t.periods.findIndex((p) => p.period === currentPeriod);
      const cur = idx >= 0 ? t.periods[idx] : t.periods[0];
      const next = t.periods.slice(idx >= 0 ? idx : 0, (idx >= 0 ? idx : 0) + 3);
      return { ...t, cur, next };
    })
    .sort((a, b) => (b.cur?.utilization_pct || 0) - (a.cur?.utilization_pct || 0));
  const overloaded = rows.filter((t) => (t.cur?.utilization_pct || 0) > 100).length;
  const pctColor = (pct) => (pct > 100 ? "text-rose-700" : pct >= 85 ? "text-amber-700" : "text-emerald-700");
  const barColor = (pct) => (pct > 100 ? "bg-rose-500" : pct >= 85 ? "bg-amber-400" : "bg-emerald-500");
  const cellBg = (pct) => (pct > 100 ? "bg-rose-100 text-rose-700 border-rose-200" : pct >= 85 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200");
  return (
    <WidgetShell
      title="Charge équipes — capacité vs allocations" icon={Users} link="/teams" linkLabel="Équipes"
      badge={overloaded > 0 && <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full normal-case tracking-normal"><AlertTriangle size={9} /> {overloaded} surcharge(s)</span>}
      testId="team-load-widget"
    >
      <div className="divide-y divide-zinc-50">
        {rows.map((t) => {
          const pct = t.cur?.utilization_pct || 0;
          return (
            <div key={t.team_id || "unassigned"} className={`px-5 py-3 ${pct > 100 ? "bg-rose-50/30" : ""}`} data-testid={`team-load-row-${t.team_id || "unassigned"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {t.team_id ? (
                    <Link to={`/teams/${t.team_id}`} className="text-xs font-semibold text-blue-600 hover:underline truncate">{t.team_name}</Link>
                  ) : (
                    <span className="text-xs font-semibold text-zinc-500 truncate">{t.team_name}</span>
                  )}
                  <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">
                    {t.cur?.allocated_jh ?? 0} / {t.cur?.capacity_jh ?? 0} JH
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {t.next.map((p) => (
                    <span key={p.period} className={`hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-lg border tabular-nums ${cellBg(p.utilization_pct)}`} title={`${p.period} : ${p.allocated_jh}/${p.capacity_jh} JH`}>
                      {p.period.slice(5)} · {Math.round(p.utilization_pct)}%
                    </span>
                  ))}
                  <span className={`text-xs font-bold tabular-nums ${pctColor(pct)}`}>{Math.round(pct)}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              {pct > 100 && (
                <p className="text-[10px] text-rose-600 mt-1">
                  Surcharge : +{Math.round((t.cur.allocated_jh - t.cur.capacity_jh) * 10) / 10} JH au-dessus de la capacité ce mois-ci
                </p>
              )}
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

export function RecentProjectsWidget({ summary }) {
  return (
    <WidgetShell title="Projets récents" link="/portfolio" linkLabel="Voir tous" testId="recent-projects-widget">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="recent-projects-table">
          <thead>
            <tr className="bg-zinc-50 text-left">
              {["Projet", "Méthodo", "Statut", "Budget total", "Consommé", "Fin prévue"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(summary.recent_projects || []).map((p) => (
              <tr key={p.project_id} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors" data-testid={`recent-project-row-${p.project_id}`}>
                <td className="px-4 py-2.5"><Link to={`/projects/${p.project_id}`} className="text-blue-600 hover:text-blue-700 font-medium text-sm">{p.name}</Link></td>
                <td className="px-4 py-2.5"><span className="text-xs text-zinc-600 capitalize">{p.methodology}</span></td>
                <td className="px-4 py-2.5"><RAGBadge status={p.status_rag} /></td>
                <td className="px-4 py-2.5 text-right font-mono-data text-xs text-zinc-700">{formatEuro(p.budget_total)}</td>
                <td className="px-4 py-2.5 text-right font-mono-data text-xs text-zinc-700">{formatEuro(p.budget_consumed)}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-600">{formatDate(p.end_date_forecast)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}

export function TopRisksWidget({ topRisks }) {
  if (!topRisks?.length) return null;
  return (
    <WidgetShell
      title="Top risques critiques — Portefeuille" icon={ShieldAlert}
      badge={<span className="text-[10px] text-zinc-400 font-mono-data normal-case tracking-normal">{topRisks.length} risques prioritaires</span>}
      testId="top-risks-widget"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="top-risks-table">
          <thead>
            <tr className="bg-zinc-50 text-left">
              {["Crit.", "Risque", "Catégorie", "Projet", "Statut", "Échéance"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topRisks.map((r) => {
              const critCls = r.criticality >= 16 ? "bg-rose-100 text-rose-700 border-rose-300" : r.criticality >= 7 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200";
              const catColors = { technique: "text-blue-600", budget: "text-violet-600", planning: "text-sky-600", ressource: "text-indigo-600", externe: "text-zinc-500", "conformité": "text-teal-600" };
              const statusCls = { identifié: "text-blue-600", traité: "text-amber-600", clos: "text-emerald-600", accepté: "text-zinc-500" };
              return (
                <tr key={r.risk_id} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors" data-testid={`top-risk-row-${r.risk_id}`}>
                  <td className="px-4 py-2.5"><span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${critCls}`}>{r.criticality}</span></td>
                  <td className="px-4 py-2.5 max-w-xs">
                    <div className="font-medium text-xs text-zinc-800 line-clamp-2 leading-snug">{r.title}</div>
                    {r.owner && <div className="text-[10px] text-zinc-400 mt-0.5">{r.owner}</div>}
                  </td>
                  <td className="px-4 py-2.5"><span className={`text-xs font-semibold capitalize ${catColors[r.category] || "text-zinc-500"}`}>{r.category}</span></td>
                  <td className="px-4 py-2.5"><Link to={`/projects/${r.project_id}`} className="text-blue-600 hover:text-blue-700 text-xs font-medium line-clamp-1" data-testid={`top-risk-project-link-${r.risk_id}`}>{r.project_name}</Link></td>
                  <td className="px-4 py-2.5"><span className={`text-xs font-semibold capitalize ${statusCls[r.status] || "text-zinc-500"}`}>{r.status}</span></td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">{r.due_date ? formatDate(r.due_date) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}

export function HeatmapWidget({ heatmapRisks, programs, allProjects }) {
  const [filterProgram, setFilterProgram] = useState("");
  const [filterProject, setFilterProject] = useState("");
  if (!heatmapRisks?.length) return null;
  const filtered = heatmapRisks.filter((r) => {
    if (filterProject) return r.project_id === filterProject;
    if (filterProgram) return r.program_id === filterProgram;
    return true;
  });
  const critical = filtered.filter((r) => r.criticality >= 16);
  const moderate = filtered.filter((r) => r.criticality >= 7 && r.criticality < 16);
  const low = filtered.filter((r) => r.criticality < 7);
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm mb-5" data-testid="dashboard-heatmap-section">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500 font-semibold">
          <MapPin size={13} className="text-rose-400" />
          Cartographie des risques P × I
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filterProgram} onChange={(e) => { setFilterProgram(e.target.value); setFilterProject(""); }} className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-600 focus:outline-none focus:border-blue-600 bg-white" data-testid="heatmap-filter-programme">
            <option value="">Tous programmes</option>
            {programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.name}</option>)}
          </select>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-600 focus:outline-none focus:border-blue-600 bg-white" data-testid="heatmap-filter-project">
            <option value="">Tous projets</option>
            {allProjects.filter((p) => !filterProgram || p.program_id === filterProgram).map((p) => (
              <option key={p.project_id} value={p.project_id}>{p.name.split("—")[0].trim().slice(0, 45)}</option>
            ))}
          </select>
          {(filterProgram || filterProject) && (
            <button onClick={() => { setFilterProgram(""); setFilterProject(""); }} className="text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1 border border-zinc-200 rounded-lg" data-testid="heatmap-filter-reset">Réinitialiser</button>
          )}
        </div>
      </div>
      <div className="p-4 md:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-1 lg:col-span-5" data-testid="dashboard-heatmap">
          <RiskHeatmap risks={filtered} showProjectName={!filterProject} />
        </div>
        <div className="col-span-1 lg:col-span-7">
          <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-3">
            Distribution criticité — {filtered.length} risque{filtered.length !== 1 ? "s" : ""}
            {(filterProgram || filterProject) && <span className="ml-2 text-blue-600 normal-case font-normal">(filtre actif)</span>}
          </div>
          {[
            { label: "Élevés (16-25)", count: critical.length, color: "bg-rose-500", textColor: "text-rose-700" },
            { label: "Modérés (7-15)", count: moderate.length, color: "bg-amber-400", textColor: "text-amber-700" },
            { label: "Faibles (1-6)", count: low.length, color: "bg-emerald-500", textColor: "text-emerald-700" },
          ].map(({ label, count, color, textColor }) => {
            const pct = filtered.length ? Math.round((count / filtered.length) * 100) : 0;
            return (
              <div key={label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className={`font-semibold ${textColor}`}>{label}</span>
                  <span className="font-mono-data text-zinc-700">{count} ({pct}%)</span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {critical.length > 0 && (
            <div className="mt-4 pt-3 border-t border-zinc-100">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-2">Risques critiques (top 3)</div>
              {critical.slice(0, 3).map((r) => (
                <div key={r.risk_id} className="flex items-start gap-2 py-1.5 border-b border-zinc-50 last:border-0">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 flex-shrink-0">{r.criticality}</span>
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-700 font-medium line-clamp-1">{r.title}</div>
                    <Link to={`/projects/${r.project_id}`} className="text-[10px] text-blue-600 hover:underline">{r.project_name}</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
