import React, { useState, useEffect } from "react";
import { X, GitFork } from "lucide-react";

const NATURES = [
  { value: "deliverable", label: "Livrable" },
  { value: "resource",    label: "Ressource" },
  { value: "technical",   label: "Technique" },
  { value: "regulatory",  label: "Réglementaire" },
  { value: "budget",      label: "Budget" },
  { value: "data",        label: "Données" },
];

const IMPACTS = [
  { value: "low",      label: "Faible",   color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "medium",   label: "Moyen",    color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "high",     label: "Élevé",    color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "critical", label: "Critique", color: "text-rose-600 bg-rose-50 border-rose-200" },
];

const STATUSES = [
  { value: "identified",  label: "Identifiée" },
  { value: "in_progress", label: "En cours" },
  { value: "resolved",    label: "Résolue" },
  { value: "blocked",     label: "Bloquée" },
];

export default function DependencyModal({
  dependency, projectId, projects, sourceMilestones, onSave, onClose,
}) {
  const isEdit = !!dependency;

  const [direction,  setDirection]  = useState(dependency?.direction  || "outbound");
  const [targetPid,  setTargetPid]  = useState(
    isEdit
      ? (dependency.direction === "outbound" ? dependency.target_project_id : dependency.source_project_id)
      : ""
  );
  const [nature,      setNature]     = useState(dependency?.nature      || "technical");
  const [description, setDescription] = useState(dependency?.description || "");
  const [targetDate,  setTargetDate]  = useState(dependency?.target_date  || "");
  const [status,      setStatus]      = useState(dependency?.status      || "identified");
  const [impact,      setImpact]      = useState(dependency?.impact      || "medium");
  const [srcMs,       setSrcMs]       = useState(dependency?.source_milestone_id || "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const otherProjects = (projects || []).filter((p) => p.project_id !== projectId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetPid) { setError("Le projet cible est requis"); return; }
    if (!description.trim()) { setError("La description est requise"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        source_project_id: direction === "outbound" ? projectId : targetPid,
        target_project_id: direction === "outbound" ? targetPid : projectId,
        source_milestone_id: srcMs || null,
        target_milestone_id: null,
        nature,
        description: description.trim(),
        target_date: targetDate || null,
        status,
        impact,
        direction,
      };
      await onSave(payload);
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="dependency-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GitFork size={16} className="text-[#0052CC]" />
            <h2 className="font-heading text-lg font-bold text-[#0F172A]">
              {isEdit ? "Modifier la dépendance" : "Nouvelle dépendance inter-projets"}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Direction */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
              Direction *
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setDirection("outbound")} data-testid="dep-dir-outbound"
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${direction === "outbound" ? "bg-[#0052CC] text-white border-[#0052CC]" : "bg-white text-slate-600 border-gray-200 hover:bg-gray-50"}`}>
                → Je dépends de
              </button>
              <button type="button" onClick={() => setDirection("inbound")} data-testid="dep-dir-inbound"
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${direction === "inbound" ? "bg-[#0052CC] text-white border-[#0052CC]" : "bg-white text-slate-600 border-gray-200 hover:bg-gray-50"}`}>
                ← Dépend de moi
              </button>
            </div>
          </div>

          {/* Target project */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
              Projet {direction === "outbound" ? "cible" : "source"} *
            </label>
            <select value={targetPid} onChange={(e) => setTargetPid(e.target.value)} required
              data-testid="dep-target-project"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]">
              <option value="">— Sélectionner le projet —</option>
              {otherProjects.map((p) => (
                <option key={p.project_id} value={p.project_id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Nature + Impact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Nature
              </label>
              <select value={nature} onChange={(e) => setNature(e.target.value)} data-testid="dep-nature"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]">
                {NATURES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Impact
              </label>
              <select value={impact} onChange={(e) => setImpact(e.target.value)} data-testid="dep-impact"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]">
                {IMPACTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
              Description *
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required
              placeholder="Décrivez la nature de cette dépendance..."
              data-testid="dep-description"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC] resize-none" />
          </div>

          {/* Date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Échéance
              </label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                data-testid="dep-target-date"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Statut
              </label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="dep-status"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Source milestone (optional) */}
          {sourceMilestones?.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Jalon source (optionnel)
              </label>
              <select value={srcMs} onChange={(e) => setSrcMs(e.target.value)} data-testid="dep-source-milestone"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#0052CC]">
                <option value="">— Aucun jalon associé —</option>
                {sourceMilestones.map((m) => (
                  <option key={m.milestone_id} value={m.milestone_id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving} data-testid="dep-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-[#0052CC] text-white rounded-lg hover:bg-[#0047B3] transition-colors disabled:opacity-60">
              {saving ? "Sauvegarde..." : isEdit ? "Enregistrer" : "Créer la dépendance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
