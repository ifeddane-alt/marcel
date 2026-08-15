import React, { useState, useEffect } from "react";
import { runAPI } from "@/api";

const cellColor = (pct) => {
  if (pct > 100) return "bg-rose-100 text-rose-700";
  if (pct > 90) return "bg-orange-100 text-orange-700";
  if (pct > 70) return "bg-amber-50 text-amber-700";
  if (pct >= 40) return "bg-emerald-50 text-emerald-700";
  if (pct > 0) return "bg-zinc-50 text-zinc-500";
  return "bg-white text-zinc-300";
};

export default function RunChargeTab() {
  const [data, setData] = useState(null);
  useEffect(() => { runAPI.load(6).then((r) => setData(r.data)).catch(() => setData({ periods: [], resources: [] })); }, []);

  if (!data) return <div className="p-6 text-sm text-zinc-400">Calcul de la charge consolidée…</div>;

  return (
    <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]" data-testid="run-charge-tab">
      <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between flex-wrap gap-2">
        <div className="font-heading text-[13px] font-bold text-m-ink">
          Charge consolidée Build + Run par ressource (JH)
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-200" /> 40-70 %</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-50 border border-amber-200" /> 70-90 %</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-100 border border-rose-200" /> &gt; 100 %</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-m-bg border-b border-m-border text-left">
              <th className="px-3 py-2 text-[10.5px] uppercase tracking-wider font-bold text-m-muted whitespace-nowrap">Ressource</th>
              <th className="px-3 py-2 text-[10.5px] uppercase tracking-wider font-bold text-m-muted whitespace-nowrap">Capacité /m</th>
              {data.periods.map((p) => (
                <th key={p} className="px-2 py-2 text-[10.5px] uppercase tracking-wider font-bold text-m-muted text-center whitespace-nowrap">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.resources.length === 0 && (
              <tr><td colSpan={2 + data.periods.length} className="px-4 py-8 text-center text-sm text-zinc-400">Aucune ressource.</td></tr>
            )}
            {data.resources.map((r) => (
              <tr key={r.resource_id} className="border-b border-zinc-100" data-testid={`load-row-${r.resource_id}`}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="text-xs font-semibold text-zinc-800">{r.resource_name}</div>
                  {r.team_name && <div className="text-[10px] text-zinc-400">{r.team_name}</div>}
                </td>
                <td className="px-3 py-2 font-mono-data text-xs text-zinc-500 whitespace-nowrap">{r.capacity_jh_month} JH</td>
                {r.periods.map((p) => (
                  <td key={p.period} className="px-1.5 py-1.5 text-center">
                    <div className={`rounded-lg px-1.5 py-1 ${cellColor(p.utilization_pct)}`}
                      title={`Build ${p.build_jh} JH · Run ${p.run_jh} JH`}>
                      <div className="font-mono-data text-[11px] font-bold">{p.utilization_pct}%</div>
                      <div className="text-[9px] opacity-75">B {p.build_jh} · R {p.run_jh}</div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
