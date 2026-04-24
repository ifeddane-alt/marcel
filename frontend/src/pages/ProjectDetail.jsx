import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, ChevronRight, Flag, AlertTriangle, Clock, TrendingUp,
  Pencil, Trash2, Plus, History, ShieldAlert, ClipboardList, Presentation, Users,
  GitBranch, BarChart2, Diamond, GitFork, Lock, Send, CheckCircle,
} from "lucide-react";
import { projectsAPI, milestonesAPI, allocationsAPI, tasksAPI, resourcesAPI, risksAPI, decisionsAPI, workAllocationsAPI, projectDependenciesAPI, vendorsAPI, scopeAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import RAGBadge, { MethodologyBadge, MilestoneBadge, TaskTypeBadge, TaskStatusBadge, ProjectStatusBadge } from "@/components/RAGBadge";
import ProjectModal from "@/components/ProjectModal";
import TaskModal from "@/components/TaskModal";
import TaskTreeView from "@/components/TaskTreeView";
import BudgetRevisionModal from "@/components/BudgetRevisionModal";
import RiskModal from "@/components/RiskModal";
import DecisionModal from "@/components/DecisionModal";
import MilestoneModal, { FAMILY_CONFIG } from "@/components/MilestoneModal";
import DependencyModal from "@/components/DependencyModal";
import RiskHeatmap from "@/components/RiskHeatmap";
import ConfirmDialog from "@/components/ConfirmDialog";
import ExportCopilModal from "@/components/ExportCopilModal";
import WorkAllocationModal from "@/components/WorkAllocationModal";
import ProjectGantt from "@/components/ProjectGantt";
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
  const { hasPermission } = usePermissions();
  const canEdit      = hasPermission("projects.edit");
  const canDelete    = hasPermission("projects.delete");
  const canCreateMS  = hasPermission("milestones.create");
  const canCreateRisk= hasPermission("risks.create");
  const canCreateTask= hasPermission("tasks.create");
  const canCreateDec = hasPermission("decisions.create");
  // Pour rétrocompat avec canWrite utilisé dans plusieurs endroits
  const canWrite = canEdit;

  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [risks, setRisks] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [resources, setResources] = useState([]);
  const [workAllocations, setWorkAllocations] = useState([]);
  const [teamConsumption, setTeamConsumption] = useState([]);
  const [raf, setRaf] = useState(null);
  const [externalCosts, setExternalCosts] = useState(null);
  const [scopeSnapshots, setScopeSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskView, setTaskView] = useState("table"); // "table" | "gantt" | "tree"

  // Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [budgetRevisionOpen, setBudgetRevisionOpen] = useState(false);
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [selectedWa, setSelectedWa] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRisk, setSelectedRisk] = useState(null);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // {type: 'project'|'task'|'risk'|'decision', item}
  const [deleting, setDeleting] = useState(false);

  // Milestone CRUD state
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);

  // Dependency state
  const [dependencies, setDependencies] = useState([]);
  const [depModalOpen, setDepModalOpen] = useState(false);
  const [selectedDep, setSelectedDep] = useState(null);
  const [allProjects, setAllProjects] = useState([]);

  const fetchAll = useCallback(() => {
    Promise.all([
      projectsAPI.get(id),
      milestonesAPI.list(id),
      allocationsAPI.list(id),
      tasksAPI.list(id),
      resourcesAPI.list(),
      risksAPI.list(id),
      decisionsAPI.list(id),
      workAllocationsAPI.list(id),
      workAllocationsAPI.teamConsumption(id),
      workAllocationsAPI.raf(id),
      projectDependenciesAPI.list(id),
      projectsAPI.list(),
    ]).then(([pRes, mRes, aRes, tRes, rRes, rkRes, dRes, waRes, tcRes, rafRes, depRes, allPRes]) => {
      setProject(pRes.data);
      setMilestones(mRes.data);
      setAllocations(aRes.data);
      setTasks(tRes.data);
      setResources(rRes.data);
      setRisks(rkRes.data);
      setDecisions(dRes.data);
      setWorkAllocations(waRes.data);
      setTeamConsumption(tcRes.data);
      setRaf(rafRes.data);
      setDependencies(depRes.data);
      setAllProjects(allPRes.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
    // Coûts externes (vendeurs) — non-bloquant
    vendorsAPI.projectCosts(id).then((r) => setExternalCosts(r.data)).catch(() => {});
    // Scope transmis — non-bloquant
    scopeAPI.listSnapshots({ project_id: id }).then((r) => {
      setScopeSnapshots((r.data || []).filter((s) => s.status === "transmitted" || s.status === "frozen"));
    }).catch(() => {});
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
      } else if (confirmDelete.type === "risk") {
        await risksAPI.delete(confirmDelete.item.risk_id);
        setConfirmDelete(null);
        fetchAll();
      } else if (confirmDelete.type === "decision") {
        await decisionsAPI.delete(confirmDelete.item.decision_id);
        setConfirmDelete(null);
        fetchAll();
      } else if (confirmDelete.type === "work_allocation") {
        await workAllocationsAPI.delete(confirmDelete.item.work_allocation_id);
        setConfirmDelete(null);
        fetchAll();
      } else if (confirmDelete.type === "milestone") {
        await milestonesAPI.delete(confirmDelete.item.milestone_id);
        setConfirmDelete(null);
        fetchAll();
      } else if (confirmDelete.type === "dependency") {
        await projectDependenciesAPI.delete(confirmDelete.item.dependency_id);
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setExportModalOpen(true)}
            data-testid="btn-export-copil-project"
            className="flex items-center gap-1.5 px-3 py-2 border border-[#0052CC] text-[#0052CC] text-sm font-semibold rounded hover:bg-[#EBF2FF] transition-colors"
          >
            <Presentation size={13} /> Export COPIL
          </button>
          {canWrite && (
            <>
              <button
                onClick={() => setEditModalOpen(true)}
                data-testid="btn-edit-project"
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded text-sm text-slate-600 hover:bg-gray-50 hover:text-[#0052CC] transition-colors"
              >
                <Pencil size={13} /> Modifier
              </button>
              {canDelete && (
                <button
                  onClick={() => setConfirmDelete({ type: "project", item: project })}
                  data-testid="btn-delete-project"
                  className="flex items-center gap-1.5 px-3 py-2 border border-rose-200 rounded text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 size={13} /> Supprimer
                </button>
              )}
            </>
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

          {/* Coûts Externes (Régie + Forfait) */}
          {externalCosts && externalCosts.resources && externalCosts.resources.length > 0 && (
            <div className="bg-white border border-gray-200 rounded shadow-sm p-5" data-testid="external-costs-section">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4 flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#0052CC]">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Coûts Externes Alloués
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="border border-orange-100 rounded-lg p-3 bg-orange-50/30">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-1">Régie estimé</div>
                  <div className="font-mono-data text-xl font-bold text-orange-700" data-testid="ext-regie-cost">
                    {externalCosts.total_regie_eur > 0
                      ? `${Math.round(externalCosts.total_regie_eur / 1000).toLocaleString("fr-FR")} K€`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">JH alloués × TJM contrat</div>
                </div>
                <div className="border border-violet-100 rounded-lg p-3 bg-violet-50/30">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-1">Forfait engagé</div>
                  <div className="font-mono-data text-xl font-bold text-violet-700" data-testid="ext-forfait-cost">
                    {externalCosts.total_forfait_envelope > 0
                      ? `${Math.round(externalCosts.total_forfait_envelope / 1000).toLocaleString("fr-FR")} K€`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {externalCosts.total_forfait_consumed > 0
                      ? `dont ${Math.round(externalCosts.total_forfait_consumed / 1000).toLocaleString("fr-FR")} K€ consommés`
                      : "Enveloppe contractuelle"}
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Total externe</div>
                  <div className="font-mono-data text-xl font-bold text-slate-800" data-testid="ext-total-cost">
                    {Math.round(externalCosts.total_external / 1000).toLocaleString("fr-FR")} K€
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {project.budget_total
                      ? `${Math.round(externalCosts.total_external / project.budget_total * 100)}% du budget total`
                      : ""}
                  </div>
                </div>
              </div>
              {/* Détail ressources */}
              <div className="space-y-1.5">
                {externalCosts.resources.map((r) => (
                  <div key={r.resource_id} className="flex items-center justify-between text-xs py-1.5 px-3 bg-gray-50 rounded border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        r.type === "regie"
                          ? "bg-orange-50 text-orange-700 border-orange-200"
                          : "bg-violet-50 text-violet-700 border-violet-200"
                      }`}>
                        {r.type === "regie" ? "RÉGIE" : "FORFAIT"}
                      </span>
                      <span className="font-medium text-slate-800">{r.name}</span>
                      {r.vendor && <span className="text-slate-400">· {r.vendor}</span>}
                    </div>
                    <div className="font-mono-data text-sm font-bold text-slate-700">
                      {r.type === "regie"
                        ? `${Math.round((r.cost_estimated || 0) / 1000).toLocaleString("fr-FR")} K€`
                        : `${Math.round((r.forfait_envelope || 0) / 1000).toLocaleString("fr-FR")} K€`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks — Décomposition du projet */}
          <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="tasks-section">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                    Décomposition du Projet ({tasks.length} tâches / features)
                  </div>
                  {/* View toggle */}
                  <div className="flex items-center gap-1 ml-2" data-testid="task-view-toggle">
                    <button
                      onClick={() => setTaskView("table")}
                      data-testid="task-view-table-btn"
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                        taskView === "table"
                          ? "bg-[#0052CC] text-white"
                          : "text-slate-500 border border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <ClipboardList size={11} /> Liste
                    </button>
                    <button
                      onClick={() => setTaskView("gantt")}
                      data-testid="task-view-gantt-btn"
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                        taskView === "gantt"
                          ? "bg-[#0052CC] text-white"
                          : "text-slate-500 border border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <BarChart2 size={11} /> Gantt
                    </button>
                    {tasks.some(t => t.task_level && t.task_level !== "task") && (
                      <button
                        onClick={() => setTaskView("tree")}
                        data-testid="task-view-tree-btn"
                        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                          taskView === "tree"
                            ? "bg-indigo-600 text-white"
                            : "text-indigo-600 border border-indigo-200 hover:bg-indigo-50"
                        }`}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M3 3h18"/><path d="M3 9h12"/><path d="M3 15h6"/><path d="M15 9v6"/><path d="M9 15v6"/>
                        </svg>
                        Arbre SAFe
                      </button>
                    )}
                  </div>
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
            ) : taskView === "gantt" ? (
              <div className="p-5" data-testid="gantt-tab-content">
                <ProjectGantt
                  tasks={tasks}
                  milestones={milestones}
                  onTaskClick={(taskId) => {
                    const t = tasks.find((x) => x.task_id === taskId);
                    if (t && canWrite) { setSelectedTask(t); setTaskModalOpen(true); }
                  }}
                />
              </div>
            ) : taskView === "tree" ? (
              <div className="p-4" data-testid="tree-tab-content">
                <TaskTreeView
                  tasks={tasks}
                  onSelectTask={(t) => { if (canWrite) { setSelectedTask(t); setTaskModalOpen(true); } }}
                />
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="line-clamp-2 leading-snug">{t.name}</span>
                              {t.task_level && t.task_level !== "task" && (
                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded border flex-shrink-0 ${
                                  t.task_level === "feature"
                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                    : "bg-violet-50 text-violet-600 border-violet-200"
                                }`}>
                                  {t.task_level === "feature" ? "FEAT" : "US"}
                                </span>
                              )}
                              {t.lifecycle_phase && t.lifecycle_phase !== "backlog" && (
                                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 flex-shrink-0">
                                  {t.lifecycle_phase.toUpperCase()}
                                </span>
                              )}
                              {t.sprint_id && (() => {
                                return (
                                  <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 flex-shrink-0 flex items-center gap-0.5">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                    Sprint
                                  </span>
                                );
                              })()}
                            </div>
                            {t.dependencies && t.dependencies.length > 0 && (
                              <div className="flex items-center gap-1 mt-0.5" title={`Prérequis : ${t.dependencies.map(depId => tasks.find(x => x.task_id === depId)?.name || depId).join(", ")}`}>
                                <GitBranch size={9} className="text-slate-400 flex-shrink-0" />
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {t.dependencies.length} prérequis
                                </span>
                              </div>
                            )}
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
                                {canDelete && (
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

          {/* Milestones — enrichis 3 familles */}
          <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="milestones-section">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                <Diamond size={13} className="text-yellow-500" />
                Jalons ({milestones.length})
              </div>
              {canCreateMS && (
                <button
                  onClick={() => { setSelectedMilestone(null); setMilestoneModalOpen(true); }}
                  data-testid="btn-new-milestone"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] transition-colors"
                >
                  <Plus size={12} /> Nouveau jalon
                </button>
              )}
            </div>
            {milestones.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-400 text-center">Aucun jalon défini</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {["Famille / Type", "Jalon", "Baseline", "Forecast", "Réelle", "Statut", "Attribut", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((m) => {
                      const fCfg = FAMILY_CONFIG[m.family];
                      const tooltipText = [
                        m.family ? `Famille: ${fCfg?.label || m.family}` : null,
                        m.type ? `Type: ${fCfg?.types?.find(t=>t.value===m.type)?.label || m.type}` : null,
                        m.comment ? `Commentaire: ${m.comment}` : null,
                        m.deliverable ? `Livrable: ${m.deliverable}` : null,
                        m.owner_resource_id ? `Owner: ${resources.find(r=>r.resource_id===m.owner_resource_id)?.name || m.owner_resource_id}` : null,
                        m.is_blocking ? "⚠ Bloquant" : null,
                      ].filter(Boolean).join(" | ");
                      return (
                        <tr key={m.milestone_id} title={tooltipText}
                          className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${m.attribute === "critical" ? "border-l-2 border-l-rose-500" : m.attribute === "strategic" ? "border-l-2 border-l-blue-500" : ""}`}
                          data-testid={`milestone-row-${m.milestone_id}`}>
                          <td className="px-3 py-2.5">
                            {fCfg ? (
                              <div className="flex flex-col gap-0.5">
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${fCfg.color}`}>{fCfg.label}</span>
                                <span className="text-[10px] text-slate-500">{fCfg.types.find(t=>t.value===m.type)?.label || m.type || "—"}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {fCfg && (
                                <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
                                  <polygon points="6,1 11,6 6,11 1,6"
                                    fill={fCfg.fill}
                                    stroke={m.attribute === "critical" ? "#EF4444" : m.attribute === "strategic" ? "#3B82F6" : "none"}
                                    strokeWidth={m.attribute ? "2" : "0"} />
                                </svg>
                              )}
                              <span className="font-medium text-slate-800 text-xs leading-snug">{m.name}</span>
                              {m.is_blocking && <span title="Bloquant" className="text-rose-500 text-[10px] font-bold ml-1">⚑</span>}
                              {m.is_governance && <Flag size={10} className="text-[#0052CC] ml-0.5 shrink-0" />}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono-data text-slate-600 whitespace-nowrap">{formatDate(m.date_baseline)}</td>
                          <td className="px-3 py-2.5 text-xs font-mono-data whitespace-nowrap">
                            <span className={m.date_forecast > m.date_baseline ? "text-rose-600 font-semibold" : "text-slate-600"}>
                              {formatDate(m.date_forecast)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono-data text-slate-500 whitespace-nowrap">
                            {m.date_actual ? formatDate(m.date_actual) : "—"}
                          </td>
                          <td className="px-3 py-2.5"><MilestoneBadge status={m.status} /></td>
                          <td className="px-3 py-2.5">
                            {m.attribute === "critical" && (
                              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase bg-rose-100 text-rose-700 rounded border border-rose-200">Critical</span>
                            )}
                            {m.attribute === "strategic" && (
                              <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase bg-blue-100 text-blue-700 rounded border border-blue-200">Strategic</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {canWrite && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setSelectedMilestone(m); setMilestoneModalOpen(true); }}
                                  data-testid={`btn-edit-milestone-${m.milestone_id}`}
                                  className="p-1 text-slate-400 hover:text-[#0052CC] rounded transition-colors">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => setConfirmDelete({ type: "milestone", item: m })}
                                  data-testid={`btn-delete-milestone-${m.milestone_id}`}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dépendances inter-projets */}
          <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="dependencies-section">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                <GitFork size={13} className="text-violet-500" />
                Dépendances inter-projets ({dependencies.length})
              </div>
              {canWrite && (
                <button
                  onClick={() => { setSelectedDep(null); setDepModalOpen(true); }}
                  data-testid="btn-new-dependency"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] transition-colors"
                >
                  <Plus size={12} /> Nouvelle dépendance
                </button>
              )}
            </div>
            {dependencies.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-400 text-center">Aucune dépendance définie</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-left">
                      {["Direction", "Projet lié", "Nature", "Impact", "Échéance", "Statut", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dependencies.map((dep) => {
                      const IMPACT_COLORS = { low: "bg-emerald-100 text-emerald-700 border-emerald-200", medium: "bg-amber-100 text-amber-700 border-amber-200", high: "bg-orange-100 text-orange-700 border-orange-200", critical: "bg-rose-100 text-rose-700 border-rose-200" };
                      const STATUS_LABELS = { identified: "Identifiée", in_progress: "En cours", resolved: "Résolue", blocked: "Bloquée" };
                      const NATURE_LABELS = { deliverable: "Livrable", resource: "Ressource", technical: "Technique", regulatory: "Réglementaire", budget: "Budget", data: "Données" };
                      const isOutbound = dep.source_project_id === id;
                      const linkedProject = isOutbound ? dep.target_project_name : dep.source_project_name;
                      return (
                        <tr key={dep.dependency_id}
                          className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                          data-testid={`dep-row-${dep.dependency_id}`}
                          title={dep.description}>
                          <td className="px-3 py-2.5">
                            {isOutbound ? (
                              <span className="text-[10px] font-bold text-[#0052CC]">→ Je dépends de</span>
                            ) : (
                              <span className="text-[10px] font-bold text-violet-600">← Dépend de moi</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-800 text-xs">{linkedProject}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{NATURE_LABELS[dep.nature] || dep.nature}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${IMPACT_COLORS[dep.impact] || ""}`}>
                              {dep.impact}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono-data text-slate-600 whitespace-nowrap">
                            {dep.target_date ? formatDate(dep.target_date) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{STATUS_LABELS[dep.status] || dep.status}</td>
                          <td className="px-3 py-2.5">
                            {canWrite && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setSelectedDep(dep); setDepModalOpen(true); }}
                                  data-testid={`btn-edit-dep-${dep.dependency_id}`}
                                  className="p-1 text-slate-400 hover:text-[#0052CC] rounded transition-colors">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => setConfirmDelete({ type: "dependency", item: dep })}
                                  data-testid={`btn-delete-dep-${dep.dependency_id}`}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Registre des risques */}
          <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="risks-section">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                <ShieldAlert size={13} className="text-rose-400" />
                Registre des risques ({risks.length})
              </div>
              {canCreateRisk && (
                <button
                  onClick={() => { setSelectedRisk(null); setRiskModalOpen(true); }}
                  data-testid="btn-new-risk"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] transition-colors"
                >
                  <Plus size={12} /> Nouveau risque
                </button>
              )}
            </div>

            {risks.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">
                Aucun risque enregistré pour ce projet.
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-0">
                {/* Table des risques */}
                <div className="col-span-12 lg:col-span-8 overflow-x-auto border-r border-gray-100">
                  <table className="w-full text-sm" data-testid="risks-table">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        {["Crit.", "Risque", "Catégorie", "P", "I", "Statut", "Échéance", ""].map((h) => (
                          <th key={h} className="px-3 py-2 text-xs font-semibold text-slate-500 border-b border-gray-200 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {risks.map((r) => {
                        const critCls = r.criticality >= 16
                          ? "bg-rose-100 text-rose-700 border-rose-200"
                          : r.criticality >= 7
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200";
                        const catColors = {
                          technique: "bg-blue-50 text-blue-700", budget: "bg-violet-50 text-violet-700",
                          planning: "bg-sky-50 text-sky-700", ressource: "bg-indigo-50 text-indigo-700",
                          externe: "bg-slate-50 text-slate-600", "conformité": "bg-teal-50 text-teal-700",
                        };
                        const statusCls = { identifié: "text-blue-600", traité: "text-amber-600", clos: "text-emerald-600", accepté: "text-slate-500" };
                        return (
                          <tr
                            key={r.risk_id}
                            className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                            onClick={() => { if (canWrite) { setSelectedRisk(r); setRiskModalOpen(true); } }}
                            data-testid={`risk-row-${r.risk_id}`}
                          >
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${critCls}`}>
                                {r.criticality}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 max-w-xs">
                              <div className="font-medium text-xs text-slate-800 leading-snug line-clamp-2">{r.title}</div>
                              {r.owner && <div className="text-[10px] text-slate-400 mt-0.5">{r.owner}</div>}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${catColors[r.category] || "bg-gray-50 text-gray-600"}`}>
                                {r.category}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono-data text-xs font-bold text-slate-600">{r.probability}</td>
                            <td className="px-3 py-2.5 text-center font-mono-data text-xs font-bold text-slate-600">{r.impact}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-semibold capitalize ${statusCls[r.status] || "text-slate-500"}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                              {r.due_date ? formatDate(r.due_date) : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {user?.role === "TENANT_ADMIN" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "risk", item: r }); }}
                                  data-testid={`btn-delete-risk-${r.risk_id}`}
                                  className="text-slate-300 hover:text-rose-500 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Heatmap 5×5 */}
                <div className="col-span-12 lg:col-span-4 p-4" data-testid="risk-heatmap-container">
                  <RiskHeatmap risks={risks} />
                </div>
              </div>
            )}
          </div>

          {/* Registre des décisions */}
          {(() => {
            const DECISION_STATUS_COLORS = {
              proposée:  "bg-sky-100 text-sky-700 border-sky-200",
              prise:     "bg-indigo-100 text-indigo-700 border-indigo-200",
              en_cours:  "bg-amber-100 text-amber-700 border-amber-200",
              appliquée: "bg-emerald-100 text-emerald-700 border-emerald-200",
              reportée:  "bg-slate-100 text-slate-600 border-slate-200",
              annulée:   "bg-rose-100 text-rose-700 border-rose-200",
            };
            const DECISION_CATEGORY_COLORS = {
              stratégique: "text-violet-700", périmètre: "text-sky-700",
              planning: "text-orange-700", budgétaire: "text-emerald-700",
              technique: "text-blue-700", ressources: "text-indigo-700",
              conformité: "text-teal-700", gouvernance: "text-slate-600",
            };
            return (
              <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="decisions-section">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                    <ClipboardList size={13} className="text-[#0052CC]" />
                    Registre des décisions ({decisions.length})
                  </div>
                  {canCreateDec && (
                    <button
                      onClick={() => { setSelectedDecision(null); setDecisionModalOpen(true); }}
                      data-testid="btn-new-decision"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] transition-colors"
                    >
                      <Plus size={12} /> Nouvelle décision
                    </button>
                  )}
                </div>

                {decisions.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-400">
                    Aucune décision enregistrée pour ce projet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="decisions-table">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          {["Date", "Décision", "Catégorie", "Statut", "Responsable", "Échéance", ""].map((h) => (
                            <th key={h} className="px-3 py-2 text-xs font-semibold text-slate-500 border-b border-gray-200 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {decisions.map((d) => (
                          <tr
                            key={d.decision_id}
                            className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                            onClick={() => { if (canWrite) { setSelectedDecision(d); setDecisionModalOpen(true); } }}
                            data-testid={`decision-row-${d.decision_id}`}
                          >
                            <td className="px-3 py-2.5 font-mono-data text-xs text-slate-500 whitespace-nowrap">
                              {d.decision_date ? formatDate(d.decision_date) : "—"}
                            </td>
                            <td className="px-3 py-2.5 max-w-xs">
                              <div className="font-medium text-xs text-slate-800 leading-snug line-clamp-2">{d.title}</div>
                              {d.impact && <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{d.impact}</div>}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-semibold capitalize ${DECISION_CATEGORY_COLORS[d.category] || "text-slate-500"}`}>
                                {d.category}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${DECISION_STATUS_COLORS[d.status] || "bg-gray-100 text-gray-700"}`}>
                                {d.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">{d.owner || "—"}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                              {d.due_date ? formatDate(d.due_date) : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {canDelete && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: "decision", item: d }); }}
                                  data-testid={`btn-delete-decision-${d.decision_id}`}
                                  className="text-slate-300 hover:text-rose-500 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

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

        {/* Work Allocations — S1-05 */}
        <div className="col-span-12 bg-white border border-gray-200 rounded shadow-sm" data-testid="work-allocations-section">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <Clock size={13} className="text-[#0052CC]" />
              Allocations de travail ({workAllocations.length})
            </div>
            {canWrite && (
              <button
                onClick={() => { setSelectedWa(null); setWaModalOpen(true); }}
                data-testid="btn-new-work-allocation"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] transition-colors"
              >
                <Plus size={12} /> Nouvelle allocation
              </button>
            )}
          </div>
          {workAllocations.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              Aucune allocation de travail. Cliquez sur "Nouvelle allocation" pour commencer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="work-allocations-table">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    {["Ressource", "Phase", "JH prévus", "JH consommés", "Coût prévu", "Coût consommé", "RAF €", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workAllocations.map((wa) => {
                    const raf_wa = Math.max((wa.planned_md || 0) - (wa.consumed_md || 0), 0);
                    const raf_cost = Math.round((raf_wa * (wa.tjm_eur || 0)) * 100) / 100;
                    return (
                      <tr key={wa.work_allocation_id} className="border-b border-gray-50 hover:bg-gray-50/50" data-testid={`wa-row-${wa.work_allocation_id}`}>
                        <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{wa.resource_name || wa.resource_id}</td>
                        <td className="px-3 py-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {wa.phase}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{wa.planned_md} JH</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{wa.consumed_md} JH</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                          {wa.planned_cost_eur ? `${wa.planned_cost_eur.toLocaleString("fr-FR")} €` : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                          {wa.consumed_cost_eur ? `${wa.consumed_cost_eur.toLocaleString("fr-FR")} €` : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-amber-700">
                          {raf_cost > 0 ? `${raf_cost.toLocaleString("fr-FR")} €` : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {canWrite && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setSelectedWa(wa); setWaModalOpen(true); }} className="p-1 text-slate-300 hover:text-[#0052CC] transition-colors" data-testid={`btn-edit-wa-${wa.work_allocation_id}`}><Pencil size={12} /></button>
                              <button onClick={() => setConfirmDelete({ type: "work_allocation", item: wa })} className="p-1 text-slate-300 hover:text-rose-500 transition-colors" data-testid={`btn-delete-wa-${wa.work_allocation_id}`}><Trash2 size={12} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Team Consumption — S1-06 */}
        {teamConsumption.length > 0 && (
          <div className="col-span-12 bg-white border border-gray-200 rounded shadow-sm" data-testid="team-consumption-section">
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                <Users size={13} className="text-[#0052CC]" />
                Consommation par équipe
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="team-consumption-table">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left">
                    {["Équipe", "JH prévus", "JH consommés", "Coût prévu", "Coût consommé", "RAF JH", "RAF €"].map((h) => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamConsumption.map((tc) => (
                    <tr key={tc.team_id || tc.team_name} className="border-b border-gray-50 hover:bg-gray-50/50" data-testid={`tc-row-${tc.team_name}`}>
                      <td className="px-3 py-2.5 font-medium text-xs text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded bg-[#0052CC]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-[#0052CC]">{tc.team_name.slice(0,2).toUpperCase()}</span>
                          </div>
                          {tc.team_name}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{tc.planned_md} JH</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-700 font-semibold">{tc.consumed_md} JH</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{tc.planned_cost_eur?.toLocaleString("fr-FR")} €</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-700 font-semibold">{tc.consumed_cost_eur?.toLocaleString("fr-FR")} €</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-amber-700 font-semibold">{tc.raf_md} JH</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-amber-700 font-bold">{tc.raf_cost_eur?.toLocaleString("fr-FR")} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Section Scope reçu ─────────────────────────────────── */}
        {scopeSnapshots.length > 0 && (
          <div className="col-span-12 bg-white border border-gray-200 rounded shadow-sm" data-testid="scope-received-section">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                <Lock size={13} className="text-[#0052CC]" />
                Scope {scopeSnapshots.some(s => s.status === "transmitted") ? "reçu" : "figé"}
              </div>
              <span className="text-xs text-slate-400">{scopeSnapshots.length} version(s)</span>
            </div>
            <div className="divide-y divide-slate-50">
              {scopeSnapshots.map((snap) => {
                const secCount    = (snap.features || []).filter(f => f.scope_status === "sec").length;
                const etenduCount = (snap.features || []).filter(f => f.scope_status === "etendu").length;
                const outCount    = (snap.features || []).filter(f => f.scope_status === "out").length;
                const overloadTeams = (snap.capacity_summary || []).filter(t => t.status === "rouge").length;
                return (
                  <div key={snap.snapshot_id} className="px-5 py-4" data-testid={`scope-snap-${snap.snapshot_id}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        {snap.status === "transmitted"
                          ? <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
                          : <Lock size={18} className="text-amber-500 flex-shrink-0" />
                        }
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">
                            {snap.period_ref} — v{snap.version}
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded font-medium ${snap.status === "transmitted" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {snap.status === "transmitted" ? "Transmis" : "Figé"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {snap.frozen_at?.slice(0, 10)}
                            {snap.comment && <span className="ml-2 italic">· {snap.comment}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold">{secCount} SEC</span>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">{etenduCount} ÉTENDU</span>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{outCount} OUT</span>
                        {overloadTeams > 0 && (
                          <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                            <AlertTriangle size={10} />{overloadTeams} surcharge
                          </span>
                        )}
                        <a href={`/scope`} className="ml-2 text-xs text-[#0052CC] hover:underline flex items-center gap-1">
                          <ChevronRight size={12} />Voir dans Scope
                        </a>
                      </div>
                    </div>

                    {/* Capa vs charge inline */}
                    {(snap.capacity_summary || []).length > 0 && (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                        {snap.capacity_summary.map((team) => (
                          <div key={team.team_id} className={`rounded-lg px-3 py-2 border text-xs
                            ${team.status === "rouge" ? "bg-red-50 border-red-200" : team.status === "orange" ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}
                            data-testid={`scope-capa-${team.team_id}`}>
                            <div className="font-semibold text-slate-700 truncate">{team.team_name}</div>
                            <div className={`font-bold mt-0.5 ${team.status === "rouge" ? "text-red-700" : team.status === "orange" ? "text-amber-700" : "text-emerald-700"}`}>
                              {team.charge_sec} / {team.capa} JH
                            </div>
                            <div className="text-slate-400">{team.taux_pct}% · {team.status === "rouge" ? "SURCHARGE" : team.status === "orange" ? "Attention" : "OK"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

          {/* RAF valorisé — S1-07 */}
          {raf && (
            <div className="bg-white border border-gray-200 rounded shadow-sm p-5" data-testid="raf-section">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
                RAF &amp; Atterrissage valorisé
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Consommé (JH)", value: `${raf.consumed_md} JH`, color: "text-slate-700" },
                  { label: "Consommé (€)", value: `${(raf.consumed_cost_eur || 0).toLocaleString("fr-FR")} €`, color: "text-slate-700" },
                  { label: "RAF (JH)", value: `${raf.raf_md} JH`, color: "text-amber-600 font-bold" },
                  { label: "RAF (€)", value: `${(raf.raf_cost_eur || 0).toLocaleString("fr-FR")} €`, color: "text-amber-600 font-bold" },
                  { label: "Atterrissage (€)", value: `${(raf.atterrissage_eur || 0).toLocaleString("fr-FR")} €`, color: "text-[#0052CC] font-bold" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className={`font-mono text-sm ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
        allTasks={tasks}
        onSaved={fetchAll}
      />
      <RiskModal
        isOpen={riskModalOpen}
        onClose={() => setRiskModalOpen(false)}
        risk={selectedRisk}
        projectId={id}
        onSaved={fetchAll}
      />
      <DecisionModal
        isOpen={decisionModalOpen}
        onClose={() => setDecisionModalOpen(false)}
        decision={selectedDecision}
        projectId={id}
        onSaved={fetchAll}
      />
      <BudgetRevisionModal
        isOpen={budgetRevisionOpen}
        onClose={() => setBudgetRevisionOpen(false)}
        project={project}
        onSaved={fetchAll}
      />
      <ExportCopilModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        selectedProjectIds={project ? [project.project_id] : []}
        selectedProjectNames={project ? [project.name] : []}
      />
      <WorkAllocationModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        wa={selectedWa}
        tasks={tasks}
        resources={resources}
        onSaved={fetchAll}
      />
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={
          confirmDelete?.type === "project" ? "Supprimer le projet"
          : confirmDelete?.type === "task" ? "Supprimer la tâche"
          : confirmDelete?.type === "risk" ? "Supprimer le risque"
          : confirmDelete?.type === "work_allocation" ? "Supprimer l'allocation"
          : confirmDelete?.type === "milestone" ? "Supprimer le jalon"
          : confirmDelete?.type === "dependency" ? "Supprimer la dépendance"
          : "Supprimer la décision"
        }
        message={
          confirmDelete?.type === "project"
            ? `Supprimer "${confirmDelete?.item?.name}" ? Toutes les tâches et jalons associés seront également supprimés.`
            : confirmDelete?.type === "task"
            ? `Supprimer la tâche "${confirmDelete?.item?.name}" ?`
            : confirmDelete?.type === "risk"
            ? `Supprimer le risque "${confirmDelete?.item?.title}" ?`
            : confirmDelete?.type === "work_allocation"
            ? `Supprimer cette allocation de travail ?`
            : confirmDelete?.type === "milestone"
            ? `Supprimer le jalon "${confirmDelete?.item?.name}" ?`
            : confirmDelete?.type === "dependency"
            ? `Supprimer cette dépendance inter-projets ?`
            : `Supprimer la décision "${confirmDelete?.item?.title}" ?`
        }
      />
      {milestoneModalOpen && (
        <MilestoneModal
          milestone={selectedMilestone}
          projectId={id}
          resources={resources}
          isAdmin={canDelete}
          onSave={async (data) => {
            if (selectedMilestone) {
              await milestonesAPI.update(selectedMilestone.milestone_id, data);
            } else {
              await milestonesAPI.create(data);
            }
            setMilestoneModalOpen(false);
            fetchAll();
          }}
          onClose={() => setMilestoneModalOpen(false)}
        />
      )}
      {depModalOpen && (
        <DependencyModal
          dependency={selectedDep}
          projectId={id}
          projects={allProjects}
          sourceMilestones={milestones}
          onSave={async (data) => {
            if (selectedDep) {
              await projectDependenciesAPI.update(selectedDep.dependency_id, data);
            } else {
              await projectDependenciesAPI.create(data);
            }
            setDepModalOpen(false);
            fetchAll();
          }}
          onClose={() => setDepModalOpen(false)}
        />
      )}
    </div>
  );
}
