import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { indicatorsAPI } from "@/api";
import { toast } from "sonner";
import { formatEuro } from "@/utils/format";

export const cpiColor = (v) => (v == null ? "text-zinc-300" : v >= 0.95 ? "text-emerald-600" : v >= 0.85 ? "text-amber-600" : "text-rose-600");
const pctColor = (v) => (v == null ? "text-zinc-300" : v >= 90 ? "text-emerald-600" : v >= 70 ? "text-amber-600" : "text-rose-600");

function Stat({ label, value, sub, accent, testId }) {
  return (
    <div className="bg-[#fbfaff] border border-[#e8e6f0] rounded-lg p-3" data-testid={testId}>
      <div className="text-[9.5px] uppercase tracking-widest text-zinc-400 font-bold">{label}</div>
      <div className={`font-mono-data font-bold text-lg ${accent || "text-zinc-950"}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Block({ title, badge, children, testId }) {
  return (
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]" data-testid={testId}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100">
        <span className="font-heading text-[13px] font-bold text-[#26243a]">{title}</span>
        {badge && <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border bg-[#f0eefc] text-[#352c6e] border-[#e0dcf5]">{badge}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const SPRINT_ST = { en_cours: "En cours", termine: "Terminé", planifie: "Planifié" };

function SprintsTable({ projectId, canWrite, onChanged }) {
  const [sprints, setSprints] = useState([]);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", committed_points: "", completed_points: "", status: "termine" });
  const load = useCallback(() => {
    indicatorsAPI.sprints(projectId).then((r) => setSprints(r.data)).catch(() => {});
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await indicatorsAPI.createSprint(projectId, {
      ...form,
      committed_points: form.committed_points === "" ? null : parseFloat(form.committed_points),
      completed_points: form.completed_points === "" ? null : parseFloat(form.completed_points),
    });
    toast.success("Sprint enregistré");
    setForm({ name: "", start_date: "", end_date: "", committed_points: "", completed_points: "", status: "termine" });
    load();
    onChanged?.();
  };
  const del = async (s) => {
    await indicatorsAPI.deleteSprint(s.sprint_id);
    load();
    onChanged?.();
  };
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Sprints ({sprints.length})</div>
      {sprints.length > 0 && (
        <table className="w-full text-sm mb-2">
          <thead>
            <tr className="text-left border-b border-zinc-100">
              {["Sprint", "Période", "Engagé", "Réalisé", "Complétion", "Statut", ""].map((h) => (
                <th key={h} className="py-1.5 pr-2 text-[9.5px] uppercase tracking-wider font-bold text-[#8a87a0]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sprints.map((s) => {
              const comp = s.committed_points > 0 ? Math.round((s.completed_points || 0) / s.committed_points * 100) : null;
              return (
                <tr key={s.sprint_id} className="border-b border-zinc-50" data-testid={`sprint-row-${s.sprint_id}`}>
                  <td className="py-1.5 pr-2 text-xs font-medium text-zinc-800">{s.name}</td>
                  <td className="py-1.5 pr-2 font-mono-data text-[11px] text-zinc-500">{s.start_date || "—"} → {s.end_date || "—"}</td>
                  <td className="py-1.5 pr-2 font-mono-data text-xs">{s.committed_points ?? "—"}</td>
                  <td className="py-1.5 pr-2 font-mono-data text-xs font-bold">{s.completed_points ?? "—"}</td>
                  <td className={`py-1.5 pr-2 font-mono-data text-xs font-bold ${pctColor(comp)}`}>{comp != null ? `${comp}%` : "—"}</td>
                  <td className="py-1.5 pr-2 text-[10px] text-zinc-500">{SPRINT_ST[s.status] || s.status}</td>
                  <td className="py-1.5">
                    {canWrite && <button onClick={() => del(s)} className="p-0.5 text-zinc-300 hover:text-rose-500"><Trash2 size={11} /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {canWrite && (
        <form onSubmit={add} className="flex items-center gap-1.5 flex-wrap">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sprint 12"
            data-testid="sprint-name-input" className="w-24 text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-600" />
          <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none" />
          <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none" />
          <input type="number" min="0" value={form.committed_points} onChange={(e) => setForm({ ...form, committed_points: e.target.value })}
            placeholder="Engagé" data-testid="sprint-committed-input"
            className="w-20 text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none font-mono-data" />
          <input type="number" min="0" value={form.completed_points} onChange={(e) => setForm({ ...form, completed_points: e.target.value })}
            placeholder="Réalisé" data-testid="sprint-completed-input"
            className="w-20 text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none font-mono-data" />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
            {Object.entries(SPRINT_ST).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="submit" data-testid="sprint-add-btn"
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus size={11} /> Ajouter
          </button>
        </form>
      )}
    </div>
  );
}

export default function ProjectIndicators({ projectId, canWrite }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    indicatorsAPI.project(projectId).then((r) => setData(r.data)).catch(() => setData(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  if (data === null) return <div className="p-6 text-sm text-zinc-400">Calcul des indicateurs…</div>;
  if (data === false) return <div className="p-6 text-sm text-zinc-400">Indicateurs indisponibles.</div>;

  const c = data.common;
  const evm = data.evm;
  const ag = data.agile;
  const sf = data.safe;
  const TrendIcon = ag?.velocity_trend === "up" ? TrendingUp : ag?.velocity_trend === "down" ? TrendingDown : Minus;

  return (
    <div className="space-y-4" data-testid="project-indicators">
      <Block title="Socle commun" badge={data.methodology} testId="indicators-common">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Avancement physique" value={`${c.physical_pct}%`}
            sub={`temps écoulé : ${c.elapsed_pct}%`}
            accent={c.physical_pct + 10 < c.elapsed_pct ? "text-rose-600" : "text-zinc-950"} testId="ind-physical" />
          <Stat label="Budget consommé" value={`${c.budget_pct}%`}
            sub={`${formatEuro(c.budget_consumed)} / ${formatEuro(c.budget_total)}`}
            accent={c.budget_pct > 100 ? "text-rose-600" : c.budget_pct > c.elapsed_pct + 10 ? "text-amber-600" : "text-zinc-950"} testId="ind-budget" />
          <Stat label="Risques ouverts" value={c.risks_open}
            sub={c.risks_critical ? `dont ${c.risks_critical} critiques` : undefined}
            accent={c.risks_critical > 0 ? "text-rose-600" : "text-zinc-950"} testId="ind-risks" />
          <Stat label="Jalons" value={`${c.milestones_done}/${c.milestones_total}`}
            sub={c.milestones_late ? `${c.milestones_late} en retard` : "aucun retard"}
            accent={c.milestones_late > 0 ? "text-amber-600" : "text-zinc-950"} testId="ind-milestones" />
        </div>
      </Block>

      {evm && (
        <Block title="Earned Value Management (EVM)" badge="Waterfall" testId="indicators-evm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="CPI (efficience coût)" value={evm.cpi ?? "—"} accent={cpiColor(evm.cpi)}
              sub="≥ 0,95 sain · < 0,85 alerte" testId="ind-cpi" />
            <Stat label="SPI (efficience délai)" value={evm.spi ?? "—"} accent={cpiColor(evm.spi)}
              sub="≥ 0,95 sain · < 0,85 alerte" testId="ind-spi" />
            <Stat label="EAC (EVM)" value={evm.eac_evm != null ? formatEuro(evm.eac_evm) : "—"}
              sub={`BAC : ${formatEuro(evm.bac)}`}
              accent={evm.eac_evm > evm.bac ? "text-rose-600" : "text-zinc-950"} testId="ind-eac" />
            <Stat label="VAC (écart à terminaison)" value={evm.vac != null ? formatEuro(evm.vac) : "—"}
              accent={evm.vac != null && evm.vac < 0 ? "text-rose-600" : "text-emerald-600"} testId="ind-vac" />
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-zinc-400 font-mono-data flex-wrap">
            <span>EV {formatEuro(evm.ev)}</span><span>PV {formatEuro(evm.pv)}</span><span>AC {formatEuro(evm.ac)}</span>
          </div>
        </Block>
      )}

      {ag && (
        <Block title="Indicateurs Agile" badge={data.methodology === "hybrid" ? "Hybride" : "Agile"} testId="indicators-agile">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Vélocité moy. (3 sprints)" value={ag.velocity_avg ?? "—"}
              sub={ag.velocity_trend ? "tendance" : undefined} testId="ind-velocity" />
            <Stat label="Complétion dernier sprint" value={ag.last_sprint_completion_pct != null ? `${ag.last_sprint_completion_pct}%` : "—"}
              accent={pctColor(ag.last_sprint_completion_pct)} testId="ind-completion" />
            <Stat label="WIP (en cours)" value={ag.wip} testId="ind-wip" />
            <Stat label="Débit 90 jours" value={ag.throughput_90d} sub="tâches terminées" testId="ind-throughput" />
            <Stat label="Âge moyen tâches" value={ag.avg_task_age_days != null ? `${ag.avg_task_age_days} j` : "—"} testId="ind-age" />
          </div>
          {ag.velocity_trend && (
            <div className={`inline-flex items-center gap-1 mt-2 text-[11px] font-semibold ${ag.velocity_trend === "up" ? "text-emerald-600" : ag.velocity_trend === "down" ? "text-rose-600" : "text-zinc-400"}`}>
              <TrendIcon size={12} /> Vélocité {ag.velocity_trend === "up" ? "en hausse" : ag.velocity_trend === "down" ? "en baisse" : "stable"}
            </div>
          )}
          <SprintsTable projectId={projectId} canWrite={canWrite} onChanged={load} />
        </Block>
      )}

      {sf && (
        <Block title="Indicateurs SAFe" badge="SAFe" testId="indicators-safe">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Fiabilité d'engagement trains" value={sf.predictability_pct != null ? `${sf.predictability_pct}%` : "—"}
              sub="vélocité réalisée vs planifiée" accent={pctColor(sf.predictability_pct)} testId="ind-predictability" />
            <Stat label="Sprints mesurés" value={sf.sprints_measured} testId="ind-safe-sprints" />
            <Stat label="PI actifs" value={sf.pis_active} testId="ind-pis" />
          </div>
        </Block>
      )}
    </div>
  );
}
