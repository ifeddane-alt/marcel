import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

const UTIL_COLORS = [
  { max: 50,  bg: "bg-slate-50",  text: "text-slate-400", label: "< 50%",    border: "border-slate-100" },
  { max: 70,  bg: "bg-emerald-50",text: "text-emerald-600",label: "50–70%",   border: "border-emerald-100" },
  { max: 90,  bg: "bg-amber-50",  text: "text-amber-600", label: "70–90%",   border: "border-amber-100" },
  { max: 100, bg: "bg-orange-50", text: "text-orange-600",label: "90–100%",  border: "border-orange-100" },
  { max: Infinity, bg: "bg-rose-50", text: "text-rose-600", label: "> 100%", border: "border-rose-100" },
];

function getCellStyle(pct) {
  return UTIL_COLORS.find((c) => pct <= c.max) || UTIL_COLORS[UTIL_COLORS.length - 1];
}

function fmtPeriod(period) {
  const [y, m] = period.split("-");
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${monthNames[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export default function CapacityHeatmap({ data, months, onMonthsChange }) {
  const [tooltip, setTooltip] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        Aucune donnée de capacité. Créez des équipes et des allocations mensuelles pour afficher la heatmap.
      </div>
    );
  }

  const periods = data[0]?.periods || [];

  return (
    <div data-testid="capacity-heatmap">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {UTIL_COLORS.map((c) => (
            <span key={c.label} className={`flex items-center gap-1 text-xs ${c.text}`}>
              <span className={`inline-block w-3 h-3 rounded-sm ${c.bg} border ${c.border}`} />
              {c.label}
            </span>
          ))}
        </div>
        <div className="relative">
          <select
            value={months}
            onChange={(e) => onMonthsChange(Number(e.target.value))}
            className="appearance-none text-xs border border-gray-200 rounded px-3 py-1.5 pr-7 bg-white focus:outline-none focus:border-[#0052CC] text-slate-600"
            data-testid="heatmap-months-select"
          >
            {[3, 6, 9, 12].map((v) => (
              <option key={v} value={v}>{v} mois</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" data-testid="heatmap-table">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-xs text-slate-500 font-semibold bg-gray-50 border border-gray-200 min-w-[120px]">
                Équipe
              </th>
              <th className="px-2 py-2 text-xs text-slate-500 font-semibold bg-gray-50 border border-gray-200 text-center min-w-[60px]">
                Capa/mois
              </th>
              {periods.map((p) => (
                <th key={p.period} className="px-2 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 text-center min-w-[72px] text-slate-500">
                  {fmtPeriod(p.period)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.team_name} data-testid={`heatmap-row-${row.team_name}`}>
                <td className="px-3 py-2 font-semibold text-slate-700 border border-gray-200 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded bg-[#0052CC]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-[#0052CC]">
                        {row.team_name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    {row.team_name}
                  </div>
                </td>
                <td className="px-2 py-2 text-center border border-gray-200 font-mono text-slate-600 bg-slate-50">
                  {row.capacity_jh_month} JH
                </td>
                {row.periods.map((p) => {
                  const style = getCellStyle(p.utilization_pct);
                  return (
                    <td
                      key={p.period}
                      className={`px-2 py-2 text-center border border-gray-200 cursor-default relative transition-all ${style.bg} ${style.text}`}
                      data-testid={`heatmap-cell-${row.team_name}-${p.period}`}
                      onMouseEnter={() => setTooltip({ team: row.team_name, period: p.period, ...p })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {p.capacity_jh === 0 ? (
                        <span className="text-slate-200">—</span>
                      ) : (
                        <div className="font-semibold">
                          {p.utilization_pct}%
                          {p.allocated_jh > 0 && (
                            <div className="text-[9px] font-normal mt-0.5 opacity-70">
                              {p.allocated_jh}/{p.capacity_jh} JH
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed bottom-8 right-8 bg-slate-800 text-white text-xs rounded-lg shadow-xl px-4 py-3 z-50 pointer-events-none min-w-[200px]">
          <div className="font-bold mb-1">{tooltip.team} · {fmtPeriod(tooltip.period)}</div>
          <div className="space-y-0.5 text-slate-300">
            <div>Capacité : <span className="text-white font-semibold">{tooltip.capacity_jh} JH</span></div>
            <div>Alloués : <span className="text-white font-semibold">{tooltip.allocated_jh} JH</span></div>
            <div>Utilisation : <span className={`font-bold ${getCellStyle(tooltip.utilization_pct).text.replace("text-", "text-")}`}>{tooltip.utilization_pct}%</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
