import React, { useEffect, useState, useCallback } from "react";
import {
  Wrench, ToggleLeft, ToggleRight, Workflow, BookOpen, Calendar,
  Bell, Palette, Plus, Trash2, GripVertical, Save, RefreshCw,
  ChevronUp, ChevronDown, CheckCircle2, AlertCircle, Info,
  Upload,
} from "lucide-react";
import { adminConfigAPI } from "@/api";
import { useTenantConfig } from "@/contexts/TenantConfigContext";

// ─── Constantes ───────────────────────────────────────────────────────────────

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] bg-white";

const TOGGLEABLE_MODULES = [
  { id: "safe",       label: "Trains SAFe",               desc: "Gestion des Trains SAFe, PIs, Sprints, Capabilities, OKRs" },
  { id: "demands",    label: "Gestion de la Demande",      desc: "Qualification, priorisation et conversion des demandes en projets" },
  { id: "timesheets", label: "Saisie des Temps",           desc: "Déclaration hebdomadaire des temps par projet" },
  { id: "leaves",     label: "Congés",                     desc: "Gestion des absences et calcul de disponibilité" },
  { id: "vendors",    label: "Suivi Fournisseurs",         desc: "Contrats régie, forfaits, alertes TJM" },
  { id: "compliance", label: "Conformité Réglementaire",   desc: "Tableau de bord des jalons réglementaires" },
  { id: "roadmap",    label: "Roadmap Consolidée",         desc: "Vue timeline transverse des projets du portefeuille" },
];

const DEMAND_STATUSES_ALL = [
  { value: "qualifiee",   label: "Qualifiée" },
  { value: "priorisee",   label: "Priorisée" },
  { value: "acceptee",    label: "Acceptée" },
  { value: "refusee",     label: "Refusée" },
  { value: "convertie",   label: "Convertie en projet" },
];

const ENUM_SECTIONS = [
  { key: "risk_categories",    label: "Catégories de risques",        info: "Utilisé dans le formulaire Risques" },
  { key: "dependency_natures", label: "Natures de dépendances",       info: "Utilisé dans Dépendances inter-projets" },
  { key: "project_statuses",   label: "Statuts de projet",            info: "Utilisé dans la fiche projet" },
  { key: "demand_urgencies",   label: "Urgences de demande",          info: "Utilisé dans la Gestion de la Demande" },
];

const FRANCE_2026 = [
  { date: "2026-01-01", name: "Jour de l'An",       country: "FR" },
  { date: "2026-04-06", name: "Lundi de Pâques",    country: "FR" },
  { date: "2026-05-01", name: "Fête du Travail",    country: "FR" },
  { date: "2026-05-08", name: "Victoire 1945",      country: "FR" },
  { date: "2026-05-14", name: "Ascension",          country: "FR" },
  { date: "2026-05-25", name: "Lundi de Pentecôte", country: "FR" },
  { date: "2026-07-14", name: "Fête Nationale",     country: "FR" },
  { date: "2026-08-15", name: "Assomption",         country: "FR" },
  { date: "2026-11-01", name: "Toussaint",          country: "FR" },
  { date: "2026-11-11", name: "Armistice 1918",     country: "FR" },
  { date: "2026-12-25", name: "Noël",               country: "FR" },
];

const MAROC_2026 = [
  { date: "2026-01-01", name: "Nouvel An",                      country: "MA" },
  { date: "2026-01-11", name: "Manifeste de l'Indépendance",    country: "MA" },
  { date: "2026-03-20", name: "Aïd Al-Fitr (J1)",              country: "MA" },
  { date: "2026-03-21", name: "Aïd Al-Fitr (J2)",              country: "MA" },
  { date: "2026-05-01", name: "Fête du Travail",                country: "MA" },
  { date: "2026-05-27", name: "Aïd Al-Adha (J1)",              country: "MA" },
  { date: "2026-05-28", name: "Aïd Al-Adha (J2)",              country: "MA" },
  { date: "2026-07-30", name: "Fête du Trône",                  country: "MA" },
  { date: "2026-08-20", name: "Révolution du Roi et du Peuple", country: "MA" },
  { date: "2026-08-21", name: "Fête de la Jeunesse",            country: "MA" },
  { date: "2026-11-06", name: "Marche Verte",                   country: "MA" },
  { date: "2026-11-18", name: "Fête de l'Indépendance",         country: "MA" },
];

// ─── SaveBar ─────────────────────────────────────────────────────────────────

