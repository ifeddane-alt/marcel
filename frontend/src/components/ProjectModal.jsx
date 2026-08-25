import React, { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp, Layers, Wallet } from "lucide-react";
import Modal from "@/components/Modal";
import { projectsAPI, projectTemplatesAPI } from "@/api";
import { useTenantConfig } from "@/contexts/TenantConfigContext";
import DateField from "@/components/ui/DateField";

const DEFAULT_STATUS_OPTIONS = [
  { value: "en_preparation", label: "En préparation" },
  { value: "actif",          label: "Actif" },
  { value: "en_pause",       label: "En pause" },
  { value: "cloture",        label: "Clôturé" },
  { value: "archive",        label: "Archivé" },
];

const EMPTY = {
  name: "", source_id: "", description: "", owner_id: "",
  program_id: "", methodology: "waterfall", status: "en_preparation",
  start_date: "", end_date_baseline: "", end_date_forecast: "", end_date_actual: "",
  capex_planned: "", capex_consumed: "0",
  opex_planned: "", opex_consumed: "0",
  jh_planned: "", jh_consumed: "0",
};

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        {hint && <span className="text-zinc-400 font-normal ml-1">({hint})</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-rose-500 mt-0.5">{error}</p>}
    </div>
  );
}

const INPUT_CLS = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue focus:ring-1 focus:ring-m-blue bg-white";

