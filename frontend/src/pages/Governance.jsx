import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Calendar, AlertTriangle, CheckCircle, Clock, XCircle,
  ClipboardList, Plus, Trash2, ChevronDown, ChevronUp, Presentation,
} from "lucide-react";
import { governanceAPI, projectsAPI, decisionsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { GovernanceTypeBadge, SanityBadge } from "@/components/RAGBadge";
import DecisionModal from "@/components/DecisionModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import ExportCopilModal from "@/components/ExportCopilModal";
import { formatDate } from "@/utils/format";

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
const DECISION_STATUSES = ["proposée", "prise", "en_cours", "appliquée", "reportée", "annulée"];
const DECISION_CATEGORIES = ["stratégique", "périmètre", "planning", "budgétaire", "technique", "ressources", "conformité", "gouvernance"];

function SanityReport({ report }) {
  if (!report || Object.keys(report).length === 0) {
    return <p className="text-xs text-slate-400 italic">Rapport non disponible</p>;
  }
  const checks = report.checks || [];
  return (
    <div>
      {report.summary && <p className="text-xs text-slate-600 mb-2">{report.summary}</p>}
      {checks.map((c, i) => (
        <div key={i} className={`text-xs flex items-start gap-1.5 mb-1 ${c.severity === "critical" ? "text-rose-600" : c.severity === "high" ? "text-orange-600" : "text-amber-600"}`}>
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{c.rule} ({c.projects_flagged?.length || 0} projet{(c.projects_flagged?.length || 0) > 1 ? "s" : ""})</span>
        </div>
      ))}
    </div>
  );
}

export default function Governance() {
  const { user } = useAuth();
  const canWrite = user?.role === "TENANT_ADMIN" || user?.role === "PMO_USER";
  const isAdmin = user?.role === "TENANT_ADMIN";

  const [instances, setInstances] = useState([]);
  const [projects, setProjects] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  // Decision modal state
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [decisionProjectId, setDecisionProjectId] = useState(null);
  const [decisionGovernanceId, setDecisionGovernanceId] = useState(null);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportProjectIds, setExportProjectIds] = useState([]);
  const [exportProjectNames, setExportProjectNames] = useState([]);
  const [exportGovId, setExportGovId] = useState(null);

  // Global decisions filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterProject, setFilterProject] = useState("");

  const fetchAll = () => {
    Promise.all([governanceAPI.list(), projectsAPI.list(), decisionsAPI.list()])
      .then(([gRes, pRes, dRes]) => {
        setInstances(gRes.data);
        setProjects(pRes.data);
        setDecisions(dRes.data);
        setLoading(false);
      }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const getProjectName = (pid) => {
    const p = projects.find((proj) => proj.project_id === pid);
    return p ? p.name : pid;
  };

  const handleDeleteDecision = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await decisionsAPI.delete(confirmDelete.decision_id);
      setConfirmDelete(null);
      fetchAll();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const openNewDecision = (governanceId = null, projectId = null) => {
    setSelectedDecision(null);
    setDecisionGovernanceId(governanceId);
    setDecisionProjectId(projectId);
    setDecisionModalOpen(true);
  };

  const openEditDecision = (dec) => {
    setSelectedDecision(dec);
    setDecisionGovernanceId(dec.governance_id || null);
    setDecisionProjectId(dec.project_id);
    setDecisionModalOpen(true);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-slate-400 text-sm">
        Chargement de la gouvernance...
      </div>
    );
  }

  const counts = {
    passed: instances.filter((i) => i.sanity_check_status === "passed").length,
    failed: instances.filter((i) => i.sanity_check_status === "failed").length,
    pending: instances.filter((i) => i.sanity_check_status === "pending").length,
  };

  // Filter decisions for global table
  const filteredDecisions = decisions.filter((d) => {
    if (filterStatus && d.status !== filterStatus) return false;
    if (filterCategory && d.category !== filterCategory) return false;
    if (filterProject && d.project_id !== filterProject) return false;
    return true;
  });

  return (
    <div className="p-8" data-testid="governance-page">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
          Gouvernance
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Instances de gouvernance, sanity checks et registre des décisions du portefeuille
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-[#0052CC]">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Total instances</div>
          <div className="font-heading text-3xl font-bold text-[#0F172A] mt-2">{instances.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-emerald-500">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Validées</div>
          <div className="font-heading text-3xl font-bold text-emerald-600 mt-2">{counts.passed}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-rose-500">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">En échec</div>
          <div className="font-heading text-3xl font-bold text-rose-600 mt-2">{counts.failed}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-indigo-400">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Décisions enregistrées</div>
          <div className="font-heading text-3xl font-bold text-indigo-600 mt-2">{decisions.length}</div>
        </div>
      </div>

      {/* ===== REGISTRE DES DÉCISIONS — Vue transversale ===== */}
      <div className="bg-white border border-gray-200 rounded shadow-sm mb-6" data-testid="decisions-global-section">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
            <ClipboardList size={13} className="text-[#0052CC]" />
            Registre des décisions — Portefeuille ({filteredDecisions.length})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white"
              data-testid="decisions-filter-status"
            >
              <option value="">Tous statuts</option>
              {DECISION_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white"
              data-testid="decisions-filter-category"
            >
              <option value="">Toutes catégories</option>
              {DECISION_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white"
              data-testid="decisions-filter-project"
            >
              <option value="">Tous projets</option>
              {projects.map((p) => (
                <option key={p.project_id} value={p.project_id}>{p.name.split("—")[0].trim().slice(0, 40)}</option>
              ))}
            </select>
            {(filterStatus || filterCategory || filterProject) && (
              <button
                onClick={() => { setFilterStatus(""); setFilterCategory(""); setFilterProject(""); }}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 border border-gray-200 rounded"
                data-testid="decisions-filter-reset"
              >
                Réinitialiser
              </button>
            )}
            {canWrite && (
              <button
                onClick={() => openNewDecision(null, null)}
                data-testid="btn-new-decision-global"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] transition-colors"
              >
                <Plus size={12} /> Nouvelle décision
              </button>
            )}
          </div>
        </div>

        {filteredDecisions.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            {decisions.length === 0 ? "Aucune décision enregistrée dans le portefeuille." : "Aucune décision ne correspond aux filtres sélectionnés."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="decisions-global-table">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {["Date", "Décision", "Catégorie", "Statut", "Projet", "Responsable", "Échéance", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-600 border-b border-gray-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDecisions.map((d) => (
                  <tr
                    key={d.decision_id}
                    className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors cursor-pointer"
                    onClick={() => canWrite && openEditDecision(d)}
                    data-testid={`decision-global-row-${d.decision_id}`}
                  >
                    <td className="px-4 py-2.5 font-mono-data text-xs text-slate-500 whitespace-nowrap">
                      {d.decision_date ? formatDate(d.decision_date) : "—"}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <div className="font-medium text-xs text-slate-800 line-clamp-2 leading-snug">{d.title}</div>
                      {d.impact && <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{d.impact}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-semibold capitalize ${DECISION_CATEGORY_COLORS[d.category] || "text-slate-500"}`}>
                        {d.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${DECISION_STATUS_COLORS[d.status] || "bg-gray-100 text-gray-700"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/projects/${d.project_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#0052CC] hover:text-[#0047B3] text-xs font-medium line-clamp-1"
                        data-testid={`decision-project-link-${d.decision_id}`}
                      >
                        {getProjectName(d.project_id).split("—")[0].trim().slice(0, 35)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{d.owner || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {d.due_date ? formatDate(d.due_date) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(d); }}
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

      {/* ===== INSTANCES DE GOUVERNANCE ===== */}
      <div className="mb-3">
        <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
          Instances de gouvernance ({instances.length})
        </div>
      </div>

      <div className="space-y-3">
        {instances.map((g) => {
          const isExpanded = expanded === g.governance_id;
          const date = new Date(g.date_scheduled);
          const isPast = date < new Date();
          const instanceDecisions = decisions.filter((d) => d.governance_id === g.governance_id);

          return (
            <div
              key={g.governance_id}
              className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden"
              data-testid={`governance-instance-${g.governance_id}`}
            >
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                data-testid={`governance-expand-btn-${g.governance_id}`}
                onClick={() => setExpanded(isExpanded ? null : g.governance_id)}
              >
                <GovernanceTypeBadge type={g.type} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate" data-testid={`governance-name-${g.governance_id}`}>
                    {g.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Calendar size={11} className="text-slate-400" />
                    <span className={`text-xs ${isPast ? "text-slate-400" : "text-[#0052CC] font-medium"}`}>
                      {formatDate(g.date_scheduled)}
                      {!isPast && " · À venir"}
                      {isPast && " · Passé"}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 flex-shrink-0">
                  <span className="font-mono-data font-bold text-slate-700">{g.projects_scope?.length || 0}</span> projet{(g.projects_scope?.length || 0) > 1 ? "s" : ""}
                </div>
                {instanceDecisions.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-indigo-600 flex-shrink-0">
                    <ClipboardList size={12} />
                    <span className="font-mono-data font-bold">{instanceDecisions.length}</span>
                  </div>
                )}
                <SanityBadge status={g.sanity_check_status} />
                <span className="text-slate-400 text-sm ml-2">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                  {/* Export COPIL shortcut */}
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={() => {
                        const pids = g.projects_scope || [];
                        setExportProjectIds(pids);
                        setExportProjectNames(pids.map((pid) => getProjectName(pid)));
                        setExportGovId(g.governance_id);
                        setExportModalOpen(true);
                      }}
                      data-testid={`btn-export-copil-instance-${g.governance_id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-[#0052CC] text-[#0052CC] text-xs font-semibold rounded hover:bg-[#EBF2FF] transition-colors"
                    >
                      <Presentation size={12} /> Export COPIL
                    </button>
                  </div>
                  {/* Projects + Sanity */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
                        Projets en périmètre
                      </div>
                      <div className="space-y-1">
                        {(g.projects_scope || []).map((pid) => (
                          <div key={pid} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0052CC] flex-shrink-0" />
                            <Link
                              to={`/projects/${pid}`}
                              className="text-xs text-[#0052CC] hover:text-[#0047B3] truncate"
                            >
                              {getProjectName(pid)}
                            </Link>
                          </div>
                        ))}
                        {(!g.projects_scope || g.projects_scope.length === 0) && (
                          <span className="text-xs text-slate-400 italic">Aucun projet défini</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
                        Rapport Sanity Check
                      </div>
                      <SanityReport report={g.sanity_check_report} />
                    </div>
                  </div>

                  {/* Per-instance decisions */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                        <ClipboardList size={11} className="text-[#0052CC]" />
                        Décisions liées à cette instance ({instanceDecisions.length})
                      </div>
                      {canWrite && (
                        <button
                          onClick={() => openNewDecision(g.governance_id, null)}
                          data-testid={`btn-new-decision-instance-${g.governance_id}`}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[#0052CC] text-white text-[11px] font-semibold rounded hover:bg-[#0047B3] transition-colors"
                        >
                          <Plus size={11} /> Ajouter
                        </button>
                      )}
                    </div>

                    {instanceDecisions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Aucune décision liée à cette instance.</p>
                    ) : (
                      <div className="space-y-2">
                        {instanceDecisions.map((d) => (
                          <div
                            key={d.decision_id}
                            className="flex items-start gap-3 p-2.5 bg-white border border-gray-100 rounded hover:border-[#0052CC]/30 transition-colors"
                            data-testid={`decision-instance-row-${d.decision_id}`}
                          >
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border flex-shrink-0 mt-0.5 ${DECISION_STATUS_COLORS[d.status] || "bg-gray-100 text-gray-700"}`}>
                              {d.status}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-800 line-clamp-1">{d.title}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-semibold capitalize ${DECISION_CATEGORY_COLORS[d.category] || "text-slate-500"}`}>{d.category}</span>
                                {d.owner && <span className="text-[10px] text-slate-400">· {d.owner}</span>}
                                {d.decision_date && <span className="text-[10px] text-slate-400">· {formatDate(d.decision_date)}</span>}
                              </div>
                              {d.impact && <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{d.impact}</div>}
                            </div>
                            {canWrite && (
                              <button
                                onClick={() => openEditDecision(d)}
                                className="text-slate-300 hover:text-[#0052CC] transition-colors flex-shrink-0"
                                data-testid={`btn-edit-decision-instance-${d.decision_id}`}
                              >
                                <ClipboardList size={13} />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => setConfirmDelete(d)}
                                className="text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0"
                                data-testid={`btn-delete-decision-instance-${d.decision_id}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {instances.length === 0 && (
          <div className="bg-white border border-gray-200 rounded p-10 text-center text-slate-400 text-sm">
            Aucune instance de gouvernance définie
          </div>
        )}
      </div>

      <ExportCopilModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        selectedProjectIds={exportProjectIds}
        selectedProjectNames={exportProjectNames}
        preGovernanceId={exportGovId}
      />
      {/* Decision Modal */}
      <DecisionModal
        isOpen={decisionModalOpen}
        onClose={() => setDecisionModalOpen(false)}
        decision={selectedDecision}
        projectId={decisionProjectId}
        governanceId={decisionGovernanceId}
        projects={projects}
        onSaved={fetchAll}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteDecision}
        loading={deleting}
        title="Supprimer la décision"
        message={`Supprimer la décision "${confirmDelete?.title}" ? Cette action est irréversible.`}
      />
    </div>
  );
}
