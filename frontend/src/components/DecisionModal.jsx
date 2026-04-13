import React, { useState, useEffect } from "react";
import { Loader2, ClipboardList } from "lucide-react";
import Modal from "@/components/Modal";
import { decisionsAPI } from "@/api";

const CATEGORIES = [
  { value: "stratégique", label: "Stratégique" },
  { value: "périmètre",   label: "Périmètre" },
  { value: "planning",    label: "Planning" },
  { value: "budgétaire",  label: "Budgétaire" },
  { value: "technique",   label: "Technique" },
  { value: "ressources",  label: "Ressources" },
  { value: "conformité",  label: "Conformité" },
  { value: "gouvernance", label: "Gouvernance" },
];

const STATUSES = [
  { value: "proposée",  label: "Proposée" },
  { value: "prise",     label: "Prise" },
  { value: "en_cours",  label: "En cours" },
  { value: "appliquée", label: "Appliquée" },
  { value: "reportée",  label: "Reportée" },
  { value: "annulée",   label: "Annulée" },
];

const EMPTY = {
  title: "", description: "", category: "stratégique", status: "proposée",
  decision_date: "", due_date: "", owner: "", impact: "", selected_project_id: "",
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

export default function DecisionModal({ isOpen, onClose, decision, projectId, governanceId, projects = [], onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  // Show project selector only when creating (no decision, no projectId prop)
  const showProjectSelector = !projectId && !decision;

  useEffect(() => {
    if (!isOpen) return;
    if (decision) {
      setForm({
        title: decision.title || "",
        description: decision.description || "",
        category: decision.category || "stratégique",
        status: decision.status || "proposée",
        decision_date: decision.decision_date || "",
        due_date: decision.due_date || "",
        owner: decision.owner || "",
        impact: decision.impact || "",
        selected_project_id: decision.project_id || "",
      });
    } else {
      setForm({ ...EMPTY, selected_project_id: projectId || "" });
    }
    setErrors({});
    setApiError("");
  }, [isOpen, decision, projectId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = "Titre requis";
    if (!form.category) errs.category = "Catégorie requise";
    if (showProjectSelector && !form.selected_project_id) errs.project = "Projet requis";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      const payload = {
        project_id: projectId || form.selected_project_id,
        title: form.title.trim(),
        description: form.description || null,
        category: form.category,
        status: form.status,
        decision_date: form.decision_date || null,
        due_date: form.due_date || null,
        owner: form.owner || null,
        impact: form.impact || null,
        ...(governanceId !== undefined ? { governance_id: governanceId || null } : {}),
      };
      if (decision) {
        await decisionsAPI.update(decision.decision_id, payload);
      } else {
        await decisionsAPI.create(payload);
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
    <Modal isOpen={isOpen} onClose={onClose} title={decision ? "Modifier la décision" : "Nouvelle décision"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="decision-form">
        {apiError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{apiError}</div>
        )}

        {showProjectSelector && (
          <Field label="Projet concerné" required error={errors.project}>
            <select data-testid="decision-form-project" className={INPUT_CLS} value={form.selected_project_id} onChange={set("selected_project_id")}>
              <option value="">-- Sélectionner un projet --</option>
              {projects.map((p) => (
                <option key={p.project_id} value={p.project_id}>{p.name}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Titre de la décision" required error={errors.title}>
          <input data-testid="decision-form-title" className={INPUT_CLS} value={form.title} onChange={set("title")} placeholder="Ex : Validation go-live Phase 2" />
        </Field>

        <Field label="Contexte / Description">
          <textarea data-testid="decision-form-description" className={`${INPUT_CLS} resize-none h-16`} value={form.description} onChange={set("description")} placeholder="Contexte et justification de la décision..." />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie" required error={errors.category}>
            <select data-testid="decision-form-category" className={INPUT_CLS} value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Statut" required>
            <select data-testid="decision-form-status" className={INPUT_CLS} value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de décision">
            <input data-testid="decision-form-date" type="date" className={INPUT_CLS} value={form.decision_date} onChange={set("decision_date")} />
          </Field>
          <Field label="Échéance d'application">
            <input data-testid="decision-form-due-date" type="date" className={INPUT_CLS} value={form.due_date} onChange={set("due_date")} />
          </Field>
        </div>

        <Field label="Décideur / Responsable">
          <input data-testid="decision-form-owner" className={INPUT_CLS} value={form.owner} onChange={set("owner")} placeholder="Ex : COPIL, Sophie Martin..." />
        </Field>

        <Field label="Impact / Conséquences">
          <textarea data-testid="decision-form-impact" className={`${INPUT_CLS} resize-none h-16`} value={form.impact} onChange={set("impact")} placeholder="Impacts sur le budget, planning, équipe, périmètre..." />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            data-testid="decision-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {decision ? "Enregistrer" : "Créer la décision"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
