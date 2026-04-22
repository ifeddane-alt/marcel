import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import { projectsAPI } from "@/api";
import { useTenantConfig } from "@/contexts/TenantConfigContext";

const DEFAULT_STATUS_OPTIONS = [
  { value: "en_preparation", label: "En préparation" },
  { value: "actif",          label: "Actif" },
  { value: "en_pause",       label: "En pause" },
  { value: "cloture",        label: "Clôturé" },
  { value: "archive",        label: "Archivé" },
];

const EMPTY = {
  name: "", source_id: "", description: "", owner_id: "",
  program_id: "", methodology: "waterfall", status_rag: "green", status: "actif",
  start_date: "", end_date_baseline: "", end_date_forecast: "", end_date_actual: "",
  capex_planned: "", capex_consumed: "0",
  opex_planned: "", opex_consumed: "0",
  jh_planned: "", jh_consumed: "0",
};

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        {hint && <span className="text-slate-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-rose-500 mt-0.5">{error}</p>}
    </div>
  );
}

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] bg-white";

export default function ProjectModal({ isOpen, onClose, project, resources = [], programs = [], onSaved }) {
  const { config } = useTenantConfig();
  const STATUS_OPTIONS = (config?.enums?.project_statuses?.length > 0)
    ? config.enums.project_statuses
    : DEFAULT_STATUS_OPTIONS;
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
        status: project.status || "actif",
        start_date: project.start_date || "",
        end_date_baseline: project.end_date_baseline || "",
        end_date_forecast: project.end_date_forecast || "",
        end_date_actual: project.end_date_actual || "",
        capex_planned: project.capex_planned != null ? String(Math.round(project.capex_planned / 1000)) : "",
        capex_consumed: project.capex_consumed != null ? String(Math.round(project.capex_consumed / 1000)) : "0",
        opex_planned: project.opex_planned != null ? String(Math.round(project.opex_planned / 1000)) : "",
        opex_consumed: project.opex_consumed != null ? String(Math.round(project.opex_consumed / 1000)) : "0",
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
    if (!form.start_date) errs.start_date = "Date de début requise";
    if (!form.end_date_baseline) errs.end_date_baseline = "Date baseline requise";
    if (!form.end_date_forecast) errs.end_date_forecast = "Date forecast requise";
    const capexP = Number(form.capex_planned);
    const opexP = Number(form.opex_planned);
    if (!form.capex_planned && !form.opex_planned) {
      errs.capex_planned = "Au moins CAPEX ou OPEX prévu requis";
    } else {
      if (form.capex_planned && isNaN(capexP)) errs.capex_planned = "Valeur numérique requise";
      if (form.opex_planned && isNaN(opexP)) errs.opex_planned = "Valeur numérique requise";
    }
    if (!form.jh_planned || isNaN(Number(form.jh_planned))) errs.jh_planned = "JH prévus requis";
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      const capexP = Number(form.capex_planned || 0) * 1000;
      const opexP  = Number(form.opex_planned  || 0) * 1000;
      const capexC = Number(form.capex_consumed || 0) * 1000;
      const opexC  = Number(form.opex_consumed  || 0) * 1000;
      const payload = {
        name: form.name.trim(),
        source_id: form.source_id || null,
        description: form.description || null,
        owner_id: form.owner_id || null,
        program_id: form.program_id || null,
        methodology: form.methodology,
        status_rag: form.status_rag,
        status: form.status,
        start_date: form.start_date,
        end_date_baseline: form.end_date_baseline,
        end_date_forecast: form.end_date_forecast,
        end_date_actual: form.end_date_actual || null,
        capex_planned: capexP,
        capex_consumed: capexC,
        opex_planned: opexP,
        opex_consumed: opexC,
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

  // Live preview: budget total auto-calculé
  const capexP = Number(form.capex_planned) || 0;
  const opexP  = Number(form.opex_planned)  || 0;
  const totalKEur = capexP + opexP;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={project ? "Modifier le projet" : "Nouveau projet"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="project-form">
        {apiError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{apiError}</div>
        )}

        {/* Nom + Code */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom du projet" required error={errors.name}>
            <input data-testid="project-form-name" className={INPUT_CLS} value={form.name} onChange={set("name")} placeholder="Ex : Projet Phoenix" />
          </Field>
          <Field label="Code projet">
            <input data-testid="project-form-code" className={INPUT_CLS} value={form.source_id} onChange={set("source_id")} placeholder="Ex : PRJ-001" />
          </Field>
        </div>

        {/* Description */}
        <Field label="Description">
          <textarea data-testid="project-form-description" className={`${INPUT_CLS} resize-none h-16`} value={form.description} onChange={set("description")} placeholder="Description du projet..." />
        </Field>

        {/* Owner + Programme */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsable (Owner)">
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

        {/* Méthodologie + RAG + Statut */}
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
          <Field label="Statut projet" required>
            <select data-testid="project-form-status" className={INPUT_CLS} value={form.status} onChange={set("status")}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        {/* Dates */}
        <div className="border-t border-gray-100 pt-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Calendrier</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Début prévu" required error={errors.start_date}>
              <input data-testid="project-form-start" type="date" className={INPUT_CLS} value={form.start_date} onChange={set("start_date")} />
            </Field>
            <Field label="Fin prévue initiale (baseline)" required error={errors.end_date_baseline}>
              <input data-testid="project-form-end-baseline" type="date" className={INPUT_CLS} value={form.end_date_baseline} onChange={set("end_date_baseline")} />
            </Field>
            <Field label="Fin prévue actuelle (forecast)" required error={errors.end_date_forecast}>
              <input data-testid="project-form-end-forecast" type="date" className={INPUT_CLS} value={form.end_date_forecast} onChange={set("end_date_forecast")} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Fin réelle" hint="si projet clôturé">
              <input data-testid="project-form-end-actual" type="date" className={INPUT_CLS} value={form.end_date_actual} onChange={set("end_date_actual")} />
            </Field>
          </div>
        </div>

        {/* Budget CAPEX / OPEX */}
        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Budget CAPEX / OPEX</div>
            {totalKEur > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono-data">
                Total budget : <span className="font-bold text-[#0052CC]">{totalKEur.toLocaleString("fr-FR")} K€</span>
                <span className="relative group cursor-help">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold">?</span>
                  <span className="absolute right-0 bottom-full mb-2 w-64 p-2 bg-slate-800 text-white text-[11px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                    L'EAC initial est égal au budget total (CAPEX + OPEX). Utilisez le bouton "Réviser l'EAC" sur le détail du projet pour enregistrer une révision avec historique.
                  </span>
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/40 border border-blue-100 rounded-lg p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#0052CC]">CAPEX</div>
              <Field label="Prévu" required error={errors.capex_planned} hint="K€">
                <input data-testid="project-form-capex-planned" type="number" className={INPUT_CLS} value={form.capex_planned} onChange={set("capex_planned")} placeholder="Ex : 1260" min="0" />
              </Field>
              <Field label="Consommé" hint="K€">
                <input data-testid="project-form-capex-consumed" type="number" className={INPUT_CLS} value={form.capex_consumed} onChange={set("capex_consumed")} placeholder="0" min="0" />
              </Field>
            </div>
            <div className="bg-amber-50/40 border border-amber-100 rounded-lg p-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-600">OPEX</div>
              <Field label="Prévu" required error={errors.opex_planned} hint="K€">
                <input data-testid="project-form-opex-planned" type="number" className={INPUT_CLS} value={form.opex_planned} onChange={set("opex_planned")} placeholder="Ex : 2940" min="0" />
              </Field>
              <Field label="Consommé" hint="K€">
                <input data-testid="project-form-opex-consumed" type="number" className={INPUT_CLS} value={form.opex_consumed} onChange={set("opex_consumed")} placeholder="0" min="0" />
              </Field>
            </div>
          </div>
        </div>

        {/* JH */}
        <div className="border-t border-gray-100 pt-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">Charges (JH)</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="JH prévus" required error={errors.jh_planned}>
              <input data-testid="project-form-jh" type="number" className={INPUT_CLS} value={form.jh_planned} onChange={set("jh_planned")} placeholder="Ex : 1000" min="0" />
            </Field>
            <Field label="JH consommés">
              <input data-testid="project-form-jh-consumed" type="number" className={INPUT_CLS} value={form.jh_consumed} onChange={set("jh_consumed")} placeholder="0" min="0" />
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
