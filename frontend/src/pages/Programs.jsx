import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { programsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import RAGBadge from "@/components/RAGBadge";
import ProgramModal from "@/components/ProgramModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatEuro } from "@/utils/format";

const STATUS_LABELS = { active: "Actif", on_hold: "En pause", completed: "Terminé", cancelled: "Annulé" };
const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function Programs() {
  const { user } = useAuth();
  const canWrite = user?.role === "TENANT_ADMIN" || user?.role === "PMO_USER";
  const isAdmin = user?.role === "TENANT_ADMIN";

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const handleDelete = async () => {
    setDeleting(true);
    try { await programsAPI.delete(confirmDelete.program_id); setConfirmDelete(null); fetchAll(); }
    catch { /* ignore */ } finally { setDeleting(false); }
  };

  if (loading) return <div className="p-8 text-slate-400 text-sm">Chargement des programmes...</div>;

  const totalProjects = programs.reduce((s, p) => s + (p.project_count || 0), 0);
  const criticalCount = programs.filter((p) => p.rag_consolidated === "red").length;

  return (
    <div className="p-8" data-testid="programs-page">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">Programmes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{programs.length} programme{programs.length > 1 ? "s" : ""} · {totalProjects} projets</p>
        </div>
        {canWrite && (
          <button onClick={openCreate} data-testid="btn-new-program"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] transition-colors shadow-sm">
            <Plus size={15} /> Nouveau programme
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Budget total consolidé", value: formatEuro(programs.reduce((s, p) => s + (p.budget_total || 0), 0)), icon: TrendingUp, color: "text-[#0052CC]" },
          { label: "Projets actifs", value: totalProjects, icon: FolderKanban, color: "text-slate-700" },
          { label: "Programmes en alerte", value: criticalCount, icon: criticalCount > 0 ? AlertTriangle : CheckCircle2, color: criticalCount > 0 ? "text-rose-600" : "text-emerald-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded shadow-sm p-4 flex items-center gap-4">
            <div className={`${color} flex-shrink-0`}><Icon size={22} strokeWidth={1.75} /></div>
            <div>
              <div className={`font-mono-data text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Programs cards */}
      <div className="space-y-4">
        {programs.map((prog) => {
          const consumedPct = prog.budget_total
            ? Math.min(Math.round((prog.budget_consumed || 0) / prog.budget_total * 100), 100) : 0;
          return (
            <div key={prog.program_id} className="bg-white border border-gray-200 rounded shadow-sm hover:shadow-md transition-shadow" data-testid={`program-card-${prog.program_id}`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <RAGBadge status={prog.rag_consolidated} />
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[prog.status] || STATUS_COLORS.active}`}>
                        {STATUS_LABELS[prog.status] || prog.status}
                      </span>
                      <span className="text-xs text-slate-400">{prog.project_count || 0} projet{(prog.project_count || 0) > 1 ? "s" : ""}</span>
                    </div>
                    <h2 className="font-heading text-lg font-bold text-[#0F172A] leading-snug">{prog.name}</h2>
                    {prog.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{prog.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      {prog.owner && <span>Owner : <span className="font-medium text-slate-600">{prog.owner}</span></span>}
                      {prog.start_date && <span>{prog.start_date} → {prog.end_date || "—"}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right space-y-1 min-w-[160px]">
                    <div className="text-xs text-slate-400">Budget total</div>
                    <div className="font-mono-data text-base font-bold text-[#0F172A]">{(prog.budget_total_keur || 0).toLocaleString("fr-FR")} K€</div>
                    <div className="text-xs text-slate-500">consommé : <span className={`font-semibold ${consumedPct > 90 ? "text-rose-600" : "text-slate-700"}`}>{(prog.budget_consumed_keur || 0).toLocaleString("fr-FR")} K€</span></div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${consumedPct > 90 ? "bg-rose-500" : "bg-[#0052CC]"}`} style={{ width: `${consumedPct}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  {[{ key: "green", color: "bg-emerald-500", label: "vert" }, { key: "orange", color: "bg-amber-500", label: "orange" }, { key: "red", color: "bg-rose-500", label: "rouge" }].map(({ key, color, label }) => (
                    <span key={key} className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="font-semibold text-slate-700">{(prog.rag_counts || {})[key] || 0}</span> {label}
                    </span>
                  ))}
                  <div className="ml-auto flex items-center gap-1">
                    {canWrite && (
                      <button onClick={(e) => openEdit(e, prog)} data-testid={`btn-edit-program-${prog.program_id}`}
                        className="p-1.5 text-slate-400 hover:text-[#0052CC] hover:bg-blue-50 rounded transition-colors" title="Modifier">
                        <Pencil size={13} />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirmDelete(prog); }}
                        data-testid={`btn-delete-program-${prog.program_id}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Supprimer">
                        <Trash2 size={13} />
                      </button>
                    )}
                    <Link to={`/programmes/${prog.program_id}`} className="flex items-center gap-1 text-xs text-[#0052CC] hover:text-[#0047B3] font-semibold ml-1" data-testid={`program-detail-link-${prog.program_id}`}>
                      Voir le détail <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {programs.length === 0 && (
          <div className="bg-white border border-gray-200 rounded p-12 text-center text-slate-400 text-sm">Aucun programme défini.</div>
        )}
      </div>

      <ProgramModal isOpen={modalOpen} onClose={() => setModalOpen(false)} program={selectedProgram} onSaved={fetchAll} />
      <ConfirmDialog
        isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete} loading={deleting}
        title="Supprimer le programme"
        message={`Supprimer "${confirmDelete?.name}" ? Les projets rattachés seront délié mais non supprimés.`}
      />
    </div>
  );
}
