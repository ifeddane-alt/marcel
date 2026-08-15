import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

const UTIL_COLORS = [
  { max: 50,  bg: "bg-zinc-50",   text: "text-zinc-400",    label: "< 50%",   border: "border-zinc-100" },
  { max: 70,  bg: "bg-emerald-50",text: "text-emerald-600", label: "50–70%",  border: "border-emerald-100" },
  { max: 90,  bg: "bg-amber-50",  text: "text-amber-600",   label: "70–90%",  border: "border-amber-100" },
  { max: 100, bg: "bg-orange-50", text: "text-orange-600",  label: "90–100%", border: "border-orange-100" },
  { max: Infinity, bg: "bg-rose-50", text: "text-rose-600", label: "> 100%",  border: "border-rose-100" },
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
      <div className="py-10 text-center text-sm text-zinc-400">
        Aucune donnée de capacité. Créez des équipes et des allocations mensuelles pour afficher la heatmap.
      </div>
    );
  }

  const periods = data[0]?.periods || [];

  const totals = periods.map((_, i) => {
    const cap = data.reduce((s, r) => s + (r.periods?.[i]?.capacity_jh || 0), 0);
    const alloc = data.reduce((s, r) => s + (r.periods?.[i]?.allocated_jh || 0), 0);
    return {
      period: periods[i].period,
      capacity_jh: Math.round(cap * 10) / 10,
      allocated_jh: Math.round(alloc * 10) / 10,
      utilization_pct: cap > 0 ? Math.round((alloc / cap) * 100) : 0,
    };
  });
  const totalCapMonth = Math.round(data.reduce((s, r) => s + (r.capacity_jh_month || 0), 0) * 10) / 10;

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
            className="appearance-none text-xs border border-m-border rounded-lg px-3 py-1.5 pr-7 bg-white focus:outline-none focus:border-m-blue text-zinc-600"
            data-testid="heatmap-months-select"
          >
            {[3, 6, 9, 12].map((v) => (
              <option key={v} value={v}>{v} mois</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-2 text-zinc-400 pointer-events-none" />
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" data-testid="heatmap-table">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-[10.5px] uppercase tracking-wider font-bold text-m-muted bg-m-bg border border-m-border min-w-[120px]">
                Équipe
              </th>
              <th className="px-2 py-2 text-[10.5px] uppercase tracking-wider font-bold text-m-muted bg-m-bg border border-m-border text-center min-w-[60px]">
                Capa/mois
              </th>
              {periods.map((p) => (
                <th key={p.period} className="px-2 py-2 text-[10.5px] uppercase tracking-wider font-bold text-m-muted bg-m-bg border border-m-border text-center min-w-[72px]">
                  {fmtPeriod(p.period)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.team_name} data-testid={`heatmap-row-${row.team_name}`}>
                <td className="px-3 py-2 font-semibold text-zinc-700 border border-m-border bg-white">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-m-blue/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-m-blue">
                        {row.team_name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    {row.team_id ? (
                      <Link to={`/teams/${row.team_id}`} className="hover:underline hover:text-m-blue transition-colors">
                        {row.team_name}
                      </Link>
                    ) : (
                      row.team_name
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-center border border-m-border font-mono-data text-zinc-600 bg-m-bg">
                  {row.capacity_jh_month} JH
                </td>
                {row.periods.map((p) => {
                  const style = getCellStyle(p.utilization_pct);
                  const content = p.capacity_jh === 0 ? (
                    <span className="text-zinc-200">—</span>
                  ) : (
                    <div className="font-semibold font-mono-data">
                      {p.utilization_pct}%
                      {p.allocated_jh > 0 && (
                        <div className="text-[9px] font-normal mt-0.5 opacity-70">
                          {p.allocated_jh}/{p.capacity_jh} JH
                        </div>
                      )}
                    </div>
                  );
                  return (
                    <td
                      key={p.period}
                      className={`text-center border border-m-border relative transition-all ${style.bg} ${style.text}`}
                      data-testid={`heatmap-cell-${row.team_name}-${p.period}`}
                      onMouseEnter={() => setTooltip({ team: row.team_name, period: p.period, ...p })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {row.team_id ? (
                        <Link
                          to={`/teams/${row.team_id}?month=${p.period}`}
                          className="block px-2 py-2 hover:ring-2 hover:ring-inset hover:ring-blue-400 rounded-none"
                          title={`${row.team_name} · ${fmtPeriod(p.period)} — voir le détail de la charge`}
                          data-testid={`heatmap-link-${row.team_id}-${p.period}`}
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="px-2 py-2 cursor-default">{content}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-testid="heatmap-total-row">
              <td className="px-3 py-2 font-heading text-[11px] font-bold text-m-ink border border-m-border bg-m-bg">
                Total portefeuille
              </td>
              <td className="px-2 py-2 text-center border border-m-border font-mono-data font-bold text-m-ink bg-m-bg">
                {totalCapMonth} JH
              </td>
              {totals.map((t) => {
                const style = getCellStyle(t.utilization_pct);
                return (
                  <td
                    key={t.period}
                    className={`px-2 py-2 text-center border border-m-border font-mono-data font-bold ${style.bg} ${style.text}`}
                    data-testid={`heatmap-total-${t.period}`}
                  >
                    {t.capacity_jh === 0 ? <span className="text-zinc-200">—</span> : (
                      <>
                        {t.utilization_pct}%
                        <div className="text-[9px] font-normal mt-0.5 opacity-70">{t.allocated_jh}/{t.capacity_jh} JH</div>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed bottom-8 right-8 bg-zinc-800 text-white text-xs rounded-lg shadow-xl px-4 py-3 z-50 pointer-events-none min-w-[200px]">
          <div className="font-bold mb-1">{tooltip.team} · {fmtPeriod(tooltip.period)}</div>
          <div className="space-y-0.5 text-zinc-300">
            <div>Capacité : <span className="text-white font-semibold">{tooltip.capacity_jh} JH</span></div>
            <div>Alloués : <span className="text-white font-semibold">{tooltip.allocated_jh} JH</span></div>
            <div>Utilisation : <span className="font-bold">{tooltip.utilization_pct}%</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
