import React, { useCallback, useEffect, useState } from "react";
import { BookmarkPlus, Crosshair, FilePlus2, PauseCircle, RotateCcw, Scissors, Trash2, Upload } from "lucide-react";
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
  const [modes, setModes] = useState({});
  const [cuts, setCuts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const [loadedScenario, setLoadedScenario] = useState(null);
  const [saveFormOpen, setSaveFormOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState("");

  const load = useCallback(() => {
    forecastAPI.levers().then((r) => setLevers(r.data.levers || [])).catch(() => {});
    forecastAPI.cuts().then((r) => setCuts(r.data || [])).catch(() => {});
    forecastAPI.scenarios().then((r) => setScenarios(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (l) => setSelected((s) => ({ ...s, [`${l.type}:${l.id}`]: s[`${l.type}:${l.id}`] ? undefined : l }));
  const setLeverMode = (l, m) => setModes((s) => ({ ...s, [`${l.type}:${l.id}`]: m }));
  const leverMode = (l) => modes[`${l.type}:${l.id}`] || "full";
  const leverValue = (l) => (l.type === "pause" && leverMode(l) === "mvp" ? (l.value_mvp ?? l.value) : l.value);
  const picked = Object.values(selected).filter(Boolean);
  const saved = picked.reduce((s, l) => s + leverValue(l), 0);
  const targetNum = parseFloat(target) || 0;
  const progress = targetNum > 0 ? Math.min(Math.round((saved / targetNum) * 100), 100) : 0;

  const resetScenario = () => {
    setSelected({}); setModes({}); setTarget(""); setLoadedScenario(null);
    setSaveFormOpen(false); setScenarioName("");
  };

  const loadScenario = (s) => {
    const sel = {}; const m = {};
    let missing = 0;
    (s.items || []).forEach((it) => {
      const l = levers.find((x) => x.type === it.type && x.id === it.id);
      if (!l) { missing += 1; return; }
      sel[`${l.type}:${l.id}`] = l;
      if (it.mode) m[`${l.type}:${l.id}`] = it.mode;
    });
    setSelected(sel); setModes(m);
    setTarget(s.target != null ? String(s.target) : "");
    setLoadedScenario(s);
    setSaveFormOpen(false);
    if (missing) toast.warning(`Scénario « ${s.name} » V${s.version} chargé — ${missing} levier(s) introuvable(s) (projet terminé ou déjà coupé), montants recalculés à date`);
    else toast.success(`Scénario « ${s.name} » V${s.version} chargé — montants recalculés à date`);
  };

  const saveScenario = async (name) => {
    setBusy(true);
    try {
      const r = await forecastAPI.saveScenario({
        name,
        lineage_id: loadedScenario?.lineage_id || null,
        target: targetNum || null,
        items: picked.map((l) => ({
          type: l.type, id: l.id,
          mode: l.type === "pause" ? leverMode(l) : null,
          label: l.label, value: leverValue(l),
        })),
      });
      toast.success(`Scénario « ${r.data.name} » enregistré en V${r.data.version}`);
      setLoadedScenario(r.data);
      setSaveFormOpen(false); setScenarioName("");
      forecastAPI.scenarios().then((res) => setScenarios(res.data || [])).catch(() => {});
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur lors de l'enregistrement du scénario"); }
    finally { setBusy(false); }
  };

  const deleteScenario = async (s) => {
    if (!window.confirm(`Supprimer le scénario « ${s.name} » V${s.version} ?`)) return;
    try {
      await forecastAPI.deleteScenario(s.scenario_id);
      if (loadedScenario?.scenario_id === s.scenario_id) setLoadedScenario(null);
      setScenarios((prev) => prev.filter((x) => x.scenario_id !== s.scenario_id));
      toast.success("Scénario supprimé");
    } catch { toast.error("Erreur lors de la suppression"); }
  };

  const apply = async () => {
    const nMvp = picked.filter((l) => l.type === "pause" && leverMode(l) === "mvp").length;
    const nPause = picked.filter((l) => l.type === "pause" && leverMode(l) !== "mvp").length;
    if (!window.confirm(`Appliquer ${picked.length} levier(s) pour ${eur(saved)} ?\n— Features sorties du scope\n— ${nPause} projet(s) mis en pause\n— ${nMvp} projet(s) réduit(s) à leur MVP (tâches hors MVP sorties du scope)`)) return;
    setBusy(true);
    try {
      const r = await forecastAPI.applyCuts({
        target: targetNum || null,
        scenario_id: loadedScenario?.scenario_id || null,
        items: picked.map((l) => ({
          type: l.type === "pause" && leverMode(l) === "mvp" ? "reduce_mvp" : l.type,
          id: l.id,
          value: leverValue(l),
        })),
      });
      toast.success(`Coupes appliquées : ${r.data.tasks_out} tâche(s)/feature(s) hors scope, ${r.data.projects_paused} projet(s) en pause${r.data.projects_reduced ? `, ${r.data.projects_reduced} réduit(s) au MVP` : ""} — ${eur(r.data.total_saved)} économisés`);
      setSelected({});
      setLoadedScenario(null);
      load();
    } catch { toast.error("Erreur lors de l'application"); } finally { setBusy(false); }
  };

  const restoreCut = async (c) => {
    if (!window.confirm(`Restaurer cette coupe de ${eur(c.total_saved)} ?\nLes tâches sorties du scope retrouveront leur scope d'origine et les projets mis en pause seront réactivés.`)) return;
    setBusy(true);
    try {
      const r = await forecastAPI.restoreCut(c.cut_id);
      toast.success(`Coupe restaurée : ${r.data.tasks_restored} tâche(s) remise(s) au scope${r.data.projects_reactivated ? `, ${r.data.projects_reactivated} projet(s) réactivé(s)` : ""}`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur lors de la restauration"); } finally { setBusy(false); }
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
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-m-border-soft" data-testid="scenario-toolbar">
            {loadedScenario && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200" data-testid="scenario-loaded-badge">
                Scénario chargé : {loadedScenario.name} · V{loadedScenario.version}
              </span>
            )}
            {saveFormOpen ? (
              <>
                <input
                  value={scenarioName} onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Nom du scénario (ex. Plan austérité T3)" autoFocus
                  data-testid="scenario-name-input"
                  className="h-8 w-64 bg-m-bg border-[1.5px] border-m-border-strong rounded-lg px-3 text-xs font-semibold"
                  onKeyDown={(e) => { if (e.key === "Enter" && scenarioName.trim()) saveScenario(scenarioName.trim()); }}
                />
                <button onClick={() => scenarioName.trim() && saveScenario(scenarioName.trim())} disabled={!scenarioName.trim() || busy}
                  data-testid="scenario-save-confirm-btn"
                  className="h-8 px-3 bg-m-blue text-white text-[11px] font-bold rounded-lg hover:bg-m-blue-dark disabled:opacity-50">
                  Enregistrer V1
                </button>
                <button onClick={() => { setSaveFormOpen(false); setScenarioName(""); }} data-testid="scenario-save-cancel-btn"
                  className="h-8 px-3 text-[11px] font-bold text-m-muted hover:text-m-ink">
                  Annuler
                </button>
              </>
            ) : (
              <button
                onClick={() => (loadedScenario ? saveScenario(loadedScenario.name) : setSaveFormOpen(true))}
                disabled={picked.length === 0 || busy}
                data-testid="scenario-save-btn"
                className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold rounded-lg border border-m-border-strong text-m-ink-soft hover:border-m-blue hover:text-m-blue transition-colors disabled:opacity-50">
                <BookmarkPlus size={12} />
                {loadedScenario ? `Enregistrer en V${loadedScenario.version + 1}` : "Enregistrer le scénario"}
              </button>
            )}
            <button onClick={resetScenario} data-testid="scenario-new-btn"
              className="flex items-center gap-1.5 h-8 px-3 text-[11px] font-bold rounded-lg border border-m-border-strong text-m-ink-soft hover:border-m-blue hover:text-m-blue transition-colors">
              <FilePlus2 size={12} /> Nouveau scénario
            </button>
            <span className="text-[10px] text-m-muted">V1 n'est jamais écrasée : ré-enregistrer depuis une version chargée crée V{loadedScenario ? loadedScenario.version + 1 : 2}, V3…</span>
          </div>
        )}
      </div>

      {scenarios.length > 0 && (
        <div className="bg-white border border-m-border rounded-xl overflow-hidden" data-testid="scenarios-panel">
          <div className="px-4 py-3 border-b border-m-border-soft">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Scénarios enregistrés ({scenarios.length})</span>
          </div>
          <div className="divide-y divide-m-surface max-h-[280px] overflow-y-auto">
            {scenarios.map((s) => (
              <div key={s.scenario_id} className={`px-4 py-2.5 flex flex-wrap items-center gap-3 text-[13px] ${loadedScenario?.scenario_id === s.scenario_id ? "bg-indigo-50/60" : ""}`}
                data-testid={`scenario-row-${s.scenario_id}`}>
                <span className="font-semibold text-m-ink">
                  {s.name}
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-m-lilac text-m-ink-soft" data-testid={`scenario-version-${s.scenario_id}`}>V{s.version}</span>
                </span>
                <span className="text-xs text-m-muted">{s.created_at?.slice(0, 10)} · {s.created_by} · {s.items?.length || 0} levier(s){s.target ? ` · cible ${eur(s.target)}` : ""}</span>
                <span className="font-bold text-m-blue">{eur(s.total_saved)}</span>
                {s.status === "applied" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" data-testid={`scenario-applied-badge-${s.scenario_id}`}>
                    Appliqué
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <button onClick={() => loadScenario(s)} data-testid={`scenario-load-btn-${s.scenario_id}`}
                    title="Recharger la sélection de ce scénario (montants recalculés à date)"
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-m-border-strong text-m-ink-soft hover:border-m-blue hover:text-m-blue transition-colors">
                    <Upload size={11} /> Charger
                  </button>
                  {canEdit && (
                    <button onClick={() => deleteScenario(s)} data-testid={`scenario-delete-btn-${s.scenario_id}`}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Supprimer">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              const mode = leverMode(l);
              const isPause = l.type === "pause";
              return (
                <div key={key} data-testid={`lever-${l.type}-${l.id}`}
                  className={`px-4 py-2.5 transition-colors ${checked ? "bg-m-blue-soft" : "hover:bg-m-bg"}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggle(l)} disabled={!canEdit}
                      className="w-4 h-4 accent-m-blue" />
                    {isPause
                      ? <PauseCircle size={16} className="text-[#b7791f] flex-shrink-0" />
                      : <Scissors size={15} className="text-m-muted flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold truncate ${checked ? "text-m-blue" : "text-m-ink"}`}>
                        {isPause && mode === "mvp" ? `Réduire au MVP — ${l.project_name}` : l.label}
                      </p>
                      <p className="text-[10px] text-m-muted">
                        {isPause
                          ? `Reste à faire : ${l.jh_full ?? l.jh} JH valorisés au TJM`
                          : `${l.project_name} · ${l.jh} JH · scope ${l.scope_status}`}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-m-ink flex-shrink-0" data-testid={`lever-value-${l.id}`}>{eur(leverValue(l))}</span>
                  </label>
                  {isPause && (
                    <div className="flex items-center gap-1.5 mt-1.5 ml-11">
                      <button type="button" disabled={!canEdit} onClick={() => setLeverMode(l, "full")}
                        data-testid={`lever-mode-full-${l.id}`}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition-colors ${mode !== "mvp" ? "bg-m-blue border-m-blue text-white" : "bg-white border-m-border-strong text-m-ink-soft hover:border-m-blue"}`}>
                        Arrêt complet · {eur(l.value_full ?? l.value)}
                      </button>
                      <button type="button" disabled={!canEdit} onClick={() => setLeverMode(l, "mvp")}
                        data-testid={`lever-mode-mvp-${l.id}`}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition-colors ${mode === "mvp" ? "bg-m-blue border-m-blue text-white" : "bg-white border-m-border-strong text-m-ink-soft hover:border-m-blue"}`}>
                        Réduire au MVP · économise {eur(l.value_mvp ?? 0)}
                      </button>
                      {mode === "mvp" && (
                        <span className="text-[10px] text-m-muted" data-testid={`lever-mvp-preserved-${l.id}`}>
                          {(l.jh_mvp_preserved ?? 0) > 0
                            ? `conserve le MVP (scope sec) : ${l.jh_mvp_preserved} JH · ${eur(l.value_mvp_preserved)} — coupe ${Math.round(((l.jh_full ?? 0) - (l.jh_mvp_preserved ?? 0)) * 10) / 10} JH`
                            : `aucune tâche marquée MVP (scope sec) — tout le RAF est coupé`}
                          {(l.jh_unqualified ?? 0) > 0 && (
                            <span className="text-amber-600 font-semibold"> · ⚠ dont {l.jh_unqualified} JH non qualifiés ({eur(l.value_unqualified)}) — qualifiez le scope des tâches</span>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
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
              <div key={c.cut_id} className="px-4 py-2.5 flex flex-wrap items-center gap-3 text-[13px]" data-testid={`cut-row-${c.cut_id}`}>
                <span className="text-xs text-m-muted">{c.created_at?.slice(0, 10)}</span>
                <span className="flex-1 text-m-ink-soft">{c.details?.length || 0} levier(s) — par {c.created_by}</span>
                {c.restored ? (
                  <>
                    <span className="font-bold text-m-muted line-through">−{eur(c.total_saved)}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" data-testid={`cut-restored-badge-${c.cut_id}`}>
                      Restaurée le {c.restored_at?.slice(0, 10)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-m-red">−{eur(c.total_saved)}</span>
                    {canEdit && (
                      <button onClick={() => restoreCut(c)} disabled={busy} data-testid={`cut-restore-btn-${c.cut_id}`}
                        title="Remettre les tâches coupées au scope et réactiver les projets mis en pause"
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-m-border-strong text-m-ink-soft hover:border-m-blue hover:text-m-blue transition-colors disabled:opacity-50">
                        <RotateCcw size={11} /> Restaurer
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
