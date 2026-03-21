import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Calendar, ChevronRight, Flag, AlertTriangle, Clock, TrendingUp,
} from "lucide-react";
import { projectsAPI, milestonesAPI, allocationsAPI, tasksAPI, resourcesAPI } from "@/api";
import RAGBadge, { MethodologyBadge, MilestoneBadge, TaskTypeBadge, TaskStatusBadge } from "@/components/RAGBadge";
import { formatEuro, formatDate, formatJH } from "@/utils/format";

function BudgetBar({ label, value, total, color }) {
  const pct = total ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="font-mono-data text-sm font-bold text-slate-800">{formatEuro(value)}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5 text-right">{pct.toFixed(0)}% du budget total</div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      projectsAPI.get(id),
      milestonesAPI.list(id),
      allocationsAPI.list(id),
      tasksAPI.list(id),
      resourcesAPI.list(),
    ]).then(([pRes, mRes, aRes, tRes, rRes]) => {
      setProject(pRes.data);
      setMilestones(mRes.data);
      setAllocations(aRes.data);
      setTasks(tRes.data);
      setResources(rRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-8 text-slate-400 text-sm">Chargement du projet...</div>;
  }
  if (!project) {
    return <div className="p-8 text-rose-500 text-sm">Projet introuvable.</div>;
  }

  const budgetDeviation = project.budget_forecast - project.budget_total;
  const scheduleDelayed = project.end_date_forecast > project.end_date_baseline;

  // Task totals for coherence check
  const taskTotals = tasks.reduce(
    (acc, t) => ({
      jh_planned: acc.jh_planned + (t.jh_planned || 0),
      jh_consumed: acc.jh_consumed + (t.jh_consumed || 0),
      budget_planned_k: acc.budget_planned_k + (t.budget_planned_k || 0),
      budget_consumed_k: acc.budget_consumed_k + (t.budget_consumed_k || 0),
    }),
    { jh_planned: 0, jh_consumed: 0, budget_planned_k: 0, budget_consumed_k: 0 }
  );

  const getResourceName = (resourceId) => {
    const r = resources.find((res) => res.resource_id === resourceId);
    return r ? r.name : resourceId ? resourceId.slice(-6) : "—";
  };

  return (
    <div className="p-8" data-testid="project-detail-page">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-500 mb-6">
        <Link to="/portfolio" className="hover:text-[#0052CC] flex items-center gap-1">
          <ArrowLeft size={13} />
          Portefeuille
        </Link>
        <ChevronRight size={12} />
        <span className="text-slate-800 font-medium truncate max-w-xs">{project.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0 mr-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono-data text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {project.source_id || "—"}
            </span>
            <RAGBadge status={project.status_rag} />
            <MethodologyBadge methodology={project.methodology} />
          </div>
          <h1 className="font-heading text-3xl font-bold text-[#0F172A] leading-tight" data-testid="project-name">
            {project.name}
          </h1>
          {project.source_tool && (
            <p className="text-xs text-slate-400 mt-1">
              Source : {project.source_tool} · Sync : {formatDate(project.last_sync_at)}
            </p>
          )}
        </div>
      </div>

      {/* Alert banners */}
      {(budgetDeviation > project.budget_total * 0.05 || scheduleDelayed) && (
        <div className="mb-4 space-y-2">
          {budgetDeviation > project.budget_total * 0.05 && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded px-4 py-2.5 text-rose-700 text-sm" data-testid="budget-alert">
              <AlertTriangle size={15} />
              Dépassement budgétaire forecast : +{formatEuro(budgetDeviation)} ({((budgetDeviation / project.budget_total) * 100).toFixed(0)}%)
            </div>
          )}
          {scheduleDelayed && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-4 py-2.5 text-amber-700 text-sm" data-testid="schedule-alert">
              <Clock size={15} />
              Retard calendrier — Fin forecast : {formatDate(project.end_date_forecast)} (baseline : {formatDate(project.end_date_baseline)})
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Left column */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Budget section */}
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5" data-testid="budget-section">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4">
              Budget & Charges
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <BudgetBar label="Budget consommé" value={project.budget_consumed} total={project.budget_total} color="bg-[#0052CC]" />
                <BudgetBar label="Budget forecast" value={project.budget_forecast} total={project.budget_total} color={project.budget_forecast > project.budget_total ? "bg-rose-500" : "bg-amber-400"} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Budget total", value: formatEuro(project.budget_total), mono: true },
                  { label: "Consommé", value: formatEuro(project.budget_consumed), mono: true },
                  { label: "Forecast", value: formatEuro(project.budget_forecast), mono: true, alert: project.budget_forecast > project.budget_total },
                  { label: "Reste à faire", value: formatEuro(project.budget_total - project.budget_consumed), mono: true },
                  { label: "JH planifiés", value: formatJH(project.jh_planned), mono: true },
                  { label: "JH consommés", value: formatJH(project.jh_consumed), mono: true },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded p-3 border border-gray-100">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{item.label}</div>
                    <div className={`font-mono-data text-sm font-bold ${item.alert ? "text-rose-600" : "text-[#0F172A]"}`}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks — Décomposition du projet */}
          <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="tasks-section">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                  Décomposition du Projet ({tasks.length} tâches / features)
                </div>
                {tasks.length > 0 && (
                  <div className="flex items-center gap-4 mt-1 text-[10px] text-slate-400">
                    <span>
                      Couverture budget : <span className="font-semibold text-slate-600">
                        {project.budget_total ? Math.round((taskTotals.budget_planned_k * 1000 / project.budget_total) * 100) : 0}%
                      </span> du budget projet
                    </span>
                    <span>
                      Couverture JH : <span className="font-semibold text-slate-600">
                        {project.jh_planned ? Math.round((taskTotals.jh_planned / project.jh_planned) * 100) : 0}%
                      </span> des JH projet
                    </span>
                  </div>
                )}
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-400 text-center">
                Aucune tâche/feature définie pour ce projet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="tasks-table">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-left">
                      <th className="px-3 py-2.5 font-semibold text-slate-600 min-w-[200px]">Nom</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Type</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Statut</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Début prévu</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Fin prévue</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Fin réelle</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Budget prévu (K€)</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Budget cons. (K€)</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">JH prévus</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">JH cons.</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => {
                      const dateOverrun = t.date_end_actual && t.date_end_planned &&
                        t.date_end_actual > t.date_end_planned;
                      const dateAtRisk = !t.date_end_actual && t.date_end_planned &&
                        t.status === "delayed";
                      const budgetOverrun = t.budget_consumed_k > t.budget_planned_k;
                      const jhOverrun = t.jh_consumed > t.jh_planned;

                      return (
                        <tr
                          key={t.task_id}
                          className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
                            t.status === "cancelled" ? "opacity-50" : ""
                          }`}
                          data-testid={`task-row-${t.task_id}`}
                        >
                          {/* Nom */}
                          <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[220px]">
                            <span className="line-clamp-2 leading-snug">{t.name}</span>
                          </td>

                          {/* Type */}
                          <td className="px-3 py-2.5">
                            <TaskTypeBadge type={t.type} />
                          </td>

                          {/* Statut */}
                          <td className="px-3 py-2.5">
                            <TaskStatusBadge status={t.status} />
                          </td>

                          {/* Début prévu */}
                          <td className="px-3 py-2.5 font-mono-data text-slate-500">
                            {formatDate(t.date_start_planned)}
                          </td>

                          {/* Fin prévue */}
                          <td className="px-3 py-2.5 font-mono-data">
                            <span className={dateAtRisk ? "text-rose-600 font-semibold" : "text-slate-500"}>
                              {formatDate(t.date_end_planned)}
                            </span>
                          </td>

                          {/* Fin réelle */}
                          <td className="px-3 py-2.5 font-mono-data">
                            {t.date_end_actual ? (
                              <span className={dateOverrun ? "text-rose-600 font-semibold" : "text-emerald-600"}>
                                {formatDate(t.date_end_actual)}
                                {dateOverrun && (
                                  <span className="ml-1 text-[9px] text-rose-500 font-bold">+RETARD</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Budget prévu K€ */}
                          <td className="px-3 py-2.5 text-right font-mono-data text-slate-600 font-medium">
                            {t.budget_planned_k > 0 ? `${t.budget_planned_k} K€` : <span className="text-slate-300">—</span>}
                          </td>

                          {/* Budget consommé K€ */}
                          <td className="px-3 py-2.5 text-right font-mono-data font-bold">
                            {t.budget_consumed_k > 0 ? (
                              <span className={budgetOverrun ? "text-rose-600" : "text-slate-700"}>
                                {t.budget_consumed_k} K€
                                {budgetOverrun && (
                                  <span className="ml-1 text-[9px] text-rose-500">({Math.round((t.budget_consumed_k / t.budget_planned_k - 1) * 100)}%)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* JH prévus */}
                          <td className="px-3 py-2.5 text-right font-mono-data text-slate-600">
                            {t.jh_planned > 0 ? t.jh_planned : <span className="text-slate-300">—</span>}
                          </td>

                          {/* JH consommés */}
                          <td className="px-3 py-2.5 text-right font-mono-data font-bold">
                            {t.jh_consumed > 0 ? (
                              <span className={jhOverrun ? "text-rose-600" : "text-slate-700"}>
                                {t.jh_consumed}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Responsable */}
                          <td className="px-3 py-2.5">
                            <span className="text-slate-600 font-medium">{getResourceName(t.resource_id)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Totals row */}
                  <tfoot>
                    <tr className="bg-[#0F172A] text-white" data-testid="tasks-totals-row">
                      <td className="px-3 py-3 font-bold text-sm" colSpan={6}>
                        TOTAUX DÉCOMPOSITION ({tasks.length} éléments)
                      </td>
                      <td className="px-3 py-3 text-right font-mono-data font-bold text-sm">
                        {taskTotals.budget_planned_k.toLocaleString("fr-FR")} K€
                        <div className="text-[9px] text-slate-400 font-normal">
                          ≈ {formatEuro(taskTotals.budget_planned_k * 1000)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono-data font-bold text-sm">
                        <span className={taskTotals.budget_consumed_k > taskTotals.budget_planned_k ? "text-rose-400" : "text-white"}>
                          {taskTotals.budget_consumed_k.toLocaleString("fr-FR")} K€
                        </span>
                        <div className="text-[9px] text-slate-400 font-normal">
                          {taskTotals.budget_planned_k ? Math.round((taskTotals.budget_consumed_k / taskTotals.budget_planned_k) * 100) : 0}% du prévu
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono-data font-bold text-sm">
                        {taskTotals.jh_planned.toLocaleString("fr-FR")} JH
                      </td>
                      <td className="px-3 py-3 text-right font-mono-data font-bold text-sm">
                        <span className={taskTotals.jh_consumed > taskTotals.jh_planned ? "text-rose-400" : "text-white"}>
                          {taskTotals.jh_consumed.toLocaleString("fr-FR")} JH
                        </span>
                        <div className="text-[9px] text-slate-400 font-normal">
                          {taskTotals.jh_planned ? Math.round((taskTotals.jh_consumed / taskTotals.jh_planned) * 100) : 0}% du prévu
                        </div>
                      </td>
                      <td className="px-3 py-3"></td>
                    </tr>

                    {/* Coherence check vs project-level */}
                    <tr className="bg-slate-50 border-t-2 border-[#0052CC]" data-testid="tasks-coherence-row">
                      <td className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wide" colSpan={6}>
                        DONNÉES PROJET (référentiel)
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-data text-xs text-slate-600 font-bold">
                        {(project.budget_total / 1000).toLocaleString("fr-FR")} K€
                        {Math.abs(taskTotals.budget_planned_k - project.budget_total / 1000) > project.budget_total / 1000 * 0.05 && (
                          <div className="text-[9px] text-amber-500">
                            Écart : {Math.round(((taskTotals.budget_planned_k * 1000 / project.budget_total) - 1) * 100)}%
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-data text-xs text-slate-600 font-bold">
                        {(project.budget_consumed / 1000).toLocaleString("fr-FR")} K€
                        {Math.abs(taskTotals.budget_consumed_k - project.budget_consumed / 1000) > project.budget_consumed / 1000 * 0.1 && (
                          <div className="text-[9px] text-amber-500">
                            Écart : {(taskTotals.budget_consumed_k - project.budget_consumed / 1000).toFixed(0)} K€
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-data text-xs text-slate-600 font-bold">
                        {project.jh_planned.toLocaleString("fr-FR")} JH
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-data text-xs text-slate-600 font-bold">
                        {project.jh_consumed.toLocaleString("fr-FR")} JH
                      </td>
                      <td className="px-3 py-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Milestones */}
          <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="milestones-section">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                Jalons ({milestones.length})
              </div>
            </div>
            {milestones.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-400 text-center">Aucun jalon défini</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    {["Jalon", "Date baseline", "Date forecast", "Date réelle", "Statut", "Gouvernance"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((m) => (
                    <tr key={m.milestone_id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors" data-testid={`milestone-row-${m.milestone_id}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{m.name}</td>
                      <td className="px-4 py-2.5 text-xs font-mono-data text-slate-600">{formatDate(m.date_baseline)}</td>
                      <td className="px-4 py-2.5 text-xs font-mono-data">
                        <span className={m.date_forecast > m.date_baseline ? "text-rose-600 font-semibold" : "text-slate-600"}>
                          {formatDate(m.date_forecast)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono-data text-slate-500">
                        {m.date_actual ? formatDate(m.date_actual) : "—"}
                      </td>
                      <td className="px-4 py-2.5"><MilestoneBadge status={m.status} /></td>
                      <td className="px-4 py-2.5">
                        {m.is_governance && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#0052CC] font-semibold">
                            <Flag size={10} />GOV
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Allocations */}
          {allocations.length > 0 && (
            <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="allocations-section">
              <div className="px-5 py-3 border-b border-gray-100">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                  Allocations ({allocations.length})
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    {["Ressource", "Période", "JH alloués", "JH consommés", "Taux"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((a) => (
                    <tr key={a.allocation_id} className="border-b border-gray-100 hover:bg-gray-50/50" data-testid={`allocation-row-${a.allocation_id}`}>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{a.resource_id.slice(-6)}</td>
                      <td className="px-4 py-2.5 font-mono-data text-xs text-slate-600">
                        {new Date(a.period_month).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-2.5 font-mono-data text-xs text-slate-700">{a.jh_allocated} JH</td>
                      <td className="px-4 py-2.5 font-mono-data text-xs text-slate-700">{a.jh_consumed} JH</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#0052CC] rounded-full"
                              style={{ width: `${Math.min(a.allocation_rate, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono-data text-xs text-slate-600">{a.allocation_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column — project info */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4">
              Informations projet
            </div>
            <dl className="space-y-3 text-sm">
              {[
                { label: "Sponsor", value: project.metadata?.sponsor || "—" },
                { label: "Programme", value: project.metadata?.program || "—" },
                { label: "Outil source", value: project.source_tool || "—" },
                { label: "Date début", value: formatDate(project.start_date) },
                { label: "Fin baseline", value: formatDate(project.end_date_baseline) },
                { label: "Fin forecast", value: formatDate(project.end_date_forecast) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2 border-b border-gray-50 pb-2 last:border-0">
                  <dt className="text-xs text-slate-400 font-medium">{label}</dt>
                  <dd className="text-xs text-slate-700 font-medium text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Milestone summary */}
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
              Résumé jalons
            </div>
            {["achieved", "planned", "at_risk", "delayed"].map((s) => {
              const count = milestones.filter((m) => m.status === s).length;
              const labels = { achieved: "Atteint", planned: "Prévu", at_risk: "À risque", delayed: "En retard" };
              const colors = { achieved: "text-emerald-600", planned: "text-slate-600", at_risk: "text-amber-600", delayed: "text-rose-600" };
              return (
                <div key={s} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className={`text-xs font-medium ${colors[s]}`}>{labels[s]}</span>
                  <span className="font-mono-data text-sm font-bold text-slate-800">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
