import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { workAllocationsAPI } from "@/api";

const PHASES = ["analyse", "conception", "implementation", "review", "test", "hypercare"];
const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] bg-white";

export default function WorkAllocationModal({ isOpen, onClose, wa, tasks, resources, onSaved }) {
  const isEdit = !!wa;
  const [form, setForm] = useState({ task_id: "", resource_id: "", phase: "implementation", planned_md: "", consumed_md: "0" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm(wa ? {
        task_id: wa.task_id || "",
        resource_id: wa.resource_id || "",
        phase: wa.phase || "implementation",
        planned_md: wa.planned_md != null ? String(wa.planned_md) : "",
        consumed_md: wa.consumed_md != null ? String(wa.consumed_md) : "0",
      } : { task_id: "", resource_id: "", phase: "implementation", planned_md: "", consumed_md: "0" });
      setError("");
    }
  }, [isOpen, wa]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.task_id) { setError("Sélectionnez une tâche"); return; }
    if (!form.resource_id) { setError("Sélectionnez une ressource"); return; }
    if (!form.planned_md) { setError("JH prévus requis"); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        task_id: form.task_id,
        resource_id: form.resource_id,
        phase: form.phase,
        planned_md: Number(form.planned_md),
        consumed_md: Number(form.consumed_md) || 0,
      };
      if (isEdit) {
        await workAllocationsAPI.update(wa.work_allocation_id, {
          phase: payload.phase,
          planned_md: payload.planned_md,
          consumed_md: payload.consumed_md,
        });
      } else {
        await workAllocationsAPI.create(payload);
      }
      onSaved(); onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally { setSaving(false); }
  };

  const selectedRes = resources.find((r) => r.resource_id === form.resource_id);
  const estimatedCost = selectedRes?.tjm_eur && form.planned_md
    ? Math.round(Number(form.planned_md) * selectedRes.tjm_eur)
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-heading text-lg font-bold text-[#0F172A] uppercase tracking-tight">
            {isEdit ? "Modifier l'allocation" : "Nouvelle allocation de travail"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</div>}

          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Tâche *</label>
              <select data-testid="wa-modal-task" className={INPUT_CLS} value={form.task_id} onChange={set("task_id")}>
                <option value="">— Sélectionner une tâche —</option>
                {tasks.map((t) => <option key={t.task_id} value={t.task_id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Ressource *</label>
              <select data-testid="wa-modal-resource" className={INPUT_CLS} value={form.resource_id} onChange={set("resource_id")}>
                <option value="">— Sélectionner une ressource —</option>
                {resources.map((r) => <option key={r.resource_id} value={r.resource_id}>{r.name} ({r.role}){r.tjm_eur ? ` — ${r.tjm_eur}€/j` : ""}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Phase *</label>
            <select data-testid="wa-modal-phase" className={INPUT_CLS} value={form.phase} onChange={set("phase")}>
              {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">JH prévus *</label>
              <input data-testid="wa-modal-planned" type="number" className={INPUT_CLS} value={form.planned_md} onChange={set("planned_md")} min="0" step="0.5" placeholder="Ex: 10" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">JH consommés</label>
              <input data-testid="wa-modal-consumed" type="number" className={INPUT_CLS} value={form.consumed_md} onChange={set("consumed_md")} min="0" step="0.5" placeholder="0" />
            </div>
          </div>

          {estimatedCost !== null && (
            <p className="text-xs text-slate-500">
              Coût prévu estimé : <strong className="text-[#0052CC]">{estimatedCost.toLocaleString("fr-FR")} €</strong>
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors">Annuler</button>
            <button type="submit" disabled={saving} data-testid="wa-modal-submit"
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#0052CC] text-white rounded hover:bg-[#0047B3] disabled:opacity-60 transition-colors">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
