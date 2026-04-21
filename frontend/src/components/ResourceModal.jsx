import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/Modal";
import { resourcesAPI, teamsAPI } from "@/api";

const EMPTY = {
  name: "", role: "", team: "", team_id: "",
  capacity_jh_month: "15", tjm_eur: "", availability_rate: "100",
  email: "", validator_resource_id: "",
};
const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] bg-white";

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

export default function ResourceModal({ isOpen, onClose, resource, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [teams, setTeams] = useState([]);
  const [allResources, setAllResources] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    teamsAPI.list().then((r) => setTeams(r.data)).catch(() => {});
    resourcesAPI.list().then((r) => setAllResources(r.data)).catch(() => {});
    if (resource) {
      setForm({
        name:                 resource.name || "",
        role:                 resource.role || "",
        team:                 resource.team || "",
        team_id:              resource.team_id || "",
        capacity_jh_month:    resource.capacity_jh_month != null ? String(resource.capacity_jh_month) : "15",
        tjm_eur:              resource.tjm_eur != null ? String(resource.tjm_eur) : "",
        availability_rate:    resource.availability_rate != null ? String(resource.availability_rate) : "100",
        email:                resource.email || "",
        validator_resource_id: resource.validator_resource_id || "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({}); setApiError("");
  }, [isOpen, resource]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleTeamChange = (e) => {
    const teamId = e.target.value;
    const team = teams.find((t) => t.team_id === teamId);
    setForm((f) => ({ ...f, team_id: teamId, team: team ? team.name : f.team }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Nom requis";
    if (!form.role.trim()) errs.role = "Rôle requis";
    if (form.availability_rate !== "" && (Number(form.availability_rate) < 0 || Number(form.availability_rate) > 100)) {
      errs.availability_rate = "Entre 0 et 100";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setApiError("");
    try {
      const payload = {
        name:                 form.name.trim(),
        role:                 form.role.trim(),
        team:                 form.team || null,
        team_id:              form.team_id || null,
        capacity_jh_month:    form.capacity_jh_month ? Number(form.capacity_jh_month) : 15,
        tjm_eur:              form.tjm_eur ? Number(form.tjm_eur) : null,
        availability_rate:    form.availability_rate !== "" ? Number(form.availability_rate) : 100,
        email:                form.email || null,
        validator_resource_id: form.validator_resource_id || null,
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

  const capaciteEffective = form.capacity_jh_month && form.availability_rate
    ? Math.round(Number(form.capacity_jh_month) * Number(form.availability_rate) / 100)
    : null;

  // Exclure la ressource elle-même de la liste des valideurs
  const valideurOptions = allResources.filter((r) => r.resource_id !== resource?.resource_id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={resource ? "Modifier la ressource" : "Nouvelle ressource"}>
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="resource-form">
        {apiError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{apiError}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom complet" required error={errors.name}>
            <input data-testid="resource-form-name" className={INPUT_CLS} value={form.name} onChange={set("name")} placeholder="Ex : Alice Dupont" />
          </Field>
          <Field label="Rôle / Poste" required error={errors.role}>
            <input data-testid="resource-form-role" className={INPUT_CLS} value={form.role} onChange={set("role")} placeholder="Ex : Chef de projet" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Équipe">
            <select data-testid="resource-form-team-id" className={INPUT_CLS} value={form.team_id} onChange={handleTeamChange}>
              <option value="">— Aucune équipe —</option>
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Email">
            <input data-testid="resource-form-email" type="email" className={INPUT_CLS} value={form.email} onChange={set("email")} placeholder="Ex : alice@altair.fr" />
          </Field>
        </div>

        {/* Valideur N+1 — nouveau champ */}
        <Field label="Valideur N+1" hint="Par défaut = manager de l'équipe">
          <select
            data-testid="resource-form-validator"
            className={INPUT_CLS}
            value={form.validator_resource_id}
            onChange={set("validator_resource_id")}
          >
            <option value="">— Défaut (manager équipe) —</option>
            {valideurOptions.map((r) => (
              <option key={r.resource_id} value={r.resource_id}>{r.name} — {r.role}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Capacité (JH/mois)">
            <input data-testid="resource-form-capacity" type="number" className={INPUT_CLS} value={form.capacity_jh_month} onChange={set("capacity_jh_month")} min="0" max="30" />
          </Field>
          <Field label="Dispo (%)" error={errors.availability_rate}>
            <input data-testid="resource-form-availability" type="number" className={INPUT_CLS} value={form.availability_rate} onChange={set("availability_rate")} min="0" max="100" placeholder="100" />
          </Field>
          <Field label="TJM (€/jour)">
            <input data-testid="resource-form-tjm" type="number" className={INPUT_CLS} value={form.tjm_eur} onChange={set("tjm_eur")} min="0" placeholder="Ex : 650" />
          </Field>
        </div>

        {capaciteEffective !== null && Number(form.availability_rate) < 100 && (
          <p className="text-xs text-slate-500 -mt-2">
            Capacité effective : <strong>{capaciteEffective} JH/mois</strong> ({form.availability_rate}% de {form.capacity_jh_month} JH)
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
            Annuler
          </button>
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
