import React, { useCallback, useEffect, useState } from "react";
import { PiggyBank, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { budgetOpsAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";

const eur = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);

export const BudgetEnvelopesTab = () => {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("budget.set_envelope") || hasPermission("*");
  const [year, setYear] = useState(new Date().getFullYear());
  const [axis, setAxis] = useState("programme");
  const [data, setData] = useState(null);
  const [amounts, setAmounts] = useState({});
  const [themeName, setThemeName] = useState("");

  const load = useCallback(() => {
    budgetOpsAPI.listEnvelopes(year).then((r) => setData(r.data)).catch(() => {});
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const refs = axis === "programme"
    ? (data?.programs || []).map((p) => ({ id: p.program_id, name: p.name }))
    : (data?.themes || []).map((t) => ({ id: t.theme_id, name: t.name, color: t.color }));
  const envMap = Object.fromEntries((data?.envelopes || []).filter((e) => e.axis === axis).map((e) => [e.ref_id, e]));

  const save = async (refId) => {
    const amount = parseFloat(amounts[refId]);
    if (!(amount >= 0)) return;
    await budgetOpsAPI.upsertEnvelope({ year, axis, ref_id: refId, amount });
    toast.success("Enveloppe enregistrée");
    setAmounts((a) => ({ ...a, [refId]: undefined }));
    load();
  };

  const addTheme = async () => {
    if (!themeName.trim()) return;
    await budgetOpsAPI.createTheme({ name: themeName.trim() });
    setThemeName("");
    load();
  };

  return (
    <div className="space-y-4" data-testid="envelopes-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#8a87a0] max-w-xl">
          Enveloppes validées en <b>comité stratégique SI</b>, par programme ou par thème stratégique. L'engagé = somme des budgets des projets rattachés.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[10px] border-[1.5px] border-[#dcd7ea] overflow-hidden bg-white">
            {[{ id: "programme", label: "Par programme" }, { id: "theme", label: "Par thème stratégique" }].map((a) => (
              <button key={a.id} onClick={() => setAxis(a.id)} data-testid={`envelope-axis-${a.id}`}
                className={`px-3 h-9 text-xs font-bold transition-colors ${axis === a.id ? "bg-[#352c6e] text-white" : "text-[#5d5a75] hover:bg-[#f0eefc]"}`}>
                {a.label}
              </button>
            ))}
          </div>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} data-testid="envelope-year-select"
            className="h-9 bg-white border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm font-semibold">
            {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {axis === "theme" && canEdit && (
        <div className="flex items-center gap-2">
          <input value={themeName} onChange={(e) => setThemeName(e.target.value)}
            placeholder="Nouveau thème stratégique (ex. Excellence opérationnelle)" data-testid="theme-name-input"
            className="h-9 flex-1 max-w-md bg-white border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm" />
          <button onClick={addTheme} data-testid="theme-add-btn"
            className="flex items-center gap-1 h-9 px-3 bg-[#352c6e] text-white text-sm font-bold rounded-[10px] hover:bg-[#2a2358]">
            <Plus size={14} /> Ajouter
          </button>
        </div>
      )}

      {refs.length === 0 ? (
        <div className="bg-white border border-[#e8e6f0] rounded-xl p-8 text-center" data-testid="envelopes-empty">
          <PiggyBank size={32} className="mx-auto text-[#dcd7ea] mb-2" />
          <p className="text-sm text-[#8a87a0]">{axis === "programme" ? "Aucun programme." : "Aucun thème stratégique — créez-en un ci-dessus. Rattachez ensuite les projets à un thème depuis leur onglet Informations."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {refs.map((ref) => {
            const env = envMap[ref.id];
            const rate = env?.rate || 0;
            return (
              <div key={ref.id} className="bg-white border border-[#e8e6f0] rounded-xl p-4" data-testid={`envelope-card-${ref.id}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-bold text-[#26243a] flex items-center gap-2">
                    {ref.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ref.color }} />}
                    {ref.name}
                  </span>
                  {axis === "theme" && canEdit && (
                    <button onClick={async () => { await budgetOpsAPI.deleteTheme(ref.id); load(); }}
                      data-testid={`theme-delete-${ref.id}`} className="p-1 text-[#cc4f45] hover:bg-[#fbe1de] rounded">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <input type="number" defaultValue={env?.amount ?? ""} placeholder="Enveloppe (€)"
                    onChange={(e) => setAmounts((a) => ({ ...a, [ref.id]: e.target.value }))}
                    disabled={!canEdit} data-testid={`envelope-amount-${ref.id}`}
                    className="h-9 flex-1 bg-[#fbfaff] border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm font-semibold disabled:opacity-60" />
                  {canEdit && (
                    <button onClick={() => save(ref.id)} disabled={amounts[ref.id] == null} data-testid={`envelope-save-${ref.id}`}
                      className="h-9 px-3 bg-[#2e5fe8] text-white text-xs font-bold rounded-[10px] hover:bg-[#2450c8] disabled:opacity-40">
                      OK
                    </button>
                  )}
                </div>
                {env ? (
                  <>
                    <div className="flex justify-between text-[11px] font-semibold mb-1">
                      <span className="text-[#5d5a75]">Engagé : {eur(env.engaged)} · Consommé : {eur(env.consumed)}</span>
                      <span style={{ color: rate > 100 ? "#cc4f45" : rate >= 85 ? "#b7791f" : "#3f8a34" }}>{rate} %</span>
                    </div>
                    <div className="h-2 bg-[#f0eefc] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: rate > 100 ? "#cc4f45" : rate >= 85 ? "#b7791f" : "#3f8a34" }} />
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-[#a39fb8]">Aucune enveloppe définie pour {year}.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
