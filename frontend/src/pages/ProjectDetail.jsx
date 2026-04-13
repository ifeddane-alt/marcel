import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, ChevronRight, Flag, AlertTriangle, Clock, TrendingUp,
  Pencil, Trash2, Plus, History,
} from "lucide-react";
import { projectsAPI, milestonesAPI, allocationsAPI, tasksAPI, resourcesAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import RAGBadge, { MethodologyBadge, MilestoneBadge, TaskTypeBadge, TaskStatusBadge, ProjectStatusBadge } from "@/components/RAGBadge";
import ProjectModal from "@/components/ProjectModal";
import TaskModal from "@/components/TaskModal";
import BudgetRevisionModal from "@/components/BudgetRevisionModal";
import ConfirmDialog from "@/components/ConfirmDialog";
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role === "TENANT_ADMIN" || user?.role === "PMO_USER";
  const isAdmin = user?.role === "TENANT_ADMIN";

  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [budgetRevisionOpen, setBudgetRevisionOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // {type: 'project'|'task', item}
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(() => {
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

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.type === "project") {
        await projectsAPI.delete(confirmDelete.item.project_id);
        navigate("/portfolio");
      } else if (confirmDelete.type === "task") {
        await tasksAPI.delete(confirmDelete.item.task_id);
        setConfirmDelete(null);
        fetchAll();
      }
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

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
      budget_landing: acc.budget_landing + (t.budget_landing || 0),
      jh_landing: acc.jh_landing + (t.jh_landing || 0),
    }),
    { jh_planned: 0, jh_consumed: 0, budget_planned_k: 0, budget_consumed_k: 0, budget_landing: 0, jh_landing: 0 }
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
          {project.description && (
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">{project.description}</p>
          )}
          {project.source_tool && (
            <p className="text-xs text-slate-400 mt-1">
              Source : {project.source_tool} · Sync : {formatDate(project.last_sync_at)}
            </p>
          )}
        </div>
        {canWrite && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setEditModalOpen(true)}
              data-testid="btn-edit-project"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded text-sm text-slate-600 hover:bg-gray-50 hover:text-[#0052CC] transition-colors"
            >
              <Pencil size={13} /> Modifier
            </button>
            {isAdmin && (
              <button
                onClick={() => setConfirmDelete({ type: "project", item: project })}
                data-testid="btn-delete-project"
                className="flex items-center gap-1.5 px-3 py-2 border border-rose-200 rounded text-sm text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 size={13} /> Supprimer
              </button>
            )}
          </div>
        )}
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
          {/* Budget CAPEX / OPEX + EAC */}
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5" data-testid="budget-section">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                Budget CAPEX / OPEX & EAC
              </div>
              {canWrite && (
                <button
                  onClick={() => setBudgetRevisionOpen(true)}
                  data-testid="btn-budget-revision"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] transition-colors"
                >
                  <TrendingUp size={12} /> Réviser l'EAC
                </button>
              )}
            </div>

            {/* 4 cards CAPEX + OPEX */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* CAPEX */}
              <div className="border border-blue-100 rounded-lg p-4 bg-blue-50/30">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#0052CC] mb-3">CAPEX</div>
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Prévu</span>
                    <span className="font-mono-data text-sm font-bold text-slate-800" data-testid="capex-planned">
                      {Math.round((project.capex_planned || 0) / 1000).toLocaleString("fr-FR")} K€
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Consommé</span>
                    <span className="font-mono-data text-sm font-bold text-[#0052CC]" data-testid="capex-consumed">
                      {Math.round((project.capex_consumed || 0) / 1000).toLocaleString("fr-FR")} K€
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0052CC] rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(((project.capex_consumed || 0) / (project.capex_planned || 1)) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-1 text-right">
                  {project.capex_planned ? Math.round((project.capex_consumed || 0) / project.capex_planned * 100) : 0}% consommé
                </div>
              </div>

              {/* OPEX */}
              <div className="border border-amber-100 rounded-lg p-4 bg-amber-50/30">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-3">OPEX</div>
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Prévu</span>
                    <span className="font-mono-data text-sm font-bold text-slate-800" data-testid="opex-planned">
                      {Math.round((project.opex_planned || 0) / 1000).toLocaleString("fr-FR")} K€
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Consommé</span>
                    <span className="font-mono-data text-sm font-bold text-amber-600" data-testid="opex-consumed">
                      {Math.round((project.opex_consumed || 0) / 1000).toLocaleString("fr-FR")} K€
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(((project.opex_consumed || 0) / (project.opex_planned || 1)) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 mt-1 text-right">
                  {project.opex_planned ? Math.round((project.opex_consumed || 0) / project.opex_planned * 100) : 0}% consommé
                </div>
              </div>
            </div>

            {/* EAC Block */}
            {(() => {
              const eac = project.eac || project.budget_forecast || 0;
              const budgetTotal = project.budget_total || 0;
              const diff = eac - budgetTotal;
              const diffPct = budgetTotal ? (diff / budgetTotal) * 100 : 0;
              const isOver = diff > 0;
              return (
                <div
                  className={`rounded-lg border p-4 mb-4 ${isOver ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"}`}
                  data-testid="eac-block"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                        EAC — Estimate At Completion
                      </div>
                      <div className={`font-mono-data text-2xl font-bold leading-none ${isOver ? "text-rose-700" : "text-emerald-700"}`} data-testid="eac-value">
                        {Math.round(eac / 1000).toLocaleString("fr-FR")} K€
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 mb-0.5">Écart vs budget</div>
                      <div className={`font-mono-data text-sm font-bold ${isOver ? "text-rose-600" : "text-emerald-600"}`} data-testid="eac-deviation">
                        {diff > 0 ? "+" : ""}{Math.round(diff / 1000).toLocaleString("fr-FR")} K€
                      </div>
                      <div className={`text-[11px] font-semibold ${isOver ? "text-rose-500" : "text-emerald-500"}`}>
                        {diff > 0 ? "+" : ""}{diffPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 border-t border-current border-opacity-20 pt-2">
                    <span>Budget total : <span className="font-mono-data font-bold text-slate-700">{Math.round(budgetTotal / 1000).toLocaleString("fr-FR")} K€</span></span>
                    <span>Consommé total : <span className="font-mono-data font-bold text-slate-700">{Math.round((project.budget_consumed || 0) / 1000).toLocaleString("fr-FR")} K€</span></span>
                    <span>JH : <span className="font-mono-data font-bold text-slate-700">{(project.jh_consumed || 0).toLocaleString("fr-FR")}/{(project.jh_planned || 0).toLocaleString("fr-FR")}</span></span>
                  </div>
                </div>
              );
            })()}

            {/* Historique révisions */}
            {(project.budget_revision_history || []).length > 0 && (
              <div data-testid="budget-revision-history">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
                  <History size={11} /> Historique révisions ({project.budget_revision_history.length})
                </div>
                <div className="space-y-0 border border-gray-100 rounded-lg overflow-hidden">
                  {[...project.budget_revision_history].reverse().map((rev, i) => {
                    const isIncrease = rev.new_eac > rev.old_eac;
                    return (
                      <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${isIncrease ? "bg-rose-400" : "bg-emerald-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-0.5">
                            <span className="font-mono-data text-[11px] text-slate-400 flex-shrink-0">{rev.date}</span>
                            <span className="flex items-center gap-1.5 text-xs font-mono-data">
                              <span className="text-slate-500">{Math.round((rev.old_eac || 0) / 1000).toLocaleString("fr-FR")} K€</span>
                              <span className="text-slate-300">→</span>
                              <span className={`font-bold ${isIncrease ? "text-rose-600" : "text-emerald-600"}`}>
                                {Math.round((rev.new_eac || 0) / 1000).toLocaleString("fr-FR")} K€
                              </span>
                              <span className={`text-[10px] font-semibold ${isIncrease ? "text-rose-400" : "text-emerald-400"}`}>
                                ({isIncrease ? "+" : ""}{Math.round(((rev.new_eac - rev.old_eac) / (rev.old_eac || 1)) * 100)}%)
                              </span>
                            </span>
                            {rev.author && (
                              <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{rev.author}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{rev.reason}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Tasks — Décomposition du projet */}
          <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="tasks-section">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                  Décomposition du Projet ({tasks.length} tâches / features)
                </div>
                {/* Mini-RAG summary + coverage */}
                {tasks.length > 0 && (() => {
                  const ragCounts = tasks.reduce(
                    (a, t) => { a[t.task_rag || "green"] = (a[t.task_rag || "green"] || 0) + 1; return a; },
                    {}
                  );
                  const tenantSettings = { budget_threshold_pct: 115, delay_threshold_days: 5 };
                  return (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {/* RAG pill summary */}
                      <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-2.5 py-1" data-testid="tasks-rag-summary">
                        {[
                          { key: "green", label: "vertes", color: "bg-emerald-500", textColor: "text-emerald-700" },
                          { key: "orange", label: "orange", color: "bg-amber-500", textColor: "text-amber-700" },
                          { key: "red", label: "rouges", color: "bg-rose-500", textColor: "text-rose-700" },
                        ].map(({ key, label, color, textColor }) => (
                          <span key={key} className="flex items-center gap-1 text-[11px] font-semibold">
                            <span className={`w-2 h-2 rounded-full ${color}`} />
                            <span className={textColor}>{ragCounts[key] || 0}</span>
                            <span className="text-slate-400 font-normal">{label}</span>
                            {key !== "red" && <span className="text-slate-200 mx-1">|</span>}
                          </span>
                        ))}
                      </div>
                      {/* Coverage */}
                      <span className="text-[10px] text-slate-400">
                        Couverture : <span className="font-semibold text-slate-600">
                          {project.budget_total ? Math.round((taskTotals.budget_planned_k * 1000 / project.budget_total) * 100) : 0}%
                        </span> budget·
                        <span className="font-semibold text-slate-600 ml-1">
                          {project.jh_planned ? Math.round((taskTotals.jh_planned / project.jh_planned) * 100) : 0}%
                        </span> JH
                      </span>
                      {/* Thresholds reminder */}
                      <span className="text-[9px] text-slate-300 hidden sm:block">
                        Seuils : &gt;115% budget ou &gt;5j retard → Rouge
                      </span>
                    </div>
                  );
                })()}
              </div>
              {canWrite && (
                <button
                  onClick={() => { setSelectedTask(null); setTaskModalOpen(true); }}
                  data-testid="btn-new-task"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] transition-colors flex-shrink-0"
                >
                  <Plus size={13} /> Nouvelle tâche
                </button>
              )}
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
                      <th className="px-3 py-2.5 font-semibold text-slate-600 text-center w-12">RAG</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600 min-w-[180px]">Nom</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Type</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Statut</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Fin prévue</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Fin réelle</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Budget prévu</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Budget landing</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">JH prévus</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">JH landing</th>
                      <th className="px-3 py-2.5 font-semibold text-slate-600">Responsable</th>
                      {canWrite && <th className="px-3 py-2.5 w-16"></th>}
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
                      const taskRag = t.task_rag || "green";
                      const ragDetail = t.rag_details || {};
                      const ragColors = {
                        green: "bg-emerald-500",
                        orange: "bg-amber-500",
                        red: "bg-rose-500",
                      };
                      const budgetLandingOverrun = (t.budget_landing || 0) > t.budget_planned_k;
                      const jhLandingOverrun = (t.jh_landing || 0) > t.jh_planned;

                      return (
                        <tr
                          key={t.task_id}
                          className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${
                            t.status === "cancelled" ? "opacity-50" : ""
                          }`}
                          data-testid={`task-row-${t.task_id}`}
                        >
                          {/* RAG badge — first column */}
                          <td className="px-3 py-2.5 text-center">
                            <div
                              className="inline-flex flex-col items-center gap-0.5 group relative cursor-default"
                              title={`Budget landing: ${t.budget_landing}K€ (${ragDetail.budget_ratio}%) · Retard: ${ragDetail.delay_days}j · JH: ${ragDetail.jh_ratio}%`}
                              data-testid={`task-rag-${t.task_id}`}
                            >
                              <span className={`w-3 h-3 rounded-full ${ragColors[taskRag]} ring-2 ring-offset-1 ring-${taskRag === 'green' ? 'emerald' : taskRag === 'orange' ? 'amber' : 'rose'}-200`} />
                              <span className={`text-[9px] font-bold uppercase ${
                                taskRag === 'green' ? 'text-emerald-600' :
                                taskRag === 'orange' ? 'text-amber-600' : 'text-rose-600'
                              }`}>
                                {taskRag === 'green' ? '✓' : taskRag === 'orange' ? '!' : '!!'}
                              </span>
                            </div>
                          </td>

                          {/* Nom */}
                          <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[200px]">
                            <span className="line-clamp-2 leading-snug">{t.name}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <TaskTypeBadge type={t.type} />
                          </td>

                          {/* Statut */}
                          <td className="px-3 py-2.5">
                            <TaskStatusBadge status={t.status} />
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
                          <td className="px-3 py-2.5 text-right font-mono-data text-slate-500">
                            {t.budget_planned_k > 0 ? `${t.budget_planned_k} K€` : <span className="text-slate-300">—</span>}
                          </td>

                          {/* Budget landing — clé de la colonne RAG */}
                          <td className="px-3 py-2.5 text-right font-mono-data">
                            {t.budget_landing != null ? (
                              <div>
                                <span className={`font-bold ${budgetLandingOverrun ? (taskRag === 'red' ? 'text-rose-600' : 'text-amber-600') : 'text-emerald-600'}`}>
                                  {t.budget_landing} K€
                                </span>
                                {budgetLandingOverrun && (
                                  <div className="text-[9px] text-rose-400 font-semibold">
                                    +{(t.budget_landing - t.budget_planned_k).toFixed(0)} K€ ({(((t.budget_landing / t.budget_planned_k) - 1) * 100).toFixed(0)}%)
                                  </div>
                                )}
                                <div className="text-[9px] text-slate-400">
                                  cons. {t.budget_consumed_k} K€
                                </div>
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>

                          {/* JH prévus */}
                          <td className="px-3 py-2.5 text-right font-mono-data text-slate-500">
                            {t.jh_planned > 0 ? `${t.jh_planned} JH` : <span className="text-slate-300">—</span>}
                          </td>

                          {/* JH landing */}
                          <td className="px-3 py-2.5 text-right font-mono-data">
                            {t.jh_landing != null ? (
                              <div>
                                <span className={`font-bold ${jhLandingOverrun ? (taskRag === 'red' ? 'text-rose-600' : 'text-amber-600') : 'text-emerald-600'}`}>
                                  {t.jh_landing} JH
                                </span>
                                {jhLandingOverrun && (
                                  <div className="text-[9px] text-rose-400 font-semibold">
                                    +{(t.jh_landing - t.jh_planned).toFixed(0)} JH
                                  </div>
                                )}
                                <div className="text-[9px] text-slate-400">
                                  cons. {t.jh_consumed}
                                </div>
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>

                          {/* Responsable */}
                          <td className="px-3 py-2.5">
                            <span className="text-slate-600 font-medium">{getResourceName(t.resource_id)}</span>
                          </td>

                          {/* Actions */}
                          {canWrite && (
                            <td className="px-2 py-2.5">
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => { setSelectedTask(t); setTaskModalOpen(true); }}
                                  data-testid={`btn-edit-task-${t.task_id}`}
                                  className="p-1 text-slate-400 hover:text-[#0052CC] hover:bg-blue-50 rounded transition-colors"
                                  title="Modifier"
                                >
                                  <Pencil size={12} />
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => setConfirmDelete({ type: "task", item: t })}
                                    data-testid={`btn-delete-task-${t.task_id}`}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Totals row */}
                  <tfoot>
                    <tr className="bg-[#0F172A] text-white" data-testid="tasks-totals-row">
                      <td className="px-3 py-3 font-bold text-sm" colSpan={canWrite ? 7 : 6}>
                        TOTAUX DÉCOMPOSITION ({tasks.length} éléments)
                      </td>
                      <td className="px-3 py-3 text-right font-mono-data font-bold text-sm">
                        {taskTotals.budget_planned_k.toLocaleString("fr-FR")} K€
                        <div className="text-[9px] text-slate-400 font-normal">
                          ≈ {formatEuro(taskTotals.budget_planned_k * 1000)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono-data font-bold text-sm">
                        <span className={taskTotals.budget_landing > taskTotals.budget_planned_k ? "text-rose-400" : "text-emerald-400"}>
                          {taskTotals.budget_landing.toLocaleString("fr-FR")} K€
                        </span>
                        <div className="text-[9px] text-slate-400 font-normal">
                          {taskTotals.budget_planned_k ? Math.round((taskTotals.budget_landing / taskTotals.budget_planned_k) * 100) : 0}% du prévu
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono-data font-bold text-sm">
                        {taskTotals.jh_planned.toLocaleString("fr-FR")} JH
                      </td>
                      <td className="px-3 py-3 text-right font-mono-data font-bold text-sm">
                        <span className={taskTotals.jh_landing > taskTotals.jh_planned ? "text-rose-400" : "text-emerald-400"}>
                          {taskTotals.jh_landing.toLocaleString("fr-FR")} JH
                        </span>
                        <div className="text-[9px] text-slate-400 font-normal">
                          {taskTotals.jh_planned ? Math.round((taskTotals.jh_landing / taskTotals.jh_planned) * 100) : 0}% du prévu
                        </div>
                      </td>
                      <td className="px-3 py-3"></td>
                    </tr>

                    {/* Coherence check vs project-level */}
                    <tr className="bg-slate-50 border-t-2 border-[#0052CC]" data-testid="tasks-coherence-row">
                      <td className="px-3 py-2.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wide" colSpan={canWrite ? 7 : 6}>
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
                        {(project.budget_forecast / 1000).toLocaleString("fr-FR")} K€
                        {Math.abs(taskTotals.budget_landing - project.budget_forecast / 1000) > project.budget_forecast / 1000 * 0.1 && (
                          <div className="text-[9px] text-amber-500">
                            Écart : {(taskTotals.budget_landing - project.budget_forecast / 1000).toFixed(0)} K€
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
              <div className="flex justify-between gap-2 border-b border-gray-50 pb-2">
                <dt className="text-xs text-slate-400 font-medium">Statut</dt>
                <dd><ProjectStatusBadge status={project.status} /></dd>
              </div>
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
              {project.end_date_actual && (
                <div className="flex justify-between gap-2 pt-1">
                  <dt className="text-xs text-slate-400 font-medium">Fin réelle</dt>
                  <dd className="text-xs font-mono-data font-bold text-emerald-700">{formatDate(project.end_date_actual)}</dd>
                </div>
              )}
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

      {/* Modals */}
      <ProjectModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={project}
        resources={resources}
        programs={[]}
        onSaved={fetchAll}
      />
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={selectedTask}
        projectId={id}
        resources={resources}
        onSaved={fetchAll}
      />
      <BudgetRevisionModal
        isOpen={budgetRevisionOpen}
        onClose={() => setBudgetRevisionOpen(false)}
        project={project}
        onSaved={fetchAll}
      />
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={confirmDelete?.type === "project" ? "Supprimer le projet" : "Supprimer la tâche"}
        message={
          confirmDelete?.type === "project"
            ? `Supprimer "${confirmDelete?.item?.name}" ? Toutes les tâches et jalons associés seront également supprimés.`
            : `Supprimer la tâche "${confirmDelete?.item?.name}" ?`
        }
      />
    </div>
  );
}
