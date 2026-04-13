import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import { projectsAPI } from "@/api";

const REQUIRED = ["name", "methodology", "status_rag", "budget_total", "budget_forecast", "jh_planned", "start_date", "end_date_baseline", "end_date_forecast"];

const EMPTY = {
  name: "", source_id: "", description: "", owner_id: "",
  program_id: "", methodology: "waterfall", status_rag: "green",
  start_date: "", end_date_baseline: "", end_date_forecast: "",
  budget_total: "", budget_forecast: "", jh_planned: "",
  budget_consumed: "0", jh_consumed: "0",
};

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

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] bg-white";

export default function ProjectModal({ isOpen, onClose, project, resources = [], programs = [], onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (project) {
      setForm({
        name: project.name || "",
        source_id: project.source_id || "",
        description: project.description || "",
        owner_id: project.owner_id || "",
        program_id: project.program_id || "",
        methodology: project.methodology || "waterfall",
        status_rag: project.status_rag || "green",
        start_date: project.start_date || "",
        end_date_baseline: project.end_date_baseline || "",
        end_date_forecast: project.end_date_forecast || "",
        budget_total: project.budget_total != null ? String(project.budget_total) : "",
        budget_forecast: project.budget_forecast != null ? String(project.budget_forecast) : "",
        budget_consumed: project.budget_consumed != null ? String(project.budget_consumed) : "0",
        jh_planned: project.jh_planned != null ? String(project.jh_planned) : "",
        jh_consumed: project.jh_consumed != null ? String(project.jh_consumed) : "0",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
    setApiError("");
  }, [isOpen, project]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Nom requis";
    if (!form.methodology) errs.methodology = "Méthodo requise";
    if (!form.status_rag) errs.status_rag = "Statut RAG requis";
    if (!form.start_date) errs.start_date = "Date de début requise";
    if (!form.end_date_baseline) errs.end_date_baseline = "Date baseline requise";
    if (!form.end_date_forecast) errs.end_date_forecast = "Date forecast requise";
    ["budget_total", "budget_forecast", "jh_planned"].forEach((f) => {
      if (!form[f] || isNaN(Number(form[f]))) errs[f] = "Valeur numérique requise";
    });
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
        source_id: form.source_id || null,
        description: form.description || null,
        owner_id: form.owner_id || null,
        program_id: form.program_id || null,
        methodology: form.methodology,
        status_rag: form.status_rag,
        start_date: form.start_date,
        end_date_baseline: form.end_date_baseline,
        end_date_forecast: form.end_date_forecast,
        budget_total: Number(form.budget_total),
        budget_forecast: Number(form.budget_forecast),
        budget_consumed: Number(form.budget_consumed || 0),
        jh_planned: Number(form.jh_planned),
        jh_consumed: Number(form.jh_consumed || 0),
      };
      if (project) {
        await projectsAPI.update(project.project_id, payload);
      } else {
        await projectsAPI.create(payload);
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
    <Modal isOpen={isOpen} onClose={onClose} title={project ? "Modifier le projet" : "Nouveau projet"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="project-form">
        {apiError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{apiError}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom du projet" required error={errors.name}>
            <input data-testid="project-form-name" className={INPUT_CLS} value={form.name} onChange={set("name")} placeholder="Ex : Projet Phoenix" />
          </Field>
          <Field label="Code projet">
            <input data-testid="project-form-code" className={INPUT_CLS} value={form.source_id} onChange={set("source_id")} placeholder="Ex : PRJ-001" />
          </Field>
        </div>

        <Field label="Description">
          <textarea data-testid="project-form-description" className={`${INPUT_CLS} resize-none h-20`} value={form.description} onChange={set("description")} placeholder="Description du projet..." />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner (responsable)">
            <select data-testid="project-form-owner" className={INPUT_CLS} value={form.owner_id} onChange={set("owner_id")}>
              <option value="">— Non assigné —</option>
              {resources.map((r) => <option key={r.resource_id} value={r.resource_id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Programme (optionnel)">
            <select data-testid="project-form-program" className={INPUT_CLS} value={form.program_id} onChange={set("program_id")}>
              <option value="">— Hors programme —</option>
              {programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Méthodologie" required error={errors.methodology}>
            <select data-testid="project-form-methodology" className={INPUT_CLS} value={form.methodology} onChange={set("methodology")}>
              <option value="waterfall">Waterfall</option>
              <option value="agile">Agile</option>
              <option value="safe">SAFe</option>
            </select>
          </Field>
          <Field label="Statut RAG" required error={errors.status_rag}>
            <select data-testid="project-form-rag" className={INPUT_CLS} value={form.status_rag} onChange={set("status_rag")}>
              <option value="green">Vert</option>
              <option value="orange">Orange</option>
              <option value="red">Rouge</option>
            </select>
          </Field>
          <div />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Début prévu" required error={errors.start_date}>
            <input data-testid="project-form-start" type="date" className={INPUT_CLS} value={form.start_date} onChange={set("start_date")} />
          </Field>
          <Field label="Fin baseline" required error={errors.end_date_baseline}>
            <input data-testid="project-form-end-baseline" type="date" className={INPUT_CLS} value={form.end_date_baseline} onChange={set("end_date_baseline")} />
          </Field>
          <Field label="Fin forecast" required error={errors.end_date_forecast}>
            <input data-testid="project-form-end-forecast" type="date" className={INPUT_CLS} value={form.end_date_forecast} onChange={set("end_date_forecast")} />
          </Field>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Budget & Charge</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Budget total (€)" required error={errors.budget_total}>
              <input data-testid="project-form-budget-total" type="number" className={INPUT_CLS} value={form.budget_total} onChange={set("budget_total")} placeholder="Ex : 500000" min="0" />
            </Field>
            <Field label="Budget forecast (€)" required error={errors.budget_forecast}>
              <input data-testid="project-form-budget-forecast" type="number" className={INPUT_CLS} value={form.budget_forecast} onChange={set("budget_forecast")} placeholder="Ex : 520000" min="0" />
            </Field>
            <Field label="JH prévus" required error={errors.jh_planned}>
              <input data-testid="project-form-jh" type="number" className={INPUT_CLS} value={form.jh_planned} onChange={set("jh_planned")} placeholder="Ex : 1000" min="0" />
            </Field>
            <Field label="Budget consommé (€)">
              <input data-testid="project-form-budget-consumed" type="number" className={INPUT_CLS} value={form.budget_consumed} onChange={set("budget_consumed")} placeholder="0" min="0" />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            data-testid="project-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {project ? "Enregistrer" : "Créer le projet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
