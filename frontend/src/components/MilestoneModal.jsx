import React, { useState, useEffect } from "react";
import { X, Diamond } from "lucide-react";
import { useTenantConfig } from "@/contexts/TenantConfigContext";

export const FAMILY_CONFIG = {
  epic_lifecycle: {
    label: "Epic Lifecycle",
    desc: "Marque le démarrage d'une phase projet",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    fill: "#EAB308",
    types: [
      { value: "kick_off",         label: "Kick-off" },
      { value: "review",           label: "Review / PI Planning" },
      { value: "epic_analysis",    label: "Epic Analysis" },
      { value: "general_design",   label: "General Design" },
      { value: "detailed_design",  label: "Detailed Design" },
      { value: "development",      label: "Development" },
      { value: "sit",              label: "SIT — System Integration Test" },
      { value: "uat",              label: "UAT — User Acceptance Test" },
      { value: "cut_over",         label: "Cut-over" },
      { value: "hypercare",        label: "Hypercare" },
      { value: "change_management","label": "Change Management" },
    ],
  },
  epic_milestone: {
    label: "Epic Milestone",
    desc: "Jalon clé lié à ce projet",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-300",
    fill: "#8B5CF6",
    types: [
      { value: "go_no_go",      label: "GO / NO-GO" },
      { value: "contractual",   label: "Contractuel" },
      { value: "roll_out",      label: "Roll-out" },
      { value: "key_deliverable", label: "Livrable clé" },
      { value: "go_live",       label: "Go-Live" },
    ],
  },
  transversal: {
    label: "Transversal",
    desc: "Événement transverse cross-projets",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    fill: "#10B981",
    types: [
      { value: "dependency",  label: "Dépendance inter-épics" },
      { value: "regulatory",  label: "Réglementaire" },
      { value: "decomm",      label: "Décommissionnement" },
    ],
  },
};

export const MILESTONE_STATUSES = [
  { value: "planned",  label: "Prévu" },
  { value: "achieved", label: "Atteint" },
  { value: "at_risk",  label: "À risque" },
  { value: "delayed",  label: "En retard" },
];

