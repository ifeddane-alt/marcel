import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Rocket, Snowflake } from "lucide-react";
import { runAPI, applicationsAPI, projectsAPI } from "@/api";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";

const inputCls = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue";
const labelCls = "block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5";
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const REL_ST = {
  planifiee: { label: "Planifiée", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  livree: { label: "Livrée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  annulee: { label: "Annulée", cls: "bg-zinc-50 text-zinc-400 border-zinc-200" },
};

function ReleaseModal({ apps, projects, onClose, onSave }) {
  const [form, setForm] = useState({ name: "", date: "", end_date: "", type: "mep", application_id: "", project_id: "", comment: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, application_id: form.application_id || null, project_id: form.project_id || null, end_date: form.end_date || null });
    } catch { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="release-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-heading text-lg font-bold text-zinc-950">Nouvelle MEP / période de gel</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Libellé *</label>
              <input value={form.name} onChange={set("name")} required data-testid="release-name-input" className={inputCls}
                placeholder="Ex : MEP CRM v2.4" />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={set("type")} data-testid="release-type-select" className={`${inputCls} bg-white`}>
                <option value="mep">MEP</option>
                <option value="gel">Période de gel</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{form.type === "gel" ? "Début du gel *" : "Date *"}</label>
              <input type="date" value={form.date} onChange={set("date")} required data-testid="release-date-input" className={inputCls} />
            </div>
            {form.type === "gel" && (
              <div>
                <label className={labelCls}>Fin du gel</label>
                <input type="date" value={form.end_date} onChange={set("end_date")} data-testid="release-end-date-input" className={inputCls} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Application</label>
              <select value={form.application_id} onChange={set("application_id")} data-testid="release-app-select" className={`${inputCls} bg-white`}>
                <option value="">—</option>
                {apps.map((a) => <option key={a.application_id} value={a.application_id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Projet lié</label>
              <select value={form.project_id} onChange={set("project_id")} data-testid="release-project-select" className={`${inputCls} bg-white`}>
                <option value="">—</option>
                {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">Annuler</button>
            <button type="submit" disabled={saving} data-testid="release-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark disabled:opacity-60">
              {saving ? "..." : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RunReleasesTab({ canWrite }) {
  const [releases, setReleases] = useState([]);
  const [apps, setApps] = useState([]);
  const [projects, setProjects] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => { runAPI.releases().then((r) => setReleases(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    load();
    applicationsAPI.list().then((r) => setApps(r.data)).catch(() => {});
    projectsAPI.list().then((r) => setProjects(r.data)).catch(() => {});
  }, [load]);

  const save = async (data) => {
    await runAPI.createRelease(data);
    toast.success(data.type === "gel" ? "Période de gel créée" : "MEP planifiée");
    setModalOpen(false);
    load();
  };
  const setStatus = async (rel, status) => {
    await runAPI.updateRelease(rel.release_id, { status });
    load();
  };
  const del = async () => {
    await runAPI.deleteRelease(confirmDelete.release_id);
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]" data-testid="run-releases-tab">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
        <div className="font-heading text-[13px] font-bold text-m-ink">Calendrier des MEP &amp; gels ({releases.length})</div>
        {canWrite && (
          <button onClick={() => setModalOpen(true)} data-testid="btn-new-release"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-m-blue text-white text-xs font-semibold rounded-lg hover:bg-m-blue-dark">
            <Plus size={12} /> Nouvelle MEP / gel
          </button>
        )}
      </div>
      {releases.length === 0 ? (
        <div className="px-5 py-10 text-sm text-zinc-400 text-center" data-testid="releases-empty">Aucune MEP planifiée.</div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {releases.map((r) => (
            <div key={r.release_id} className="flex items-center gap-3 px-5 py-2.5 flex-wrap" data-testid={`release-row-${r.release_id}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${r.type === "gel" ? "bg-sky-50 text-sky-600" : "bg-m-lilac text-m-primary"}`}>
                {r.type === "gel" ? <Snowflake size={13} /> : <Rocket size={13} />}
              </span>
              <div className="flex-1 min-w-[160px]">
                <div className="text-xs font-semibold text-zinc-800">{r.name}</div>
                <div className="text-[10px] text-zinc-400">
                  {r.application_name || ""}{r.application_name && r.project_name ? " · " : ""}{r.project_name || ""}
                </div>
              </div>
              <span className="font-mono-data text-xs text-zinc-600 whitespace-nowrap">
                {fmtDate(r.date)}{r.end_date ? ` → ${fmtDate(r.end_date)}` : ""}
              </span>
              {r.type !== "gel" && (
                canWrite ? (
                  <select value={r.status || "planifiee"} onChange={(e) => setStatus(r, e.target.value)}
                    data-testid={`release-status-${r.release_id}`}
                    className="text-[10px] font-bold border border-zinc-200 rounded-lg px-1.5 py-1 bg-white focus:outline-none">
                    {Object.entries(REL_ST).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                ) : (
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${REL_ST[r.status]?.cls || ""}`}>{REL_ST[r.status]?.label || r.status}</span>
                )
              )}
              {canWrite && (
                <button onClick={() => setConfirmDelete(r)} className="p-1 text-zinc-300 hover:text-rose-500"><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {modalOpen && <ReleaseModal apps={apps} projects={projects} onClose={() => setModalOpen(false)} onSave={save} />}
      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={del}
        title="Supprimer" message={`Supprimer "${confirmDelete?.name}" ?`} />
    </div>
  );
}
