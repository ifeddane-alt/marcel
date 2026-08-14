import React, { useEffect, useState } from "react";
import { Activity, Users, Layers, Wrench } from "lucide-react";
import { capacityAPI } from "@/api";

const fmtMonth = (m) => {
  const names = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${names[parseInt(m.slice(5, 7), 10) - 1]} ${m.slice(2, 4)}`;
};

const rateStyle = (rate, capacity) => {
  if (!capacity) return { backgroundColor: "#f7f6fb", color: "#a39fb8" };
  if (rate > 100) return { backgroundColor: "#fbe1de", color: "#cc4f45" };
  if (rate >= 85) return { backgroundColor: "#fdf6e3", color: "#b7791f" };
  if (rate === 0) return { backgroundColor: "#f7f6fb", color: "#a39fb8" };
  return { backgroundColor: "#ddf0d8", color: "#3f8a34" };
};

const AXES = [
  { id: "team", label: "Par équipe", icon: Users },
  { id: "resource", label: "Par ressource", icon: Activity },
  { id: "skill", label: "Par compétence", icon: Wrench },
];

export default function Capacite() {
  const [horizon, setHorizon] = useState(3);
  const [axis, setAxis] = useState("team");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    capacityAPI.console(horizon, axis)
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [horizon, axis]);

  const rows = data?.rows || [];
  const months = data?.months || [];
  const overloaded = rows.filter((r) => r.rate > 100).length;
  const globalRate = data?.totals?.capacity ? Math.round((data.totals.load / data.totals.capacity) * 100) : null;

  return (
    <div className="p-4 md:p-6 space-y-5" data-testid="capacite-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-extrabold text-[#26243a] flex items-center gap-2">
            <Layers size={20} className="text-[#352c6e]" /> Console capacitaire
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Charge vs capacité (JH) sur les prochains mois — allocations × capacité des ressources</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[10px] border-[1.5px] border-[#dcd7ea] overflow-hidden bg-white">
            {[3, 6].map((h) => (
              <button key={h} onClick={() => setHorizon(h)} data-testid={`capacity-horizon-${h}`}
                className={`px-4 h-9 text-sm font-bold transition-colors ${horizon === h ? "bg-[#2e5fe8] text-white" : "text-[#5d5a75] hover:bg-[#f0eefc]"}`}>
                {h} mois
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Capacité totale" value={data?.totals?.capacity != null ? `${data.totals.capacity} JH` : "—"} testId="capacity-kpi-capacity" />
        <Kpi label="Charge allouée" value={data?.totals?.load != null ? `${data.totals.load} JH` : "—"} testId="capacity-kpi-load" />
        <Kpi label="Taux de charge global" value={globalRate != null ? `${globalRate} %` : "—"}
          color={globalRate > 100 ? "#cc4f45" : globalRate >= 85 ? "#b7791f" : "#3f8a34"} testId="capacity-kpi-rate" />
        <Kpi label={`${axis === "team" ? "Équipes" : axis === "resource" ? "Ressources" : "Compétences"} en surcharge`}
          value={overloaded} color={overloaded > 0 ? "#cc4f45" : "#3f8a34"} testId="capacity-kpi-overloaded" />
      </div>

      {/* Axes */}
      <div className="flex items-center gap-1 flex-wrap">
        {AXES.map((a) => (
          <button key={a.id} onClick={() => setAxis(a.id)} data-testid={`capacity-axis-${a.id}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${axis === a.id ? "bg-blue-600 text-white" : "text-zinc-500 border border-zinc-200 bg-white hover:bg-zinc-50"}`}>
            <a.icon size={13} /> {a.label}
          </button>
        ))}
      </div>

      {/* Grille */}
      <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-x-auto" data-testid="capacity-grid">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[#8a87a0] border-b border-[#f0eff6] bg-[#fbfaff]">
              <th className="px-4 py-2.5">{axis === "team" ? "Équipe" : axis === "resource" ? "Ressource" : "Compétence"}</th>
              <th className="px-2 py-2.5 text-center w-14">Res.</th>
              {months.map((m) => <th key={m} className="px-2 py-2.5 text-center">{fmtMonth(m)}</th>)}
              <th className="px-3 py-2.5 text-center bg-[#f0eefc]">Total</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={months.length + 3} className="px-4 py-8 text-center text-[#8a87a0]">Chargement…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={months.length + 3} className="px-4 py-8 text-center text-[#8a87a0]" data-testid="capacity-empty">Aucune donnée de capacité.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-[#f7f6fb] hover:bg-[#fbfaff]" data-testid={`capacity-row-${r.key}`}>
                <td className="px-4 py-2 font-semibold text-[#26243a] truncate max-w-[220px]" title={r.label}>{r.label}</td>
                <td className="px-2 py-2 text-center text-xs text-[#8a87a0]">{r.resources}</td>
                {r.cells.map((c) => (
                  <td key={c.month} className="px-1.5 py-1.5 text-center">
                    <div className="rounded-lg px-1.5 py-1 leading-tight" style={rateStyle(c.rate, c.capacity)}>
                      <div className="text-[13px] font-bold">{c.capacity ? `${c.rate} %` : "—"}</div>
                      <div className="text-[9px] opacity-80">{c.load} / {c.capacity} JH</div>
                    </div>
                  </td>
                ))}
                <td className="px-3 py-2 text-center bg-[#fbfaff]">
                  <span className="text-[13px] font-extrabold" style={{ color: rateStyle(r.rate, r.total_capacity).color }}>
                    {r.total_capacity ? `${r.rate} %` : "—"}
                  </span>
                  <div className="text-[9px] text-[#8a87a0]">{r.total_load} / {r.total_capacity} JH</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {axis === "skill" && (
        <p className="text-[11px] text-[#8a87a0]">Une ressource multi-compétences compte dans chaque compétence : les totaux par compétence ne s'additionnent pas.</p>
      )}
    </div>
  );
}

const Kpi = ({ label, value, color, testId }) => (
  <div className="bg-white border border-[#e8e6f0] rounded-xl p-4 shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]" data-testid={testId}>
    <p className="text-[10px] uppercase tracking-widest font-bold text-[#8a87a0]">{label}</p>
    <p className="text-2xl font-extrabold mt-1" style={{ color: color || "#26243a" }}>{value}</p>
  </div>
);
