import React, { useState, useEffect } from "react";
import { Loader2, User, Building2, FileText } from "lucide-react";
import Modal from "@/components/Modal";
import { resourcesAPI, teamsAPI } from "@/api";
import DateField from "@/components/ui/DateField";

const EMPTY = {
  name: "", role: "", team: "", team_id: "",
  capacity_jh_month: "15", tjm_eur: "", availability_rate: "100",
  email: "", validator_resource_id: "",
  resource_type: "interne",
  vendor: "", contract_tjm: "",
  forfait_envelope: "", forfait_consumed: "",
  contract_start: "", contract_end: "",
  entry_date: "", contract_ref: "",
};

const INPUT_CLS = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue focus:ring-1 focus:ring-m-blue bg-white";

const TYPE_OPTIONS = [
  { value: "interne",         label: "Interne",         icon: User,      bg: "bg-blue-50 border-blue-300 text-blue-700" },
  { value: "externe_regie",   label: "Externe Régie",   icon: Building2, bg: "bg-orange-50 border-orange-300 text-orange-700" },
  { value: "externe_forfait", label: "Externe Forfait", icon: FileText,  bg: "bg-violet-50 border-violet-300 text-violet-700" },
];

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

export default function ResourceModal({ isOpen, onClose, resource, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [skills, setSkills] = useState([]);
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
        name:                  resource.name || "",
        role:                  resource.role || "",
        team:                  resource.team || "",
        team_id:               resource.team_id || "",
        capacity_jh_month:     resource.capacity_jh_month != null ? String(resource.capacity_jh_month) : "15",
        tjm_eur:               resource.tjm_eur != null ? String(resource.tjm_eur) : "",
        availability_rate:     resource.availability_rate != null ? String(resource.availability_rate) : "100",
        email:                 resource.email || "",
        validator_resource_id: resource.validator_resource_id || "",
        resource_type:         resource.resource_type || "interne",
        vendor:                resource.vendor || "",
        contract_tjm:          resource.contract_tjm != null ? String(resource.contract_tjm) : "",
        forfait_envelope:      resource.forfait_envelope != null ? String(resource.forfait_envelope) : "",
        forfait_consumed:      resource.forfait_consumed != null ? String(resource.forfait_consumed) : "",
        contract_start:        resource.contract_start || "",
        contract_end:          resource.contract_end || "",
        entry_date:            resource.entry_date || "",
        contract_ref:          resource.contract_ref || "",
      });
    } else {
      setForm(EMPTY);
    }
    setSkills(resource?.skills || []);
    setErrors({}); setApiError("");
  }, [isOpen, resource]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleTeamChange = (e) => {
    const teamId = e.target.value;
    const team = teams.find((t) => t.team_id === teamId);
    setForm((f) => ({ ...f, team_id: teamId, team: team ? team.name : f.team }));
  };

  const isExterne = form.resource_type !== "interne";
  const isRegie   = form.resource_type === "externe_regie";
  const isForfait = form.resource_type === "externe_forfait";

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Nom requis";
    if (!form.role.trim()) errs.role = "Rôle requis";
    if (form.availability_rate !== "" && (Number(form.availability_rate) < 0 || Number(form.availability_rate) > 100)) {
      errs.availability_rate = "Entre 0 et 100";
    }
    if (isExterne && !form.vendor.trim()) errs.vendor = "Fournisseur requis";
    if (isRegie && form.contract_tjm && Number(form.contract_tjm) < 0) errs.contract_tjm = "Valeur positive";
    if (isForfait && form.forfait_envelope && Number(form.forfait_envelope) < 0) errs.forfait_envelope = "Valeur positive";
    if (isForfait && form.forfait_consumed && form.forfait_envelope && Number(form.forfait_consumed) > Number(form.forfait_envelope)) {
      errs.forfait_consumed = "Ne peut dépasser l'enveloppe";
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
        name:                  form.name.trim(),
        role:                  form.role.trim(),
        team:                  form.team || null,
        team_id:               form.team_id || null,
        capacity_jh_month:     form.capacity_jh_month ? Number(form.capacity_jh_month) : 15,
        tjm_eur:               form.tjm_eur ? Number(form.tjm_eur) : null,
        availability_rate:     form.availability_rate !== "" ? Number(form.availability_rate) : 100,
        email:                 form.email || null,
        validator_resource_id: form.validator_resource_id || null,
        resource_type:         form.resource_type,
        vendor:                isExterne ? (form.vendor || null) : null,
        contract_tjm:          isRegie && form.contract_tjm ? Number(form.contract_tjm) : null,
        forfait_envelope:      isForfait && form.forfait_envelope ? Number(form.forfait_envelope) : null,
        forfait_consumed:      isForfait && form.forfait_consumed ? Number(form.forfait_consumed) : null,
        contract_start:        form.contract_start || null,
        contract_end:          form.contract_end || null,
        entry_date:            form.entry_date || null,
        contract_ref:          form.contract_ref || null,
        skills:                skills.filter((s) => (s.name || "").trim())
                                     .map((s) => ({ name: s.name.trim(), level: Number(s.level) || 1 })),
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

  const capaEffective = form.capacity_jh_month && form.availability_rate
    ? Math.round(Number(form.capacity_jh_month) * Number(form.availability_rate) / 100)
    : null;
  const valideurOptions = allResources.filter((r) => r.resource_id !== resource?.resource_id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={resource ? "Modifier la ressource" : "Nouvelle ressource"}>
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="resource-form">
        {apiError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{apiError}</div>
        )}

        {/* Sélecteur type ressource */}
        <Field label="Type de ressource" required>
          <div className="grid grid-cols-3 gap-2" data-testid="resource-type-selector">
            {TYPE_OPTIONS.map(({ value, label, icon: Icon, bg }) => (
              <button
                key={value}
                type="button"
                data-testid={`resource-type-${value}`}
                onClick={() => setForm((f) => ({ ...f, resource_type: value }))}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                  form.resource_type === value ? bg : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </Field>

        {/* Identité */}
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

        <Field label="Valideur N+1" hint="Par défaut = manager de l'équipe">
          <select data-testid="resource-form-validator" className={INPUT_CLS} value={form.validator_resource_id} onChange={set("validator_resource_id")}>
            <option value="">— Défaut (manager équipe) —</option>
            {valideurOptions.map((r) => (
              <option key={r.resource_id} value={r.resource_id}>{r.name} — {r.role}</option>
            ))}
          </select>
        </Field>

        {/* Référentiel */}
        <div className={`grid gap-3 ${isExterne ? "grid-cols-2" : "grid-cols-3"}`}>
          <Field label="Date d'entrée">
            <DateField testId="resource-form-entry-date" value={form.entry_date} onChange={(v) => set("entry_date")({ target: { value: v } })} />
          </Field>
          <Field label="Référence contrat">
            <input data-testid="resource-form-contract-ref" className={INPUT_CLS} value={form.contract_ref} onChange={set("contract_ref")} placeholder="Ex : CTR-2026-042" />
          </Field>
          {!isExterne && (
            <Field label="Expiration contrat" hint="si CDD">
              <DateField testId="resource-form-contract-end" value={form.contract_end} onChange={(v) => set("contract_end")({ target: { value: v } })} />
            </Field>
          )}
        </div>

        {/* Capacité & coûts */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Capacité (JH/mois)">
            <input data-testid="resource-form-capacity" type="number" className={INPUT_CLS} value={form.capacity_jh_month} onChange={set("capacity_jh_month")} min="0" max="30" />
          </Field>
          <Field label="Dispo (%)" error={errors.availability_rate}>
            <input data-testid="resource-form-availability" type="number" className={INPUT_CLS} value={form.availability_rate} onChange={set("availability_rate")} min="0" max="100" />
          </Field>
          <Field label={isRegie ? "TJM facturé (€)" : "TJM (€/jour)"}>
            <input data-testid="resource-form-tjm" type="number" className={INPUT_CLS} value={form.tjm_eur} onChange={set("tjm_eur")} min="0" placeholder="Ex : 650" />
          </Field>
        </div>

        {capaEffective !== null && Number(form.availability_rate) < 100 && (
          <p className="text-xs text-zinc-500 -mt-2">
            Capacité effective : <strong>{capaEffective} JH/mois</strong> ({form.availability_rate}% de {form.capacity_jh_month} JH)
            — soit <strong>{capaEffective * 12} JH/an</strong>
          </p>
        )}

        {/* Champs fournisseur — uniquement pour ressources externes */}
        {isExterne && (
          <div className="border-t border-zinc-100 pt-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
              Données contractuelles fournisseur
            </div>

            <Field label="Fournisseur / ESN" required error={errors.vendor}>
              <input
                data-testid="resource-form-vendor"
                className={INPUT_CLS}
                value={form.vendor}
                onChange={set("vendor")}
                placeholder="Ex : Capgemini, Accenture, Sopra Steria…"
              />
            </Field>

            {isRegie && (
              <Field label="TJM contractuel signé (€/jour)" error={errors.contract_tjm}>
                <input
                  data-testid="resource-form-contract-tjm"
                  type="number"
                  className={INPUT_CLS}
                  value={form.contract_tjm}
                  onChange={set("contract_tjm")}
                  min="0"
                  placeholder="Ex : 750"
                />
              </Field>
            )}

            {isForfait && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Enveloppe forfait (€)" error={errors.forfait_envelope}>
                  <input
                    data-testid="resource-form-forfait-envelope"
                    type="number"
                    className={INPUT_CLS}
                    value={form.forfait_envelope}
                    onChange={set("forfait_envelope")}
                    min="0"
                    placeholder="Ex : 150000"
                  />
                </Field>
                <Field label="Consommé forfait (€)" error={errors.forfait_consumed}>
                  <input
                    data-testid="resource-form-forfait-consumed"
                    type="number"
                    className={INPUT_CLS}
                    value={form.forfait_consumed}
                    onChange={set("forfait_consumed")}
                    min="0"
                    placeholder="Ex : 75000"
                  />
                </Field>
              </div>
            )}

            {isForfait && form.forfait_envelope && form.forfait_consumed && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Consommation forfait</span>
                  <span className="font-semibold">
                    {Math.round(Number(form.forfait_consumed) / Number(form.forfait_envelope) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      Number(form.forfait_consumed) / Number(form.forfait_envelope) > 0.85
                        ? "bg-rose-500"
                        : "bg-violet-500"
                    }`}
                    style={{ width: `${Math.min(Number(form.forfait_consumed) / Number(form.forfait_envelope) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Début de contrat">
                <DateField testId="resource-form-contract-start" value={form.contract_start} onChange={(v) => set("contract_start")({ target: { value: v } })} />
              </Field>
              <Field label="Expiration contrat">
                <DateField testId="resource-form-contract-end" value={form.contract_end} onChange={(v) => set("contract_end")({ target: { value: v } })} />
              </Field>
            </div>
          </div>
        )}

        <div className="border border-zinc-100 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-600">Compétences</span>
            <button type="button" onClick={() => setSkills((s) => [...s, { name: "", level: 3 }])}
              data-testid="resource-skill-add-btn"
              className="text-[11px] font-semibold text-m-blue hover:underline">+ Ajouter</button>
          </div>
          {skills.length === 0 && <p className="text-[11px] text-zinc-400">Aucune compétence renseignée.</p>}
          <div className="space-y-2">
            {skills.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={s.name} onChange={(e) => setSkills((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  placeholder="Ex : React, SAP FI, Cybersécurité…" data-testid={`resource-skill-name-${i}`}
                  className={`${INPUT_CLS} flex-1`} />
                <select value={s.level} onChange={(e) => setSkills((arr) => arr.map((x, j) => j === i ? { ...x, level: e.target.value } : x))}
                  data-testid={`resource-skill-level-${i}`} className={`${INPUT_CLS} w-32`}>
                  {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Niveau {l}</option>)}
                </select>
                <button type="button" onClick={() => setSkills((arr) => arr.filter((_, j) => j !== i))}
                  className="p-1 text-zinc-300 hover:text-rose-500" data-testid={`resource-skill-remove-${i}`}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-zinc-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={saving} data-testid="resource-form-submit"
            className="flex items-center gap-2 px-5 py-2 bg-m-blue text-white text-sm font-semibold rounded-lg hover:bg-m-blue-dark disabled:opacity-50 transition-colors">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {resource ? "Enregistrer" : "Créer la ressource"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
