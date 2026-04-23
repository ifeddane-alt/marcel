import React, { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Plus, Pencil, Trash2, Presentation } from "lucide-react";
import { projectsAPI, programsAPI, resourcesAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import RAGBadge, { MethodologyBadge, ProjectStatusBadge } from "@/components/RAGBadge";
import ProjectModal from "@/components/ProjectModal";
import ExportCopilModal from "@/components/ExportCopilModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatEuro, formatDate } from "@/utils/format";

const RAG_LABELS = { green: "Vert", orange: "Orange", red: "Rouge" };

export default function Portfolio() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("projects.create");
  const canEdit   = hasPermission("projects.edit");
  const canDelete = hasPermission("projects.delete");
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRag, setFilterRag] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  // Selection state
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [preGovernanceId, setPreGovernanceId] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const selectAllRef = useRef(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = () => {
    Promise.all([projectsAPI.list(), programsAPI.list(), resourcesAPI.list()])
      .then(([pRes, progRes, rRes]) => {
        setProjects(pRes.data);
        setPrograms(progRes.data);
        setResources(rRes.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  // Read URL pre-selection params (from ProgramDetail / ProjectDetail / Governance shortcuts)
  useEffect(() => {
    const sel = searchParams.get("selected");
    const govId = searchParams.get("governance_id");
    if (sel) setSelectedProjects(new Set(sel.split(",").filter(Boolean)));
    if (govId) setPreGovernanceId(govId);
    if (sel || govId) setSearchParams({}, { replace: true });
  }, []); // Run once on mount

  const openCreate = () => { setSelectedProject(null); setModalOpen(true); };
  const openEdit = (e, p) => { e.stopPropagation(); setSelectedProject(p); setModalOpen(true); };
  const openDelete = (e, p) => { e.stopPropagation(); setConfirmDelete(p); };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await projectsAPI.delete(confirmDelete.project_id);
      setConfirmDelete(null);
      fetchAll();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase();
      return (
        (!search || p.name.toLowerCase().includes(q) || (p.source_id || "").toLowerCase().includes(q)) &&
        (!filterRag || p.status_rag === filterRag) &&
        (!filterMethod || p.methodology === filterMethod) &&
        (!filterProgram || p.program_id === filterProgram) &&
        (!filterStatus || p.status === filterStatus)
      );
    })
    .sort((a, b) => {
      let av = a[sortKey] ?? ""; let bv = b[sortKey] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Update the "select all" checkbox indeterminate state
  useEffect(() => {
    if (selectAllRef.current) {
      const indeterminate = selectedProjects.size > 0 && selectedProjects.size < filtered.length;
      selectAllRef.current.indeterminate = indeterminate;
    }
  });

  const toggleSelect = (pid) => {
    const next = new Set(selectedProjects);
    if (next.has(pid)) next.delete(pid);
    else next.add(pid);
    setSelectedProjects(next);
  };

  const toggleSelectAll = () => {
    if (selectedProjects.size === filtered.length && filtered.length > 0) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filtered.map((p) => p.project_id)));
    }
  };

  if (loading) return <div className="p-8 text-slate-400 text-sm">Chargement...</div>;

  const ragCounts = { green: 0, orange: 0, red: 0 };
  projects.forEach((p) => { if (p.status_rag in ragCounts) ragCounts[p.status_rag]++; });

  return (
    <div className="p-8" data-testid="portfolio-page">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">Portefeuille</h1>
          <p className="text-sm text-slate-500 mt-0.5">{projects.length} projets — {ragCounts.red} rouge · {ragCounts.orange} orange · {ragCounts.green} vert</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            data-testid="btn-new-project"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] transition-colors shadow-sm"
          >
            <Plus size={15} /> Nouveau projet
          </button>
        )}
      </div>

      {/* Export COPIL action bar */}
      {selectedProjects.size > 0 && (
        <div
          className="flex items-center gap-4 px-5 py-3 mb-4 bg-[#0052CC] rounded-lg shadow-md"
          data-testid="export-action-bar"
        >
          <span className="text-white font-semibold text-sm">
            {selectedProjects.size} projet{selectedProjects.size > 1 ? "s" : ""} sélectionné{selectedProjects.size > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setExportModalOpen(true)}
            data-testid="btn-export-copil"
            className="flex items-center gap-2 px-4 py-1.5 bg-white text-[#0052CC] text-sm font-bold rounded hover:bg-blue-50 transition-colors"
          >
            <Presentation size={14} /> Export COPIL
          </button>
          <button
            onClick={() => { setSelectedProjects(new Set()); setPreGovernanceId(null); }}
            data-testid="btn-clear-selection"
            className="ml-auto text-sm text-blue-100 hover:text-white transition-colors"
          >
            Annuler la sélection
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..." data-testid="portfolio-search"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#0052CC] w-52"
          />
        </div>
        <select value={filterRag} onChange={(e) => setFilterRag(e.target.value)} data-testid="portfolio-filter-rag"
          className="text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:border-[#0052CC]">
          <option value="">Tous RAG</option>
          {["green","orange","red"].map((r) => <option key={r} value={r}>{RAG_LABELS[r]}</option>)}
        </select>
        <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} data-testid="portfolio-filter-methodology"
          className="text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:border-[#0052CC]">
          <option value="">Toutes méthodos</option>
          <option value="waterfall">Waterfall</option>
          <option value="agile">Agile</option>
          <option value="safe">SAFe</option>
        </select>
        {programs.length > 0 && (
          <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} data-testid="portfolio-filter-program"
            className="text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:border-[#0052CC]">
            <option value="">Tous programmes</option>
            {programs.map((prog) => <option key={prog.program_id} value={prog.program_id}>{prog.name}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="portfolio-filter-status"
          className="text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:border-[#0052CC]">
          <option value="">Tous statuts</option>
          <option value="en_preparation">En préparation</option>
          <option value="actif">Actif</option>
          <option value="en_pause">En pause</option>
          <option value="cloture">Clôturé</option>
          <option value="archive">Archivé</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto">
        <table className="w-full text-sm" data-testid="portfolio-table">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 w-8">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={selectedProjects.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                  className="w-4 h-4 rounded border-gray-300 text-[#0052CC] focus:ring-[#0052CC] cursor-pointer"
                />
              </th>
              {[["status_rag","RAG"],["name","Nom"],["methodology","Méthodo"],["budget_total","Budget total"],["budget_forecast","Forecast"],["end_date_forecast","Fin prévue"]].map(([key, label]) => (
                <th key={key} onClick={() => toggleSort(key)}
                  className="px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-[#0052CC] select-none whitespace-nowrap">
                  {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
              {(canEdit || canDelete) && <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const prog = programs.find((pr) => pr.program_id === p.program_id);
              const overBudget = p.budget_forecast > p.budget_total * 1.05;
              return (
                <tr key={p.project_id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors" data-testid={`project-row-${p.project_id}`}>
                  <td className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(p.project_id)}
                      onChange={() => toggleSelect(p.project_id)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-project-${p.project_id}`}
                      className="w-4 h-4 rounded border-gray-300 text-[#0052CC] focus:ring-[#0052CC] cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3"><RAGBadge status={p.status_rag} /></td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link to={`/projects/${p.project_id}`} className="text-[#0052CC] hover:text-[#0047B3] font-medium text-sm leading-snug" data-testid={`project-link-${p.project_id}`}>
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      {prog && <div className="text-[10px] text-slate-400 truncate">{prog.name}</div>}
                      {prog && p.status && <span className="text-slate-200">·</span>}
                      {p.status && <ProjectStatusBadge status={p.status} />}
                    </div>
                  </td>
                  <td className="px-4 py-3"><MethodologyBadge methodology={p.methodology} /></td>
                  <td className="px-4 py-3 font-mono-data text-xs text-slate-700">{formatEuro(p.budget_total)}</td>
                  <td className="px-4 py-3 font-mono-data text-xs">
                    <span className={overBudget ? "text-rose-600 font-semibold" : "text-slate-700"}>{formatEuro(p.budget_forecast)}</span>
                  </td>
                  <td className="px-4 py-3 font-mono-data text-xs text-slate-600">{formatDate(p.end_date_forecast)}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                        <button onClick={(e) => openEdit(e, p)} data-testid={`btn-edit-project-${p.project_id}`}
                          className="p-1.5 text-slate-400 hover:text-[#0052CC] hover:bg-blue-50 rounded transition-colors" title="Modifier">
                          <Pencil size={13} />
                        </button>
                        )}
                        {canDelete && (
                          <button onClick={(e) => openDelete(e, p)} data-testid={`btn-delete-project-${p.project_id}`}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Supprimer">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={(canEdit || canDelete) ? 8 : 7} className="text-center py-12 text-slate-400 text-sm">Aucun projet correspondant aux filtres</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ExportCopilModal
        isOpen={exportModalOpen}
        onClose={() => { setExportModalOpen(false); setPreGovernanceId(null); }}
        selectedProjectIds={[...selectedProjects]}
        selectedProjectNames={projects.filter((p) => selectedProjects.has(p.project_id)).map((p) => p.name)}
        preGovernanceId={preGovernanceId}
      />
      <ProjectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        project={selectedProject}
        resources={resources}
        programs={programs}
        onSaved={fetchAll}
      />
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Supprimer le projet"
        message={`Supprimer "${confirmDelete?.name}" ? Toutes les tâches, jalons et allocations associés seront également supprimés.`}
      />
    </div>
  );
}
