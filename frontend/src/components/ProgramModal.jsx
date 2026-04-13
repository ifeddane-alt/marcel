import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import { programsAPI } from "@/api";

const EMPTY = { name: "", description: "", owner: "", start_date: "", end_date: "", budget_keur: "", status: "active" };
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

export default function ProgramModal({ isOpen, onClose, program, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (program) {
      setForm({
        name: program.name || "",
        description: program.description || "",
        owner: program.owner || "",
        start_date: program.start_date || "",
        end_date: program.end_date || "",
        budget_keur: program.budget_keur != null ? String(program.budget_keur) : "",
        status: program.status || "active",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({}); setApiError("");
  }, [isOpen, program]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Nom requis";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        owner: form.owner || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget_keur: form.budget_keur ? Number(form.budget_keur) : 0,
        status: form.status,
      };
      if (program) {
        await programsAPI.update(program.program_id, payload);
      } else {
        await programsAPI.create(payload);
      }
      onSaved(); onClose();
    } catch (err) {
      setApiError(err.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={program ? "Modifier le programme" : "Nouveau programme"}>
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="program-form">
        {apiError && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{apiError}</div>}

        <Field label="Nom du programme" required error={errors.name}>
          <input data-testid="program-form-name" className={INPUT_CLS} value={form.name} onChange={set("name")} placeholder="Ex : Transformation Digitale" />
        </Field>

        <Field label="Description">
          <textarea className={`${INPUT_CLS} resize-none h-20`} value={form.description} onChange={set("description")} placeholder="Objectifs et périmètre du programme..." />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <input data-testid="program-form-owner" className={INPUT_CLS} value={form.owner} onChange={set("owner")} placeholder="Ex : Marie Dupont" />
          </Field>
          <Field label="Statut">
            <select data-testid="program-form-status" className={INPUT_CLS} value={form.status} onChange={set("status")}>
              <option value="active">Actif</option>
              <option value="on_hold">En pause</option>
              <option value="completed">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date début">
            <input type="date" className={INPUT_CLS} value={form.start_date} onChange={set("start_date")} />
          </Field>
          <Field label="Date fin prévue">
            <input type="date" className={INPUT_CLS} value={form.end_date} onChange={set("end_date")} />
          </Field>
        </div>

        <Field label="Budget alloué (K€)">
          <input data-testid="program-form-budget" type="number" className={INPUT_CLS} value={form.budget_keur} onChange={set("budget_keur")} placeholder="Ex : 5000" min="0" />
        </Field>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors">Annuler</button>
          <button type="submit" disabled={saving} data-testid="program-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 transition-colors">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {program ? "Enregistrer" : "Créer le programme"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
