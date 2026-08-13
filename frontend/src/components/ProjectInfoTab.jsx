import React, { useEffect, useState } from "react";
import { Save, Check } from "lucide-react";
import { toast } from "sonner";
import { projectsAPI, programsAPI, applicationsAPI, safeAPI, resourcesAPI } from "@/api";

const inputCls = "w-full h-10 bg-[#fbfaff] border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm text-[#26243a] focus:outline-none focus:border-[#2e5fe8] disabled:opacity-60 disabled:cursor-not-allowed";
const areaCls = "w-full bg-[#fbfaff] border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 py-2 text-sm text-[#26243a] focus:outline-none focus:border-[#2e5fe8] disabled:opacity-60 disabled:cursor-not-allowed";

const Field = ({ label, children, full }) => (
  <div className={full ? "md:col-span-2" : ""}>
    <label className="block text-[11px] uppercase tracking-wider font-bold text-[#8a87a0] mb-1.5">{label}</label>
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
  });
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
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-5 md:p-6" data-testid="project-info-tab">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-base font-bold text-[#26243a]">Informations du projet</h2>
        {canWrite && (
          <button onClick={save} disabled={saving} data-testid="project-info-save-btn"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2e5fe8] text-white text-sm font-bold rounded-lg hover:bg-[#2450c8] transition-colors disabled:opacity-60">
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
            <p className="text-sm text-[#8a87a0]">Aucune application dans le référentiel APM.</p>
          ) : (
            <div className="border-[1.5px] border-[#dcd7ea] rounded-[10px] bg-[#fbfaff] max-h-44 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1" data-testid="info-impacted-apps">
              {applications.map((a) => {
                const checked = form.impacted_application_ids.includes(a.application_id);
                return (
                  <label key={a.application_id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${checked ? "bg-[#e9effe] text-[#2e5fe8] font-semibold" : "text-[#26243a] hover:bg-[#f0eefc]"} ${!canWrite ? "pointer-events-none opacity-60" : ""}`}
                    data-testid={`info-app-${a.application_id}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleApp(a.application_id)} disabled={!canWrite} className="hidden" />
                    <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${checked ? "bg-[#2e5fe8] border-[#2e5fe8]" : "border-[#dcd7ea] bg-white"}`}>
                      {checked && <Check size={11} className="text-white" />}
                    </span>
                    <span className="truncate">{a.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </Field>
      </div>
    </div>
  );
};
