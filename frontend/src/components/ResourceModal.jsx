import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import { resourcesAPI } from "@/api";

const EMPTY = { name: "", role: "", team: "", capacity_jh_month: "15", email: "" };
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

export default function ResourceModal({ isOpen, onClose, resource, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (resource) {
      setForm({
        name: resource.name || "",
        role: resource.role || "",
        team: resource.team || "",
        capacity_jh_month: resource.capacity_jh_month != null ? String(resource.capacity_jh_month) : "15",
        email: resource.email || "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({}); setApiError("");
  }, [isOpen, resource]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Nom requis";
    if (!form.role.trim()) errs.role = "Rôle requis";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      const payload = {
        name: form.name.trim(),
        role: form.role.trim(),
        team: form.team || null,
        capacity_jh_month: form.capacity_jh_month ? Number(form.capacity_jh_month) : 15,
        email: form.email || null,
      };
      if (resource) {
        await resourcesAPI.update(resource.resource_id, payload);
      } else {
        await resourcesAPI.create(payload);
      }
      onSaved(); onClose();
    } catch (err) {
      setApiError(err.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={resource ? "Modifier la ressource" : "Nouvelle ressource"}>
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="resource-form">
        {apiError && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{apiError}</div>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom complet" required error={errors.name}>
            <input data-testid="resource-form-name" className={INPUT_CLS} value={form.name} onChange={set("name")} placeholder="Ex : Alice Dupont" />
          </Field>
          <Field label="Rôle / Poste" required error={errors.role}>
            <input data-testid="resource-form-role" className={INPUT_CLS} value={form.role} onChange={set("role")} placeholder="Ex : Chef de projet" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Équipe / Département">
            <input data-testid="resource-form-team" className={INPUT_CLS} value={form.team} onChange={set("team")} placeholder="Ex : Équipe Digital" />
          </Field>
          <Field label="Capacité mensuelle (JH)">
            <input data-testid="resource-form-capacity" type="number" className={INPUT_CLS} value={form.capacity_jh_month} onChange={set("capacity_jh_month")} min="0" max="30" />
          </Field>
        </div>

        <Field label="Email">
          <input data-testid="resource-form-email" type="email" className={INPUT_CLS} value={form.email} onChange={set("email")} placeholder="Ex : alice@altair.fr" />
        </Field>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors">Annuler</button>
          <button type="submit" disabled={saving} data-testid="resource-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 transition-colors">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {resource ? "Enregistrer" : "Créer la ressource"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
