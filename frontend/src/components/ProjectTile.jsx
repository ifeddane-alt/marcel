import React from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { MethodologyBadge, ProjectStatusBadge } from "@/components/RAGBadge";
import { formatEuro, formatDate } from "@/utils/format";

const RAG_STYLES = {
  green:  { head: "bg-m-green-soft", badge: "bg-m-green", fill: "#3f8a34", ring: "#3f8a34", label: "Vert" },
  orange: { head: "bg-[#f3edb5]", badge: "bg-[#a3891a]", fill: "#a3891a", ring: "#a3891a", label: "Orange" },
  red:    { head: "bg-m-red-soft", badge: "bg-m-red", fill: "#cc4f45", ring: "#cc4f45", label: "Rouge" },
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
      <div className="w-[54px] h-[54px] rounded-full border-2 border-m-border flex flex-col items-center justify-center">
        {valid ? (
          <>
            <span className="text-[8.5px] font-bold uppercase text-m-muted leading-none font-heading">
              {d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
            </span>
            <span className="text-[15px] font-extrabold text-m-ink leading-tight font-heading">
              {String(d.getDate()).padStart(2, "0")}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-[#c9c6da]">—</span>
        )}
      </div>
      <span className="text-[9px] font-bold text-m-muted">{label}</span>
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
          <span className="text-[12px] font-extrabold text-m-ink leading-none font-heading">{pct}%</span>
          {caption && <span className="text-[7.5px] font-bold uppercase text-m-muted mt-0.5">{caption}</span>}
        </div>
      </div>
      <span className="text-[9px] font-bold text-m-muted">{label}</span>
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
  favorite = false,
  onToggleFavorite,
}) {
  const style = p.status === "en_preparation" ? PREP_STYLE : (RAG_STYLES[p.status_rag] || RAG_STYLES.green);
  const progress = elapsedPct(p.start_date, p.end_date_forecast);
  const budgetPct = p.budget_total > 0 ? clamp(Math.round((p.budget_consumed / p.budget_total) * 100)) : 0;
  const overBudget = p.budget_forecast > p.budget_total * 1.05;

  return (
    <div
      className="relative bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] hover:shadow-[0_10px_30px_-10px_rgba(53,44,110,0.2)] transition-shadow duration-200 mt-2.5"
      data-testid={`project-tile-${p.project_id}`}
    >
      {/* Badge de statut flottant */}
      <span
        className={`absolute -top-2.5 right-3 z-10 text-[10px] font-extrabold text-white px-2.5 py-[3px] rounded-md font-heading tracking-wide ${style.badge}`}
        data-testid={`tile-status-${p.project_id}`}
      >
        {style.label}
      </span>
      {onToggleFavorite && (
        <button
          onClick={() => onToggleFavorite(p.project_id)}
          data-testid={`tile-favorite-${p.project_id}`}
          title={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className={`absolute -top-2.5 left-3 z-10 w-6 h-6 rounded-full flex items-center justify-center border shadow-sm transition-colors ${
            favorite ? "bg-amber-400 border-amber-400 text-white" : "bg-white border-[#e0dcf0] text-[#c5c1d8] hover:text-amber-400"
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      )}

      {/* En-tête teinté */}
      <div className={`${style.head} rounded-t-xl px-4 pt-3 pb-2.5`}>
        <Link
          to={`/projects/${p.project_id}`}
          className="font-heading text-[13.5px] font-bold text-m-ink leading-snug hover:underline block pr-10 truncate"
          data-testid={`project-tile-link-${p.project_id}`}
          title={p.name}
        >
          {p.name}
        </Link>
        <div className="flex items-center gap-2 mt-1">
          {p.code && (
            <span className="font-mono-data text-[10px] font-semibold text-m-primary-dark bg-white/60 px-1.5 py-px rounded" data-testid={`project-code-${p.project_id}`}>
              {p.code}
            </span>
          )}
          {program && <span className="text-[10px] text-m-ink-soft truncate">{program.name}</span>}
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
        <div className="flex justify-between text-[10px] text-m-muted mb-3">
          <span>{formatDate(p.start_date)}</span>
          <span>{formatDate(p.end_date_forecast)}</span>
        </div>

        {/* Anneaux */}
        <div className="flex justify-between px-1">
          <Ring pct={progress} color={style.ring} label="Temps" caption="écoulé" />
          <Ring pct={budgetPct} color={overBudget ? "#cc4f45" : "#2e5fe8"} label="Budget" caption="conso" />
          <DateCircle date={p.end_date_forecast} label="Date de fin" />
        </div>

        {/* Métriques */}
        <div className="flex justify-between mt-3 text-[10.5px] text-m-muted">
          <span>Budget <b className="font-mono-data text-m-ink">{formatEuro(p.budget_total)}</b></span>
          <span>Forecast <b className={`font-mono-data ${overBudget ? "text-m-red" : "text-m-ink"}`}>{formatEuro(p.budget_forecast)}</b></span>
        </div>
        {p.jira_sync && (
          <div className="flex items-center justify-between mt-1.5 text-[10.5px]" data-testid={`tile-jira-${p.project_id}`}>
            <span className="flex items-center gap-1 font-semibold text-m-blue">
              <span className="w-3.5 h-3.5 rounded-[3px] bg-m-blue text-white text-[8px] font-extrabold flex items-center justify-center">J</span>
              Jira {p.jira_sync.jira_key}
            </span>
            <span className="text-m-muted">
              {p.jira_sync.issues_done}/{p.jira_sync.issues_total} issues ·{" "}
              <b className="font-mono-data text-m-ink">{p.jira_sync.progress_pct}%</b>
            </span>
          </div>
        )}
        {(() => {
          const eur = (p.benefits || []).filter((b) => b.unit === "EUR");
          const exp = eur.reduce((s, b) => s + (b.expected_value || 0), 0);
          if (!exp) return null;
          const real = eur.reduce((s, b) => s + (b.realized_value || 0), 0);
          const pct = Math.round((real / exp) * 100);
          return (
            <div className="flex justify-between mt-1.5 text-[10.5px] text-m-muted" data-testid={`tile-benefits-${p.project_id}`}>
              <span>Bénéfices attendus <b className="font-mono-data text-m-ink">{formatEuro(exp)}</b></span>
              <span>réalisés <b className={`font-mono-data ${pct >= 100 ? "text-m-green" : "text-m-ink"}`}>{pct}%</b></span>
            </div>
          );
        })()}
      </div>

      {/* Pied : sélection + actions */}
      <div className="flex items-center gap-1 px-3.5 py-2 border-t border-m-border-soft">
        {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          data-testid={`tile-checkbox-${p.project_id}`}
          className="w-4 h-4 rounded border-[#c9c6da] text-m-blue focus:ring-m-blue cursor-pointer"
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
              className="p-1.5 text-m-muted-2 hover:text-m-blue hover:bg-m-blue-soft rounded-lg transition-colors"
              title="Modifier"
            >
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => onDelete(e, p)}
              data-testid={`tile-delete-${p.project_id}`}
              className="p-1.5 text-m-muted-2 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 size={13} />
            </button>
          )}
          <Link
            to={`/projects/${p.project_id}`}
            data-testid={`tile-open-${p.project_id}`}
            className="p-1.5 text-m-muted-2 hover:text-m-blue hover:bg-m-blue-soft rounded-lg transition-colors"
            title="Ouvrir la fiche"
          >
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
