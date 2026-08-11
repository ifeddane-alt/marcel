import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Target, Plus, Pencil, Trash2, X, Link2, AlertTriangle } from "lucide-react";
import { objectivesAPI, projectsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatEuro } from "@/utils/format";
import ConfirmDialog from "@/components/ConfirmDialog";

const STATUSES = [
  { value: "actif", label: "Actif", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "atteint", label: "Atteint", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "abandonne", label: "Abandonné", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
];
const RAG_DOT = { green: "bg-emerald-500", orange: "bg-amber-500", red: "bg-rose-500" };

function ObjectiveModal({ objective, onClose, onSaved }) {
  const isEdit = !!objective;
  const [title, setTitle] = useState(objective?.title || "");
  const [description, setDescription] = useState(objective?.description || "");
  const [pillar, setPillar] = useState(objective?.pillar || "");
  const [horizon, setHorizon] = useState(objective?.horizon || "");
  const [owner, setOwner] = useState(objective?.owner || "");
  const [status, setStatus] = useState(objective?.status || "actif");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = { title: title.trim(), description, pillar, horizon, owner, status };
    try {
      if (isEdit) {
        await objectivesAPI.update(objective.objective_id, payload);
        toast.success("Objectif mis à jour");
      } else {
        await objectivesAPI.create(payload);
        toast.success("Objectif créé");
      }
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la sauvegarde");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="objective-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-blue-600" />
            <h2 className="font-heading text-lg font-bold text-zinc-950">
              {isEdit ? "Modifier l'objectif" : "Nouvel objectif stratégique"}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="obj-title-input"
              placeholder="Ex : Réduire le coût de run de 15 %"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} data-testid="obj-desc-input"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Axe stratégique</label>
              <input value={pillar} onChange={(e) => setPillar(e.target.value)} data-testid="obj-pillar-input"
                placeholder="Ex : Excellence opérationnelle"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Horizon</label>
              <input value={horizon} onChange={(e) => setHorizon(e.target.value)} data-testid="obj-horizon-input"
                placeholder="Ex : 2026-2028"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Sponsor / porteur</label>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} data-testid="obj-owner-input"
                placeholder="Ex : DSI"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="obj-status-select"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 bg-white">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">Annuler</button>
            <button type="submit" disabled={saving} data-testid="obj-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
              {saving ? "Sauvegarde..." : isEdit ? "Enregistrer" : "Créer l'objectif"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LinkProjectsModal({ objective, projects, onClose, onSaved }) {
  const [selected, setSelected] = useState((objective.projects || []).map((p) => p.project_id));
  const [saving, setSaving] = useState(false);

  const toggle = (pid) =>
    setSelected((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));

  const submit = async () => {
    setSaving(true);
    try {
      await objectivesAPI.setProjects(objective.objective_id, selected);
      toast.success("Projets rattachés mis à jour");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="link-projects-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 size={15} className="text-blue-600 flex-shrink-0" />
            <h2 className="font-heading text-base font-bold text-zinc-950 truncate">Projets rattachés — {objective.title}</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 flex-shrink-0"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-50">
          {projects.map((p) => (
            <label key={p.project_id} className="flex items-center gap-3 px-6 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(p.project_id)} onChange={() => toggle(p.project_id)}
                data-testid={`link-project-${p.project_id}`} className="accent-blue-600" />
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${RAG_DOT[p.status_rag] || "bg-zinc-300"}`} />
              <span className="truncate flex-1 text-xs">{p.name}</span>
              <span className="font-mono-data text-[10px] text-zinc-400 flex-shrink-0">{formatEuro(p.budget_total)}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-zinc-100">
          <span className="text-xs text-zinc-400">{selected.length} projet{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">Annuler</button>
            <button onClick={submit} disabled={saving} data-testid="link-projects-save"
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
              {saving ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent, testId }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4" data-testid={testId}>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">{label}</div>
      <div className={`font-heading text-2xl sm:text-3xl font-bold mt-2 ${accent || "text-zinc-950"}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Objectives() {
  const { user } = useAuth();
  const canWrite = ["TENANT_ADMIN", "PMO_USER"].includes(user?.role);
  const [objectives, setObjectives] = useState([]);
  const [alignment, setAlignment] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [linking, setLinking] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    Promise.all([objectivesAPI.list(), objectivesAPI.alignment(), projectsAPI.list()])
      .then(([oRes, aRes, pRes]) => {
        setObjectives(oRes.data);
        setAlignment(aRes.data);
        setProjects(pRes.data);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await objectivesAPI.delete(confirmDelete.objective_id);
      toast.success("Objectif supprimé");
      setConfirmDelete(null);
      load();
    } catch { toast.error("Erreur lors de la suppression"); }
    finally { setDeleting(false); }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-64 text-zinc-400 text-sm">Chargement des objectifs…</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="objectives-page">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[#8a87a0] mb-0.5">Accueil / <span className="text-[#352c6e] font-semibold">Objectifs stratégiques</span></div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#26243a] tracking-tight">Objectifs stratégiques</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Référentiel des objectifs DSI et alignement du portefeuille projets</p>
        </div>
        {canWrite && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }} data-testid="btn-new-objective"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={15} /> Nouvel objectif
          </button>
        )}
      </div>

      {/* KPIs alignement */}
      {alignment && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi label="Objectifs actifs" value={objectives.filter((o) => o.status === "actif").length}
            sub={`${objectives.length} au total`} testId="obj-kpi-active" />
          <Kpi label="Projets alignés" value={`${alignment.aligned_projects}/${alignment.total_projects}`}
            sub={`${alignment.alignment_pct}% du portefeuille`}
            accent={alignment.alignment_pct >= 80 ? "text-emerald-600" : alignment.alignment_pct >= 50 ? "text-amber-600" : "text-rose-600"}
            testId="obj-kpi-aligned" />
          <Kpi label="Budget aligné" value={`${alignment.budget_alignment_pct}%`}
            sub={`${formatEuro(alignment.budget_aligned)} / ${formatEuro(alignment.budget_total)}`}
            accent={alignment.budget_alignment_pct >= 80 ? "text-emerald-600" : alignment.budget_alignment_pct >= 50 ? "text-amber-600" : "text-rose-600"}
            testId="obj-kpi-budget" />
          <Kpi label="Projets non alignés" value={alignment.unaligned.length}
            accent={alignment.unaligned.length > 0 ? "text-rose-600" : "text-emerald-600"}
            testId="obj-kpi-unaligned" />
        </div>
      )}

      {/* Objectifs */}
      <div className="space-y-3 mb-6">
        {objectives.length === 0 && (
          <div className="bg-white border border-zinc-200 rounded-lg p-10 text-center text-zinc-400 text-sm" data-testid="objectives-empty">
            Aucun objectif stratégique défini — créez le référentiel de la DSI pour mesurer l'alignement du portefeuille.
          </div>
        )}
        {objectives.map((o) => {
          const st = STATUSES.find((s) => s.value === o.status) || STATUSES[0];
          return (
            <div key={o.objective_id} className="bg-white border border-zinc-200 rounded-lg shadow-sm p-5" data-testid={`objective-card-${o.objective_id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-heading text-[15px] font-bold text-zinc-950" data-testid={`objective-title-${o.objective_id}`}>{o.title}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${st.cls}`}>{st.label}</span>
                    {o.pillar && <span className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-full text-[10px] font-semibold">{o.pillar}</span>}
                    {o.horizon && <span className="font-mono-data text-[10.5px] text-zinc-400">{o.horizon}</span>}
                  </div>
                  {o.description && <p className="text-xs text-zinc-500 mb-2 line-clamp-2">{o.description}</p>}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                    <span><b className="font-mono-data text-zinc-800">{o.project_count}</b> projet{o.project_count > 1 ? "s" : ""}</span>
                    <span>Budget <b className="font-mono-data text-zinc-800">{formatEuro(o.budget_total)}</b></span>
                    {o.owner && <span>Porteur : <b className="text-zinc-700">{o.owner}</b></span>}
                    {o.project_count > 0 && (
                      <span className="flex items-center gap-1.5">
                        {["green", "orange", "red"].map((c) => o.rag[c] > 0 && (
                          <span key={c} className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${RAG_DOT[c]}`} />
                            <span className="font-mono-data">{o.rag[c]}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  {(o.projects || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {o.projects.map((p) => (
                        <Link key={p.project_id} to={`/projects/${p.project_id}`}
                          className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded-full text-[10.5px] text-zinc-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                          <span className={`w-1.5 h-1.5 rounded-full ${RAG_DOT[p.status_rag] || "bg-zinc-300"}`} />
                          {(p.code ? `${p.code} · ` : "") + p.name.split("—")[0].trim().slice(0, 35)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setLinking(o)} data-testid={`btn-link-projects-${o.objective_id}`}
                      title="Rattacher des projets"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                      <Link2 size={12} /> Projets
                    </button>
                    <button onClick={() => { setEditing(o); setModalOpen(true); }} data-testid={`btn-edit-objective-${o.objective_id}`}
                      className="p-1.5 text-zinc-400 hover:text-blue-600 rounded-lg transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => setConfirmDelete(o)} data-testid={`btn-delete-objective-${o.objective_id}`}
                      className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg transition-colors"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Projets non alignés */}
      {alignment && alignment.unaligned.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm" data-testid="unaligned-section">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100 text-xs uppercase tracking-widest text-zinc-500 font-semibold">
            <AlertTriangle size={13} className="text-amber-500" />
            Projets sans objectif stratégique ({alignment.unaligned.length})
          </div>
          <div className="divide-y divide-zinc-50">
            {alignment.unaligned.map((p) => (
              <div key={p.project_id} className="flex items-center justify-between px-5 py-2.5" data-testid={`unaligned-project-${p.project_id}`}>
                <Link to={`/projects/${p.project_id}`} className="text-xs text-blue-600 hover:underline font-medium truncate">
                  {(p.code ? `${p.code} — ` : "") + p.name}
                </Link>
                <span className="font-mono-data text-[11px] text-zinc-400 flex-shrink-0">{formatEuro(p.budget_total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <ObjectiveModal objective={editing} onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); load(); }} />
      )}
      {linking && (
        <LinkProjectsModal objective={linking} projects={projects}
          onClose={() => setLinking(null)}
          onSaved={() => { setLinking(null); load(); }} />
      )}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Supprimer l'objectif"
        message={`Supprimer l'objectif "${confirmDelete?.title}" ? Les projets rattachés seront détachés.`}
      />
    </div>
  );
}
