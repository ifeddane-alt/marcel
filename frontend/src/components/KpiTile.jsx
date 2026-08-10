import React from "react";
import { Ring } from "@/components/ProjectTile";

export const KpiTile = ({ label, value, sub, pct, ringColor, ringLabel, ringCaption, valueClass = "text-[#26243a]", testId }) => (
  <div
    className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4 flex items-center justify-between gap-3"
    data-testid={testId}
  >
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{label}</div>
      <div className={`font-mono-data text-[22px] font-bold mt-1 ${valueClass}`}>{value}</div>
      {sub && <div className="text-[10.5px] text-[#8a87a0] mt-0.5 truncate">{sub}</div>}
    </div>
    {pct != null && (
      <div className="flex-shrink-0">
        <Ring pct={pct} color={ringColor} label={ringLabel} caption={ringCaption} />
      </div>
    )}
  </div>
);

export default KpiTile;
