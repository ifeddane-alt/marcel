import React, { useState, useEffect } from "react";
import { Loader2, GitBranch, Layers, BookOpen, FileText, Zap } from "lucide-react";
import Modal from "@/components/Modal";
import { tasksAPI, safeAPI } from "@/api";

const EMPTY = {
  name: "", type: "tâche", status: "not_started",
  date_start_planned: "", date_end_planned: "",
  date_start_actual: "", date_end_actual: "",
  budget_planned_k: "", budget_consumed_k: "",
  jh_planned: "", jh_consumed: "", resource_id: "",
  dependencies: [],
  // SAFe
  task_level: "task",
  parent_id: "",
  sprint_id: "",
};

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] bg-white";

const LEVEL_OPTIONS = [
  { value: "task",       label: "Tâche",       icon: FileText, bg: "bg-slate-50  border-slate-300  text-slate-600" },
  { value: "feature",    label: "Feature",     icon: Layers,   bg: "bg-blue-50   border-blue-300   text-blue-700" },
  { value: "user_story", label: "User Story",  icon: BookOpen, bg: "bg-violet-50 border-violet-300 text-violet-700" },
];

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

export default function TaskModal({ isOpen, onClose, task, projectId, resources = [], allTasks = [], onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [sprints, setSprints] = useState([]);

  // Charger les sprints disponibles (tous sprints du tenant pour ce projet)
  useEffect(() => {
    if (!isOpen) return;
    safeAPI.listSprints({}).then(r => setSprints(r.data)).catch(() => {});
  }, [isOpen]);

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
        dependencies: task.dependencies || [],
        task_level: task.task_level || "task",
        parent_id: task.parent_id || "",
        sprint_id: task.sprint_id || "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
    setApiError("");
  }, [isOpen, task]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleDep = (depId) => {
    setForm((f) => {
      const deps = f.dependencies.includes(depId)
        ? f.dependencies.filter((d) => d !== depId)
        : [...f.dependencies, depId];
      return { ...f, dependencies: deps };
    });
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Nom requis";
    if (!form.type) errs.type = "Type requis";
    if (form.task_level === "user_story" && !form.parent_id) {
      errs.parent_id = "Une User Story doit avoir une Feature parente";
    }
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
        dependencies: form.dependencies,
        task_level: form.task_level,
        parent_id: form.parent_id || null,
        sprint_id: form.sprint_id || null,
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

  // Features disponibles comme parents (pour user_story uniquement)
  const parentFeatures = allTasks.filter(t => t.task_level === "feature" && t.task_id !== task?.task_id);
  const isUserStory = form.task_level === "user_story";
  const isFeature = form.task_level === "feature";
  const isSafe = isUserStory || isFeature;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? "Modifier la tâche" : "Nouvelle tâche"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="task-form">
        {apiError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{apiError}</div>
        )}

        {/* Niveau SAFe */}
        <Field label="Niveau SAFe">
          <div className="grid grid-cols-3 gap-2" data-testid="task-level-selector">
            {LEVEL_OPTIONS.map(({ value, label, icon: Icon, bg }) => (
              <button
                key={value}
                type="button"
                data-testid={`task-level-${value}`}
                onClick={() => setForm(f => ({ ...f, task_level: value, parent_id: value !== "user_story" ? "" : f.parent_id }))}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border-2 transition-all ${
                  form.task_level === value ? bg : "bg-white border-gray-200 text-slate-500 hover:border-gray-300"
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Nom de la tâche" required error={errors.name}>
          <input data-testid="task-form-name" className={INPUT_CLS} value={form.name} onChange={set("name")} placeholder={
            isFeature ? "Ex : Parcours Onboarding Web" : isUserStory ? "Ex : Écran inscription et validation email" : "Ex : Cadrage stratégique"
          } />
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
              <option value="done">Fait (SAFe)</option>
            </select>
          </Field>
        </div>

        {/* Feature parente (user_story uniquement) */}
        {isUserStory && (
          <Field label="Feature parente" required error={errors.parent_id}>
            <select
              data-testid="task-form-parent-id"
              className={INPUT_CLS}
              value={form.parent_id}
              onChange={set("parent_id")}
            >
              <option value="">— Sélectionner une Feature —</option>
              {parentFeatures.map(f => (
                <option key={f.task_id} value={f.task_id}>{f.name}</option>
              ))}
            </select>
            {parentFeatures.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-0.5">Aucune feature disponible — créez d'abord une Feature.</p>
            )}
          </Field>
        )}

        {/* Sprint assignment (feature ou user_story) */}
        {(isSafe || form.sprint_id) && sprints.length > 0 && (
          <Field label="Sprint assigné">
            <select
              data-testid="task-form-sprint-id"
              className={INPUT_CLS}
              value={form.sprint_id}
              onChange={set("sprint_id")}
            >
              <option value="">— Non assigné (Backlog PI) —</option>
              {sprints.map(s => (
                <option key={s.sprint_id} value={s.sprint_id}>
                  {s.name} ({s.start_date?.slice(0,10)} → {s.end_date?.slice(0,10)})
                </option>
              ))}
            </select>
          </Field>
        )}

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

        {/* Dépendances */}
        {(() => {
          const availableDeps = allTasks.filter((t) => t.task_id !== task?.task_id);
          if (availableDeps.length === 0) return null;
          return (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
                <GitBranch size={11} />
                Dépendances (tâches prérequises)
              </div>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded divide-y divide-gray-50" data-testid="dependencies-picker">
                {availableDeps.map((t) => {
                  const checked = form.dependencies.includes(t.task_id);
                  return (
                    <label key={t.task_id}
                      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${checked ? "bg-blue-50/50" : ""}`}
                    >
                      <input type="checkbox" className="accent-[#0052CC] flex-shrink-0"
                        checked={checked} onChange={() => toggleDep(t.task_id)}
                        data-testid={`dep-checkbox-${t.task_id}`} />
                      <span className="text-xs text-slate-700 leading-snug line-clamp-1 flex-1">{t.name}</span>
                      {t.task_level && t.task_level !== "task" && (
                        <span className="text-[9px] font-bold text-blue-600 flex-shrink-0">{t.task_level.toUpperCase()}</span>
                      )}
                    </label>
                  );
                })}
              </div>
              {form.dependencies.length > 0 && (
                <p className="text-[10px] text-[#0052CC] mt-1">
                  {form.dependencies.length} dépendance{form.dependencies.length > 1 ? "s" : ""} sélectionnée{form.dependencies.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          );
        })()}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={saving} data-testid="task-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 transition-colors">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {task ? "Enregistrer" : "Créer la tâche"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
