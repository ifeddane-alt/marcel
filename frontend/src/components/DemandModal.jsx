import React, { useState, useEffect } from "react";
import { X, Calendar, Euro, User, Briefcase, TrendingUp, AlertTriangle } from "lucide-react";
import { demandsAPI } from "@/api";
import { toast } from "sonner";

const URGENCY_CFG = {
  low:      { label: "Faible",   color: "bg-slate-100 text-slate-600 border-slate-200" },
  medium:   { label: "Moyen",    color: "bg-blue-50 text-blue-700 border-blue-200" },
  high:     { label: "Élevé",    color: "bg-amber-50 text-amber-700 border-amber-200" },
  critical: { label: "Critique", color: "bg-rose-50 text-rose-700 border-rose-200" },
};

const STATUS_CFG = {
  nouvelle:  { label: "Nouvelle",  color: "bg-slate-100 text-slate-700" },
  qualifiee: { label: "Qualifiée", color: "bg-blue-50 text-blue-700" },
  priorisee: { label: "Priorisée", color: "bg-violet-50 text-violet-700" },
  acceptee:  { label: "Acceptée",  color: "bg-emerald-50 text-emerald-700" },
  refusee:   { label: "Refusée",   color: "bg-rose-50 text-rose-700" },
  convertie: { label: "Convertie", color: "bg-teal-50 text-teal-700" },
};