function SaveBar({ onSave, saving, dirty, success }) {
  return (
    <div className={`flex items-center gap-3 mt-6 pt-4 border-t border-gray-200 transition-opacity ${dirty ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
      <button
        onClick={onSave}
        disabled={saving || !dirty}
        data-testid="admin-config-save-btn"
        className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50"
      >
        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? "Sauvegarde…" : "Enregistrer"}
      </button>
      {success && (
        <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
          <CheckCircle2 size={14} /> Sauvegardé
        </span>
      )}
    </div>
  );
}

// ─── Section : Modules ────────────────────────────────────────────────────────

function ModulesSection({ config, onSave }) {
  const [enabled, setEnabled] = useState(config.modules_enabled || TOGGLEABLE_MODULES.map(m => m.id));
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const dirty = JSON.stringify(enabled.sort()) !== JSON.stringify((config.modules_enabled || []).sort());

  const toggle = (id) => {
    setEnabled(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminConfigAPI.updateModules({ modules_enabled: enabled });
      setSuccess(true);
      onSave();
      setTimeout(() => setSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div data-testid="section-modules">
      <div className="grid gap-3">
        {TOGGLEABLE_MODULES.map(mod => {
          const isOn = enabled.includes(mod.id);
          return (
            <div
              key={mod.id}
              data-testid={`module-toggle-${mod.id}`}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer ${
                isOn ? "border-[#0052CC]/30 bg-blue-50/40" : "border-gray-200 bg-gray-50/50 opacity-60"
              }`}
              onClick={() => toggle(mod.id)}
            >
              <button
                className="flex-shrink-0 text-[#0052CC] transition-colors"
                aria-label={`Toggle ${mod.label}`}
              >
                {isOn
                  ? <ToggleRight size={28} className="text-[#0052CC]" />
                  : <ToggleLeft size={28} className="text-slate-400" />
                }
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-slate-800">{mod.label}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{mod.desc}</div>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isOn ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"}`}>
                {isOn ? "Activé" : "Désactivé"}
              </span>
            </div>
          );
        })}
      </div>
      <SaveBar onSave={handleSave} saving={saving} dirty={dirty} success={success} />
    </div>
  );
}

// ─── Section : Workflows ──────────────────────────────────────────────────────

function WorkflowsSection({ config, onSave }) {
  const wf = config.workflows || {};
  const ts = wf.timesheet || {};
  const dm = wf.demands || {};

  const [steps, setSteps] = useState(ts.validation_steps || 2);
  const [cpTimeout, setCpTimeout] = useState(ts.cp_timeout_days ?? 3);
  const [autoValidate, setAutoValidate] = useState(ts.auto_validate_on_timeout ?? true);
  const [activeStatuses, setActiveStatuses] = useState(dm.active_statuses || DEMAND_STATUSES_ALL.map(s => s.value));
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const dirty = steps !== (ts.validation_steps || 2)
    || Number(cpTimeout) !== (ts.cp_timeout_days ?? 3)
    || autoValidate !== (ts.auto_validate_on_timeout ?? true)
    || JSON.stringify(activeStatuses.sort()) !== JSON.stringify((dm.active_statuses || []).sort());

  const toggleStatus = (val) => {
    setActiveStatuses(prev =>
      prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]
    );
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminConfigAPI.updateWorkflows({
        workflows: {
          timesheet: { validation_steps: Number(steps), cp_timeout_days: Number(cpTimeout), auto_validate_on_timeout: autoValidate },
          demands:   { active_statuses: activeStatuses },
        },
      });
      setSuccess(true);
      onSave();
      setTimeout(() => setSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="section-workflows">
      {/* Timesheet */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Workflow size={15} className="text-[#0052CC]" /> Workflow Timesheets
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-2">
              Nombre d'étapes de validation
            </label>
            <div className="flex gap-3">
              {[2, 3].map(n => (
                <label key={n} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value={n} checked={steps === n} onChange={() => { setSteps(n); setSuccess(false); }}
                    className="accent-[#0052CC]" data-testid={`ts-steps-${n}`} />
                  <span className="text-sm text-slate-700">
                    {n === 2 ? "2 étapes (Valideur → Validé)" : "3 étapes (Valideur → CP → Validé)"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          {steps === 3 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Timeout CP (jours ouvrés)
                </label>
                <input type="number" min="1" max="30" value={cpTimeout}
                  onChange={e => { setCpTimeout(e.target.value); setSuccess(false); }}
                  className={INPUT_CLS} data-testid="ts-cp-timeout" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">
                  Auto-validation si timeout
                </label>
                <div
                  className="flex items-center gap-2 cursor-pointer mt-1"
                  onClick={() => { setAutoValidate(a => !a); setSuccess(false); }}
                >
                  {autoValidate
                    ? <ToggleRight size={24} className="text-[#0052CC]" />
                    : <ToggleLeft size={24} className="text-slate-400" />
                  }
                  <span className="text-sm text-slate-700" data-testid="ts-auto-validate">
                    {autoValidate ? "Activé" : "Désactivé"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Demandes */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Workflow size={15} className="text-[#0052CC]" /> Workflow Demandes
        </div>
        <label className="text-xs font-semibold text-slate-600 block mb-3">
          Étapes actives du workflow
        </label>
        <div className="space-y-2">
          {DEMAND_STATUSES_ALL.map(s => (
            <label key={s.value}
              className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
              data-testid={`demand-status-${s.value}`}
            >
              <input type="checkbox" className="accent-[#0052CC]"
                checked={activeStatuses.includes(s.value)}
                onChange={() => toggleStatus(s.value)} />
              <span className="text-sm text-slate-700">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <SaveBar onSave={handleSave} saving={saving} dirty={dirty} success={success} />
    </div>
  );
}

// ─── Section : Référentiels ───────────────────────────────────────────────────

function EnumEditor({ items, onChange, allowDelete = true }) {
  const add = () => onChange([...items, { value: `custom_${Date.now()}`, label: "", is_system: false, order: items.length }]);
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const setField = (i, field, val) => onChange(items.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const move = (i, dir) => {
    const arr = [...items];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr.map((item, idx) => ({ ...item, order: idx })));
  };

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 group" data-testid={`enum-item-${i}`}>
          <div className="flex flex-col gap-0.5">
            <button onClick={() => move(i, -1)} disabled={i === 0}
              className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
              <ChevronUp size={11} />
            </button>
            <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
              className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
              <ChevronDown size={11} />
            </button>
          </div>
          <GripVertical size={12} className="text-slate-200 flex-shrink-0" />
          <input
            className={`${INPUT_CLS} flex-1`}
            placeholder="Label affiché…"
            value={item.label}
            onChange={e => setField(i, "label", e.target.value)}
            data-testid={`enum-label-${i}`}
          />
          <input
            className={`${INPUT_CLS} w-36 font-mono text-xs`}
            placeholder="value_interne"
            value={item.value}
            onChange={e => setField(i, "value", e.target.value)}
            disabled={item.is_system}
            title={item.is_system ? "Valeur système non modifiable" : ""}
          />
          {item.is_system
            ? <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-semibold border border-slate-200 flex-shrink-0">SYS</span>
            : allowDelete && (
              <button onClick={() => remove(i)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors" data-testid={`enum-delete-${i}`}>
                <Trash2 size={13} />
              </button>
            )
          }
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1.5 text-[11px] text-[#0052CC] hover:text-[#0047B3] font-semibold mt-2"
        data-testid="enum-add-btn"
      >
        <Plus size={11} /> Ajouter une valeur
      </button>
    </div>
  );
}

function EnumsSection({ config, onSave }) {
  const enums = config.enums || {};
  const [data, setData] = useState({
    risk_categories:    enums.risk_categories    || [],
    dependency_natures: enums.dependency_natures || [],
    project_statuses:   enums.project_statuses   || [],
    demand_urgencies:   enums.demand_urgencies   || [],
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeEnum, setActiveEnum] = useState(ENUM_SECTIONS[0].key);

  const dirty = JSON.stringify(data) !== JSON.stringify({
    risk_categories:    enums.risk_categories    || [],
    dependency_natures: enums.dependency_natures || [],
    project_statuses:   enums.project_statuses   || [],
    demand_urgencies:   enums.demand_urgencies   || [],
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentEnums = config.enums || {};
      await adminConfigAPI.updateEnums({
        enums: { ...currentEnums, ...data },
      });
      setSuccess(true);
      onSave();
      setTimeout(() => setSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  return (
    <div data-testid="section-enums">
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {ENUM_SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveEnum(s.key)}
            data-testid={`enum-tab-${s.key}`}
            className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeEnum === s.key
                ? "border-[#0052CC] text-[#0052CC]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {ENUM_SECTIONS.filter(s => s.key === activeEnum).map(s => (
        <div key={s.key} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start gap-2 mb-4">
            <div>
              <div className="font-semibold text-slate-800 text-sm">{s.label}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Info size={10} /> {s.info}
              </div>
            </div>
          </div>
          <EnumEditor
            items={data[s.key]}
            onChange={items => { setData(d => ({ ...d, [s.key]: items })); setSuccess(false); }}
          />
        </div>
      ))}

      <SaveBar onSave={handleSave} saving={saving} dirty={dirty} success={success} />
    </div>
  );
}

// ─── Section : Jours Fériés ───────────────────────────────────────────────────

function HolidaysSection({ config, onSave }) {
  const [holidays, setHolidays] = useState(config.holidays || []);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const dirty = JSON.stringify(holidays) !== JSON.stringify(config.holidays || []);

  const addHoliday = () => setHolidays(h => [...h, { date: "", name: "", country: "FR" }]);
  const remove = (i) => { setHolidays(h => h.filter((_, idx) => idx !== i)); setSuccess(false); };
  const set = (i, field, val) => { setHolidays(h => h.map((item, idx) => idx === i ? { ...item, [field]: val } : item)); setSuccess(false); };

  const loadPreset = (preset) => {
    const existing = holidays.filter(h => h.country !== (preset === "FR" ? "FR" : "MA"));
    const newHols = preset === "FR" ? FRANCE_2026 : MAROC_2026;
    setHolidays([...existing, ...newHols].sort((a, b) => a.date.localeCompare(b.date)));
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminConfigAPI.updateHolidays({ holidays });
      setSuccess(true);
      onSave();
      setTimeout(() => setSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  const grouped = holidays.reduce((acc, h) => {
    const key = h.country || "FR";
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  return (
    <div data-testid="section-holidays">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => loadPreset("FR")}
          data-testid="load-holidays-fr"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 font-semibold hover:bg-blue-100"
        >
          <Calendar size={13} /> Charger fériés France 2026
        </button>
        <button
          onClick={() => loadPreset("MA")}
          data-testid="load-holidays-ma"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded text-sm text-green-700 font-semibold hover:bg-green-100"
        >
          <Calendar size={13} /> Charger fériés Maroc 2026
        </button>
        <button
          onClick={addHoliday}
          data-testid="add-holiday-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded text-sm text-slate-600 hover:border-[#0052CC] hover:text-[#0052CC]"
        >
          <Plus size={13} /> Ajouter un jour férié
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm" data-testid="holidays-table">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Libellé</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pays</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {holidays.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">
                  Aucun jour férié configuré — chargez un pays ou ajoutez manuellement
                </td>
              </tr>
            ) : holidays.map((h, i) => (
              <tr key={i} className="hover:bg-gray-50/70" data-testid={`holiday-row-${i}`}>
                <td className="px-3 py-1.5">
                  <input type="date" className={INPUT_CLS + " text-xs"} value={h.date}
                    onChange={e => set(i, "date", e.target.value)} />
                </td>
                <td className="px-3 py-1.5">
                  <input className={INPUT_CLS + " text-xs"} value={h.name}
                    onChange={e => set(i, "name", e.target.value)} placeholder="Libellé…" />
                </td>
                <td className="px-3 py-1.5">
                  <select className={INPUT_CLS + " text-xs"} value={h.country || "FR"}
                    onChange={e => set(i, "country", e.target.value)}>
                    <option value="FR">France</option>
                    <option value="MA">Maroc</option>
                    <option value="BE">Belgique</option>
                    <option value="CH">Suisse</option>
                    <option value="LU">Luxembourg</option>
                  </select>
                </td>
                <td className="px-3 py-1.5 text-center">
                  <button onClick={() => remove(i)} className="p-1 text-slate-300 hover:text-rose-500"
                    data-testid={`holiday-delete-${i}`}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {holidays.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-[11px] text-slate-400">
            {holidays.length} jour{holidays.length > 1 ? "s" : ""} férié{holidays.length > 1 ? "s" : ""} configuré{holidays.length > 1 ? "s" : ""}
            {Object.entries(grouped).map(([country, list]) => ` · ${list.length} ${country}`).join("")}
          </div>
        )}
      </div>

      <SaveBar onSave={handleSave} saving={saving} dirty={dirty} success={success} />
    </div>
  );
}

// ─── Section : Alertes ───────────────────────────────────────────────────────

function AlertsSection({ config, onSave }) {
  const thr = config.thresholds || {};
  const [form, setForm] = useState({
    capacity_orange_pct: thr.capacity_orange_pct ?? 70,
    capacity_red_pct:    thr.capacity_red_pct    ?? 85,
    forfait_orange_pct:  thr.forfait_orange_pct  ?? 80,
    forfait_red_pct:     thr.forfait_red_pct     ?? 95,
    tjm_variance_pct:    thr.tjm_variance_pct    ?? 10,
    regulatory_days:     thr.regulatory_days     ?? 90,
    eac_ratio:           thr.eac_ratio           ?? 1.10,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify({
    capacity_orange_pct: thr.capacity_orange_pct ?? 70,
    capacity_red_pct:    thr.capacity_red_pct    ?? 85,
    forfait_orange_pct:  thr.forfait_orange_pct  ?? 80,
    forfait_red_pct:     thr.forfait_red_pct     ?? 95,
    tjm_variance_pct:    thr.tjm_variance_pct    ?? 10,
    regulatory_days:     thr.regulatory_days     ?? 90,
    eac_ratio:           thr.eac_ratio           ?? 1.10,
  });

  const set = k => e => { setForm(f => ({ ...f, [k]: Number(e.target.value) })); setSuccess(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminConfigAPI.updateThresholds({ thresholds: form });
      setSuccess(true);
      onSave();
      setTimeout(() => setSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  const FIELDS = [
    {
      group: "Capacité Équipe",
      color: "text-amber-600",
      items: [
        { key: "capacity_orange_pct", label: "Seuil alerte orange",  unit: "%", min: 1, max: 100 },
        { key: "capacity_red_pct",    label: "Seuil alerte rouge",   unit: "%", min: 1, max: 100 },
      ],
    },
    {
      group: "Forfait Fournisseur",
      color: "text-rose-600",
      items: [
        { key: "forfait_orange_pct",  label: "Seuil alerte orange",  unit: "%", min: 1, max: 100 },
        { key: "forfait_red_pct",     label: "Seuil alerte rouge",   unit: "%", min: 1, max: 100 },
      ],
    },
    {
      group: "Divers",
      color: "text-slate-600",
      items: [
        { key: "tjm_variance_pct",   label: "Écart TJM maximum",     unit: "%",   min: 0, max: 100, step: 1 },
        { key: "regulatory_days",    label: "Alerte réglementaire",   unit: "jours", min: 1, max: 365, step: 1 },
        { key: "eac_ratio",          label: "Seuil alerte EAC",       unit: "× budget", min: 1, max: 3, step: 0.01 },
      ],
    },
  ];

  return (
    <div className="space-y-4" data-testid="section-alerts">
      {FIELDS.map(group => (
        <div key={group.group} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className={`font-semibold text-sm mb-4 ${group.color}`}>{group.group}</div>
          <div className="grid grid-cols-2 gap-4">
            {group.items.map(f => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  {f.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={f.min} max={f.max} step={f.step || 1}
                    value={form[f.key]}
                    onChange={set(f.key)}
                    className={INPUT_CLS + " max-w-24 font-mono text-center"}
                    data-testid={`threshold-${f.key}`}
                  />
                  <span className="text-xs text-slate-500">{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <SaveBar onSave={handleSave} saving={saving} dirty={dirty} success={success} />
    </div>
  );
}

// ─── Section : Export PPT ─────────────────────────────────────────────────────

function BrandingSection({ config, onSave }) {
  const br = config.ppt_branding || {};
  const [form, setForm] = useState({
    primary_color:   br.primary_color   || "#0B2545",
    secondary_color: br.secondary_color || "#134074",
    accent_color:    br.accent_color    || "#10B981",
    company_name:    br.company_name    || "",
    font:            br.font            || "Arial",
    logo_base64:     br.logo_base64     || null,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [logoFile, setLogoFile] = useState(null);

  const dirty = JSON.stringify(form) !== JSON.stringify({
    primary_color:   br.primary_color   || "#0B2545",
    secondary_color: br.secondary_color || "#134074",
    accent_color:    br.accent_color    || "#10B981",
    company_name:    br.company_name    || "",
    font:            br.font            || "Arial",
    logo_base64:     br.logo_base64     || null,
  });

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setSuccess(false); };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, logo_base64: ev.target.result }));
      setLogoFile(file.name);
      setSuccess(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminConfigAPI.updateBranding({ ppt_branding: form });
      setSuccess(true);
      onSave();
      setTimeout(() => setSuccess(false), 3000);
    } finally { setSaving(false); }
  };

  const FONTS = ["Arial", "Calibri", "Helvetica", "Georgia", "Times New Roman", "Trebuchet MS"];

  return (
    <div className="space-y-4" data-testid="section-branding">
      {/* Preview */}
      <div
        className="rounded-lg p-6 text-white flex items-center gap-4"
        style={{ background: `linear-gradient(135deg, ${form.primary_color} 0%, ${form.secondary_color} 100%)` }}
      >
        {form.logo_base64 ? (
          <img src={form.logo_base64} alt="Logo" className="h-10 w-auto object-contain bg-white/10 rounded p-1" />
        ) : (
          <div className="w-12 h-10 bg-white/10 rounded flex items-center justify-center text-white/50 text-[10px] font-bold border border-white/20">
            LOGO
          </div>
        )}
        <div>
          <div className="font-bold text-lg">{form.company_name || "Nom Entreprise"}</div>
          <div className="text-sm opacity-70" style={{ color: form.accent_color }}>
            Rapport COPIL Portefeuille Projets
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Nom entreprise</label>
            <input className={INPUT_CLS} value={form.company_name} onChange={set("company_name")}
              placeholder="Groupe Altair Industries" data-testid="branding-company-name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Police PPT</label>
            <select className={INPUT_CLS} value={form.font} onChange={set("font")} data-testid="branding-font">
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {[
            { key: "primary_color",   label: "Couleur primaire" },
            { key: "secondary_color", label: "Couleur secondaire" },
            { key: "accent_color",    label: "Couleur accent" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form[key]} onChange={set(key)}
                  className="w-10 h-9 rounded border border-gray-200 cursor-pointer p-0.5"
                  data-testid={`branding-${key}`} />
                <input className={INPUT_CLS + " font-mono text-xs flex-1"} value={form[key]}
                  onChange={set(key)} placeholder="#000000" maxLength={7} />
              </div>
            </div>
          ))}

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Logo (PNG/SVG)</label>
            <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded px-3 py-2 cursor-pointer hover:border-[#0052CC] hover:bg-blue-50/30 transition-colors"
              data-testid="branding-logo-upload">
              <Upload size={14} className="text-slate-400" />
              <span className="text-sm text-slate-500 truncate">
                {logoFile || form.logo_base64 ? (logoFile || "Logo chargé") : "Choisir un fichier…"}
              </span>
              <input type="file" accept="image/png,image/svg+xml,image/jpeg" onChange={handleLogoChange} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      <SaveBar onSave={handleSave} saving={saving} dirty={dirty} success={success} />
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const TABS = [
  { id: "modules",    label: "Modules",         icon: ToggleRight },
  { id: "workflows",  label: "Workflows",        icon: Workflow },
  { id: "enums",      label: "Référentiels",     icon: BookOpen },
  { id: "holidays",   label: "Jours Fériés",     icon: Calendar },
  { id: "alerts",     label: "Alertes",          icon: Bell },
  { id: "branding",   label: "Export PPT",       icon: Palette },
];

export default function AdminConfig() {
  const { reload: reloadTenantConfig } = useTenantConfig();
  const [activeTab, setActiveTab] = useState("modules");
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConfig = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await adminConfigAPI.get();
      if (!res.data || Object.keys(res.data).length === 0) {
        // Seed initial
        const seedRes = await adminConfigAPI.seed();
        setConfig(seedRes.data);
      } else {
        setConfig(res.data);
      }
    } catch (e) {
      setError("Impossible de charger la configuration : " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = () => { loadConfig(); reloadTenantConfig(); };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw size={18} className="animate-spin mr-2" /> Chargement de la configuration…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-center gap-2 text-rose-700">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto" data-testid="admin-config-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-[#0052CC] rounded flex items-center justify-center flex-shrink-0">
          <Wrench size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold text-slate-800">Configuration du Tenant</h1>
          <p className="text-xs text-slate-400">Paramètres d'administration réservés aux administrateurs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            data-testid={`config-tab-${id}`}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === id
                ? "border-[#0052CC] text-[#0052CC]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "modules"   && <ModulesSection   config={config} onSave={handleSave} />}
      {activeTab === "workflows" && <WorkflowsSection config={config} onSave={handleSave} />}
      {activeTab === "enums"     && <EnumsSection     config={config} onSave={handleSave} />}
      {activeTab === "holidays"  && <HolidaysSection  config={config} onSave={handleSave} />}
      {activeTab === "alerts"    && <AlertsSection    config={config} onSave={handleSave} />}
      {activeTab === "branding"  && <BrandingSection  config={config} onSave={handleSave} />}
    </div>
  );
}
