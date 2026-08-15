import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { forecastAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";

const eur = (v) => {
  v = v || 0;
  if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1).replace(".", ",")} M€`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} K€`;
  return `${Math.round(v)} €`;
};

export const BudgetReforecastTab = () => {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("budget.edit") || hasPermission("*");
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);
  const [adjustment, setAdjustment] = useState("");

  const load = useCallback(() => {
    forecastAPI.quarters(year).then((r) => setData(r.data)).catch(() => {});
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const validate = async () => {
    try {
      await forecastAPI.validate({ project_id: sel.project_id, quarter: sel.quarter, adjustment: parseFloat(adjustment) || 0 });
      toast.success(`Reforecast ${sel.quarter} validé`);
      setSel(null); setAdjustment("");
      load();
    } catch { toast.error("Erreur de validation"); }
  };

  const quarters = [1, 2, 3, 4].map((i) => `${year}-Q${i}`);
  const projects = data?.projects || [];

  return (
    <div className="space-y-4" data-testid="reforecast-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-m-muted max-w-xl">
          Le reforecast de chaque trimestre = <b>scope valorisé en €</b> (JH alloués × TJM réel des ressources, TJM moyen {eur(data?.default_tjm)} si absent).
        </p>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} data-testid="reforecast-year-select"
          className="h-9 bg-white border-[1.5px] border-m-border-strong rounded-lg px-3 text-sm font-semibold">
          {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Budget portefeuille", value: eur(data?.totals?.budget) },
          { label: `Forecast ${year} (scope valorisé)`, value: eur(data?.totals?.forecast), color: "#2e5fe8" },
          { label: "Consommé", value: eur(data?.totals?.consumed) },
          { label: "Écart budget − forecast", value: eur((data?.totals?.budget || 0) - (data?.totals?.forecast || 0)),
            color: (data?.totals?.budget || 0) - (data?.totals?.forecast || 0) < 0 ? "#cc4f45" : "#3f8a34" },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-m-border rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-m-muted">{k.label}</p>
            <p className="text-xl font-extrabold mt-1" style={{ color: k.color || "#26243a" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Barre de validation */}
      {sel && canEdit && (
        <div className="bg-m-blue-soft border border-m-blue/30 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3" data-testid="reforecast-validate-bar">
          <span className="text-sm font-bold text-m-ink">{sel.name} — {sel.quarter}</span>
          <span className="text-sm text-m-ink-soft">Scope : <b>{eur(sel.scope_value)}</b></span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-m-ink-soft">Ajustement (€) :</span>
            <input type="number" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} placeholder="0"
              data-testid="reforecast-adjustment-input"
              className="h-8 w-28 bg-white border-[1.5px] border-m-border-strong rounded-lg px-2 text-sm" />
          </div>
          <span className="text-sm text-m-ink-soft">Final : <b className="text-m-blue">{eur(sel.scope_value + (parseFloat(adjustment) || 0))}</b></span>
          <button onClick={validate} data-testid="reforecast-validate-btn"
            className="h-8 px-4 bg-m-blue text-white text-sm font-bold rounded-lg hover:bg-m-blue-dark">Valider le reforecast</button>
          <button onClick={() => { setSel(null); setAdjustment(""); }} className="p-1 text-m-muted hover:text-m-ink" data-testid="reforecast-cancel-btn"><X size={16} /></button>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white border border-m-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-m-muted border-b border-m-border-soft bg-m-bg">
              <th className="px-4 py-2.5">Projet</th>
              {quarters.map((q) => <th key={q} className="px-2 py-2.5 text-center">{q.slice(5)}</th>)}
              <th className="px-3 py-2.5 text-right">Forecast {year}</th>
              <th className="px-3 py-2.5 text-right">Budget</th>
              <th className="px-3 py-2.5 text-right">Écart</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.project_id} className="border-b border-m-surface hover:bg-m-bg" data-testid={`reforecast-row-${p.project_id}`}>
                <td className="px-4 py-2">
                  <span className="font-semibold text-m-ink">{p.name}</span>
                  {p.code && <span className="ml-1.5 text-[10px] font-mono text-m-muted">{p.code}</span>}
                  {p.status === "pause" && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-px rounded-full bg-[#fdf6e3] text-[#b7791f]">PAUSE</span>}
                </td>
                {p.quarters.map((c) => (
                  <td key={c.quarter} className="px-1.5 py-1.5 text-center">
                    <button
                      onClick={() => canEdit && setSel({ ...c, project_id: p.project_id, name: p.name })}
                      data-testid={`reforecast-cell-${p.project_id}-${c.quarter.slice(5)}`}
                      className={`w-full rounded-lg px-1.5 py-1 leading-tight transition-colors ${c.validated ? "bg-m-green-soft" : "bg-m-surface hover:bg-m-lilac"} ${canEdit ? "cursor-pointer" : "cursor-default"}`}>
                      <span className="text-[12px] font-bold text-m-ink flex items-center justify-center gap-1">
                        {eur(c.validated ? c.final_value : c.scope_value)}
                        {c.validated && <CheckCircle2 size={11} className="text-m-green" />}
                      </span>
                      <span className="text-[9px] text-m-muted block">cons. {eur(c.consumed_value)}</span>
                    </button>
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-bold text-m-blue">{eur(p.forecast_year)}</td>
                <td className="px-3 py-2 text-right text-m-ink-soft">{eur(p.budget_total)}</td>
                <td className="px-3 py-2 text-right font-bold" style={{ color: p.ecart_budget < 0 ? "#cc4f45" : "#3f8a34" }}>{eur(p.ecart_budget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
