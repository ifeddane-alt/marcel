import React, { useCallback, useEffect, useState } from "react";
import { Crosshair, PauseCircle, Scissors } from "lucide-react";
import { toast } from "sonner";
import { forecastAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";

const eur = (v) => {
  v = v || 0;
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(2).replace(".", ",")} M€`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} K€`;
  return `${Math.round(v)} €`;
};

export const BudgetTargetTab = () => {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("budget.edit") || hasPermission("*");
  const [target, setTarget] = useState("");
  const [levers, setLevers] = useState([]);
  const [selected, setSelected] = useState({});
  const [cuts, setCuts] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    forecastAPI.levers().then((r) => setLevers(r.data.levers || [])).catch(() => {});
    forecastAPI.cuts().then((r) => setCuts(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (l) => setSelected((s) => ({ ...s, [`${l.type}:${l.id}`]: s[`${l.type}:${l.id}`] ? undefined : l }));
  const picked = Object.values(selected).filter(Boolean);
  const saved = picked.reduce((s, l) => s + l.value, 0);
  const targetNum = parseFloat(target) || 0;
  const progress = targetNum > 0 ? Math.min(Math.round((saved / targetNum) * 100), 100) : 0;

  const apply = async () => {
    if (!window.confirm(`Appliquer ${picked.length} coupe(s) pour ${eur(saved)} ? Les features passeront hors scope et les projets sélectionnés seront mis en pause.`)) return;
    setBusy(true);
    try {
      const r = await forecastAPI.applyCuts({
        target: targetNum || null,
        items: picked.map((l) => ({ type: l.type, id: l.id, value: l.value })),
      });
      toast.success(`Coupes appliquées : ${r.data.tasks_out} feature(s) hors scope, ${r.data.projects_paused} projet(s) en pause — ${eur(r.data.total_saved)} économisés`);
      setSelected({});
      load();
    } catch { toast.error("Erreur lors de l'application"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="target-tab">
      <div className="bg-white border border-m-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-m-ink flex items-center gap-2 mb-1">
          <Crosshair size={15} className="text-m-blue" /> Budget cible — console de réajustement
        </h3>
        <p className="text-xs text-m-muted mb-4">Fixez une économie cible, sélectionnez les leviers (features à sortir du scope, projets à mettre en pause), simulez puis appliquez.</p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-m-ink-soft">Économie cible :</span>
            <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="500000"
              data-testid="target-amount-input"
              className="h-10 w-36 bg-m-bg border-[1.5px] border-m-border-strong rounded-lg px-3 text-sm font-semibold" />
            <span className="text-xs text-m-muted">€</span>
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span className="text-m-ink-soft">{picked.length} levier(s) — <span className="text-m-blue">{eur(saved)}</span></span>
              {targetNum > 0 && <span style={{ color: saved >= targetNum ? "#3f8a34" : "#8a87a0" }}>{progress} % de la cible</span>}
            </div>
            <div className="h-2.5 bg-m-lilac rounded-full overflow-hidden" data-testid="target-progress-bar">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${targetNum > 0 ? progress : picked.length ? 100 : 0}%`, backgroundColor: saved >= targetNum && targetNum > 0 ? "#3f8a34" : "#2e5fe8" }} />
            </div>
          </div>
          {canEdit && (
            <button onClick={apply} disabled={picked.length === 0 || busy} data-testid="target-apply-btn"
              className="h-10 px-5 bg-m-red text-white text-sm font-bold rounded-lg hover:bg-[#b23c33] disabled:opacity-50">
              Appliquer les coupes
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-m-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-m-border-soft">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Leviers disponibles ({levers.length})</span>
        </div>
        {levers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-m-muted" data-testid="levers-empty">Aucun levier identifié (pas de features actives ni de budget restant).</p>
        ) : (
          <div className="divide-y divide-m-surface max-h-[440px] overflow-y-auto">
            {levers.map((l) => {
              const key = `${l.type}:${l.id}`;
              const checked = !!selected[key];
              return (
                <label key={key} data-testid={`lever-${l.type}-${l.id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? "bg-m-blue-soft" : "hover:bg-m-bg"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(l)} disabled={!canEdit}
                    className="w-4 h-4 accent-m-blue" />
                  {l.type === "pause"
                    ? <PauseCircle size={16} className="text-[#b7791f] flex-shrink-0" />
                    : <Scissors size={15} className="text-m-muted flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-semibold truncate ${checked ? "text-m-blue" : "text-m-ink"}`}>{l.label}</p>
                    <p className="text-[10px] text-m-muted">
                      {l.type === "pause" ? "Pause projet — gel du reste à faire" : `${l.project_name} · ${l.jh} JH · scope ${l.scope_status}`}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-m-ink flex-shrink-0">{eur(l.value)}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {cuts.length > 0 && (
        <div className="bg-white border border-m-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-m-border-soft">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Historique des coupes</span>
          </div>
          <div className="divide-y divide-m-surface">
            {cuts.map((c) => (
              <div key={c.cut_id} className="px-4 py-2.5 flex items-center gap-3 text-[13px]" data-testid={`cut-row-${c.cut_id}`}>
                <span className="text-xs text-m-muted">{c.created_at?.slice(0, 10)}</span>
                <span className="flex-1 text-m-ink-soft">{c.details?.length || 0} levier(s) — par {c.created_by}</span>
                <span className="font-bold text-m-red">−{eur(c.total_saved)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
