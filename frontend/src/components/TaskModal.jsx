import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import { tasksAPI } from "@/api";

const EMPTY = {
  name: "", type: "tâche", status: "not_started",
  date_start_planned: "", date_end_planned: "",
  date_start_actual: "", date_end_actual: "",
  budget_planned_k: "", budget_consumed_k: "",
  jh_planned: "", jh_consumed: "", resource_id: "",
};

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] bg-white";

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-rose-500 mt-0.5">{error}</p>}
    </div>
  );
}

export default function TaskModal({ isOpen, onClose, task, projectId, resources = [], onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (task) {
      setForm({
        name: task.name || "",
        type: task.type || "tâche",
        status: task.status || "not_started",
        date_start_planned: task.date_start_planned || "",
        date_end_planned: task.date_end_planned || "",
        date_start_actual: task.date_start_actual || "",
        date_end_actual: task.date_end_actual || "",
        budget_planned_k: task.budget_planned_k != null ? String(task.budget_planned_k) : "",
        budget_consumed_k: task.budget_consumed_k != null ? String(task.budget_consumed_k) : "",
        jh_planned: task.jh_planned != null ? String(task.jh_planned) : "",
        jh_consumed: task.jh_consumed != null ? String(task.jh_consumed) : "",
        resource_id: task.resource_id || "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
    setApiError("");
  }, [isOpen, task]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Nom requis";
    if (!form.type) errs.type = "Type requis";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        date_start_planned: form.date_start_planned || null,
        date_end_planned: form.date_end_planned || null,
        date_start_actual: form.date_start_actual || null,
        date_end_actual: form.date_end_actual || null,
        budget_planned_k: form.budget_planned_k ? Number(form.budget_planned_k) : 0,
        budget_consumed_k: form.budget_consumed_k ? Number(form.budget_consumed_k) : 0,
        jh_planned: form.jh_planned ? Number(form.jh_planned) : 0,
        jh_consumed: form.jh_consumed ? Number(form.jh_consumed) : 0,
        resource_id: form.resource_id || null,
        project_id: projectId,
      };
      if (task) {
        await tasksAPI.update(task.task_id, payload);
      } else {
        await tasksAPI.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? "Modifier la tâche" : "Nouvelle tâche"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="task-form">
        {apiError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{apiError}</div>
        )}

        <Field label="Nom de la tâche" required error={errors.name}>
          <input data-testid="task-form-name" className={INPUT_CLS} value={form.name} onChange={set("name")} placeholder="Ex : Cadrage stratégique" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required error={errors.type}>
            <select data-testid="task-form-type" className={INPUT_CLS} value={form.type} onChange={set("type")}>
              <option value="tâche">Tâche</option>
              <option value="feature">Feature</option>
              <option value="epic">Epic</option>
              <option value="user_story">User Story</option>
            </select>
          </Field>
          <Field label="Statut">
            <select data-testid="task-form-status" className={INPUT_CLS} value={form.status} onChange={set("status")}>
              <option value="not_started">Non démarré</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminé</option>
              <option value="delayed">En retard</option>
              <option value="cancelled">Annulé</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Début prévu">
            <input type="date" className={INPUT_CLS} value={form.date_start_planned} onChange={set("date_start_planned")} />
          </Field>
          <Field label="Fin prévue">
            <input data-testid="task-form-end-planned" type="date" className={INPUT_CLS} value={form.date_end_planned} onChange={set("date_end_planned")} />
          </Field>
          <Field label="Début réel">
            <input type="date" className={INPUT_CLS} value={form.date_start_actual} onChange={set("date_start_actual")} />
          </Field>
          <Field label="Fin réelle">
            <input type="date" className={INPUT_CLS} value={form.date_end_actual} onChange={set("date_end_actual")} />
          </Field>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Budget & Charge</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget prévu (K€)">
              <input data-testid="task-form-budget-planned" type="number" className={INPUT_CLS} value={form.budget_planned_k} onChange={set("budget_planned_k")} placeholder="Ex : 100" min="0" />
            </Field>
            <Field label="Budget consommé (K€)">
              <input type="number" className={INPUT_CLS} value={form.budget_consumed_k} onChange={set("budget_consumed_k")} placeholder="0" min="0" />
            </Field>
            <Field label="JH prévus">
              <input data-testid="task-form-jh-planned" type="number" className={INPUT_CLS} value={form.jh_planned} onChange={set("jh_planned")} placeholder="Ex : 200" min="0" />
            </Field>
            <Field label="JH consommés">
              <input type="number" className={INPUT_CLS} value={form.jh_consumed} onChange={set("jh_consumed")} placeholder="0" min="0" />
            </Field>
          </div>
        </div>

        <Field label="Responsable">
          <select data-testid="task-form-resource" className={INPUT_CLS} value={form.resource_id} onChange={set("resource_id")}>
            <option value="">— Non assigné —</option>
            {resources.map((r) => <option key={r.resource_id} value={r.resource_id}>{r.name}</option>)}
          </select>
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            data-testid="task-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {task ? "Enregistrer" : "Créer la tâche"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
