import React, { useEffect, useState } from "react";
import {
  Bell, Plus, Trash2, ToggleLeft, ToggleRight, X,
  TrendingDown, Calendar, Users, Shield, Target,
} from "lucide-react";
import { agentAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

const METRICS = [
  { value: "eac_overrun_pct",   label: "Dépassement EAC (%)",     icon: TrendingDown, unit: "%",  placeholder: "ex : 10" },
  { value: "budget_overrun_pct",label: "Dépassement budget (%)",  icon: Target,       unit: "%",  placeholder: "ex : 5" },
  { value: "delay_days",        label: "Retard jalons (jours)",   icon: Calendar,     unit: "j",  placeholder: "ex : 7" },
  { value: "team_overload_pct", label: "Surcharge équipe (%)",    icon: Users,        unit: "%",  placeholder: "ex : 20" },
  { value: "risk_score",        label: "Criticité risque (/25)",  icon: Shield,       unit: "/25",placeholder: "ex : 15" },
];

const METRIC_MAP = Object.fromEntries(METRICS.map(m => [m.value, m]));

function AlertRuleModal({ onClose, onSave }) {
  const [metric, setMetric] = useState(METRICS[0].value);
  const [threshold, setThreshold] = useState("");
  const [scope, setScope] = useState("all");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!threshold || isNaN(parseFloat(threshold))) {
      toast.error("Veuillez saisir un seuil numérique valide.");
      return;
    }
    setSaving(true);
    try {
      await agentAPI.createAlertRule({
        metric,
        threshold: parseFloat(threshold),
        scope,
        enabled: true,
        label: label.trim() || undefined,
      });
      toast.success("Règle d'alerte créée.");
      onSave();
      onClose();
    } catch {
      toast.error("Erreur lors de la création de la règle.");
    }
    setSaving(false);
  };

  const metaCfg = METRIC_MAP[metric];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="alert-rule-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-blue-600" />
            <span className="font-semibold text-slate-800 text-sm">Nouvelle règle d'alerte</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Métrique */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Indicateur surveillé</label>
            <select
              value={metric}
              onChange={e => setMetric(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              data-testid="alert-metric-select"
            >
              {METRICS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Seuil */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Seuil d'alerte {metaCfg && <span className="text-slate-400 font-normal">({metaCfg.unit})</span>}
            </label>
            <input
              type="number"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              placeholder={metaCfg?.placeholder || ""}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              data-testid="alert-threshold-input"
            />
          </div>

          {/* Périmètre */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Périmètre</label>
            <select
              value={scope}
              onChange={e => setScope(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              data-testid="alert-scope-select"
            >
              <option value="all">Tout le portefeuille</option>
            </select>
          </div>

          {/* Libellé personnalisé */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Libellé personnalisé <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Ex : Mon alerte dépassement EAC"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              data-testid="alert-label-input"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg border border-gray-200">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="alert-save-btn"
            className="text-sm text-white px-4 py-2 rounded-lg bg-[#0052CC] hover:bg-[#0047B3] disabled:opacity-50 transition-colors"
          >
            {saving ? "Enregistrement..." : "Créer la règle"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MesAlertes() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission("agent.alerts") || hasPermission("agent.chat") || hasPermission("*");

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await agentAPI.listAlertRules();
      setRules(res.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (canView) load(); }, [canView]);

  const toggleRule = async (rule) => {
    try {
      await agentAPI.updateAlertRule(rule.rule_id, { enabled: !rule.enabled });
      setRules(prev => prev.map(r => r.rule_id === rule.rule_id ? { ...r, enabled: !r.enabled } : r));
    } catch { toast.error("Erreur lors de la mise à jour."); }
  };

  const deleteRule = async (ruleId) => {
    if (!window.confirm("Supprimer cette règle d'alerte ?")) return;
    try {
      await agentAPI.deleteAlertRule(ruleId);
      setRules(prev => prev.filter(r => r.rule_id !== ruleId));
      toast.success("Règle supprimée.");
    } catch { toast.error("Erreur lors de la suppression."); }
  };

  if (!canView) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-slate-400 text-sm">
        Accès non autorisé.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="mes-alertes-page">
      {showModal && <AlertRuleModal onClose={() => setShowModal(false)} onSave={load} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
            Mes alertes
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configurez vos seuils d'alerte personnalisés sur le portefeuille
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          data-testid="new-alert-rule-btn"
          className="flex items-center gap-2 text-sm text-white px-4 py-2 rounded-lg bg-[#0052CC] hover:bg-[#0047B3] transition-colors shadow-sm"
        >
          <Plus size={14} /> Nouvelle règle
        </button>
      </div>

      {/* Tableau des règles */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm" data-testid="alert-rules-table">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Bell size={14} className="text-[#0052CC]" />
          <span className="text-sm font-bold text-slate-800">Règles d'alerte actives</span>
          <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
            {rules.filter(r => r.enabled).length} actives
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
            Chargement...
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
              <Bell size={22} className="text-slate-300" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">Aucune règle configurée</p>
            <p className="text-slate-400 text-xs mt-1">Cliquez sur "Nouvelle règle" pour commencer.</p>
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="alert-rules-list">
            <thead>
              <tr className="bg-gray-50">
                {["Indicateur", "Seuil", "Périmètre", "Libellé", "Statut", "Actions"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-600 text-left border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => {
                const metaCfg = METRIC_MAP[rule.metric];
                const Icon = metaCfg?.icon || Bell;
                return (
                  <tr key={rule.rule_id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors" data-testid={`alert-rule-row-${rule.rule_id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon size={13} className="text-slate-500" />
                        <span className="text-xs font-medium text-slate-700">{metaCfg?.label || rule.metric}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono-data text-sm font-bold text-slate-800">
                      {rule.threshold} {metaCfg?.unit || ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {rule.scope === "all" ? "Tout le portefeuille" : rule.scope}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate">
                      {rule.label || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleRule(rule)}
                        data-testid={`toggle-rule-${rule.rule_id}`}
                        className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                      >
                        {rule.enabled
                          ? <><ToggleRight size={18} className="text-emerald-500" /><span className="text-emerald-600">Active</span></>
                          : <><ToggleLeft size={18} className="text-slate-300" /><span className="text-slate-400">Inactif</span></>
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteRule(rule.rule_id)}
                        data-testid={`delete-rule-${rule.rule_id}`}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Explication */}
      <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
        <strong>Comment fonctionnent les alertes ?</strong> Ces règles sont personnelles et complémentaires aux seuils définis par l'administrateur dans la configuration du tenant. Elles n'affectent que votre vue.
      </div>
    </div>
  );
}
