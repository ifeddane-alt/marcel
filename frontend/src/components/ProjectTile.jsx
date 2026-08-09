import React from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { MethodologyBadge, ProjectStatusBadge } from "@/components/RAGBadge";
import { formatEuro, formatDate } from "@/utils/format";

const RAG_STYLES = {
  green:  { head: "bg-[#ddf0d8]", badge: "bg-[#3f8a34]", fill: "#3f8a34", ring: "#3f8a34", label: "Vert" },
  orange: { head: "bg-[#f3edb5]", badge: "bg-[#a3891a]", fill: "#a3891a", ring: "#a3891a", label: "Orange" },
  red:    { head: "bg-[#fbe1de]", badge: "bg-[#cc4f45]", fill: "#cc4f45", ring: "#cc4f45", label: "Rouge" },
};
const PREP_STYLE = { head: "bg-[#d5efec]", badge: "bg-[#22948c]", fill: "#22948c", ring: "#22948c", label: "Cadrage" };

export const clamp = (v) => Math.max(0, Math.min(100, v));

export function elapsedPct(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!s || !e || e <= s) return 0;
  return clamp(Math.round(((Date.now() - s) / (e - s)) * 100));
}

export function DateCircle({ date, label }) {
  const d = date ? new Date(date) : null;
  const valid = d && !isNaN(d.getTime());
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-[54px] h-[54px] rounded-full border-2 border-[#e8e6f0] flex flex-col items-center justify-center">
        {valid ? (
          <>
            <span className="text-[8.5px] font-bold uppercase text-[#8a87a0] leading-none font-heading">
              {d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
            </span>
            <span className="text-[15px] font-extrabold text-[#26243a] leading-tight font-heading">
              {String(d.getDate()).padStart(2, "0")}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-[#c9c6da]">—</span>
        )}
      </div>
      <span className="text-[9px] font-bold text-[#8a87a0]">{label}</span>
    </div>
  );
}

export function Ring({ pct, color, label, caption }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-[54px] h-[54px] rounded-full flex items-center justify-center"
        style={{ background: `conic-gradient(${color} 0 ${pct}%, #ece9f4 ${pct}%)` }}
      >
        <div className="w-[42px] h-[42px] rounded-full bg-white flex flex-col items-center justify-center">
          <span className="text-[12px] font-extrabold text-[#26243a] leading-none font-heading">{pct}%</span>
          {caption && <span className="text-[7.5px] font-bold uppercase text-[#8a87a0] mt-0.5">{caption}</span>}
        </div>
      </div>
      <span className="text-[9px] font-bold text-[#8a87a0]">{label}</span>
    </div>
  );
}

export default function ProjectTile({
  project: p,
  program,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  selectable = true,
}) {
  const style = p.status === "en_preparation" ? PREP_STYLE : (RAG_STYLES[p.status_rag] || RAG_STYLES.green);
  const progress = elapsedPct(p.start_date, p.end_date_forecast);
  const budgetPct = p.budget_total > 0 ? clamp(Math.round((p.budget_consumed / p.budget_total) * 100)) : 0;
  const overBudget = p.budget_forecast > p.budget_total * 1.05;

  return (
    <div
      className="relative bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] hover:shadow-[0_10px_30px_-10px_rgba(53,44,110,0.2)] transition-shadow duration-200 mt-2.5"
      data-testid={`project-tile-${p.project_id}`}
    >
      {/* Badge de statut flottant */}
      <span
        className={`absolute -top-2.5 right-3 z-10 text-[10px] font-extrabold text-white px-2.5 py-[3px] rounded-md font-heading tracking-wide ${style.badge}`}
        data-testid={`tile-status-${p.project_id}`}
      >
        {style.label}
      </span>

      {/* En-tête teinté */}
      <div className={`${style.head} rounded-t-xl px-4 pt-3 pb-2.5`}>
        <Link
          to={`/projects/${p.project_id}`}
          className="font-heading text-[13.5px] font-bold text-[#26243a] leading-snug hover:underline block pr-10 truncate"
          data-testid={`project-tile-link-${p.project_id}`}
          title={p.name}
        >
          {p.name}
        </Link>
        <div className="flex items-center gap-2 mt-1">
          {p.code && (
            <span className="font-mono-data text-[10px] font-semibold text-[#3d3564] bg-white/60 px-1.5 py-px rounded" data-testid={`project-code-${p.project_id}`}>
              {p.code}
            </span>
          )}
          {program && <span className="text-[10px] text-[#5d5a75] truncate">{program.name}</span>}
        </div>
      </div>

      {/* Corps */}
      <div className="px-4 pt-3 pb-2">
        {/* Timeline jalonnée */}
        <div className="relative h-[22px]">
          <span className="absolute left-0 right-0 top-[10px] h-[2px] bg-[#e3e0ef] rounded" />
          <span className="absolute left-0 top-[10px] h-[2px] rounded" style={{ width: `${progress}%`, background: style.fill }} />
          <span className="absolute top-[6px] w-[9px] h-[9px] rotate-45 rounded-[2px]" style={{ left: "0%", background: style.fill, border: `2px solid ${style.fill}` }} />
          <span className="absolute top-[6px] w-[9px] h-[9px] rotate-45 rounded-[2px] bg-white" style={{ left: `calc(${progress}% - 4px)`, border: `2px solid ${style.fill}` }} />
          <span className="absolute top-[6px] right-0 w-[9px] h-[9px] rotate-45 rounded-[2px] bg-white border-2 border-[#c9c6da]" />
        </div>
        <div className="flex justify-between text-[10px] text-[#8a87a0] mb-3">
          <span>{formatDate(p.start_date)}</span>
          <span>{formatDate(p.end_date_forecast)}</span>
        </div>

        {/* Anneaux */}
        <div className="flex justify-between px-1">
          <Ring pct={progress} color={style.ring} label="Avancement" caption="temps" />
          <Ring pct={budgetPct} color={overBudget ? "#cc4f45" : "#2e5fe8"} label="Budget" caption="conso" />
          <DateCircle date={p.end_date_forecast} label="Date de fin" />
        </div>

        {/* Métriques */}
        <div className="flex justify-between mt-3 text-[10.5px] text-[#8a87a0]">
          <span>Budget <b className="font-mono-data text-[#26243a]">{formatEuro(p.budget_total)}</b></span>
          <span>Forecast <b className={`font-mono-data ${overBudget ? "text-[#cc4f45]" : "text-[#26243a]"}`}>{formatEuro(p.budget_forecast)}</b></span>
        </div>
      </div>

      {/* Pied : sélection + actions */}
      <div className="flex items-center gap-1 px-3.5 py-2 border-t border-[#f0eff6]">
        {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          data-testid={`tile-checkbox-${p.project_id}`}
          className="w-4 h-4 rounded border-[#c9c6da] text-[#2e5fe8] focus:ring-[#2e5fe8] cursor-pointer"
          title="Sélectionner pour export COPIL"
        />
        )}
        <span className="ml-1"><MethodologyBadge methodology={p.methodology} /></span>
        {p.status && <ProjectStatusBadge status={p.status} />}
        <div className="ml-auto flex items-center">
          {canEdit && (
            <button
              onClick={(e) => onEdit(e, p)}
              data-testid={`tile-edit-${p.project_id}`}
              className="p-1.5 text-[#a39fb8] hover:text-[#2e5fe8] hover:bg-[#e9effe] rounded-lg transition-colors"
              title="Modifier"
            >
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => onDelete(e, p)}
              data-testid={`tile-delete-${p.project_id}`}
              className="p-1.5 text-[#a39fb8] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 size={13} />
            </button>
          )}
          <Link
            to={`/projects/${p.project_id}`}
            data-testid={`tile-open-${p.project_id}`}
            className="p-1.5 text-[#a39fb8] hover:text-[#2e5fe8] hover:bg-[#e9effe] rounded-lg transition-colors"
            title="Ouvrir la fiche"
          >
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
