/**
 * ProjectGantt.jsx — Wrapper React pour frappe-gantt (frappe-gantt@1.2.2, MIT)
 *
 * Choix technique justifié :
 * - frappe-gantt est explicitement demandé ; version 1.x API stable
 * - Pattern DOM ref + useEffect : on crée l'instance dans un SVG container géré par le lib,
 *   en dehors du virtual DOM React → pas de conflit de render
 * - Destruction de l'instance à chaque changement de données pour éviter les fuites
 */
import React, { useEffect, useRef, useState } from "react";
import Gantt from "frappe-gantt";
import "frappe-gantt/dist/frappe-gantt.css";

const VIEW_MODES = ["Day", "Week", "Month", "Quarter Year"];
const VIEW_LABELS = { Day: "Jour", Week: "Semaine", Month: "Mois", "Quarter Year": "Trimestre" };

function toGanttTasks(tasks, milestones) {
  const today = new Date();
  const fmt = (d) => d ? d.split("T")[0] : null;

  const ganttTasks = tasks
    .filter((t) => t.date_start_planned && t.date_end_planned)
    .map((t) => {
      const start = fmt(t.date_start_planned);
      const end   = fmt(t.date_end_planned);
      if (!start || !end) return null;
      const progress = t.jh_planned
        ? Math.min(Math.round((t.jh_consumed || 0) / t.jh_planned * 100), 100)
        : 0;
      const deps = (t.dependencies || []).join(",");
      return {
        id: t.task_id,
        name: t.name,
        start,
        end,
        progress,
        dependencies: deps,
        custom_class: t.status === "completed" ? "bar-completed"
          : t.status === "in_progress" ? "bar-in-progress"
          : "bar-not-started",
      };
    })
    .filter(Boolean);

  // Jalons (losanges) — frappe-gantt les affiche comme des barres 1-jour
  milestones
    .filter((m) => m.date_forecast || m.date_baseline)
    .forEach((m) => {
      const d = fmt(m.date_forecast || m.date_baseline);
      if (!d) return;
      ganttTasks.push({
        id: `ms_${m.milestone_id}`,
        name: `⬥ ${m.name}`,
        start: d,
        end: d,
        progress: m.status === "atteint" ? 100 : 0,
        custom_class: `milestone-bar rag-${(m.status === "atteint" ? "green" : m.status === "en_retard" ? "red" : "orange")}`,
      });
    });

  return ganttTasks;
}

export default function ProjectGantt({ tasks = [], milestones = [], onTaskClick }) {
  const containerRef = useRef(null);
  const ganttRef     = useRef(null);
  const [viewMode, setViewMode] = useState("Month");

  const ganttTasks = toGanttTasks(tasks, milestones);

  useEffect(() => {
    if (!containerRef.current || ganttTasks.length === 0) return;
    // Nettoyer l'instance précédente
    containerRef.current.innerHTML = "";
    ganttRef.current = new Gantt(containerRef.current, ganttTasks, {
      view_mode: viewMode,
      date_format: "YYYY-MM-DD",
      on_click: (task) => onTaskClick?.(task.id),
      language: "fr",
    });
    return () => { containerRef.current && (containerRef.current.innerHTML = ""); };
  }, [ganttTasks.length, viewMode]); // eslint-disable-line

  if (ganttTasks.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-400" data-testid="gantt-empty">
        Aucune tâche avec des dates planifiées. Ajoutez des dates de début et fin pour afficher le Gantt.
      </div>
    );
  }

  return (
    <div data-testid="gantt-container">
      {/* Controls */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            data-testid={`gantt-view-${mode.toLowerCase().replace(" ", "-")}`}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === mode
                ? "bg-[#0052CC] text-white"
                : "text-slate-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {VIEW_LABELS[mode]}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-2">
          {ganttTasks.length} tâche{ganttTasks.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Gantt chart */}
      <div className="overflow-x-auto">
        <div ref={containerRef} className="gantt-container" style={{ minWidth: "800px" }} />
      </div>

      <style>{`
        .gantt .bar-completed rect { fill: #10B981; }
        .gantt .bar-in-progress rect { fill: #0052CC; }
        .gantt .bar-not-started rect { fill: #94A3B8; }
        .gantt .milestone-bar.rag-green rect { fill: #10B981; }
        .gantt .milestone-bar.rag-orange rect { fill: #F59E0B; }
        .gantt .milestone-bar.rag-red rect { fill: #EF4444; }
        .gantt .bar-label { font-size: 11px; fill: #0F172A; font-weight: 500; }
        .gantt .today-highlight { fill: rgba(0,82,204,0.07); }
      `}</style>
    </div>
  );
}
