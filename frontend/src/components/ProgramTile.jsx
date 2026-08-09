import React from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { Ring, DateCircle, elapsedPct, clamp } from "@/components/ProjectTile";
import { formatEuro, formatDate } from "@/utils/format";

const RAG_STYLES = {
  green:  { head: "bg-[#ddf0d8]", badge: "bg-[#3f8a34]", fill: "#3f8a34", label: "Vert" },
  orange: { head: "bg-[#f3edb5]", badge: "bg-[#a3891a]", fill: "#a3891a", label: "Orange" },
  red:    { head: "bg-[#fbe1de]", badge: "bg-[#cc4f45]", fill: "#cc4f45", label: "Rouge" },
};
const STATUS_LABELS = { active: "Actif", on_hold: "En pause", completed: "Terminé", cancelled: "Annulé" };
const STATUS_COLORS = {
  active: "bg-white/60 text-emerald-800",
  on_hold: "bg-white/60 text-amber-800",
  completed: "bg-white/60 text-zinc-600",
  cancelled: "bg-white/60 text-rose-800",
};

export default function ProgramTile({ program: prog, onEdit, onDelete, canEdit, canDelete }) {
  const style = RAG_STYLES[prog.rag_consolidated] || RAG_STYLES.green;
  const progress = elapsedPct(prog.start_date, prog.end_date);
  const budgetPct = prog.budget_total > 0 ? clamp(Math.round(((prog.budget_consumed || 0) / prog.budget_total) * 100)) : 0;
  const overBudget = budgetPct > 90;
  const rc = prog.rag_counts || {};

  return (
    <div
      className="relative bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] hover:shadow-[0_10px_30px_-10px_rgba(53,44,110,0.2)] transition-shadow duration-200 mt-2.5"
      data-testid={`program-tile-${prog.program_id}`}
    >
      {/* Badge RAG flottant */}
      <span
        className={`absolute -top-2.5 right-3 z-10 text-[10px] font-extrabold text-white px-2.5 py-[3px] rounded-md font-heading tracking-wide ${style.badge}`}
        data-testid={`program-tile-status-${prog.program_id}`}
      >
        {style.label}
      </span>

      {/* En-tête teinté */}
      <div className={`${style.head} rounded-t-xl px-4 pt-3 pb-2.5`}>
        <Link
          to={`/programmes/${prog.program_id}`}
          className="font-heading text-[13.5px] font-bold text-[#26243a] leading-snug hover:underline block pr-10 truncate"
          data-testid={`program-tile-link-${prog.program_id}`}
          title={prog.name}
        >
          {prog.name}
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] font-semibold px-1.5 py-px rounded ${STATUS_COLORS[prog.status] || STATUS_COLORS.active}`}>
            {STATUS_LABELS[prog.status] || prog.status}
          </span>
          <span className="text-[10px] text-[#5d5a75]">{prog.project_count || 0} projet{(prog.project_count || 0) > 1 ? "s" : ""}</span>
          {prog.owner && <span className="text-[10px] text-[#5d5a75] truncate">· {prog.owner}</span>}
        </div>
      </div>

      {/* Corps */}
      <div className="px-4 pt-3 pb-2">
        {/* Timeline */}
        <div className="relative h-[22px]">
          <span className="absolute left-0 right-0 top-[10px] h-[2px] bg-[#e3e0ef] rounded" />
          <span className="absolute left-0 top-[10px] h-[2px] rounded" style={{ width: `${progress}%`, background: style.fill }} />
          <span className="absolute top-[6px] w-[9px] h-[9px] rotate-45 rounded-[2px]" style={{ left: "0%", background: style.fill, border: `2px solid ${style.fill}` }} />
          <span className="absolute top-[6px] w-[9px] h-[9px] rotate-45 rounded-[2px] bg-white" style={{ left: `calc(${progress}% - 4px)`, border: `2px solid ${style.fill}` }} />
          <span className="absolute top-[6px] right-0 w-[9px] h-[9px] rotate-45 rounded-[2px] bg-white border-2 border-[#c9c6da]" />
        </div>
        <div className="flex justify-between text-[10px] text-[#8a87a0] mb-3">
          <span>{formatDate(prog.start_date)}</span>
          <span>{formatDate(prog.end_date)}</span>
        </div>

        {/* Anneaux */}
        <div className="flex justify-between px-1">
          <Ring pct={progress} color={style.fill} label="Avancement" caption="temps" />
          <Ring pct={budgetPct} color={overBudget ? "#cc4f45" : "#2e5fe8"} label="Budget" caption="conso" />
          <DateCircle date={prog.end_date} label="Date de fin" />
        </div>

        {/* Métriques */}
        <div className="flex justify-between mt-3 text-[10.5px] text-[#8a87a0]">
          <span>Budget <b className="font-mono-data text-[#26243a]">{formatEuro(prog.budget_total)}</b></span>
          <span>Consommé <b className={`font-mono-data ${overBudget ? "text-[#cc4f45]" : "text-[#26243a]"}`}>{formatEuro(prog.budget_consumed)}</b></span>
        </div>

        {/* Prochains jalons */}
        {(prog.next_milestones || []).length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-[#f0eff6] space-y-1" data-testid={`program-tile-milestones-${prog.program_id}`}>
            <div className="text-[8.5px] font-bold uppercase tracking-widest text-[#a39fb8]">Prochains jalons</div>
            {prog.next_milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10.5px]">
                <span className="w-[7px] h-[7px] rotate-45 rounded-[1.5px] flex-shrink-0" style={{ background: m.overdue ? "#cc4f45" : style.fill }} />
                <span className={`font-mono-data font-semibold flex-shrink-0 ${m.overdue ? "text-[#cc4f45]" : "text-[#26243a]"}`}>{formatDate(m.date)}</span>
                <span className="text-[#5d5a75] truncate" title={m.name}>{m.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pied : répartition RAG + actions */}
      <div className="flex items-center gap-2.5 px-3.5 py-2 border-t border-[#f0eff6]">
        {[
          { key: "green", color: "bg-emerald-500" },
          { key: "orange", color: "bg-amber-500" },
          { key: "red", color: "bg-rose-500" },
        ].map(({ key, color }) => (
          <span key={key} className="flex items-center gap-1 text-[10.5px] text-[#8a87a0]">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <b className="text-[#26243a]">{rc[key] || 0}</b>
          </span>
        ))}
        <div className="ml-auto flex items-center">
          {canEdit && (
            <button
              onClick={(e) => onEdit(e, prog)}
              data-testid={`program-tile-edit-${prog.program_id}`}
              className="p-1.5 text-[#a39fb8] hover:text-[#2e5fe8] hover:bg-[#e9effe] rounded-lg transition-colors"
              title="Modifier"
            >
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => onDelete(e, prog)}
              data-testid={`program-tile-delete-${prog.program_id}`}
              className="p-1.5 text-[#a39fb8] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 size={13} />
            </button>
          )}
          <Link
            to={`/programmes/${prog.program_id}`}
            data-testid={`program-tile-open-${prog.program_id}`}
            className="p-1.5 text-[#a39fb8] hover:text-[#2e5fe8] hover:bg-[#e9effe] rounded-lg transition-colors"
            title="Voir le détail"
          >
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
