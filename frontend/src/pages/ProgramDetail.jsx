import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, AlertTriangle, TrendingUp, Calendar, Flag, Presentation,
} from "lucide-react";
import { programsAPI } from "@/api";
import ExportCopilModal from "@/components/ExportCopilModal";
import RAGBadge, { MethodologyBadge, MilestoneBadge } from "@/components/RAGBadge";
import { formatEuro, formatDate } from "@/utils/format";

const STATUS_LABELS = { active: "Actif", on_hold: "En pause", completed: "Terminé", cancelled: "Annulé" };
const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function ProgramDetail() {
  const { id } = useParams();
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  useEffect(() => {
    programsAPI.get(id).then((r) => {
      setProgram(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-slate-400 text-sm">Chargement du programme...</div>;
  if (!program) return <div className="p-8 text-rose-500 text-sm">Programme introuvable.</div>;

  const { metrics = {}, projects = [], milestones = [] } = program;
  const consumedPct = metrics.budget_total
    ? Math.min(Math.round((metrics.budget_consumed || 0) / metrics.budget_total * 100), 100)
    : 0;

  // Sort milestones: upcoming first, then past
  const sortedMilestones = [...milestones]
    .sort((a, b) => (a.date_forecast || "").localeCompare(b.date_forecast || ""))
    .slice(0, 10);

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="program-detail-page">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-500 mb-6">
        <Link to="/programmes" className="hover:text-[#0052CC] flex items-center gap-1">
          <ArrowLeft size={13} /> Programmes
        </Link>
        <ChevronRight size={12} />
        <span className="text-slate-800 font-medium truncate max-w-xs">{program.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0 mr-4">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <RAGBadge status={metrics.rag_consolidated || "green"} />
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[program.status] || STATUS_COLORS.active}`}>
              {STATUS_LABELS[program.status] || program.status}
            </span>
            <span className="text-xs text-slate-400">
              {metrics.project_count || 0} projet{(metrics.project_count || 0) > 1 ? "s" : ""}
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] leading-tight" data-testid="program-name">
            {program.name}
          </h1>
          {program.description && (
            <p className="text-sm text-slate-500 mt-2 max-w-2xl">{program.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            {program.owner && <span>Owner : <span className="font-medium text-slate-600">{program.owner}</span></span>}
            {program.start_date && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {program.start_date} → {program.end_date || "—"}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          <button
            onClick={() => setExportModalOpen(true)}
            data-testid="btn-export-copil-program"
            className="flex items-center gap-2 px-4 py-2 border border-[#0052CC] text-[#0052CC] text-sm font-semibold rounded hover:bg-[#EBF2FF] transition-colors"
          >
            <Presentation size={14} /> Export COPIL
          </button>
        </div>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Budget total", value: formatEuro(metrics.budget_total || 0), alert: false },
          {
            label: "Consommé",
            value: formatEuro(metrics.budget_consumed || 0),
            sub: `${consumedPct}%`,
            alert: consumedPct > 90,
          },
          {
            label: "Forecast",
            value: formatEuro(metrics.budget_forecast || 0),
            alert: (metrics.budget_forecast || 0) > (metrics.budget_total || 1),
          },
          { label: "Projets", value: metrics.project_count || 0, alert: false },
        ].map(({ label, value, sub, alert }) => (
          <div key={label} className={`bg-white border rounded shadow-sm p-4 ${alert ? "border-rose-200 bg-rose-50/30" : "border-gray-200"}`}>
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{label}</div>
            <div className={`font-mono-data text-lg font-bold ${alert ? "text-rose-600" : "text-[#0F172A]"}`}>{value}</div>
            {sub && <div className="text-xs text-slate-400 mt-0.5">{sub} du budget</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Projects list */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="program-projects-section">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                Projets du programme ({projects.length})
              </div>
            </div>
            {projects.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Aucun projet rattaché</div>
            ) : (
              <table className="w-full text-sm" data-testid="program-projects-table">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    {["RAG", "Nom", "Méthodo", "Budget total", "Consommé", "Forecast", "Fin prévue"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const overBudget = p.budget_forecast > p.budget_total * 1.05;
                    return (
                      <tr
                        key={p.project_id}
                        className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                        data-testid={`program-project-row-${p.project_id}`}
                      >
                        <td className="px-4 py-3">
                          <RAGBadge status={p.status_rag} />
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <Link
                            to={`/projects/${p.project_id}`}
                            className="text-[#0052CC] hover:text-[#0047B3] font-medium text-sm leading-snug line-clamp-2"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <MethodologyBadge methodology={p.methodology} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono-data text-xs text-slate-700">
                          {formatEuro(p.budget_total)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-data text-xs text-slate-700">
                          {formatEuro(p.budget_consumed)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-data text-xs">
                          <span className={overBudget ? "text-rose-600 font-semibold" : "text-slate-700"}>
                            {formatEuro(p.budget_forecast)}
                          </span>
                          {overBudget && (
                            <AlertTriangle size={11} className="text-rose-500 inline ml-1" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono-data text-slate-600">
                          {formatDate(p.end_date_forecast)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Budget totals footer */}
                <tfoot>
                  <tr className="bg-[#0F172A] text-white" data-testid="program-totals-row">
                    <td className="px-4 py-3 font-bold text-xs" colSpan={3}>
                      TOTAUX PROGRAMME
                    </td>
                    <td className="px-4 py-3 text-right font-mono-data font-bold text-xs">
                      {formatEuro(metrics.budget_total || 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-data font-bold text-xs">
                      <span className={consumedPct > 90 ? "text-rose-400" : "text-emerald-400"}>
                        {formatEuro(metrics.budget_consumed || 0)}
                      </span>
                      <div className="text-[9px] text-slate-400 font-normal">{consumedPct}%</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-data font-bold text-xs">
                      <span className={(metrics.budget_forecast || 0) > (metrics.budget_total || 1) ? "text-rose-400" : "text-emerald-400"}>
                        {formatEuro(metrics.budget_forecast || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Milestones agrégés */}
          {sortedMilestones.length > 0 && (
            <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="program-milestones-section">
              <div className="px-5 py-3 border-b border-gray-100">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                  Jalons agrégés ({milestones.length})
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    {["Jalon", "Projet", "Baseline", "Forecast", "Statut"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedMilestones.map((m) => {
                    const proj = projects.find((p) => p.project_id === m.project_id);
                    return (
                      <tr key={m.milestone_id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-800 text-xs">
                          {m.is_governance && <Flag size={11} className="text-[#0052CC] inline mr-1" />}
                          {m.name}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[160px] truncate">
                          {proj ? (
                            <Link to={`/projects/${proj.project_id}`} className="hover:text-[#0052CC]">
                              {proj.name.split("—")[0].trim()}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono-data text-slate-500">{formatDate(m.date_baseline)}</td>
                        <td className="px-4 py-2.5 text-xs font-mono-data">
                          <span className={m.date_forecast > m.date_baseline ? "text-rose-600 font-semibold" : "text-slate-600"}>
                            {formatDate(m.date_forecast)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><MilestoneBadge status={m.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* RAG distribution */}
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
              Distribution RAG
            </div>
            {["red", "orange", "green"].map((status) => {
              const count = (metrics.rag_counts || {})[status] || 0;
              const total = metrics.project_count || 1;
              const colors = { green: "bg-emerald-500", orange: "bg-amber-500", red: "bg-rose-500" };
              const labels = { green: "Vert", orange: "Orange", red: "Rouge" };
              return (
                <div key={status} className="flex items-center gap-3 mb-3 last:mb-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${colors[status]} flex-shrink-0`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-slate-600 font-medium">{labels[status]}</span>
                      <span className="font-mono-data font-bold text-slate-800">{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[status]}`}
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Program info */}
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
              Informations programme
            </div>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: "Owner", value: program.owner || "—" },
                { label: "Début", value: program.start_date || "—" },
                { label: "Fin prévue", value: program.end_date || "—" },
                { label: "Budget alloué", value: `${(program.budget_keur || 0).toLocaleString("fr-FR")} K€` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2 border-b border-gray-50 pb-2 last:border-0">
                  <dt className="text-xs text-slate-400 font-medium">{label}</dt>
                  <dd className="text-xs text-slate-700 font-medium text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Budget consumption bar */}
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
              Avancement budgétaire
            </div>
            <div className="flex items-end justify-between mb-2">
              <span className="font-mono-data text-2xl font-bold text-[#0F172A]">{consumedPct}%</span>
              <span className="text-xs text-slate-400">du budget consommé</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${consumedPct > 90 ? "bg-rose-500" : "bg-[#0052CC]"}`}
                style={{ width: `${consumedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>{formatEuro(metrics.budget_consumed || 0)}</span>
              <span>{formatEuro(metrics.budget_total || 0)}</span>
            </div>
            {(metrics.budget_forecast || 0) > (metrics.budget_total || 1) && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-rose-600 font-semibold bg-rose-50 rounded px-2 py-1">
                <TrendingUp size={12} />
                Forecast en dépassement : {formatEuro(metrics.budget_forecast || 0)}
              </div>
            )}
          </div>
        </div>
      </div>
      <ExportCopilModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        selectedProjectIds={projects.map((p) => p.project_id)}
        selectedProjectNames={projects.map((p) => p.name)}
      />
    </div>
  );
}
