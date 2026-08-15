import React, { useEffect, useState } from "react";
import { Save, Check } from "lucide-react";
import { toast } from "sonner";
import { projectsAPI, programsAPI, applicationsAPI, safeAPI, resourcesAPI } from "@/api";

const inputCls = "w-full h-10 bg-m-bg border-[1.5px] border-m-border-strong rounded-lg px-3 text-sm text-m-ink focus:outline-none focus:border-m-blue disabled:opacity-60 disabled:cursor-not-allowed";
const areaCls = "w-full bg-m-bg border-[1.5px] border-m-border-strong rounded-lg px-3 py-2 text-sm text-m-ink focus:outline-none focus:border-m-blue disabled:opacity-60 disabled:cursor-not-allowed";

const Field = ({ label, children, full }) => (
  <div className={full ? "md:col-span-2" : ""}>
    <label className="block text-[11px] uppercase tracking-wider font-bold text-m-muted mb-1.5">{label}</label>
    {children}
  </div>
);

export const ProjectInfoTab = ({ project, canWrite, onSaved }) => {
  const [form, setForm] = useState({
    direction: project.direction || "",
    program_id: project.program_id || "",
    description: project.description || "",
    leading_indicators: project.leading_indicators || "",
    outcome: project.outcome || "",
    income: project.income ?? "",
    expected_result: project.expected_result || "",
    impacted_application_ids: project.impacted_application_ids || [],
    art_train_id: project.art_train_id || "",
    epic_owner_id: project.epic_owner_id || "",
    scope_in: project.scope_in || "",
    scope_out: project.scope_out || "",
    nfr: project.nfr || "",
    impacted_entities: (project.impacted_entities || []).join(", "),
    build_to_run: project.build_to_run || "",
  });
  const [roles, setRoles] = useState(project.governance_roles || []);
  const [breakdown, setBreakdown] = useState(project.budget_breakdown || []);
  const [programs, setPrograms] = useState([]);
  const [applications, setApplications] = useState([]);
  const [trains, setTrains] = useState([]);
  const [resources, setResources] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    programsAPI.list().then((r) => setPrograms(r.data || [])).catch(() => {});
    applicationsAPI.list().then((r) => setApplications(r.data || [])).catch(() => {});
    safeAPI.listTrains().then((r) => setTrains(r.data || [])).catch(() => {});
    resourcesAPI.list().then((r) => setResources(r.data || [])).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleApp = (id) =>
    setForm((f) => ({
      ...f,
      impacted_application_ids: f.impacted_application_ids.includes(id)
        ? f.impacted_application_ids.filter((a) => a !== id)
        : [...f.impacted_application_ids, id],
    }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        income: form.income === "" ? null : parseFloat(form.income),
        program_id: form.program_id || null,
        art_train_id: form.art_train_id || null,
        epic_owner_id: form.epic_owner_id || null,
        impacted_entities: form.impacted_entities.split(",").map((s) => s.trim()).filter(Boolean),
        governance_roles: roles.filter((r) => r.name?.trim()),
        budget_breakdown: breakdown.filter((b) => b.entity?.trim()).map((b) => ({
          entity: b.entity, capex: parseFloat(b.capex) || 0, opex: parseFloat(b.opex) || 0,
        })),
      };
      await projectsAPI.update(project.project_id, payload);
      toast.success("Informations projet enregistrées");
      onSaved && onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-5 md:p-6" data-testid="project-info-tab">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-base font-bold text-m-ink">Informations du projet</h2>
        {canWrite && (
          <button onClick={save} disabled={saving} data-testid="project-info-save-btn"
            className="flex items-center gap-1.5 px-4 py-2 bg-m-blue text-white text-sm font-bold rounded-lg hover:bg-m-blue-dark transition-colors disabled:opacity-60">
            <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Direction">
          <input value={form.direction} onChange={set("direction")} disabled={!canWrite}
            placeholder="ex. Direction Financière" data-testid="info-direction-input" className={inputCls} />
        </Field>
        <Field label="Programme">
          <select value={form.program_id} onChange={set("program_id")} disabled={!canWrite}
            data-testid="info-program-select" className={inputCls}>
            <option value="">— Aucun —</option>
            {programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Description" full>
          <textarea value={form.description} onChange={set("description")} disabled={!canWrite} rows={3}
            data-testid="info-description-input" className={areaCls} />
        </Field>
        <Field label="Leading indicators">
          <textarea value={form.leading_indicators} onChange={set("leading_indicators")} disabled={!canWrite} rows={3}
            placeholder="Indicateurs avancés mesurant la progression vers l'outcome" data-testid="info-leading-indicators-input" className={areaCls} />
        </Field>
        <Field label="Outcome">
          <textarea value={form.outcome} onChange={set("outcome")} disabled={!canWrite} rows={3}
            placeholder="Résultat métier attendu" data-testid="info-outcome-input" className={areaCls} />
        </Field>
        <Field label="Income (€)">
          <input type="number" value={form.income} onChange={set("income")} disabled={!canWrite}
            placeholder="0" data-testid="info-income-input" className={inputCls} />
        </Field>
        <Field label="Expected result">
          <textarea value={form.expected_result} onChange={set("expected_result")} disabled={!canWrite} rows={2}
            data-testid="info-expected-result-input" className={areaCls} />
        </Field>
        <Field label="ART (Train SAFe)">
          <select value={form.art_train_id} onChange={set("art_train_id")} disabled={!canWrite}
            data-testid="info-art-select" className={inputCls}>
            <option value="">— Aucun —</option>
            {trains.map((t) => <option key={t.train_id} value={t.train_id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Epic Owner">
          <select value={form.epic_owner_id} onChange={set("epic_owner_id")} disabled={!canWrite}
            data-testid="info-epic-owner-select" className={inputCls}>
            <option value="">— Aucun —</option>
            {resources.map((r) => <option key={r.resource_id} value={r.resource_id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Produits / Applications impactés" full>
          {applications.length === 0 ? (
            <p className="text-sm text-m-muted">Aucune application dans le référentiel APM.</p>
          ) : (
            <div className="border-[1.5px] border-m-border-strong rounded-lg bg-m-bg max-h-44 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1" data-testid="info-impacted-apps">
              {applications.map((a) => {
                const checked = form.impacted_application_ids.includes(a.application_id);
                return (
                  <label key={a.application_id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${checked ? "bg-m-blue-soft text-m-blue font-semibold" : "text-m-ink hover:bg-m-lilac"} ${!canWrite ? "pointer-events-none opacity-60" : ""}`}
                    data-testid={`info-app-${a.application_id}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleApp(a.application_id)} disabled={!canWrite} className="hidden" />
                    <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${checked ? "bg-m-blue border-m-blue" : "border-m-border-strong bg-white"}`}>
                      {checked && <Check size={11} className="text-white" />}
                    </span>
                    <span className="truncate">{a.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </Field>

        <div className="md:col-span-2 border-t border-zinc-100 pt-4 mt-1">
          <h3 className="font-heading text-sm font-bold text-m-ink mb-3">Cadrage & gouvernance</h3>
        </div>
        <Field label="Périmètre inclus">
          <textarea value={form.scope_in} onChange={set("scope_in")} disabled={!canWrite} rows={2}
            placeholder="Ce qui fait partie du projet" data-testid="info-scope-in-input" className={areaCls} />
        </Field>
        <Field label="Périmètre exclu">
          <textarea value={form.scope_out} onChange={set("scope_out")} disabled={!canWrite} rows={2}
            placeholder="Ce qui n'en fait pas partie" data-testid="info-scope-out-input" className={areaCls} />
        </Field>
        <Field label="Exigences non fonctionnelles">
          <textarea value={form.nfr} onChange={set("nfr")} disabled={!canWrite} rows={2}
            placeholder="Performance, sécurité, RGPD, disponibilité…" data-testid="info-nfr-input" className={areaCls} />
        </Field>
        <Field label="Entités / sites impactés">
          <input value={form.impacted_entities} onChange={set("impacted_entities")} disabled={!canWrite}
            placeholder="Siège, Filiale Espagne, Usine Lyon (séparés par des virgules)" data-testid="info-entities-input" className={inputCls} />
        </Field>
        <Field label="Impact exploitation (build-to-run)" full>
          <textarea value={form.build_to_run} onChange={set("build_to_run")} disabled={!canWrite} rows={2}
            placeholder="Impact sur le run : maintenance, supervision, support, horaires de service…" data-testid="info-build-to-run-input" className={areaCls} />
        </Field>
        <Field label="Rôles de gouvernance" full>
          <div className="space-y-1.5" data-testid="info-governance-roles">
            {roles.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={r.role} disabled={!canWrite}
                  onChange={(e) => setRoles((arr) => arr.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
                  className={`${inputCls} w-56`}>
                  {["Sponsor", "Chef de projet", "Responsable produit", "Product Owner", "Architecte", "Sécurité", "DPO", "Juridique", "Responsable métier", "Autre"].map((o) => <option key={o}>{o}</option>)}
                </select>
                <input value={r.name} disabled={!canWrite} placeholder="Nom"
                  onChange={(e) => setRoles((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  data-testid={`info-role-name-${i}`} className={`${inputCls} flex-1`} />
                {canWrite && (
                  <button type="button" onClick={() => setRoles((arr) => arr.filter((_, j) => j !== i))}
                    className="text-zinc-300 hover:text-rose-500 text-lg leading-none px-1">×</button>
                )}
              </div>
            ))}
            {canWrite && (
              <button type="button" onClick={() => setRoles((arr) => [...arr, { role: "Sponsor", name: "" }])}
                data-testid="info-add-role-btn"
                className="text-[11px] font-semibold text-m-blue hover:underline">+ Ajouter un rôle</button>
            )}
          </div>
        </Field>
        <Field label="Ventilation budgétaire par entité" full>
          <div className="space-y-1.5" data-testid="info-budget-breakdown">
            {breakdown.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={b.entity} disabled={!canWrite} placeholder="Entité (ex. Siège)"
                  onChange={(e) => setBreakdown((arr) => arr.map((x, j) => (j === i ? { ...x, entity: e.target.value } : x)))}
                  className={`${inputCls} flex-1`} />
                <input type="number" value={b.capex} disabled={!canWrite} placeholder="Capex €"
                  onChange={(e) => setBreakdown((arr) => arr.map((x, j) => (j === i ? { ...x, capex: e.target.value } : x)))}
                  className={`${inputCls} w-32`} />
                <input type="number" value={b.opex} disabled={!canWrite} placeholder="Opex €"
                  onChange={(e) => setBreakdown((arr) => arr.map((x, j) => (j === i ? { ...x, opex: e.target.value } : x)))}
                  className={`${inputCls} w-32`} />
                {canWrite && (
                  <button type="button" onClick={() => setBreakdown((arr) => arr.filter((_, j) => j !== i))}
                    className="text-zinc-300 hover:text-rose-500 text-lg leading-none px-1">×</button>
                )}
              </div>
            ))}
            {canWrite && (
              <button type="button" onClick={() => setBreakdown((arr) => [...arr, { entity: "", capex: "", opex: "" }])}
                data-testid="info-add-breakdown-btn"
                className="text-[11px] font-semibold text-m-blue hover:underline">+ Ajouter une entité</button>
            )}
          </div>
        </Field>
      </div>
    </div>
  );
};
