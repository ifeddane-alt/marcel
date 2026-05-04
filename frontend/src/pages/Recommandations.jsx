import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, TrendingDown, Shield, Calendar, Target,
  Users, RefreshCw, Filter, ChevronRight, Download, FileText, FileSpreadsheet,
} from "lucide-react";
import { agentAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";

const TYPE_CONFIG = {
  eac_overrun:      { label: "Dépassement EAC",     icon: TrendingDown, color: "text-rose-600",   bg: "bg-rose-50",   border: "border-rose-200" },
  unmitigated_risk: { label: "Risque critique",      icon: Shield,       color: "text-rose-600",   bg: "bg-rose-50",   border: "border-rose-200" },
  delayed_milestone:{ label: "Jalon retard",         icon: Calendar,     color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
  envelope_breach:  { label: "Enveloppe dépassée",   icon: Target,       color: "text-rose-600",   bg: "bg-rose-50",   border: "border-rose-200" },
  red_project:      { label: "Projet rouge",         icon: AlertTriangle,color: "text-rose-600",   bg: "bg-rose-50",   border: "border-rose-200" },
  team_overload:    { label: "Surcharge équipe",     icon: Users,        color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
};

const SEVERITY_CONFIG = {
  critical: { label: "Critique", badge: "bg-rose-100 text-rose-700 border-rose-300" },
  warning:  { label: "Attention", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  info:     { label: "Info",     badge: "bg-blue-100 text-blue-700 border-blue-200" },
};

function RecommendationCard({ rec }) {
  const typeCfg = TYPE_CONFIG[rec.type] || { label: rec.type, icon: AlertTriangle, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" };
  const sevCfg  = SEVERITY_CONFIG[rec.severity] || SEVERITY_CONFIG.info;
  const Icon = typeCfg.icon;

  return (
    <div
      data-testid={`rec-card-${rec.id}`}
      className={`flex gap-3 p-4 rounded-xl border ${typeCfg.bg} ${typeCfg.border} hover:shadow-sm transition-shadow`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeCfg.bg} border ${typeCfg.border}`}>
        <Icon size={17} className={typeCfg.color} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className={`text-xs font-bold ${typeCfg.color} leading-snug`}>{rec.title}</span>
          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sevCfg.badge}`}>
            {sevCfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">{rec.description}</p>
        {rec.project_id && (
          <Link
            to={`/projects/${rec.project_id}`}
            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline mt-1.5"
          >
            Voir le projet <ChevronRight size={10} />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Recommandations() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission("agent.recommend") || hasPermission("*");

  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [exporting, setExporting] = useState("");

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const res = format === "pdf"
        ? await agentAPI.exportRecoPDF()
        : await agentAPI.exportRecoExcel();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `recommandations_ia_${new Date().toISOString().slice(0, 10)}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {}
    setExporting("");
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await agentAPI.getRecommendations();
      setRecs(res.data || []);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (canView) load(); }, [canView]);

  if (!canView) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-slate-400 text-sm">
        Accès non autorisé.
      </div>
    );
  }

  const filtered = recs.filter(r => {
    if (filterSeverity !== "all" && r.severity !== filterSeverity) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  });

  const criticalCount = recs.filter(r => r.severity === "critical").length;
  const warningCount  = recs.filter(r => r.severity === "warning").length;

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="recommendations-page">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
            Recommandations IA
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Anomalies et alertes détectées automatiquement dans le portefeuille
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export PDF */}
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting === "pdf" || loading || recs.length === 0}
            data-testid="rec-export-pdf-btn"
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-rose-200 rounded-lg hover:border-rose-300 hover:bg-rose-50 text-rose-600 transition-colors disabled:opacity-50"
          >
            <FileText size={13} />
            {exporting === "pdf" ? "Export…" : "PDF"}
          </button>
          {/* Export Excel */}
          <button
            onClick={() => handleExport("excel")}
            disabled={exporting === "excel" || loading || recs.length === 0}
            data-testid="rec-export-excel-btn"
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-emerald-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 text-emerald-600 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={13} />
            {exporting === "excel" ? "Export…" : "Excel"}
          </button>
          <button
            onClick={load}
            disabled={loading}
            data-testid="rec-refresh-btn"
            className="flex items-center gap-2 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 text-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Actualiser
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border-l-4 border-l-rose-500">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Critiques</div>
          <div className="text-3xl font-heading font-bold text-[#0F172A] mt-2" data-testid="rec-critical-count">{criticalCount}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border-l-4 border-l-amber-400">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Attentions</div>
          <div className="text-3xl font-heading font-bold text-[#0F172A] mt-2" data-testid="rec-warning-count">{warningCount}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 border-l-4 border-l-blue-500">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Total</div>
          <div className="text-3xl font-heading font-bold text-[#0F172A] mt-2" data-testid="rec-total-count">{recs.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <Filter size={13} className="text-slate-400" />
        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-blue-400 bg-white"
          data-testid="rec-filter-severity"
        >
          <option value="all">Toutes sévérités</option>
          <option value="critical">Critique</option>
          <option value="warning">Attention</option>
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-blue-400 bg-white"
          data-testid="rec-filter-type"
        >
          <option value="all">Tous types</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {(filterSeverity !== "all" || filterType !== "all") && (
          <button
            onClick={() => { setFilterSeverity("all"); setFilterType("all"); }}
            className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 border border-gray-200 rounded-lg"
          >
            Réinitialiser
          </button>
        )}
        {lastRefresh && (
          <span className="ml-auto text-[10px] text-slate-400">
            Actualisé à {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
          <RefreshCw size={14} className="animate-spin" /> Analyse du portefeuille en cours...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
            <Shield size={24} className="text-emerald-500" />
          </div>
          <p className="text-slate-700 font-semibold">Aucune anomalie détectée</p>
          <p className="text-slate-400 text-xs mt-1">
            {recs.length === 0
              ? "Le portefeuille ne présente pas d'anomalie selon les règles actuelles."
              : "Aucun résultat pour ces filtres."}
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="recommendations-list">
          {filtered.map(rec => <RecommendationCard key={rec.id} rec={rec} />)}
        </div>
      )}
    </div>
  );
}
