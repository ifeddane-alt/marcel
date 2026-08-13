import React, { useState } from "react";
import { AppWindow, X } from "lucide-react";

export const APP_STATUSES = [
  { value: "etude", label: "Étude" },
  { value: "build", label: "Build" },
  { value: "production", label: "Production" },
  { value: "decommissionnement", label: "Décommissionnement" },
  { value: "retiree", label: "Retirée" },
];
export const APP_STATUS_CFG = {
  etude: "bg-zinc-50 text-zinc-600 border-zinc-200",
  build: "bg-blue-50 text-blue-700 border-blue-200",
  production: "bg-emerald-50 text-emerald-700 border-emerald-200",
  decommissionnement: "bg-amber-50 text-amber-700 border-amber-200",
  retiree: "bg-rose-50 text-rose-600 border-rose-200",
};
export const TIME_RATINGS = [
  { value: "invest", label: "Invest" },
  { value: "tolerate", label: "Tolerate" },
  { value: "migrate", label: "Migrate" },
  { value: "eliminate", label: "Eliminate" },
];
export const TIME_CFG = {
  invest: "bg-emerald-50 text-emerald-700 border-emerald-200",
  tolerate: "bg-blue-50 text-blue-700 border-blue-200",
  migrate: "bg-amber-50 text-amber-700 border-amber-200",
  eliminate: "bg-rose-50 text-rose-700 border-rose-200",
};
export const CRITICALITIES = [
  { value: "basse", label: "Basse" },
  { value: "moyenne", label: "Moyenne" },
  { value: "haute", label: "Haute" },
  { value: "critique", label: "Critique" },
];
export const CRIT_CFG = {
  basse: "bg-zinc-50 text-zinc-500 border-zinc-200",
  moyenne: "bg-blue-50 text-blue-700 border-blue-200",
  haute: "bg-amber-50 text-amber-700 border-amber-200",
  critique: "bg-rose-50 text-rose-700 border-rose-200",
};

const inputCls = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600";
const labelCls = "block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5";

export default function ApplicationModal({ app, onClose, onSave }) {
  const isEdit = !!app;
  const [form, setForm] = useState({
    name: app?.name || "",
    code: app?.code || "",
    description: app?.description || "",
    status: app?.status || "production",
    criticality: app?.criticality || "moyenne",
    time_rating: app?.time_rating || "",
    editor: app?.editor || "",
    technology: app?.technology || "",
    hosting: app?.hosting || "on_premise",
    data_sensitivity: app?.data_sensitivity || "interne",
    business_owner: app?.business_owner || "",
    it_owner: app?.it_owner || "",
    users_count: app?.users_count ?? "",
    tco_annual: app?.tco_annual ?? "",
    business_capabilities: (app?.business_capabilities || []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...form,
        time_rating: form.time_rating || null,
        users_count: form.users_count === "" ? null : parseInt(form.users_count, 10),
        tco_annual: form.tco_annual === "" ? null : parseFloat(form.tco_annual),
        business_capabilities: form.business_capabilities.split(",").map((s) => s.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la sauvegarde");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="application-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <AppWindow size={16} className="text-[#352c6e]" />
            <h2 className="font-heading text-lg font-bold text-zinc-950">
              {isEdit ? "Modifier l'application" : "Nouvelle application"}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" data-testid="application-modal-close"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nom *</label>
              <input value={form.name} onChange={set("name")} required data-testid="app-name-input"
                placeholder="Ex : SAP S/4HANA" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Code</label>
              <input value={form.code} onChange={set("code")} data-testid="app-code-input" placeholder="Ex : ERP-01" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={set("description")} rows={2} data-testid="app-description-input"
              className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Cycle de vie</label>
              <select value={form.status} onChange={set("status")} data-testid="app-status-select" className={`${inputCls} bg-white`}>
                {APP_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Criticité métier</label>
              <select value={form.criticality} onChange={set("criticality")} data-testid="app-criticality-select" className={`${inputCls} bg-white`}>
                {CRITICALITIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Classification TIME</label>
              <select value={form.time_rating} onChange={set("time_rating")} data-testid="app-time-select" className={`${inputCls} bg-white`}>
                <option value="">— Non classée —</option>
                {TIME_RATINGS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Éditeur</label>
              <input value={form.editor} onChange={set("editor")} data-testid="app-editor-input" placeholder="Ex : SAP" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Technologie</label>
              <input value={form.technology} onChange={set("technology")} data-testid="app-technology-input" placeholder="Ex : ABAP, Java" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hébergement</label>
              <select value={form.hosting} onChange={set("hosting")} data-testid="app-hosting-select" className={`${inputCls} bg-white`}>
                <option value="on_premise">On-premise</option>
                <option value="cloud">Cloud (IaaS/PaaS)</option>
                <option value="saas">SaaS</option>
                <option value="hybride">Hybride</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Sensibilité données</label>
              <select value={form.data_sensitivity} onChange={set("data_sensitivity")} data-testid="app-sensitivity-select" className={`${inputCls} bg-white`}>
                <option value="publique">Publique</option>
                <option value="interne">Interne</option>
                <option value="confidentielle">Confidentielle</option>
                <option value="reglementee">Réglementée (RGPD/santé…)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Owner métier</label>
              <input value={form.business_owner} onChange={set("business_owner")} data-testid="app-business-owner-input" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Owner IT</label>
              <input value={form.it_owner} onChange={set("it_owner")} data-testid="app-it-owner-input" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nb utilisateurs</label>
              <input type="number" min="0" value={form.users_count} onChange={set("users_count")} data-testid="app-users-input" className={`${inputCls} font-mono-data`} />
            </div>
            <div>
              <label className={labelCls}>TCO annuel (€)</label>
              <input type="number" min="0" step="any" value={form.tco_annual} onChange={set("tco_annual")} data-testid="app-tco-input" className={`${inputCls} font-mono-data`} />
            </div>
            <div>
              <label className={labelCls}>Capacités métiers</label>
              <input value={form.business_capabilities} onChange={set("business_capabilities")} data-testid="app-capabilities-input"
                placeholder="Finance, RH… (virgules)" className={inputCls} />
            </div>
          </div>
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">Annuler</button>
            <button type="submit" disabled={saving} data-testid="app-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
              {saving ? "Sauvegarde..." : isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
