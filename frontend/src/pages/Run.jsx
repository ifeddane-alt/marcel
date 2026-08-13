import React, { useState, useEffect, useCallback } from "react";
import { ServerCog, Plus, Pencil, Trash2, X, Euro, AlertTriangle, Gauge, PieChart, Users } from "lucide-react";
import { runAPI, applicationsAPI, teamsAPI, resourcesAPI } from "@/api";
import { toast } from "sonner";
import { formatEuro } from "@/utils/format";
import { usePermissions } from "@/hooks/usePermissions";
import ConfirmDialog from "@/components/ConfirmDialog";
import RunChargeTab from "@/components/RunChargeTab";
import RunIncidentsTab from "@/components/RunIncidentsTab";
import RunReleasesTab from "@/components/RunReleasesTab";

export const ACTIVITY_TYPES = [
  { value: "mco", label: "MCO" },
  { value: "support", label: "Support" },
  { value: "supervision", label: "Supervision" },
  { value: "maintenance_corrective", label: "Maint. corrective" },
  { value: "maintenance_evolutive", label: "Maint. évolutive" },
  { value: "patching", label: "Patching" },
  { value: "sauvegardes", label: "Sauvegardes" },
  { value: "astreinte", label: "Astreinte" },
  { value: "autre", label: "Autre" },
];
const inputCls = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600";
const labelCls = "block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5";
const tLabel = (v) => ACTIVITY_TYPES.find((t) => t.value === v)?.label || v;

