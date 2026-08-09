import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Pencil, Trash2, LayoutGrid, List, ChevronRight } from "lucide-react";
import { programsAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import RAGBadge from "@/components/RAGBadge";
import ProgramModal from "@/components/ProgramModal";
import ProgramTile from "@/components/ProgramTile";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatEuro, formatDate } from "@/utils/format";
import ExcelToolbar from "@/components/ExcelToolbar";

const STATUS_LABELS = { active: "Actif", on_hold: "En pause", completed: "Terminé", cancelled: "Annulé" };
const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-zinc-100 text-zinc-600",
  cancelled: "bg-rose-100 text-rose-700",
};
const RAG_LABELS = { green: "Vert", orange: "Orange", red: "Rouge" };

export default function Programs() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("projects.create");
  const canEdit   = hasPermission("projects.edit");
  const canDelete = hasPermission("projects.delete");

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRag, setFilterRag] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [view, setView] = useState(() => localStorage.getItem("programs_view") || "tiles");
  const switchView = (v) => { setView(v); localStorage.setItem("programs_view", v); };

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = () => {
    programsAPI.list()
      .then((r) => { setPrograms(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setSelectedProgram(null); setModalOpen(true); };
  const openEdit = (e, p) => { e.stopPropagation(); e.preventDefault(); setSelectedProgram(p); setModalOpen(true); };
  const openDelete = (e, p) => { e.stopPropagation(); e.preventDefault(); setConfirmDelete(p); };
  const handleDelete = async () => {
    setDeleting(true);
    try { await programsAPI.delete(confirmDelete.program_id); setConfirmDelete(null); fetchAll(); }
    catch { /* ignore */ } finally { setDeleting(false); }
  };

  if (loading) return <div className="p-8 text-zinc-400 text-sm">Chargement des programmes...</div>;

  const totalProjects = programs.reduce((s, p) => s + (p.project_count || 0), 0);
  const totalBudget = programs.reduce((s, p) => s + (p.budget_total || 0), 0);
  const ragCounts = { green: 0, orange: 0, red: 0 };
  programs.forEach((p) => { if (p.rag_consolidated in ragCounts) ragCounts[p.rag_consolidated]++; });

  const filtered = programs.filter((p) => {
    const q = search.toLowerCase();
    return (
      (!search || p.name.toLowerCase().includes(q) || (p.owner || "").toLowerCase().includes(q)) &&
      (!filterRag || p.rag_consolidated === filterRag) &&
      (!filterStatus || p.status === filterStatus)
    );
  });

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="programs-page">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[#8a87a0] mb-0.5">Accueil / <span className="text-[#352c6e] font-semibold">Programmes</span></div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#26243a] tracking-tight">Programmes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {programs.length} programme{programs.length > 1 ? "s" : ""} · {totalProjects} projets · {formatEuro(totalBudget)} consolidés — {ragCounts.red} rouge · {ragCounts.orange} orange · {ragCounts.green} vert
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelToolbar entity="programs" onImported={fetchAll} canImport={canCreate} />
          {canCreate && (
            <button onClick={openCreate} data-testid="btn-new-program"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
              <Plus size={15} /> Nouveau programme
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..." data-testid="programs-search"
            className="pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:border-blue-600 w-52"
          />
        </div>
        <select value={filterRag} onChange={(e) => setFilterRag(e.target.value)} data-testid="programs-filter-rag"
          className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-600">
          <option value="">Tous RAG</option>
          {["green","orange","red"].map((r) => <option key={r} value={r}>{RAG_LABELS[r]}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="programs-filter-status"
          className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-600">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {/* Bascule tuiles / liste */}
        <div className="ml-auto flex border border-[#dcd9ea] rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => switchView("tiles")}
            data-testid="programs-view-toggle-tiles"
            className={`w-9 h-9 flex items-center justify-center transition-colors ${view === "tiles" ? "bg-[#e9effe] text-[#2e5fe8]" : "text-[#8a87a0] hover:bg-[#f7f6fb]"}`}
            title="Vue tuiles"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => switchView("list")}
            data-testid="programs-view-toggle-list"
            className={`w-9 h-9 flex items-center justify-center transition-colors border-l border-[#dcd9ea] ${view === "list" ? "bg-[#e9effe] text-[#2e5fe8]" : "text-[#8a87a0] hover:bg-[#f7f6fb]"}`}
            title="Vue liste"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Vue tuiles */}
      {view === "tiles" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5" data-testid="programs-tiles">
          {filtered.map((prog) => (
            <ProgramTile
              key={prog.program_id}
              program={prog}
              onEdit={openEdit}
              onDelete={openDelete}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-zinc-400 text-sm">Aucun programme correspondant aux filtres</div>
          )}
        </div>
      )}

      {/* Vue liste */}
      {view === "list" && (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm" data-testid="programs-table">
            <thead>
              <tr className="bg-[#fbfaff] border-b border-[#e8e6f0] text-left">
                {["RAG", "Nom", "Statut", "Projets", "Budget total", "Consommé", "Période", ""].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-[10.5px] uppercase tracking-wider font-bold text-[#8a87a0] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((prog) => {
                const consumedPct = prog.budget_total
                  ? Math.min(Math.round((prog.budget_consumed || 0) / prog.budget_total * 100), 100) : 0;
                return (
                  <tr key={prog.program_id} className="border-b border-zinc-100 hover:bg-blue-50/30 transition-colors" data-testid={`program-row-${prog.program_id}`}>
                    <td className="px-4 py-3"><RAGBadge status={prog.rag_consolidated} /></td>
                    <td className="px-4 py-3 max-w-xs">
                      <Link to={`/programmes/${prog.program_id}`} className="text-blue-600 hover:text-blue-700 font-medium text-sm leading-snug" data-testid={`program-link-${prog.program_id}`}>
                        {prog.name}
                      </Link>
                      {prog.owner && <div className="text-[10px] text-zinc-400 mt-0.5">Owner : {prog.owner}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${STATUS_COLORS[prog.status] || STATUS_COLORS.active}`}>
                        {STATUS_LABELS[prog.status] || prog.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono-data text-xs text-zinc-700">{prog.project_count || 0}</td>
                    <td className="px-4 py-3 font-mono-data text-xs text-zinc-700">{formatEuro(prog.budget_total)}</td>
                    <td className="px-4 py-3 font-mono-data text-xs">
                      <span className={consumedPct > 90 ? "text-rose-600 font-semibold" : "text-zinc-700"}>{formatEuro(prog.budget_consumed)}</span>
                      <span className="text-zinc-400 ml-1">({consumedPct}%)</span>
                    </td>
                    <td className="px-4 py-3 font-mono-data text-xs text-zinc-600 whitespace-nowrap">{formatDate(prog.start_date)} → {formatDate(prog.end_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button onClick={(e) => openEdit(e, prog)} data-testid={`btn-edit-program-${prog.program_id}`}
                            className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                            <Pencil size={13} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={(e) => openDelete(e, prog)} data-testid={`btn-delete-program-${prog.program_id}`}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Supprimer">
                            <Trash2 size={13} />
                          </button>
                        )}
                        <Link to={`/programmes/${prog.program_id}`} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold ml-1" data-testid={`program-detail-link-${prog.program_id}`}>
                          Détail <ChevronRight size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-zinc-400 text-sm">Aucun programme correspondant aux filtres</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ProgramModal isOpen={modalOpen} onClose={() => setModalOpen(false)} program={selectedProgram} onSaved={fetchAll} />
      <ConfirmDialog
        isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete} loading={deleting}
        title="Supprimer le programme"
        message={`Supprimer "${confirmDelete?.name}" ? Les projets rattachés seront déliés mais non supprimés.`}
      />
    </div>
  );
}
