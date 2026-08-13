import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Plus, AlertTriangle, Link2, X, AppWindow } from "lucide-react";
import { applicationsAPI, projectsAPI } from "@/api";
import { toast } from "sonner";
import { formatEuro } from "@/utils/format";
import { usePermissions } from "@/hooks/usePermissions";
import ConfirmDialog from "@/components/ConfirmDialog";
import ApplicationModal, { APP_STATUSES, APP_STATUS_CFG, TIME_RATINGS, TIME_CFG, CRITICALITIES, CRIT_CFG } from "@/components/ApplicationModal";

const label = (list, v) => list.find((x) => x.value === v)?.label || v || "—";
const OBS_CFG = {
  obsolete: { cls: "bg-rose-50 text-rose-700 border-rose-200", label: "Obsolète" },
  fin_proche: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Fin de support < 6 mois" },
  ok: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Supporté" },
};

function Info({ label: l, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-0.5">{l}</div>
      <div className="text-sm text-zinc-800 font-medium">{children || "—"}</div>
    </div>
  );
}

function ProjectLinkModal({ app, onClose, onSave }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(new Set(app.project_ids || []));
  const [saving, setSaving] = useState(false);
  useEffect(() => { projectsAPI.list().then((r) => setProjects(r.data)); }, []);
  const toggle = (pid) => setSelected((s) => { const n = new Set(s); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  const submit = async () => {
    setSaving(true);
    try { await onSave([...selected]); } catch { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="project-link-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
          <h2 className="font-heading text-base font-bold text-zinc-950">Projets impactant l'application</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {projects.map((p) => (
            <label key={p.project_id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-50 cursor-pointer" data-testid={`link-project-${p.project_id}`}>
              <input type="checkbox" checked={selected.has(p.project_id)} onChange={() => toggle(p.project_id)} className="accent-blue-600" />
              <span className="text-sm text-zinc-700 font-medium flex-1 truncate">{p.name}</span>
              {p.code && <span className="font-mono-data text-[10px] text-zinc-400">{p.code}</span>}
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">Annuler</button>
          <button onClick={submit} disabled={saving} data-testid="project-link-save-btn"
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasAnyPermission } = usePermissions();
  const canWrite = hasAnyPermission("*", "portfolio.edit", "projects.create", "projects.edit");
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newComp, setNewComp] = useState({ name: "", version: "", support_end: "" });

  const load = useCallback(() => {
    applicationsAPI.get(id)
      .then((r) => { setApp(r.data); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (data) => {
    await applicationsAPI.update(id, data);
    toast.success("Application mise à jour");
    setEditOpen(false);
    load();
  };
  const handleDelete = async () => {
    await applicationsAPI.delete(id);
    toast.success("Application supprimée");
    navigate("/applications");
  };
  const addComponent = async (e) => {
    e.preventDefault();
    if (!newComp.name.trim()) return;
    const comps = [...(app.components || []), { ...newComp }];
    await applicationsAPI.update(id, { components: comps.map(({ obsolescence, ...c }) => c) });
    setNewComp({ name: "", version: "", support_end: "" });
    toast.success("Composant ajouté");
    load();
  };
  const removeComponent = async (idx) => {
    const comps = (app.components || []).filter((_, i) => i !== idx).map(({ obsolescence, ...c }) => c);
    await applicationsAPI.update(id, { components: comps });
    load();
  };
  const handleSetProjects = async (ids) => {
    await applicationsAPI.setProjects(id, ids);
    toast.success("Projets liés mis à jour");
    setLinkOpen(false);
    load();
  };

  if (loading) return <div className="p-8 text-sm text-zinc-400">Chargement…</div>;
  if (!app) return <div className="p-8 text-sm text-zinc-400">Application introuvable. <Link to="/applications" className="text-blue-600">Retour</Link></div>;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="application-detail-page">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link to="/applications" className="flex items-center gap-1 hover:text-blue-600" data-testid="back-to-applications">
          <ArrowLeft size={13} /> Portefeuille Applicatif
        </Link>
      </div>

      <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {app.code && <span className="font-mono-data text-xs font-bold text-[#8a87a0]">{app.code}</span>}
              <h1 className="font-heading text-xl md:text-2xl font-extrabold text-[#26243a] flex items-center gap-2">
                <AppWindow size={20} className="text-[#352c6e]" /> {app.name}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${APP_STATUS_CFG[app.status]}`}>{label(APP_STATUSES, app.status)}</span>
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${CRIT_CFG[app.criticality] || CRIT_CFG.basse}`}>Criticité {label(CRITICALITIES, app.criticality)}</span>
              {app.time_rating && <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${TIME_CFG[app.time_rating]}`}>{label(TIME_RATINGS, app.time_rating)}</span>}
            </div>
            {app.description && <p className="text-sm text-zinc-500 mt-2 max-w-2xl">{app.description}</p>}
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditOpen(true)} data-testid="btn-edit-application"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
                <Pencil size={12} /> Modifier
              </button>
              <button onClick={() => setConfirmDelete(true)} data-testid="btn-delete-application"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors">
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-zinc-100">
          <Info label="Éditeur">{app.editor}</Info>
          <Info label="Technologie">{app.technology}</Info>
          <Info label="Hébergement">{{ on_premise: "On-premise", cloud: "Cloud", saas: "SaaS", hybride: "Hybride" }[app.hosting] || "—"}</Info>
          <Info label="Sensibilité données">{{ publique: "Publique", interne: "Interne", confidentielle: "Confidentielle", reglementee: "Réglementée" }[app.data_sensitivity] || "—"}</Info>
          <Info label="Owner métier">{app.business_owner}</Info>
          <Info label="Owner IT">{app.it_owner}</Info>
          <Info label="Utilisateurs">{app.users_count != null ? app.users_count.toLocaleString("fr-FR") : "—"}</Info>
          <Info label="TCO annuel (run)">{app.tco_annual ? formatEuro(app.tco_annual) : "—"}</Info>
        </div>
        {(app.business_capabilities || []).length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-100">
            <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-1.5">Capacités métiers couvertes</div>
            <div className="flex flex-wrap gap-1.5">
              {app.business_capabilities.map((c) => (
                <span key={c} className="px-2 py-0.5 text-[11px] font-medium text-[#352c6e] bg-[#f0eefc] rounded-lg">{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composants & obsolescence */}
      <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]" data-testid="components-section">
        <div className="px-5 py-3 border-b border-zinc-100 font-heading text-[13px] font-bold text-[#26243a]">
          Composants techniques &amp; obsolescence ({(app.components || []).length})
        </div>
        {(app.components || []).length === 0 ? (
          <div className="px-5 py-6 text-sm text-zinc-400 text-center">Aucun composant — ajoutez les briques techniques pour suivre leur fin de support.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#fbfaff] border-b border-[#e8e6f0] text-left">
                {["Composant", "Version", "Fin de support", "Statut", ""].map((h) => (
                  <th key={h} className="px-4 py-2 text-[10.5px] uppercase tracking-wider font-bold text-[#8a87a0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {app.components.map((c, i) => {
                const obs = OBS_CFG[c.obsolescence] || OBS_CFG.ok;
                return (
                  <tr key={i} className="border-b border-zinc-100" data-testid={`component-row-${i}`}>
                    <td className="px-4 py-2 text-xs font-medium text-zinc-800">{c.name}</td>
                    <td className="px-4 py-2 font-mono-data text-xs text-zinc-600">{c.version || "—"}</td>
                    <td className="px-4 py-2 font-mono-data text-xs text-zinc-600">{c.support_end || "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded-lg border ${obs.cls}`}>
                        {c.obsolescence !== "ok" && <AlertTriangle size={9} />} {obs.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canWrite && (
                        <button onClick={() => removeComponent(i)} data-testid={`btn-remove-component-${i}`}
                          className="p-1 text-zinc-300 hover:text-rose-500 transition-colors"><Trash2 size={12} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {canWrite && (
          <form onSubmit={addComponent} className="flex items-center gap-2 px-4 py-3 border-t border-zinc-100 flex-wrap">
            <input value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} placeholder="Composant (ex : Oracle DB)"
              data-testid="component-name-input" className="flex-1 min-w-[140px] text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-600" />
            <input value={newComp.version} onChange={(e) => setNewComp({ ...newComp, version: e.target.value })} placeholder="Version"
              data-testid="component-version-input" className="w-24 text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-600" />
            <input type="date" value={newComp.support_end} onChange={(e) => setNewComp({ ...newComp, support_end: e.target.value })}
              data-testid="component-support-end-input" className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-600" />
            <button type="submit" data-testid="btn-add-component"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={11} /> Ajouter
            </button>
          </form>
        )}
      </div>

      {/* Projets liés */}
      <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]" data-testid="linked-projects-section">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <div className="font-heading text-[13px] font-bold text-[#26243a]">Projets impactant l'application ({(app.projects || []).length})</div>
          {canWrite && (
            <button onClick={() => setLinkOpen(true)} data-testid="btn-link-projects"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
              <Link2 size={11} /> Lier des projets
            </button>
          )}
        </div>
        {(app.projects || []).length === 0 ? (
          <div className="px-5 py-6 text-sm text-zinc-400 text-center">Aucun projet lié.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {app.projects.map((p) => (
              <Link key={p.project_id} to={`/projects/${p.project_id}`}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50/70 transition-colors" data-testid={`linked-project-${p.project_id}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status_rag === "green" ? "bg-emerald-500" : p.status_rag === "orange" ? "bg-amber-500" : p.status_rag === "red" ? "bg-rose-500" : "bg-zinc-300"}`} />
                <span className="text-sm font-medium text-zinc-700 flex-1 truncate">{p.name}</span>
                {p.code && <span className="font-mono-data text-[10px] text-zinc-400">{p.code}</span>}
                <span className="font-mono-data text-xs text-zinc-500">{p.budget_total ? formatEuro(p.budget_total) : ""}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {editOpen && <ApplicationModal app={app} onClose={() => setEditOpen(false)} onSave={handleUpdate} />}
      {linkOpen && <ProjectLinkModal app={app} onClose={() => setLinkOpen(false)} onSave={handleSetProjects} />}
      <ConfirmDialog isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={handleDelete}
        title="Supprimer l'application" message={`Supprimer "${app.name}" du référentiel applicatif ?`} />
    </div>
  );
}
