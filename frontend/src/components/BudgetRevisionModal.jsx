import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import api from "@/api";

const INPUT_CLS = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white";

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

export default function BudgetRevisionModal({ isOpen, onClose, project, onSaved }) {
  const [form, setForm] = useState({ eac: "", reason: "", author: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!isOpen || !project) return;
    setForm({
      eac: project.eac != null ? String(Math.round(project.eac / 1000)) : String(Math.round((project.budget_forecast || project.budget_total || 0) / 1000)),
      reason: "",
      author: "",
    });
    setErrors({}); setApiError("");
  }, [isOpen, project]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.eac || isNaN(Number(form.eac))) errs.eac = "EAC requis (montant en K€)";
    if (!form.reason.trim()) errs.reason = "Motif requis";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      await api.post(`/projects/${project.project_id}/budget-revision`, {
        eac: Number(form.eac) * 1000,
        reason: form.reason.trim(),
        author: form.author.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setApiError(err.response?.data?.detail || "Erreur lors de la révision");
    } finally { setSaving(false); }
  };

  const currentEacK = project ? Math.round((project.eac || project.budget_forecast || project.budget_total || 0) / 1000) : 0;
  const newEacK = Number(form.eac) || 0;
  const drift = newEacK - currentEacK;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Réviser l'EAC (Estimate At Completion)">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="budget-revision-form">
        {apiError && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{apiError}</div>}

        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 flex items-center justify-between text-sm">
          <span className="text-zinc-500">EAC actuel :</span>
          <span className="font-mono-data font-bold text-zinc-950">{currentEacK.toLocaleString("fr-FR")} K€</span>
        </div>

        <Field label="Nouvel EAC" required hint="en K€" error={errors.eac}>
          <input
            data-testid="revision-form-eac"
            type="number" className={INPUT_CLS} value={form.eac}
            onChange={set("eac")} placeholder={String(currentEacK)} min="0"
          />
        </Field>

        {form.eac && !isNaN(Number(form.eac)) && (
          <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${drift > 0 ? "bg-rose-50 border border-rose-200" : drift < 0 ? "bg-emerald-50 border border-emerald-200" : "bg-zinc-50 border border-zinc-200"}`}>
            <span className="text-zinc-500">Variation :</span>
            <span className={`font-mono-data font-bold ${drift > 0 ? "text-rose-600" : drift < 0 ? "text-emerald-600" : "text-zinc-500"}`}>
              {drift > 0 ? "+" : ""}{drift.toLocaleString("fr-FR")} K€
              {currentEacK > 0 ? ` (${drift > 0 ? "+" : ""}${Math.round(drift / currentEacK * 100)}%)` : ""}
            </span>
          </div>
        )}

        <Field label="Motif de la révision" required error={errors.reason}>
          <textarea
            data-testid="revision-form-reason"
            className={`${INPUT_CLS} resize-none h-20`} value={form.reason}
            onChange={set("reason")} placeholder="Ex : Dépassement scope — ajout module reporting"
          />
        </Field>

        <Field label="Auteur">
          <input
            data-testid="revision-form-author"
            className={INPUT_CLS} value={form.author}
            onChange={set("author")} placeholder="Ex : Marie Dupont"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2 border-t border-zinc-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">Annuler</button>
          <button type="submit" disabled={saving} data-testid="revision-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer la révision
          </button>
        </div>
      </form>
    </Modal>
  );
}