// ─── Sous-composant : formulaire création/édition ───────────────────────────
function DemandForm({ form, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Titre <span className="text-rose-500">*</span>
        </label>
        <input
          data-testid="demand-title-input"
          type="text"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
          placeholder="Titre de la demande"
          value={form.title}
          onChange={(e) => onChange("title", e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
        <textarea
          data-testid="demand-description-input"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 resize-none"
          rows={3}
          placeholder="Contexte et objectifs du projet..."
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Demandeur <span className="text-rose-500">*</span>
        </label>
        <input
          data-testid="demand-requester-input"
          type="text"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
          placeholder="Nom du demandeur"
          value={form.requester}
          onChange={(e) => onChange("requester", e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Direction / Département</label>
        <input
          data-testid="demand-department-input"
          type="text"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
          placeholder="Direction Financière, DSI…"
          value={form.requester_department}
          onChange={(e) => onChange("requester_department", e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-semibold text-slate-600 mb-1">Valeur métier</label>
        <textarea
          data-testid="demand-business-value-input"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 resize-none"
          rows={2}
          placeholder="Bénéfices attendus, KPIs cibles..."
          value={form.business_value}
          onChange={(e) => onChange("business_value", e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Budget estimé (€)</label>
        <input
          data-testid="demand-budget-input"
          type="number"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
          placeholder="0"
          min="0"
          value={form.estimated_budget}
          onChange={(e) => onChange("estimated_budget", e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Urgence</label>
        <select
          data-testid="demand-urgency-select"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 bg-white"
          value={form.urgency}
          onChange={(e) => onChange("urgency", e.target.value)}
        >
          <option value="low">Faible</option>
          <option value="medium">Moyen</option>
          <option value="high">Élevé</option>
          <option value="critical">Critique</option>
        </select>
      </div>
    </div>
  );
}

// ─── Sous-composant : actions workflow ──────────────────────────────────────
function WorkflowActions({ demand, canWrite, onTransition, onConvert }) {
  const [showRefuseReason, setShowRefuseReason] = useState(false);
  const [showPriorityScore, setShowPriorityScore] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  const [priorityScore, setPriorityScore] = useState(demand.priority_score || 50);

  if (!canWrite) return null;

  return (
    <div className="border-t border-slate-100 pt-4 mt-4">
      <div className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">
        Actions workflow
      </div>

      <div className="flex flex-wrap gap-2">
        {demand.status === "nouvelle" && (
          <button
            data-testid="btn-qualify"
            onClick={() => onTransition("qualify")}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Qualifier
          </button>
        )}

        {demand.status === "qualifiee" && (
          <>
            {showPriorityScore ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  data-testid="priority-score-input"
                  type="number"
                  min="0"
                  max="100"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                  placeholder="Score 0-100"
                  value={priorityScore}
                  onChange={(e) => setPriorityScore(Number(e.target.value))}
                />
                <button
                  data-testid="btn-confirm-prioritize"
                  onClick={() => { onTransition("prioritize", { priority_score: priorityScore }); setShowPriorityScore(false); }}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
                >
                  Confirmer
                </button>
                <button onClick={() => setShowPriorityScore(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
                  Annuler
                </button>
              </div>
            ) : (
              <button
                data-testid="btn-prioritize"
                onClick={() => setShowPriorityScore(true)}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
              >
                Prioriser
              </button>
            )}
          </>
        )}

        {demand.status === "priorisee" && (
          <>
            <button
              data-testid="btn-accept"
              onClick={() => onTransition("accept")}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              Accepter
            </button>

            {showRefuseReason ? (
              <div className="w-full mt-2 space-y-2">
                <textarea
                  data-testid="refuse-reason-input"
                  rows={2}
                  className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/40 resize-none"
                  placeholder="Motif de refus obligatoire..."
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    data-testid="btn-confirm-refuse"
                    onClick={() => { if (!refuseReason.trim()) return toast.error("Le motif est obligatoire"); onTransition("refuse", { rejection_reason: refuseReason }); setShowRefuseReason(false); }}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors"
                  >
                    Confirmer le refus
                  </button>
                  <button onClick={() => setShowRefuseReason(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                data-testid="btn-refuse"
                onClick={() => setShowRefuseReason(true)}
                className="px-4 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition-colors"
              >
                Refuser
              </button>
            )}
          </>
        )}

        {demand.status === "acceptee" && (
          <button
            data-testid="btn-convert"
            onClick={onConvert}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors flex items-center gap-2"
          >
            <Briefcase size={14} />
            Convertir en projet
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Modal principal ─────────────────────────────────────────────────────────
export default function DemandModal({ demand, onClose, onSaved, canWrite, onConvert }) {
  const isEdit = !!demand?.demand_id;
  const statusCfg = demand ? STATUS_CFG[demand.status] : null;

  const [form, setForm] = useState({
    title:                demand?.title               || "",
    description:          demand?.description         || "",
    requester:            demand?.requester           || "",
    requester_department: demand?.requester_department || "",
    business_value:       demand?.business_value      || "",
    estimated_budget:     demand?.estimated_budget    || "",
    urgency:              demand?.urgency             || "medium",
  });
  const [loading, setLoading] = useState(false);

  function change(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) return toast.error("Le titre est obligatoire");
    if (!form.requester.trim()) return toast.error("Le demandeur est obligatoire");
    setLoading(true);
    try {
      const payload = {
        ...form,
        estimated_budget: form.estimated_budget ? parseFloat(form.estimated_budget) : undefined,
      };
      if (isEdit) {
        await demandsAPI.update(demand.demand_id, payload);
        toast.success("Demande mise à jour");
      } else {
        await demandsAPI.create(payload);
        toast.success("Demande créée avec succès");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  }

  async function handleTransition(action, extra = {}) {
    setLoading(true);
    try {
      await demandsAPI.transition(demand.demand_id, { action, ...extra });
      toast.success("Statut mis à jour");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de transition");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        data-testid="demand-modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-800">
              {isEdit ? "Modifier la demande" : "Nouvelle demande"}
            </h2>
            {statusCfg && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            )}
          </div>
          <button
            data-testid="demand-modal-close"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Informations de la demande existante (vue detail) */}
          {isEdit && demand?.rejection_reason && (
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">Motif de refus</div>
                <div>{demand.rejection_reason}</div>
              </div>
            </div>
          )}

          {isEdit && demand?.status === "convertie" && demand?.converted_project_id && (
            <div className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-700">
              <Briefcase size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Converti en projet</div>
                <div className="text-xs mt-0.5 font-mono">{demand.converted_project_id}</div>
              </div>
            </div>
          )}

          {/* Méta-informations */}
          {isEdit && (
            <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
              {demand?.requester_department && (
                <div className="flex items-center gap-1.5">
                  <User size={11} />
                  <span>{demand.requester_department}</span>
                </div>
              )}
              {demand?.estimated_budget && (
                <div className="flex items-center gap-1.5">
                  <Euro size={11} />
                  <span>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(demand.estimated_budget)}</span>
                </div>
              )}
              {demand?.priority_score != null && (
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={11} />
                  <span>Score : {demand.priority_score}/100</span>
                </div>
              )}
              {demand?.created_at && (
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} />
                  <span>{new Date(demand.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
              )}
            </div>
          )}

          {/* Formulaire */}
          {(canWrite && (demand?.status === "nouvelle" || !isEdit)) || !isEdit ? (
            <DemandForm form={form} onChange={change} />
          ) : (
            /* Vue read-only pour les demandes avancées dans le workflow */
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Titre</div>
                <div className="text-slate-800 font-medium">{demand.title}</div>
              </div>
              {demand.description && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">Description</div>
                  <div className="text-slate-700">{demand.description}</div>
                </div>
              )}
              {demand.business_value && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">Valeur métier</div>
                  <div className="text-slate-700">{demand.business_value}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1">Demandeur</div>
                  <div className="text-slate-700">{demand.requester}</div>
                </div>
                {demand.requester_department && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-1">Direction</div>
                    <div className="text-slate-700">{demand.requester_department}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workflow actions */}
          {isEdit && (
            <WorkflowActions
              demand={demand}
              canWrite={canWrite}
              onTransition={handleTransition}
              onConvert={onConvert}
            />
          )}
        </div>

        {/* Footer */}
        {(!isEdit || demand?.status === "nouvelle") && canWrite && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
            <button
              data-testid="demand-modal-cancel"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              data-testid="demand-modal-save"
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-[#0052CC] text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Créer la demande"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
