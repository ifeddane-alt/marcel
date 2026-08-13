import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gauge, Camera } from "lucide-react";
import { indicatorsAPI, snapshotsAPI, thresholdsAPI } from "@/api";
import { makeCpiColor } from "@/components/ProjectIndicators";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { formatEuro } from "@/utils/format";

const METHOD_CFG = {
  waterfall: { label: "Waterfall", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  agile: { label: "Agile", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  safe: { label: "SAFe", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  hybrid: { label: "Hybride", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};
const RAG = { green: "bg-emerald-500", orange: "bg-amber-500", red: "bg-rose-500" };
const pctColor = (v) => (v == null ? "text-zinc-300" : v >= 90 ? "text-emerald-600" : v >= 70 ? "text-amber-600" : "text-rose-600");
const fmtDelta = (v) => (v == null ? "" : v > 0 ? `+${v}` : `${v}`);

function SnapshotsTab() {
  const { hasAnyPermission } = usePermissions();
  const canRun = hasAnyPermission("*", "admin.config", "projects.create");
  const [snaps, setSnaps] = useState(null);
  const load = () => snapshotsAPI.list().then((r) => setSnaps(r.data)).catch(() => setSnaps([]));
  useEffect(() => { load(); }, []);
  const run = async () => {
    try { await snapshotsAPI.run(); toast.success("Snapshot du mois enregistré"); load(); }
    catch { toast.error("Erreur"); }
  };
  if (snaps === null) return <div className="text-sm text-zinc-400 p-4">Chargement…</div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">Photo mensuelle automatique du portefeuille (le 1er du mois) — comparez les évolutions d'un mois à l'autre.</p>
        {canRun && (
          <button onClick={run} data-testid="snapshot-run-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
            <Camera size={12} /> Snapshot maintenant
          </button>
        )}
      </div>
      {snaps.length === 0 ? (
        <div className="bg-white border border-[#e8e6f0] rounded-xl p-8 text-center text-sm text-zinc-400" data-testid="snapshots-empty">
          Aucun snapshot — le premier sera pris automatiquement le 1er du mois prochain.
        </div>
      ) : (
        <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#fbfaff] border-b border-[#e8e6f0] text-left">
                {["Mois", "Projets", "Budget total", "Consommé", "EAC", "Vert", "Orange", "Rouge"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10.5px] uppercase tracking-wider font-bold text-[#8a87a0] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snaps.map((s, i) => {
                const prev = i > 0 ? snaps[i - 1] : null;
                const d = (k) => (prev ? s[k] - prev[k] : null);
                return (
                  <tr key={s.month} className="border-b border-zinc-100" data-testid={`snapshot-row-${s.month}`}>
                    <td className="px-3 py-2.5 font-mono-data text-xs font-bold text-zinc-800">{s.month}</td>
                    <td className="px-3 py-2.5 font-mono-data text-xs">{s.n_projects}
                      {d("n_projects") != null && d("n_projects") !== 0 && <span className="text-[10px] text-zinc-400 ml-1">({fmtDelta(d("n_projects"))})</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono-data text-xs">{formatEuro(s.budget_total)}</td>
                    <td className="px-3 py-2.5 font-mono-data text-xs">{formatEuro(s.budget_consumed)}
                      {d("budget_consumed") != null && d("budget_consumed") !== 0 && <span className="text-[10px] text-amber-600 ml-1">({fmtDelta(Math.round(d("budget_consumed") / 1000))} k€)</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono-data text-xs">{formatEuro(s.eac_total)}</td>
                    <td className="px-3 py-2.5 font-mono-data text-xs text-emerald-600 font-bold">{s.rag?.green ?? 0}</td>
                    <td className="px-3 py-2.5 font-mono-data text-xs text-amber-600 font-bold">{s.rag?.orange ?? 0}</td>
                    <td className="px-3 py-2.5 font-mono-data text-xs text-rose-600 font-bold">{s.rag?.red ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Pilotage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [methodFilter, setMethodFilter] = useState("");
  const [tab, setTab] = useState("indicateurs");
  const [thresholds, setThresholds] = useState({ cpi_amber: 0.95, cpi_red: 0.85, spi_amber: 0.95, spi_red: 0.85 });

  useEffect(() => {
    indicatorsAPI.portfolio().then((r) => setRows(r.data)).catch(() => setRows([]));
    thresholdsAPI.get().then((r) => setThresholds(r.data)).catch(() => {});
  }, []);

  const cpiColor = makeCpiColor(thresholds.cpi_amber, thresholds.cpi_red);
  const spiColor = makeCpiColor(thresholds.spi_amber, thresholds.spi_red);

  if (rows === null) return <div className="p-8 text-sm text-zinc-400">Calcul des indicateurs portefeuille…</div>;
  const filtered = methodFilter ? rows.filter((r) => r.methodology === methodFilter) : rows;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="pilotage-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-extrabold text-[#26243a] flex items-center gap-2">
            <Gauge size={20} className="text-[#352c6e]" /> Pilotage par indicateurs
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Chaque projet est piloté avec les indicateurs de sa méthodologie — EVM (waterfall), vélocité (agile), fiabilité (SAFe)</p>
        </div>
        {tab === "indicateurs" && (
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} data-testid="pilotage-method-filter"
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-600">
            <option value="">Toutes méthodologies</option>
            {Object.entries(METHOD_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
        )}
      </div>

      <div className="border-b border-[#e7e3f2] flex gap-5">
        {[{ id: "indicateurs", label: "Indicateurs" }, { id: "evolution", label: "Évolution mensuelle" }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`pilotage-tab-${t.id}`}
            className={`pb-2 text-sm font-semibold ${tab === t.id ? "text-[#2e5fe8] border-b-[3px] border-[#2e5fe8] -mb-px" : "text-zinc-400 hover:text-zinc-600"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "evolution" && <SnapshotsTab />}

      {tab === "indicateurs" && (
        <>
          <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fbfaff] border-b border-[#e8e6f0] text-left">
                  {["Projet", "Méthode", "Avancement", "Budget", "CPI", "SPI", "Vélocité", "Complétion sprint", "WIP", "Risques", "Jalons retard"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[10.5px] uppercase tracking-wider font-bold text-[#8a87a0] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const m = METHOD_CFG[r.methodology] || METHOD_CFG.waterfall;
                  const isWf = r.methodology === "waterfall" || r.methodology === "hybrid";
                  const isAg = ["agile", "safe", "hybrid"].includes(r.methodology);
                  return (
                    <tr key={r.project_id} onClick={() => navigate(`/projects/${r.project_id}`)}
                      className="border-b border-zinc-100 hover:bg-zinc-50/70 cursor-pointer" data-testid={`pilotage-row-${r.project_id}`}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${RAG[r.status_rag] || "bg-zinc-300"}`} />
                          <div>
                            <div className="text-xs font-semibold text-zinc-800 max-w-[220px] truncate">{r.name}</div>
                            {r.code && <div className="font-mono-data text-[10px] text-zinc-400">{r.code}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${m.cls}`}>{m.label}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`font-mono-data text-xs font-bold ${r.physical_pct + 10 < r.elapsed_pct ? "text-rose-600" : "text-zinc-700"}`}>{r.physical_pct}%</span>
                        <span className="font-mono-data text-[10px] text-zinc-400"> / {r.elapsed_pct}% écoulé</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-mono-data text-xs font-bold ${r.budget_pct > 100 ? "text-rose-600" : r.budget_pct > r.elapsed_pct + 10 ? "text-amber-600" : "text-zinc-700"}`}>{r.budget_pct}%</span>
                      </td>
                      <td className={`px-3 py-2.5 font-mono-data text-xs font-bold ${isWf ? cpiColor(r.cpi) : "text-zinc-200"}`}>{isWf ? (r.cpi ?? "—") : "·"}</td>
                      <td className={`px-3 py-2.5 font-mono-data text-xs font-bold ${isWf ? spiColor(r.spi) : "text-zinc-200"}`}>{isWf ? (r.spi ?? "—") : "·"}</td>
                      <td className="px-3 py-2.5 font-mono-data text-xs font-bold text-zinc-700">{isAg ? (r.velocity_avg ?? "—") : <span className="text-zinc-200">·</span>}</td>
                      <td className={`px-3 py-2.5 font-mono-data text-xs font-bold ${isAg ? pctColor(r.last_sprint_completion_pct) : "text-zinc-200"}`}>
                        {isAg ? (r.last_sprint_completion_pct != null ? `${r.last_sprint_completion_pct}%` : "—") : "·"}
                      </td>
                      <td className="px-3 py-2.5 font-mono-data text-xs text-zinc-600">{isAg ? r.wip : <span className="text-zinc-200">·</span>}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-mono-data text-xs font-bold ${r.risks_critical > 0 ? "text-rose-600" : "text-zinc-600"}`}>{r.risks_open}</span>
                        {r.risks_critical > 0 && <span className="text-[9px] text-rose-500 font-bold ml-1">({r.risks_critical} crit.)</span>}
                      </td>
                      <td className={`px-3 py-2.5 font-mono-data text-xs font-bold ${r.milestones_late > 0 ? "text-amber-600" : "text-zinc-400"}`}>{r.milestones_late}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-zinc-400" data-testid="pilotage-thresholds-note">
            Seuils (configurables dans Administration → Configuration → Indicateurs) : CPI/SPI ≥ {thresholds.cpi_amber} <span className="text-emerald-600 font-bold">vert</span> · {thresholds.cpi_red}–{thresholds.cpi_amber} <span className="text-amber-600 font-bold">ambre</span> · &lt; {thresholds.cpi_red} <span className="text-rose-600 font-bold">rouge</span>. Cliquez sur un projet pour le détail (onglet Pilotage).
          </p>
        </>
      )}
    </div>
  );
}
