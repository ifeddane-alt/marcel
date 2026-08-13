import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, CheckCircle2, XCircle } from "lucide-react";
import { runAPI, applicationsAPI } from "@/api";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";

const SEV_CFG = {
  P1: "bg-rose-50 text-rose-700 border-rose-200",
  P2: "bg-amber-50 text-amber-700 border-amber-200",
  P3: "bg-blue-50 text-blue-700 border-blue-200",
  P4: "bg-zinc-50 text-zinc-500 border-zinc-200",
};
const ST_CFG = {
  ouvert: { label: "Ouvert", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  en_cours: { label: "En cours", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  resolu: { label: "Résolu", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
const inputCls = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600";
const labelCls = "block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5";
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

function IncidentModal({ incident, apps, onClose, onSave }) {
  const [form, setForm] = useState({
    title: incident?.title || "",
    application_id: incident?.application_id || "",
    severity: incident?.severity || "P3",
    status: incident?.status || "ouvert",
    sla_target_hours: incident?.sla_target_hours ?? "",
    description: incident?.description || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, application_id: form.application_id || null,
        sla_target_hours: form.sla_target_hours === "" ? null : parseFloat(form.sla_target_hours) });
    } catch { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="incident-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-heading text-lg font-bold text-zinc-950">{incident ? "Modifier l'incident" : "Nouvel incident"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Titre *</label>
            <input value={form.title} onChange={set("title")} required data-testid="incident-title-input" className={inputCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Application</label>
              <select value={form.application_id} onChange={set("application_id")} data-testid="incident-app-select" className={`${inputCls} bg-white`}>
                <option value="">—</option>
                {apps.map((a) => <option key={a.application_id} value={a.application_id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sévérité</label>
              <select value={form.severity} onChange={set("severity")} data-testid="incident-severity-select" className={`${inputCls} bg-white`}>
                {["P1", "P2", "P3", "P4"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Statut</label>
              <select value={form.status} onChange={set("status")} data-testid="incident-status-select" className={`${inputCls} bg-white`}>
                {Object.entries(ST_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>SLA cible (heures)</label>
              <input type="number" min="0" step="any" value={form.sla_target_hours} onChange={set("sla_target_hours")}
                data-testid="incident-sla-input" className={`${inputCls} font-mono-data`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={set("description")} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">Annuler</button>
            <button type="submit" disabled={saving} data-testid="incident-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? "..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RunIncidentsTab({ canWrite, onChanged }) {
  const [incidents, setIncidents] = useState([]);
  const [apps, setApps] = useState([]);
  const [modal, setModal] = useState(null); // null | {incident?}
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    runAPI.incidents().then((r) => setIncidents(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    applicationsAPI.list().then((r) => setApps(r.data)).catch(() => {});
  }, [load]);

  const save = async (data) => {
    if (modal?.incident) {
      await runAPI.updateIncident(modal.incident.incident_id, data);
      toast.success("Incident mis à jour");
    } else {
      await runAPI.createIncident(data);
      toast.success("Incident créé");
    }
    setModal(null);
    load();
    onChanged?.();
  };
  const del = async () => {
    await runAPI.deleteIncident(confirmDelete.incident_id);
    toast.success("Incident supprimé");
    setConfirmDelete(null);
    load();
    onChanged?.();
  };

  return (
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]" data-testid="run-incidents-tab">
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
        <div className="font-heading text-[13px] font-bold text-[#26243a]">Incidents &amp; SLA ({incidents.length})</div>
        {canWrite && (
          <button onClick={() => setModal({})} data-testid="btn-new-incident"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
            <Plus size={12} /> Nouvel incident
          </button>
        )}
      </div>
      {incidents.length === 0 ? (
        <div className="px-5 py-10 text-sm text-zinc-400 text-center" data-testid="incidents-empty">Aucun incident déclaré.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#fbfaff] border-b border-[#e8e6f0] text-left">
                {["Incident", "Application", "Sévérité", "Statut", "Ouvert le", "Résolu le", "SLA", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-[10.5px] uppercase tracking-wider font-bold text-[#8a87a0] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.incident_id} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`incident-row-${i.incident_id}`}>
                  <td className="px-3 py-2 text-xs font-medium text-zinc-800 max-w-[240px] truncate">{i.title}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{i.application_name || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-lg border ${SEV_CFG[i.severity] || SEV_CFG.P4}`}>{i.severity}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${ST_CFG[i.status]?.cls || ""}`}>{ST_CFG[i.status]?.label || i.status}</span>
                  </td>
                  <td className="px-3 py-2 font-mono-data text-xs text-zinc-500 whitespace-nowrap">{fmtDate(i.opened_at)}</td>
                  <td className="px-3 py-2 font-mono-data text-xs text-zinc-500 whitespace-nowrap">{fmtDate(i.resolved_at)}</td>
                  <td className="px-3 py-2">
                    {i.sla_met === true && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600"><CheckCircle2 size={11} /> Tenu</span>}
                    {i.sla_met === false && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600"><XCircle size={11} /> Dépassé</span>}
                    {i.sla_met == null && <span className="text-zinc-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {canWrite && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setModal({ incident: i })} data-testid={`btn-edit-incident-${i.incident_id}`}
                          className="p-1 text-zinc-400 hover:text-blue-600"><Pencil size={12} /></button>
                        <button onClick={() => setConfirmDelete(i)} className="p-1 text-zinc-400 hover:text-rose-500"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <IncidentModal incident={modal.incident} apps={apps} onClose={() => setModal(null)} onSave={save} />}
      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={del}
        title="Supprimer l'incident" message={`Supprimer "${confirmDelete?.title}" ?`} />
    </div>
  );
}