export default function ProjectModal({ isOpen, onClose, project, resources = [], programs = [], onSaved }) {
  const { config } = useTenantConfig();
  const STATUS_OPTIONS = (config?.enums?.project_statuses?.length > 0)
    ? config.enums.project_statuses
    : DEFAULT_STATUS_OPTIONS;
  const isEdit = !!project;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [showBudget, setShowBudget] = useState(false);
  // Template state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedPhases, setSelectedPhases] = useState([]);
  const [showTemplate, setShowTemplate] = useState(false);
  const [nextCode, setNextCode] = useState("");

  useEffect(() => {
    if (!isOpen || project) return;
    projectsAPI.nextCode(form.program_id)
      .then(({ data }) => setNextCode(data.code))
      .catch(() => setNextCode(""));
  }, [isOpen, project, form.program_id]);

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
    setShowBudget(false);
    setSelectedTemplate(null);
    setSelectedPhases([]);
    setShowTemplate(false);
  }, [isOpen, project]);

  // Load templates when methodology changes (creation only)
  useEffect(() => {
    if (!isOpen || project) return;
    projectTemplatesAPI.list().then(({ data }) => {
      setTemplates(data);
      const match = data.find(t => t.methodology === form.methodology);
      setSelectedTemplate(match || null);
      setSelectedPhases(match ? match.phases.map(p => p.name) : []);
    }).catch(() => {});
  }, [form.methodology, isOpen, project]);

  const methodTemplates = templates.filter(t => t.methodology === form.methodology);

  const handleTemplateChange = (e) => {
    const tpl = methodTemplates.find(t => t.template_id === e.target.value) || null;
    setSelectedTemplate(tpl);
    setSelectedPhases(tpl ? tpl.phases.map(p => p.name) : []);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Nom requis";
    if (!form.methodology) errs.methodology = "Méthodo requise";
    if (!form.start_date) errs.start_date = "Date de début requise";
    if (!form.end_date_forecast) errs.end_date_forecast = "Date de fin prévue requise";
    if (isEdit && !form.end_date_baseline) errs.end_date_baseline = "Date baseline requise";
    if (form.capex_planned && isNaN(Number(form.capex_planned))) errs.capex_planned = "Valeur numérique requise";
    if (form.opex_planned && isNaN(Number(form.opex_planned))) errs.opex_planned = "Valeur numérique requise";
    if (form.jh_planned && isNaN(Number(form.jh_planned))) errs.jh_planned = "Valeur numérique requise";
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
        status: form.status,
        start_date: form.start_date,
        end_date_baseline: form.end_date_baseline || form.end_date_forecast,
        end_date_forecast: form.end_date_forecast,
        end_date_actual: form.end_date_actual || null,
        capex_planned: capexP,
        capex_consumed: capexC,
        opex_planned: opexP,
        opex_consumed: opexC,
        jh_planned: Number(form.jh_planned || 0),
        jh_consumed: Number(form.jh_consumed || 0),
      };
      if (project) {
        await projectsAPI.update(project.project_id, payload);
      } else {
        const { data: created } = await projectsAPI.create(payload);
        // Apply template if selected
        if (showTemplate && selectedTemplate && selectedPhases.length > 0) {
          await projectTemplatesAPI.applyTemplate(created.project_id, {
            template_id: selectedTemplate.template_id,
            selected_phases: selectedPhases,
          });
        }
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
  const budgetSectionOpen = isEdit || showBudget;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={project ? "Modifier le projet" : "Nouveau projet"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="project-form">
        {apiError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{apiError}</div>
        )}

        {/* Nom + Code */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom du projet" required error={errors.name}>
            <input data-testid="project-form-name" className={INPUT_CLS} value={form.name} onChange={set("name")} placeholder="Ex : Projet Phoenix" />
          </Field>
          <Field label="Code projet" hint="généré automatiquement">
            <input data-testid="project-form-code" className={`${INPUT_CLS} bg-zinc-50 text-zinc-500 font-mono cursor-not-allowed`}
              value={project ? (project.code || "—") : (nextCode || "…")} readOnly disabled />
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

        {/* Méthodologie + Statut — RAG calculé automatiquement */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Méthodologie" required error={errors.methodology}>
            <select data-testid="project-form-methodology" className={INPUT_CLS} value={form.methodology} onChange={set("methodology")}>
              <option value="waterfall">Waterfall</option>
              <option value="agile">Agile</option>
              <option value="safe">SAFe</option>
            </select>
          </Field>
          <Field label="Statut projet" required>
            <select data-testid="project-form-status" className={INPUT_CLS} value={form.status} onChange={set("status")}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-[11px] text-zinc-400 -mt-2" data-testid="rag-auto-hint">
          Le statut RAG est calculé automatiquement à partir du budget (EAC), des délais (jalons, glissement) et des risques critiques.
        </p>

        {/* Dates */}
        <div className="border-t border-zinc-100 pt-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-2">Calendrier</div>
          {isEdit ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Début prévu" required error={errors.start_date}>
                  <DateField testId="project-form-start" value={form.start_date} onChange={(v) => set("start_date")({ target: { value: v } })} />
                </Field>
                <Field label="Fin prévue initiale (baseline)" required error={errors.end_date_baseline}>
                  <DateField testId="project-form-end-baseline" value={form.end_date_baseline} onChange={(v) => set("end_date_baseline")({ target: { value: v } })} />
                </Field>
                <Field label="Fin prévue actuelle (forecast)" required error={errors.end_date_forecast}>
                  <DateField testId="project-form-end-forecast" value={form.end_date_forecast} onChange={(v) => set("end_date_forecast")({ target: { value: v } })} />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Fin réelle" hint="si projet clôturé">
                  <DateField testId="project-form-end-actual" value={form.end_date_actual} onChange={(v) => set("end_date_actual")({ target: { value: v } })} />
                </Field>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début prévu" required error={errors.start_date}>
                <DateField testId="project-form-start" value={form.start_date} onChange={(v) => set("start_date")({ target: { value: v } })} />
              </Field>
              <Field label="Fin prévue" required error={errors.end_date_forecast} hint="servira de baseline">
                <DateField testId="project-form-end-forecast" value={form.end_date_forecast} onChange={(v) => set("end_date_forecast")({ target: { value: v } })} />
              </Field>
            </div>
          )}
        </div>

        {/* Budget & charges — repliable en création, ouvert en édition */}
        <div className="border-t border-zinc-100 pt-3">
          {!isEdit && (
            <button
              type="button"
              data-testid="budget-section-toggle"
              onClick={() => setShowBudget(v => !v)}
              className="flex items-center gap-2 w-full text-left text-sm font-semibold text-zinc-700 hover:text-m-blue transition-colors"
            >
              <Wallet size={15} />
              <span>Budget & charges <span className="text-zinc-400 font-normal">(optionnel — complétable plus tard)</span></span>
              {showBudget ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
            </button>
          )}
          {budgetSectionOpen && (
            <div className={!isEdit ? "mt-3" : ""}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">Budget CAPEX / OPEX</div>
                {totalKEur > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono-data">
                    Total budget : <span className="font-bold text-m-blue">{totalKEur.toLocaleString("fr-FR")} K€</span>
                    <span className="relative group cursor-help">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-200 text-zinc-500 text-[10px] font-bold">?</span>
                      <span className="absolute right-0 bottom-full mb-2 w-64 p-2 bg-zinc-800 text-white text-[11px] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                        L'EAC initial est égal au budget total (CAPEX + OPEX). Utilisez le bouton "Réviser l'EAC" sur le détail du projet pour enregistrer une révision avec historique.
                      </span>
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/40 border border-blue-100 rounded-lg p-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-m-blue">CAPEX</div>
                  <Field label="Prévu" error={errors.capex_planned} hint="K€">
                    <input data-testid="project-form-capex-planned" type="number" className={INPUT_CLS} value={form.capex_planned} onChange={set("capex_planned")} placeholder="Ex : 1260" min="0" />
                  </Field>
                  {isEdit && (
                    <Field label="Consommé" hint="K€">
                      <input data-testid="project-form-capex-consumed" type="number" className={INPUT_CLS} value={form.capex_consumed} onChange={set("capex_consumed")} placeholder="0" min="0" />
                    </Field>
                  )}
                </div>
                <div className="bg-amber-50/40 border border-amber-100 rounded-lg p-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-600">OPEX</div>
                  <Field label="Prévu" error={errors.opex_planned} hint="K€">
                    <input data-testid="project-form-opex-planned" type="number" className={INPUT_CLS} value={form.opex_planned} onChange={set("opex_planned")} placeholder="Ex : 2940" min="0" />
                  </Field>
                  {isEdit && (
                    <Field label="Consommé" hint="K€">
                      <input data-testid="project-form-opex-consumed" type="number" className={INPUT_CLS} value={form.opex_consumed} onChange={set("opex_consumed")} placeholder="0" min="0" />
                    </Field>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="JH prévus" error={errors.jh_planned}>
                  <input data-testid="project-form-jh" type="number" className={INPUT_CLS} value={form.jh_planned} onChange={set("jh_planned")} placeholder="Ex : 1000" min="0" />
                </Field>
                {isEdit && (
                  <Field label="JH consommés">
                    <input data-testid="project-form-jh-consumed" type="number" className={INPUT_CLS} value={form.jh_consumed} onChange={set("jh_consumed")} placeholder="0" min="0" />
                  </Field>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Template (création uniquement) */}
        {!project && selectedTemplate && (
          <div className="border-t border-zinc-100 pt-3">
            <button
              type="button"
              data-testid="template-toggle"
              onClick={() => setShowTemplate(v => !v)}
              className="flex items-center gap-2 w-full text-left text-sm font-semibold text-zinc-700 hover:text-m-blue transition-colors"
            >
              <Layers size={15} />
              <span>Pré-charger depuis le template {selectedTemplate.name}</span>
              {showTemplate ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
            </button>

            {showTemplate && (
              <div className="mt-3 space-y-2 bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                {methodTemplates.length > 1 && (
                  <Field label="Template à appliquer">
                    <select
                      data-testid="template-select"
                      className={INPUT_CLS}
                      value={selectedTemplate.template_id}
                      onChange={handleTemplateChange}
                    >
                      {methodTemplates.map(t => (
                        <option key={t.template_id} value={t.template_id}>
                          {t.name}{t.is_default ? " (par défaut)" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <p className="text-xs text-zinc-500 mb-2">Sélectionnez les phases à pré-charger :</p>
                {selectedTemplate.phases.map(phase => (
                  <label
                    key={phase.name}
                    data-testid={`template-phase-${phase.name}`}
                    className="flex items-start gap-2 cursor-pointer hover:bg-white rounded-lg p-2 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPhases.includes(phase.name)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedPhases(prev => [...prev, phase.name]);
                        } else {
                          setSelectedPhases(prev => prev.filter(n => n !== phase.name));
                        }
                      }}
                      className="mt-0.5 accent-m-blue"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-700">{phase.name}</span>
                      <span className="text-xs text-zinc-400 ml-2">
                        {phase.milestones?.length || 0} jalons · {phase.tasks?.length || 0} tâches
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            data-testid="project-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-m-blue text-white text-sm font-semibold rounded-lg hover:bg-m-blue-dark disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {project ? "Enregistrer" : (showTemplate && selectedTemplate ? "Créer + Appliquer le template" : "Créer le projet")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
