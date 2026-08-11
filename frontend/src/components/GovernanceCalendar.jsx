import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const TYPE_COLORS = {
  copil: "bg-blue-600",
  coproj: "bg-sky-500",
  comex: "bg-violet-600",
  codir: "bg-amber-500",
  steering: "bg-teal-600",
  autre: "bg-zinc-400",
};
const TYPE_LABELS = {
  copil: "COPIL", coproj: "COPROJ", comex: "COMEX",
  codir: "CODIR", steering: "Steering", autre: "Autre",
};
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function GovernanceCalendar({ instances, onOpen }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const byDay = {};
  instances.forEach((g) => {
    const k = (g.date_scheduled || "").slice(0, 10);
    if (!k) return;
    (byDay[k] = byDay[k] || []).push(g);
  });

  const startOffset = (month.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) =>
    new Date(month.getFullYear(), month.getMonth(), 1 - startOffset + i));
  const todayKey = dayKey(new Date());

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm" data-testid="gov-calendar">
      {/* Header navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            data-testid="gov-cal-prev"
            className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <ChevronLeft size={15} />
          </button>
          <div className="font-heading text-sm font-bold text-[#26243a] capitalize w-40 text-center" data-testid="gov-cal-month">
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            data-testid="gov-cal-next"
            className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <ChevronRight size={15} />
          </button>
          <button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}
            data-testid="gov-cal-today"
            className="ml-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
            Aujourd'hui
          </button>
        </div>
        {/* Légende */}
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(TYPE_LABELS).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span className={`w-2 h-2 rounded-full ${TYPE_COLORS[k]}`} /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border-b border-zinc-100">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-[10px] uppercase tracking-widest font-bold text-[#8a87a0] text-center">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const k = dayKey(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = k === todayKey;
          const dayInstances = byDay[k] || [];
          return (
            <div key={i}
              className={`min-h-[84px] border-b border-r border-zinc-50 p-1.5 ${inMonth ? "" : "bg-zinc-50/60"}`}>
              <div className={`text-[11px] font-mono-data mb-1 w-5 h-5 flex items-center justify-center rounded-full
                ${isToday ? "bg-blue-600 text-white font-bold" : inMonth ? "text-zinc-600" : "text-zinc-300"}`}>
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {dayInstances.map((g) => (
                  <button key={g.governance_id} onClick={() => onOpen(g)}
                    data-testid={`gov-cal-chip-${g.governance_id}`}
                    title={`${TYPE_LABELS[g.type] || g.type} — ${g.name}`}
                    className={`w-full text-left px-1.5 py-0.5 rounded text-[9.5px] font-semibold text-white truncate
                      hover:opacity-80 transition-opacity ${TYPE_COLORS[g.type] || TYPE_COLORS.autre}
                      ${g.status === "annule" ? "opacity-40 line-through" : ""}`}>
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
