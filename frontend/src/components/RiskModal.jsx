import React, { useState, useEffect } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import Modal from "@/components/Modal";
import { risksAPI } from "@/api";
import { useTenantConfig } from "@/contexts/TenantConfigContext";

const DEFAULT_CATEGORIES = [
  { value: "technique",  label: "Technique" },
  { value: "budget",     label: "Budget" },
  { value: "planning",   label: "Planning" },
  { value: "ressource",  label: "Ressource" },
  { value: "externe",    label: "Externe" },
  { value: "conformité", label: "Conformité" },
];

const STATUSES = [
  { value: "identifié", label: "Identifié" },
  { value: "traité",    label: "Traité" },
  { value: "clos",      label: "Clos" },
  { value: "accepté",   label: "Accepté" },
];

const SCORE_LABELS = { 1: "Très faible", 2: "Faible", 3: "Modéré", 4: "Élevé", 5: "Critique" };

const EMPTY = {
  title: "", description: "", category: "technique", probability: "3",
  impact: "3", status: "identifié", mitigation_plan: "", owner: "", due_date: "",
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

function ScoreSelect({ value, onChange, testId }) {
  return (
    <select value={value} onChange={onChange} data-testid={testId} className={INPUT_CLS}>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>{n} — {SCORE_LABELS[n]}</option>
      ))}
    </select>
  );
}

function CritBadge({ crit }) {
  const cls = crit >= 16
    ? "bg-rose-100 text-rose-700 border-rose-300"
    : crit >= 7
    ? "bg-amber-100 text-amber-700 border-amber-300"
    : "bg-emerald-100 text-emerald-700 border-emerald-300";
  const label = crit >= 16 ? "ÉLEVÉ" : crit >= 7 ? "MODÉRÉ" : "FAIBLE";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${cls}`}>
      <ShieldAlert size={13} />
      Criticité {crit} — {label}
    </span>
  );
}

export default function RiskModal({ isOpen, onClose, risk, projectId, onSaved }) {
  const { config } = useTenantConfig();
  const CATEGORIES = (config?.enums?.risk_categories?.length > 0)
    ? config.enums.risk_categories
    : DEFAULT_CATEGORIES;

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (risk) {
      setForm({
        title: risk.title || "",
        description: risk.description || "",
        category: risk.category || "technique",
        probability: String(risk.probability || 3),
        impact: String(risk.impact || 3),
        status: risk.status || "identifié",
        mitigation_plan: risk.mitigation_plan || "",
        owner: risk.owner || "",
        due_date: risk.due_date || "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
    setApiError("");
  }, [isOpen, risk]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = "Titre requis";
    if (!form.category) errs.category = "Catégorie requise";
    return errs;
  };

  const criticality = Number(form.probability) * Number(form.impact);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      const payload = {
        project_id: projectId,
        title: form.title.trim(),
        description: form.description || null,
        category: form.category,
        probability: Number(form.probability),
        impact: Number(form.impact),
        status: form.status,
        mitigation_plan: form.mitigation_plan || null,
        owner: form.owner || null,
        due_date: form.due_date || null,
      };
      if (risk) {
        await risksAPI.update(risk.risk_id, payload);
      } else {
        await risksAPI.create(payload);
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
    <Modal isOpen={isOpen} onClose={onClose} title={risk ? "Modifier le risque" : "Nouveau risque"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="risk-form">
        {apiError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{apiError}</div>
        )}

        {/* Titre */}
        <Field label="Titre du risque" required error={errors.title}>
          <input data-testid="risk-form-title" className={INPUT_CLS} value={form.title} onChange={set("title")} placeholder="Ex : Retard livraison backend" />
        </Field>

        {/* Description */}
        <Field label="Description">
          <textarea data-testid="risk-form-description" className={`${INPUT_CLS} resize-none h-16`} value={form.description} onChange={set("description")} placeholder="Contexte et détails du risque..." />
        </Field>

        {/* Catégorie + Statut */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie" required error={errors.category}>
            <select data-testid="risk-form-category" className={INPUT_CLS} value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Statut" required>
            <select data-testid="risk-form-status" className={INPUT_CLS} value={form.status} onChange={set("status")}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        </div>

        {/* Probabilité + Impact */}
        <div className="border-t border-gray-100 pt-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
            Évaluation P × I
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Probabilité (1–5)" required>
              <ScoreSelect value={form.probability} onChange={set("probability")} testId="risk-form-probability" />
            </Field>
            <Field label="Impact (1–5)" required>
              <ScoreSelect value={form.impact} onChange={set("impact")} testId="risk-form-impact" />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Criticité auto-calculée :</span>
            <CritBadge crit={criticality} />
          </div>
        </div>

        {/* Plan de mitigation */}
        <Field label="Plan de mitigation">
          <textarea data-testid="risk-form-mitigation" className={`${INPUT_CLS} resize-none h-16`} value={form.mitigation_plan} onChange={set("mitigation_plan")} placeholder="Actions préventives ou curatives..." />
        </Field>

        {/* Responsable + Échéance */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsable (Owner)">
            <input data-testid="risk-form-owner" className={INPUT_CLS} value={form.owner} onChange={set("owner")} placeholder="Ex : Sophie Martin" />
          </Field>
          <Field label="Échéance de traitement">
            <input data-testid="risk-form-due-date" type="date" className={INPUT_CLS} value={form.due_date} onChange={set("due_date")} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            data-testid="risk-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {risk ? "Enregistrer" : "Créer le risque"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