function ActivityModal({ activity, apps, teams, onClose, onSave }) {
  const [form, setForm] = useState({
    name: activity?.name || "",
    type: activity?.type || "mco",
    application_id: activity?.application_id || "",
    team_id: activity?.team_id || "",
    owner: activity?.owner || "",
    recurrence: activity?.recurrence || "continue",
    status: activity?.status || "active",
    budget_annual: activity?.budget_annual ?? "",
    budget_consumed: activity?.budget_consumed ?? "",
    description: activity?.description || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        application_id: form.application_id || null,
        team_id: form.team_id || null,
        budget_annual: form.budget_annual === "" ? null : parseFloat(form.budget_annual),
        budget_consumed: form.budget_consumed === "" ? null : parseFloat(form.budget_consumed),
      });
    } catch { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="activity-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-heading text-lg font-bold text-zinc-950">{activity ? "Modifier l'activité" : "Nouvelle activité de run"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nom *</label>
              <input value={form.name} onChange={set("name")} required data-testid="activity-name-input"
                placeholder="Ex : MCO ERP SAP" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={set("type")} data-testid="activity-type-select" className={`${inputCls} bg-white`}>
                {ACTIVITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Application</label>
              <select value={form.application_id} onChange={set("application_id")} data-testid="activity-app-select" className={`${inputCls} bg-white`}>
                <option value="">—</option>
                {apps.map((a) => <option key={a.application_id} value={a.application_id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Équipe</label>
              <select value={form.team_id} onChange={set("team_id")} data-testid="activity-team-select" className={`${inputCls} bg-white`}>
                <option value="">—</option>
                {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Responsable</label>
              <input value={form.owner} onChange={set("owner")} data-testid="activity-owner-input" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Récurrence</label>
              <select value={form.recurrence} onChange={set("recurrence")} className={`${inputCls} bg-white`}>
                <option value="continue">Continue</option>
                <option value="mensuelle">Mensuelle</option>
                <option value="trimestrielle">Trimestrielle</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Budget annuel (€)</label>
              <input type="number" min="0" step="any" value={form.budget_annual} onChange={set("budget_annual")}
                data-testid="activity-budget-input" className={`${inputCls} font-mono-data`} />
            </div>
            <div>
              <label className={labelCls}>Consommé (€)</label>
              <input type="number" min="0" step="any" value={form.budget_consumed} onChange={set("budget_consumed")}
                data-testid="activity-consumed-input" className={`${inputCls} font-mono-data`} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={set("description")} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">Annuler</button>
            <button type="submit" disabled={saving} data-testid="activity-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? "..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AllocationModal({ activity, resources, onClose, onSaved }) {
  const [allocs, setAllocs] = useState(null);
  const [newRow, setNewRow] = useState({ resource_id: "", month: "", days_allocated: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    runAPI.getAllocations(activity.activity_id).then((r) => setAllocs(r.data)).catch(() => setAllocs([]));
  }, [activity.activity_id]);
  const addRow = (e) => {
    e.preventDefault();
    if (!newRow.resource_id || !newRow.month || !newRow.days_allocated) return;
    const rn = resources.find((r) => r.resource_id === newRow.resource_id)?.name || "?";
    setAllocs((a) => [...a, { ...newRow, days_allocated: parseFloat(newRow.days_allocated), month: `${newRow.month}-01`, resource_name: rn }]);
    setNewRow({ resource_id: "", month: "", days_allocated: "" });
  };
  const save = async () => {
    setSaving(true);
    try {
      await runAPI.setAllocations(activity.activity_id, allocs.map((a) => ({
        resource_id: a.resource_id, month: a.month, days_allocated: a.days_allocated,
      })));
      toast.success("Allocations run enregistrées");
      onSaved();
    } catch { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="run-allocation-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
          <h2 className="font-heading text-base font-bold text-zinc-950">Ressources — {activity.name}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {allocs === null ? (
            <div className="text-sm text-zinc-400">Chargement…</div>
          ) : allocs.length === 0 ? (
            <div className="text-sm text-zinc-400 text-center py-4">Aucune ressource allouée à cette activité.</div>
          ) : (
            <div className="space-y-1">
              {allocs.map((a, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#fbfaff] border border-[#e8e6f0]" data-testid={`run-alloc-row-${i}`}>
                  <span className="text-xs font-medium text-zinc-700 flex-1 truncate">{a.resource_name}</span>
                  <span className="font-mono-data text-[11px] text-zinc-500">{String(a.month).slice(0, 7)}</span>
                  <span className="font-mono-data text-xs font-bold text-zinc-700">{a.days_allocated} JH</span>
                  <button onClick={() => setAllocs((x) => x.filter((_, j) => j !== i))}
                    className="p-0.5 text-zinc-300 hover:text-rose-500"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={addRow} className="flex items-center gap-2 mt-3 flex-wrap">
            <select value={newRow.resource_id} onChange={(e) => setNewRow({ ...newRow, resource_id: e.target.value })}
              data-testid="run-alloc-resource-select"
              className="flex-1 min-w-[130px] text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-600">
              <option value="">Ressource…</option>
              {resources.map((r) => <option key={r.resource_id} value={r.resource_id}>{r.name}</option>)}
            </select>
            <input type="month" value={newRow.month} onChange={(e) => setNewRow({ ...newRow, month: e.target.value })}
              data-testid="run-alloc-month-input"
              className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-600" />
            <input type="number" min="0.5" step="0.5" value={newRow.days_allocated} placeholder="JH"
              onChange={(e) => setNewRow({ ...newRow, days_allocated: e.target.value })}
              data-testid="run-alloc-days-input"
              className="w-16 text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-600 font-mono-data" />
            <button type="submit" data-testid="run-alloc-add-btn"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
              <Plus size={11} /> Ajouter
            </button>
          </form>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">Annuler</button>
          <button onClick={save} disabled={saving || allocs === null} data-testid="run-alloc-save-btn"
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, accent, testId }) {
  return (
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4 flex items-center gap-3" data-testid={testId}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent || "bg-[#f0eefc] text-[#352c6e]"}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{label}</div>
        <div className="font-mono-data font-bold text-lg text-zinc-950 truncate">{value}</div>
        {sub && <div className="text-[10px] text-zinc-400">{sub}</div>}
      </div>
    </div>
  );
}

const TABS = [
  { id: "activites", label: "Activités" },
  { id: "charge", label: "Charge Build + Run" },
  { id: "incidents", label: "Incidents & SLA" },
  { id: "mep", label: "MEP & gels" },
];

export default function Run() {
  const { hasAnyPermission } = usePermissions();
  const canWrite = hasAnyPermission("*", "portfolio.edit", "projects.create", "projects.edit");
  const [tab, setTab] = useState("activites");
  const [summary, setSummary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [apps, setApps] = useState([]);
  const [teams, setTeams] = useState([]);
  const [resources, setResources] = useState([]);
  const [actModal, setActModal] = useState(null);
  const [allocModal, setAllocModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    runAPI.summary().then((r) => setSummary(r.data)).catch(() => {});
    runAPI.activities().then((r) => setActivities(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    applicationsAPI.list().then((r) => setApps(r.data)).catch(() => {});
    teamsAPI.list().then((r) => setTeams(r.data)).catch(() => {});
    resourcesAPI.list().then((r) => setResources(r.data)).catch(() => {});
  }, [load]);

  const saveActivity = async (data) => {
    if (actModal?.activity) {
      await runAPI.updateActivity(actModal.activity.activity_id, data);
      toast.success("Activité mise à jour");
    } else {
      await runAPI.createActivity(data);
      toast.success("Activité créée");
    }
    setActModal(null);
    load();
  };
  const delActivity = async () => {
    await runAPI.deleteActivity(confirmDelete.activity_id);
    toast.success("Activité supprimée");
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="run-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-extrabold text-[#26243a] flex items-center gap-2">
            <ServerCog size={20} className="text-[#352c6e]" /> Run &amp; Exploitation
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Activités récurrentes, budget run, charge consolidée, incidents et MEP</p>
        </div>
        {canWrite && tab === "activites" && (
          <button onClick={() => setActModal({})} data-testid="btn-new-activity"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
            <Plus size={13} /> Nouvelle activité
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Budget run annuel" value={formatEuro(summary?.budget_run_annual || 0)}
          sub={`consommé : ${formatEuro(summary?.budget_run_consumed || 0)}`} icon={Euro} testId="run-kpi-budget" />
        <Kpi label="Ratio run / (run+build)" value={`${summary?.run_ratio_pct ?? 0}%`} icon={PieChart} testId="run-kpi-ratio" />
        <Kpi label="Incidents ouverts" value={summary?.incidents_open ?? 0}
          sub={summary?.incidents_p1_open ? `dont ${summary.incidents_p1_open} P1` : undefined}
          icon={AlertTriangle} accent={summary?.incidents_p1_open > 0 ? "bg-rose-50 text-rose-600" : undefined} testId="run-kpi-incidents" />
        <Kpi label="SLA respecté" value={summary?.sla_met_pct != null ? `${summary.sla_met_pct}%` : "—"} icon={Gauge} testId="run-kpi-sla" />
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`run-tab-${t.id}`}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t.id ? "bg-blue-600 text-white" : "text-zinc-500 border border-zinc-200 hover:bg-zinc-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "activites" && (
        <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-x-auto" data-testid="run-activities-tab">
          {activities.length === 0 ? (
            <div className="px-5 py-12 text-sm text-zinc-400 text-center" data-testid="activities-empty">
              Aucune activité de run — créez le catalogue des activités récurrentes de la DSI (MCO, support, supervision…).
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fbfaff] border-b border-[#e8e6f0] text-left">
                  {["Activité", "Application", "Équipe", "Budget annuel", "Consommé", "JH alloués", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[10.5px] uppercase tracking-wider font-bold text-[#8a87a0] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => {
                  const pct = a.budget_annual > 0 ? Math.min(Math.round((a.budget_consumed || 0) / a.budget_annual * 100), 999) : null;
                  return (
                    <tr key={a.activity_id} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`activity-row-${a.activity_id}`}>
                      <td className="px-3 py-2.5">
                        <div className="text-xs font-semibold text-zinc-800">{a.name}</div>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border bg-[#f0eefc] text-[#352c6e] border-[#e0dcf5]">
                          {tLabel(a.type)}
                        </span>
                        {a.status === "suspendue" && <span className="ml-1 text-[9px] text-amber-600 font-bold">SUSPENDUE</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-zinc-500">{a.application_name || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-zinc-500">{a.team_name || "—"}</td>
                      <td className="px-3 py-2.5 font-mono-data text-xs text-zinc-700 whitespace-nowrap">{a.budget_annual ? formatEuro(a.budget_annual) : "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-mono-data text-xs text-zinc-700">{a.budget_consumed ? formatEuro(a.budget_consumed) : "—"}</span>
                        {pct !== null && (
                          <span className={`ml-1.5 font-mono-data text-[10px] font-bold ${pct > 100 ? "text-rose-600" : pct > 85 ? "text-amber-600" : "text-zinc-400"}`}>{pct}%</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => canWrite && setAllocModal(a)} data-testid={`btn-allocations-${a.activity_id}`}
                          className={`inline-flex items-center gap-1 font-mono-data text-xs font-bold text-zinc-700 ${canWrite ? "hover:text-blue-600" : ""}`}>
                          <Users size={11} className="text-zinc-400" /> {a.allocated_jh || 0} JH
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        {canWrite && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setActModal({ activity: a })} data-testid={`btn-edit-activity-${a.activity_id}`}
                              className="p-1 text-zinc-400 hover:text-blue-600"><Pencil size={12} /></button>
                            <button onClick={() => setConfirmDelete(a)} className="p-1 text-zinc-400 hover:text-rose-500"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "charge" && <RunChargeTab />}
      {tab === "incidents" && <RunIncidentsTab canWrite={canWrite} onChanged={load} />}
      {tab === "mep" && <RunReleasesTab canWrite={canWrite} />}

      {actModal && <ActivityModal activity={actModal.activity} apps={apps} teams={teams}
        onClose={() => setActModal(null)} onSave={saveActivity} />}
      {allocModal && <AllocationModal activity={allocModal} resources={resources}
        onClose={() => setAllocModal(null)} onSaved={() => { setAllocModal(null); load(); }} />}
      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={delActivity}
        title="Supprimer l'activité" message={`Supprimer "${confirmDelete?.name}" et ses allocations ?`} />
    </div>
  );
}
