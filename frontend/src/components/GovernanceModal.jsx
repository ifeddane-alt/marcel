import React, { useState } from "react";
import { Shield, Plus, Trash2, X } from "lucide-react";
import { governanceAPI } from "@/api";
import { toast } from "sonner";
import DateField from "@/components/ui/DateField";

const TYPES = [
  { value: "copil", label: "COPIL" },
  { value: "coproj", label: "COPROJ" },
  { value: "comex", label: "COMEX" },
  { value: "codir", label: "CODIR" },
  { value: "steering", label: "Steering Committee" },
  { value: "autre", label: "Autre" },
];
const STATUSES = [
  { value: "planifie", label: "Planifié" },
  { value: "tenu", label: "Tenu" },
  { value: "annule", label: "Annulé" },
];

function parseDateTime(iso) {
  if (!iso) return { date: "", time: "09:00" };
  return { date: iso.slice(0, 10), time: iso.length >= 16 ? iso.slice(11, 16) : "09:00" };
}

export default function GovernanceModal({ instance, projects, onClose, onSaved }) {
  const isEdit = !!instance;
  const init = parseDateTime(instance?.date_scheduled);
  const [name, setName] = useState(instance?.name || "");
  const [type, setType] = useState(instance?.type || "copil");
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [status, setStatus] = useState(instance?.status || "planifie");
  const [scope, setScope] = useState(instance?.projects_scope || []);
  const [attendees, setAttendees] = useState((instance?.attendees || []).join("\n"));
  const [agenda, setAgenda] = useState(
    (instance?.agenda || []).map((a) => ({ ...a })) // copie
  );
  const [notes, setNotes] = useState(instance?.minutes_notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleScope = (pid) =>
    setScope((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));

  const addAgendaItem = () => setAgenda((prev) => [...prev, { title: "", presenter: "", duration_min: "" }]);
  const updateAgendaItem = (i, field, val) =>
    setAgenda((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: val } : a)));
  const removeAgendaItem = (i) => setAgenda((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Le nom est obligatoire"); return; }
    if (!date) { setError("La date est obligatoire"); return; }
    setSaving(true);
    setError("");
    const payload = {
      name: name.trim(),
      type,
      date_scheduled: `${date}T${time || "09:00"}:00Z`,
      status,
      projects_scope: scope,
      attendees: attendees.split("\n").map((a) => a.trim()).filter(Boolean),
      agenda: agenda
        .filter((a) => (a.title || "").trim())
        .map((a) => ({ ...a, duration_min: parseInt(a.duration_min) || 0 })),
      minutes_notes: notes,
    };
    try {
      if (isEdit) {
        await governanceAPI.update(instance.governance_id, payload);
        toast.success("Instance mise à jour");
      } else {
        await governanceAPI.create(payload);
        toast.success("Instance créée");
      }
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la sauvegarde");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="instance-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-m-blue" />
            <h2 className="font-heading text-lg font-bold text-zinc-950">
              {isEdit ? "Modifier l'instance" : "Nouvelle instance de gouvernance"}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Nom de l'instance *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required data-testid="inst-name-input"
              placeholder="Ex : COPIL Mensuel Juillet 2026 — Portefeuille Projets"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} data-testid="inst-type-select"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue bg-white">
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Date *</label>
              <DateField value={date} onChange={setDate} required testId="inst-date-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Heure</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="inst-time-input"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue font-mono-data" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="inst-status-select"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue bg-white">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Ordre du jour */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Ordre du jour ({agenda.length})</label>
              <button type="button" onClick={addAgendaItem} data-testid="inst-agenda-add"
                className="flex items-center gap-1 text-[11px] font-semibold text-m-blue hover:text-m-blue-dark">
                <Plus size={11} /> Ajouter un point
              </button>
            </div>
            {agenda.length === 0 ? (
              <p className="text-xs text-zinc-400 italic border border-dashed border-zinc-200 rounded-lg px-3 py-3 text-center">
                Aucun point — ajoutez l'ordre du jour du comité.
              </p>
            ) : (
              <div className="space-y-2">
                {agenda.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono-data text-xs font-bold text-m-blue w-5 flex-shrink-0">{i + 1}.</span>
                    <input value={item.title} onChange={(e) => updateAgendaItem(i, "title", e.target.value)}
                      placeholder="Sujet" data-testid={`inst-agenda-title-${i}`}
                      className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-m-blue" />
                    <input value={item.presenter} onChange={(e) => updateAgendaItem(i, "presenter", e.target.value)}
                      placeholder="Intervenant" data-testid={`inst-agenda-presenter-${i}`}
                      className="w-32 text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-m-blue" />
                    <input type="number" min="0" value={item.duration_min} onChange={(e) => updateAgendaItem(i, "duration_min", e.target.value)}
                      placeholder="min" data-testid={`inst-agenda-duration-${i}`}
                      className="w-16 text-sm border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-m-blue font-mono-data" />
                    <button type="button" onClick={() => removeAgendaItem(i)} data-testid={`inst-agenda-remove-${i}`}
                      className="text-zinc-300 hover:text-rose-500 transition-colors flex-shrink-0"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">
                Projets en périmètre ({scope.length})
              </label>
              <div className="border border-zinc-200 rounded-lg max-h-36 overflow-y-auto divide-y divide-zinc-50">
                {projects.map((p) => (
                  <label key={p.project_id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 cursor-pointer">
                    <input type="checkbox" checked={scope.includes(p.project_id)} onChange={() => toggleScope(p.project_id)}
                      data-testid={`inst-scope-${p.project_id}`} className="accent-blue-600" />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Participants (un par ligne)</label>
              <textarea value={attendees} onChange={(e) => setAttendees(e.target.value)} rows={5} data-testid="inst-attendees-input"
                placeholder={"Ex :\nDSI — M. Dupont\nDirection Financière — Mme Martin"}
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue resize-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Compte-rendu / notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} data-testid="inst-notes-input"
              placeholder="Relevé de conclusions, points d'attention… (les décisions formelles se rattachent via le registre des décisions)"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue resize-none" />
          </div>

          {error && <p className="text-sm text-rose-600 font-medium" data-testid="inst-error">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">Annuler</button>
            <button type="submit" disabled={saving} data-testid="inst-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark transition-colors disabled:opacity-60">
              {saving ? "Sauvegarde..." : isEdit ? "Enregistrer" : "Créer l'instance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