export default function MilestoneModal({ milestone, projectId, resources, onSave, onClose, isAdmin }) {
  const isEdit = !!milestone;
  const { config } = useTenantConfig();

  const [family, setFamily] = useState(milestone?.family || "");
  const [type, setType]     = useState(milestone?.type || "");
  const [name, setName]     = useState(milestone?.name || "");
  const [dateBaseline, setDateBaseline] = useState(milestone?.date_baseline || "");
  const [dateForecast, setDateForecast] = useState(milestone?.date_forecast || "");
  const [dateActual, setDateActual]     = useState(milestone?.date_actual || "");
  const [status, setStatus] = useState(milestone?.status || "planned");
  const [isGovernance, setIsGovernance] = useState(milestone?.is_governance || false);
  const [attribute, setAttribute]       = useState(milestone?.attribute || "");
  const [comment, setComment]           = useState(milestone?.comment || "");
  const [ownerResId, setOwnerResId]     = useState(milestone?.owner_resource_id || "");
  const [deliverable, setDeliverable]   = useState(milestone?.deliverable || "");
  const [isBlocking, setIsBlocking]     = useState(milestone?.is_blocking || false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const familyCfg = FAMILY_CONFIG[family] || null;
  // Merge tenant types with hardcoded defaults for this family
  const tenantFamilyTypes = config?.enums?.milestone_types?.[family]?.types;
  const filteredTypes = tenantFamilyTypes?.length > 0 ? tenantFamilyTypes : (familyCfg?.types || []);

  // Reset type when family changes
  useEffect(() => {
    if (family && !filteredTypes.find((t) => t.value === type)) {
      setType("");
    }
  }, [family]); // eslint-disable-line

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Le nom est requis"); return; }
    if (!family) { setError("La famille est requise"); return; }
    if (!type) { setError("Le type est requis"); return; }
    if (!dateBaseline) { setError("La date baseline est requise"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        project_id: projectId,
        name: name.trim(),
        family,
        type,
        date_baseline: dateBaseline,
        date_forecast: dateForecast || dateBaseline,
        date_actual: dateActual || null,
        status,
        is_governance: isGovernance,
        attribute: attribute || null,
        comment: comment.slice(0, 500),
        owner_resource_id: ownerResId || null,
        deliverable: deliverable || null,
        is_blocking: isBlocking,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="milestone-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Diamond size={16} className="text-[#0052CC]" />
            <h2 className="font-heading text-lg font-bold text-[#0F172A]">
              {isEdit ? "Modifier le jalon" : "Nouveau jalon"}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Step 1 — Family selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">
              Famille *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(FAMILY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFamily(key)}
                  data-testid={`family-card-${key}`}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    family === key
                      ? `${cfg.border} ${cfg.bg}`
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="12" height="12" viewBox="0 0 12 12">
                      <polygon points="6,1 11,6 6,11 1,6" fill={family === key ? cfg.fill : "#CBD5E1"} />
                    </svg>
                    <span className={`text-xs font-bold ${family === key ? cfg.color : "text-slate-500"}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">{cfg.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Type (filtered by family) */}
          {family && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
                data-testid="milestone-type-select"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]"
              >
                <option value="">— Sélectionner le type —</option>
                {filteredTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
              Nom du jalon *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              placeholder="Ex: Go-Live SI Finance"
              data-testid="milestone-name-input"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]"
            />
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Date baseline *
              </label>
              <input type="date" value={dateBaseline} onChange={(e) => setDateBaseline(e.target.value)} required data-testid="milestone-date-baseline"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Date forecast
              </label>
              <input type="date" value={dateForecast} onChange={(e) => setDateForecast(e.target.value)} data-testid="milestone-date-forecast"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Date réelle
              </label>
              <input type="date" value={dateActual} onChange={(e) => setDateActual(e.target.value)} data-testid="milestone-date-actual"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]" />
            </div>
          </div>

          {/* Status + Governance row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Statut
              </label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="milestone-status-select"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]">
                {MILESTONE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Owner
              </label>
              <select value={ownerResId} onChange={(e) => setOwnerResId(e.target.value)} data-testid="milestone-owner-select"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]">
                <option value="">— Aucun owner —</option>
                {resources.map((r) => (
                  <option key={r.resource_id} value={r.resource_id}>{r.name} ({r.role})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Deliverable */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
              Livrable attendu
            </label>
            <input type="text" value={deliverable} onChange={(e) => setDeliverable(e.target.value)} maxLength={200}
              placeholder="Ex: PV de recette signé, Rapport GAP Analysis..."
              data-testid="milestone-deliverable-input"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]" />
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
              Commentaire CP
            </label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={500}
              placeholder="Contexte, risques, points d'attention..."
              data-testid="milestone-comment-input"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC] resize-none" />
            <div className="text-[10px] text-slate-400 text-right">{comment.length}/500</div>
          </div>

          {/* Toggles row */}
          <div className="flex items-center gap-6 flex-wrap">
            {/* Attribute (ADMIN/PMO only) */}
            {isAdmin && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                  Attribut
                </label>
                <div className="flex items-center gap-2">
                  {["", "critical", "strategic"].map((val) => (
                    <button key={val} type="button"
                      onClick={() => setAttribute(val)}
                      data-testid={`attribute-btn-${val || "none"}`}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                        attribute === val
                          ? val === "critical" ? "bg-rose-100 border-rose-400 text-rose-700"
                            : val === "strategic" ? "bg-blue-100 border-blue-400 text-blue-700"
                            : "bg-slate-100 border-slate-300 text-slate-600"
                          : "bg-white border-gray-200 text-slate-400 hover:border-gray-300"
                      }`}>
                      {val === "" ? "Aucun" : val === "critical" ? "Critical" : "Strategic"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Blocking toggle */}
            <div className="flex items-center gap-2 mt-1">
              <button type="button" onClick={() => setIsBlocking(!isBlocking)}
                data-testid="milestone-blocking-toggle"
                className={`relative w-9 h-5 rounded-full transition-colors ${isBlocking ? "bg-rose-500" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isBlocking ? "translate-x-4" : ""}`} />
              </button>
              <span className="text-xs font-medium text-slate-600">Bloquant</span>
            </div>

            {/* Governance toggle */}
            <div className="flex items-center gap-2 mt-1">
              <button type="button" onClick={() => setIsGovernance(!isGovernance)}
                data-testid="milestone-governance-toggle"
                className={`relative w-9 h-5 rounded-full transition-colors ${isGovernance ? "bg-[#0052CC]" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isGovernance ? "translate-x-4" : ""}`} />
              </button>
              <span className="text-xs font-medium text-slate-600">Gouvernance</span>
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving} data-testid="milestone-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-[#0052CC] text-white rounded-lg hover:bg-[#0047B3] transition-colors disabled:opacity-60">
              {saving ? "Sauvegarde..." : isEdit ? "Enregistrer" : "Créer le jalon"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
