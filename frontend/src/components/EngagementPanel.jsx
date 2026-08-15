import { useCallback, useEffect, useState } from "react";
import { engagementAPI, exportsAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Check, X, Settings2, Presentation, Plus, Trash2 } from "lucide-react";

const inputCls = "text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-600";

function CriteriaManagerModal({ fromPhase, onClose, onChanged }) {
  const [criteria, setCriteria] = useState(null);
  const [newLabel, setNewLabel] = useState("");
  const load = useCallback(() => {
    engagementAPI.criteria(fromPhase).then((r) => setCriteria(r.data || []));
  }, [fromPhase]);
  useEffect(() => { load(); }, [load]);

  const patch = async (c, data) => {
    await engagementAPI.updateCriterion(c.criterion_id, data);
    load();
    onChanged();
  };
  const add = async () => {
    if (!newLabel.trim()) return;
    await engagementAPI.createCriterion({ from_phase: fromPhase, label: newLabel });
    setNewLabel("");
    load();
    onChanged();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="criteria-manager-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
          <h3 className="font-heading text-sm font-bold text-zinc-950">Critères du dossier — phase {fromPhase}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" data-testid="criteria-manager-close"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-1.5">
          {(criteria || []).map((c) => (
            <div key={c.criterion_id} className={`flex items-center gap-2 border border-zinc-100 rounded-lg px-3 py-2 ${!c.active ? "opacity-50" : ""}`}
              data-testid={`criteria-row-${c.key}`}>
              <input defaultValue={c.label} onBlur={(e) => e.target.value !== c.label && patch(c, { label: e.target.value })}
                className="flex-1 text-xs bg-transparent focus:outline-none focus:bg-zinc-50 rounded px-1 py-0.5" />
              <span className={`px-1.5 py-px text-[9px] font-bold rounded ${c.type === "auto" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {c.type === "auto" ? "Auto" : "Attesté"}
              </span>
              <button onClick={() => patch(c, { mandatory: !c.mandatory })} data-testid={`criteria-mandatory-${c.key}`}
                className={`px-1.5 py-px text-[9px] font-bold rounded border ${c.mandatory ? "bg-[#352c6e] text-white border-[#352c6e]" : "bg-white text-zinc-400 border-zinc-200"}`}>
                {c.mandatory ? "Obligatoire" : "Recommandé"}
              </button>
              <button onClick={() => patch(c, { active: !c.active })}
                className={`px-1.5 py-px text-[9px] font-bold rounded border ${c.active ? "bg-white text-zinc-500 border-zinc-200" : "bg-zinc-100 text-zinc-400 border-zinc-200"}`}>
                {c.active ? "Actif" : "Inactif"}
              </button>
              {c.custom && (
                <button onClick={async () => { await engagementAPI.deleteCriterion(c.criterion_id); load(); onChanged(); }}
                  className="text-zinc-300 hover:text-rose-500"><Trash2 size={12} /></button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nouveau critère (attesté)…"
              data-testid="criteria-new-input" className={`${inputCls} flex-1`} />
            <button onClick={add} data-testid="criteria-add-btn"
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
              <Plus size={11} /> Ajouter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const EngagementPanel = ({ projectId }) => {
  const { hasPermission } = usePermissions();
  const canAttest = hasPermission("lifecycle.request") || hasPermission("lifecycle.decide");
  const canManage = hasPermission("lifecycle.decide");
  const [data, setData] = useState(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [justif, setJustif] = useState({});

  const load = useCallback(() => {
    engagementAPI.readiness(projectId).then((r) => setData(r.data)).catch(() => setData(null));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  if (!data || data.from_phase === "run") return null;

  const attest = async (item, patch) => {
    const a = item.attestation || {};
    try {
      await engagementAPI.attest(projectId, {
        criterion_id: item.criterion_id,
        checked: patch.checked ?? a.checked ?? false,
        not_applicable: patch.not_applicable ?? a.not_applicable ?? false,
        justification: justif[item.criterion_id] ?? a.justification ?? "",
      });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const exportDeck = async () => {
    toast.info("Génération du dossier d'engagement…");
    try {
      const r = await exportsAPI.engagementPptx(projectId);
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Dossier_engagement_${new Date().toISOString().slice(0, 10)}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Dossier d'engagement téléchargé");
    } catch { toast.error("Erreur lors de l'export"); }
  };

  const autos = data.items.filter((i) => i.type === "auto");
  const attested = data.items.filter((i) => i.type === "attested");

  return (
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-sm p-5" data-testid="engagement-panel">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-3">
          <h3 className="font-heading font-bold text-[#26243a]">Dossier d'engagement</h3>
          <span data-testid="readiness-score"
            className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border ${data.ready
              ? "bg-[#ddf0d8] text-[#3f8a34] border-[#bfe0b6]" : "bg-[#fdf6e3] text-[#8a6d1a] border-[#eadfb8]"}`}>
            Prêt à {data.score_pct}%
          </span>
          {!data.ready && (
            <span className="text-[11px] text-[#cc4f45]" data-testid="readiness-missing-count">
              {data.mandatory_missing.length} obligatoire{data.mandatory_missing.length > 1 ? "s" : ""} manquant{data.mandatory_missing.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button onClick={() => setManagerOpen(true)} data-testid="manage-criteria-btn"
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
              <Settings2 size={12} /> Gérer les critères
            </button>
          )}
          <button onClick={exportDeck} data-testid="export-engagement-btn"
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#352c6e] border border-[#352c6e]/25 rounded-lg hover:bg-[#f0eefc]">
            <Presentation size={11} /> Dossier PPTX
          </button>
        </div>
      </div>
      <div className="h-1.5 bg-zinc-100 rounded-full mb-4 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${data.ready ? "bg-[#3f8a34]" : "bg-[#e8a33d]"}`}
          style={{ width: `${data.score_pct}%` }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1.5">Vérifiés automatiquement</div>
          <div className="space-y-1">
            {autos.map((i) => (
              <div key={i.criterion_id} className="flex items-center gap-2 text-xs" data-testid={`readiness-item-${i.key}`}>
                {i.ok ? <Check size={13} className="text-[#3f8a34] flex-shrink-0" /> : <X size={13} className="text-[#cc4f45] flex-shrink-0" />}
                <span className={i.ok ? "text-zinc-600" : "text-zinc-800 font-medium"}>{i.label}</span>
                {i.mandatory && !i.ok && <span className="text-[9px] font-bold text-[#cc4f45]">obligatoire</span>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1.5">Attestés</div>
          <div className="space-y-1.5">
            {attested.map((i) => {
              const a = i.attestation || {};
              return (
                <div key={i.criterion_id} className="text-xs" data-testid={`readiness-attest-${i.key}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={!!a.checked} disabled={!canAttest || a.not_applicable}
                      data-testid={`attest-check-${i.key}`}
                      onChange={(e) => attest(i, { checked: e.target.checked })} />
                    <span className={i.ok ? "text-zinc-600" : "text-zinc-800 font-medium"}>{i.label}</span>
                    {i.mandatory && !i.ok && <span className="text-[9px] font-bold text-[#cc4f45]">obligatoire</span>}
                    <button onClick={() => attest(i, { not_applicable: !a.not_applicable, checked: false })}
                      disabled={!canAttest} data-testid={`attest-na-${i.key}`}
                      className={`ml-auto px-1.5 py-px text-[9px] font-bold rounded border ${a.not_applicable
                        ? "bg-zinc-200 text-zinc-600 border-zinc-300" : "bg-white text-zinc-400 border-zinc-200 hover:bg-zinc-50"}`}>
                      N/A
                    </button>
                  </div>
                  {(a.checked || a.not_applicable) && a.by_name && (
                    <div className="text-[10px] text-zinc-400 ml-5">par {a.by_name}{a.justification ? ` — ${a.justification}` : ""}</div>
                  )}
                  {canAttest && !a.checked && !a.not_applicable && (
                    <input value={justif[i.criterion_id] ?? ""} placeholder="Justification (optionnel)"
                      onChange={(e) => setJustif((j) => ({ ...j, [i.criterion_id]: e.target.value }))}
                      className="ml-5 mt-0.5 w-3/4 text-[10px] border-b border-zinc-100 focus:outline-none focus:border-blue-400 bg-transparent" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {managerOpen && (
        <CriteriaManagerModal fromPhase={data.from_phase} onClose={() => setManagerOpen(false)} onChanged={load} />
      )}
    </div>
  );
};
