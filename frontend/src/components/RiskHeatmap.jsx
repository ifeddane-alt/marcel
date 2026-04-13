import React, { useState } from "react";

function getCellColor(crit) {
  if (crit >= 16) return "bg-rose-100 border-rose-200 hover:bg-rose-200";
  if (crit >= 7)  return "bg-amber-50 border-amber-200 hover:bg-amber-100";
  return "bg-emerald-50 border-emerald-200 hover:bg-emerald-100";
}

function getDotColor(crit) {
  if (crit >= 16) return "bg-rose-500 text-white";
  if (crit >= 7)  return "bg-amber-500 text-white";
  return "bg-emerald-500 text-white";
}

export default function RiskHeatmap({ risks, showProjectName = false }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  const getRisks = (prob, impact) => risks.filter((r) => r.probability === prob && r.impact === impact);
  const hoveredRisks = hoveredCell ? getRisks(hoveredCell.prob, hoveredCell.impact) : [];

  return (
    <div data-testid="risk-heatmap">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-3">
        Heatmap P × I
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col items-center justify-center w-3">
          <span className="text-[8px] text-slate-400" style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}>
            Probabilité
          </span>
        </div>
        <div className="flex-1">
          <div className="flex flex-col gap-0.5">
            {[5, 4, 3, 2, 1].map((prob) => (
              <div key={prob} className="flex items-center gap-0.5">
                <span className="text-[9px] text-slate-400 w-3 text-right flex-shrink-0">{prob}</span>
                <div className="flex gap-0.5 flex-1">
                  {[1, 2, 3, 4, 5].map((impact) => {
                    const crit = prob * impact;
                    const cellRisks = getRisks(prob, impact);
                    const isHovered = hoveredCell?.prob === prob && hoveredCell?.impact === impact;
                    return (
                      <div
                        key={impact}
                        className={`relative flex-1 h-8 flex items-center justify-center rounded border text-[10px] font-bold cursor-default transition-colors ${getCellColor(crit)} ${isHovered ? "ring-2 ring-[#0052CC]" : ""}`}
                        onMouseEnter={() => cellRisks.length > 0 && setHoveredCell({ prob, impact })}
                        onMouseLeave={() => setHoveredCell(null)}
                        data-testid={`heatmap-cell-${prob}-${impact}`}
                      >
                        {cellRisks.length > 0 && (
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${getDotColor(crit)}`}>
                            {cellRisks.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-0.5 mt-0.5 pl-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-slate-400">{i}</div>
            ))}
          </div>
          <div className="text-[8px] text-slate-400 text-center mt-0.5">Impact →</div>
        </div>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {[{ label: "Faible (1-6)", cls: "bg-emerald-100 border-emerald-300" },
          { label: "Modéré (7-15)", cls: "bg-amber-100 border-amber-300" },
          { label: "Élevé (16-25)", cls: "bg-rose-100 border-rose-300" }].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded border ${item.cls}`} />
            <span className="text-[9px] text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredCell && hoveredRisks.length > 0 && (
        <div className="mt-3 border border-gray-200 rounded-lg bg-slate-50 p-2.5" data-testid="heatmap-tooltip">
          <div className="text-[10px] font-bold text-slate-600 mb-1.5">
            P{hoveredCell.prob} × I{hoveredCell.impact} = {hoveredCell.prob * hoveredCell.impact}
          </div>
          {hoveredRisks.map((r) => {
            const crit = r.criticality;
            const cls = crit >= 16 ? "text-rose-600" : crit >= 7 ? "text-amber-600" : "text-emerald-600";
            return (
              <div key={r.risk_id} className="text-[11px] text-slate-700 py-0.5 border-b border-gray-100 last:border-0">
                <div className="flex items-start gap-1.5">
                  <span className={`font-bold flex-shrink-0 ${cls}`}>{crit}</span>
                  <span className="line-clamp-2">{r.title}</span>
                </div>
                {showProjectName && r.project_name && (
                  <div className="text-[10px] text-slate-400 pl-4">{r.project_name}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
