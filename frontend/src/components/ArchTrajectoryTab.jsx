import React, { useCallback, useEffect, useState } from "react";
import { Map as MapIcon, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { trajectoryAPI } from "@/api";

const DISPOSITIONS = [
  { id: "conserver", label: "Conserver", color: "#3f8a34", bg: "#ddf0d8", desc: "Applications cibles, à maintenir" },
  { id: "moderniser", label: "Moderniser", color: "#2e5fe8", bg: "#e9effe", desc: "À faire évoluer / refondre" },
  { id: "remplacer", label: "Remplacer", color: "#b7791f", bg: "#fdf6e3", desc: "À substituer par une solution cible" },
  { id: "decommissionner", label: "Décommissionner", color: "#cc4f45", bg: "#fbe1de", desc: "À éteindre" },
];

export const ArchTrajectoryTab = ({ canWrite }) => {
  const [data, setData] = useState({ applications: [], milestones: [] });
  const [msForm, setMsForm] = useState({ title: "", date: "", application_id: "" });

  const load = useCallback(() => {
    trajectoryAPI.get().then((r) => setData(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const setDisposition = async (app, disposition) => {
    await trajectoryAPI.setDisposition(app.application_id, { disposition });
    toast.success(`${app.name} → ${DISPOSITIONS.find((d) => d.id === disposition)?.label}`);
    load();
  };

  const addMilestone = async () => {
    if (!msForm.title.trim() || !msForm.date) return;
    await trajectoryAPI.createMilestone(msForm);
    toast.success("Jalon de trajectoire ajouté");
    setMsForm({ title: "", date: "", application_id: "" });
    load();
  };

  const apps = data.applications || [];
  const unset = apps.filter((a) => !a.disposition);
  const appName = (id) => apps.find((a) => a.application_id === id)?.name;

  return (
    <div className="space-y-4" data-testid="trajectory-tab">
      <p className="text-xs text-m-muted">
        Trajectoire du SI (modèle TIME) : positionnez chaque application, puis jalonnez la route vers la cible. Revue en <b>Revue de trajectoire SI</b> annuelle.
      </p>

      {/* Board TIME */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {DISPOSITIONS.map((d) => {
          const items = apps.filter((a) => a.disposition === d.id);
          return (
            <div key={d.id} className="bg-white border border-m-border rounded-xl overflow-hidden" data-testid={`trajectory-col-${d.id}`}>
              <div className="px-3 py-2.5 border-b" style={{ backgroundColor: d.bg, borderColor: d.bg }}>
                <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: d.color }}>
                  {d.label} <span className="opacity-70">({items.length})</span>
                </p>
                <p className="text-[10px] opacity-80" style={{ color: d.color }}>{d.desc}</p>
              </div>
              <div className="p-2 space-y-1.5 min-h-[90px]">
                {items.map((a) => (
                  <AppCard key={a.application_id} app={a} canWrite={canWrite} onMove={setDisposition} current={d.id} />
                ))}
                {items.length === 0 && <p className="text-[11px] text-m-muted-2 px-1 py-3 text-center">—</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Non positionnées */}
      {unset.length > 0 && (
        <div className="bg-white border border-dashed border-m-border-strong rounded-xl p-3" data-testid="trajectory-unset">
          <p className="text-[10px] uppercase tracking-widest text-m-muted font-bold mb-2">Non positionnées ({unset.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {unset.map((a) => (
              <AppCard key={a.application_id} app={a} canWrite={canWrite} onMove={setDisposition} inline />
            ))}
          </div>
        </div>
      )}

      {/* Jalons de trajectoire */}
      <div className="bg-white border border-m-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-m-border-soft flex items-center gap-2">
          <MapIcon size={14} className="text-m-primary" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Jalons de trajectoire ({(data.milestones || []).length})</span>
        </div>
        <div className="divide-y divide-m-surface">
          {(data.milestones || []).map((m) => (
            <div key={m.milestone_id} className="px-4 py-2.5 flex items-center gap-3" data-testid={`trajectory-ms-${m.milestone_id}`}>
              <span className={`text-xs font-mono font-bold ${m.status === "fait" ? "text-m-green" : "text-m-blue"}`}>{m.date}</span>
              <span className={`flex-1 text-[13px] ${m.status === "fait" ? "text-m-muted line-through" : "text-m-ink font-semibold"}`}>
                {m.title}{m.application_id && appName(m.application_id) ? ` — ${appName(m.application_id)}` : ""}
              </span>
              {canWrite && (
                <span className="flex items-center gap-1">
                  {m.status !== "fait" && (
                    <button onClick={async () => { await trajectoryAPI.updateMilestone(m.milestone_id, { status: "fait" }); load(); }}
                      title="Marquer fait" data-testid={`trajectory-ms-done-${m.milestone_id}`}
                      className="p-1 text-m-green hover:bg-m-green-soft rounded"><Check size={13} /></button>
                  )}
                  <button onClick={async () => { await trajectoryAPI.deleteMilestone(m.milestone_id); load(); }}
                    data-testid={`trajectory-ms-delete-${m.milestone_id}`}
                    className="p-1 text-m-red hover:bg-m-red-soft rounded"><Trash2 size={13} /></button>
                </span>
              )}
            </div>
          ))}
          {(data.milestones || []).length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-m-muted" data-testid="trajectory-ms-empty">Aucun jalon — tracez la route vers la cible.</p>
          )}
        </div>
        {canWrite && (
          <div className="px-4 py-3 bg-m-bg border-t border-m-border-soft flex flex-wrap items-center gap-2">
            <input value={msForm.title} onChange={(e) => setMsForm({ ...msForm, title: e.target.value })}
              placeholder="Jalon (ex. Migration CRM vers Salesforce)" data-testid="trajectory-ms-title-input"
              className="h-9 flex-1 min-w-[200px] bg-white border-[1.5px] border-m-border-strong rounded-lg px-3 text-sm" />
            <input type="date" value={msForm.date} onChange={(e) => setMsForm({ ...msForm, date: e.target.value })}
              data-testid="trajectory-ms-date-input"
              className="h-9 bg-white border-[1.5px] border-m-border-strong rounded-lg px-2 text-sm" />
            <select value={msForm.application_id} onChange={(e) => setMsForm({ ...msForm, application_id: e.target.value })}
              data-testid="trajectory-ms-app-select"
              className="h-9 bg-white border-[1.5px] border-m-border-strong rounded-lg px-2 text-sm max-w-[180px]">
              <option value="">Application (opt.)</option>
              {apps.map((a) => <option key={a.application_id} value={a.application_id}>{a.name}</option>)}
            </select>
            <button onClick={addMilestone} data-testid="trajectory-ms-add-btn"
              className="flex items-center gap-1 h-9 px-3 bg-m-primary text-white text-sm font-bold rounded-lg hover:bg-m-primary-deep">
              <Plus size={14} /> Ajouter
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AppCard = ({ app, canWrite, onMove, current, inline }) => (
  <div className={`${inline ? "inline-flex" : "flex"} items-center gap-2 px-2.5 py-1.5 bg-m-bg border border-m-border-soft rounded-lg`}
    data-testid={`trajectory-app-${app.application_id}`}>
    <span className="text-[12px] font-semibold text-m-ink truncate max-w-[150px]" title={app.name}>{app.name}</span>
    {app.criticality && <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-m-lilac text-m-muted uppercase">{app.criticality}</span>}
    {canWrite && (
      <select value={current || ""} onChange={(e) => e.target.value && onMove(app, e.target.value)}
        data-testid={`trajectory-app-select-${app.application_id}`}
        className="text-[10px] bg-transparent border border-m-border-strong rounded px-1 py-0.5 text-m-ink-soft ml-auto">
        <option value="">Positionner…</option>
        {DISPOSITIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
    )}
  </div>
);
