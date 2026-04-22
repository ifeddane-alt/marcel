import React, { useState } from "react";
import { Layers, BookOpen, FileText, ChevronRight, ChevronDown } from "lucide-react";

const LEVEL_CONFIG = {
  feature:    { label: "FEATURE",    Icon: Layers,   bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  user_story: { label: "USER STORY", Icon: BookOpen, bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  task:       { label: "TÂCHE",      Icon: FileText, bg: "bg-slate-50",  text: "text-slate-600",  border: "border-slate-200" },
};

const PHASE_COLORS = {
  backlog:        "bg-slate-100 text-slate-600",
  review:         "bg-blue-50 text-blue-600",
  analysis:       "bg-amber-50 text-amber-700",
  implementation: "bg-indigo-50 text-indigo-700",
  test:           "bg-violet-50 text-violet-700",
  hypercare:      "bg-orange-50 text-orange-700",
  done:           "bg-emerald-50 text-emerald-700",
  rejected:       "bg-rose-50 text-rose-700",
};

const STATUS_LABELS = {
  not_started: { label: "À faire",  cls: "bg-slate-200 text-slate-600" },
  in_progress: { label: "En cours", cls: "bg-blue-500 text-white" },
  done:        { label: "Fait",     cls: "bg-emerald-500 text-white" },
  blocked:     { label: "Bloqué",   cls: "bg-rose-500 text-white" },
  delayed:     { label: "Retard",   cls: "bg-amber-500 text-white" },
  review:      { label: "Révision", cls: "bg-amber-500 text-white" },
  cancelled:   { label: "Annulé",   cls: "bg-slate-400 text-white" },
};

/**
 * Construit une liste plate ordonnée avec depth info.
 * feature → ses user_stories → prochaine feature → ...
 * Les tâches flat (task_level="task") sont ajoutées après.
 */
function buildFlatTree(tasks) {
  const taskMap = {};
  tasks.forEach(t => { taskMap[t.task_id] = t; });

  const roots = tasks.filter(t => !t.parent_id || !taskMap[t.parent_id]);
  const result = [];

  function addNode(task, depth) {
    result.push({ task, depth });
    // Chercher les enfants directs
    const childs = tasks.filter(t => t.parent_id === task.task_id);
    childs.forEach(c => addNode(c, depth + 1));
  }

  roots.forEach(r => addNode(r, 0));
  return result;
}

export default function TaskTreeView({ tasks, onSelectTask }) {
  const [collapsed, setCollapsed] = useState({});

  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Aucune tâche pour ce projet.
      </div>
    );
  }

  const hasSafeHierarchy = tasks.some(t => t.task_level && t.task_level !== "task");
  const flatTree = hasSafeHierarchy ? buildFlatTree(tasks) : tasks.map(t => ({ task: t, depth: 0 }));

  const toggleCollapse = (taskId, e) => {
    e.stopPropagation();
    setCollapsed(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Trouver les nœuds dont le parent est collapsed
  const isHidden = (task) => {
    if (!task.parent_id) return false;
    const parentCollapsed = collapsed[task.parent_id];
    if (parentCollapsed) return true;
    // Chercher récursivement
    const parent = tasks.find(t => t.task_id === task.parent_id);
    if (parent && isHidden(parent)) return true;
    return false;
  };

  const hasDirectChildren = (taskId) => tasks.some(t => t.parent_id === taskId);

  return (
    <div className="border border-gray-200 rounded overflow-hidden" data-testid="task-tree-view">
      {flatTree.filter(({ task }) => !isHidden(task)).map(({ task, depth }) => {
        const level = task.task_level || "task";
        const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.task;
        const { Icon } = cfg;
        const phase = task.lifecycle_phase;
        const status = STATUS_LABELS[task.status] || STATUS_LABELS.not_started;
        const hasKids = hasDirectChildren(task.task_id);
        const isCollapsed = !!collapsed[task.task_id];

        return (
          <div
            key={task.task_id}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50/80 cursor-pointer border-b border-gray-50 transition-colors"
            style={{ paddingLeft: `${12 + depth * 20}px` }}
            onClick={() => onSelectTask && onSelectTask(task)}
            data-testid={`task-tree-row-${task.task_id}`}
          >
            {/* Toggle collapse */}
            <div className="w-4 flex-shrink-0 flex items-center justify-center">
              {hasKids ? (
                <button
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                  onClick={(e) => toggleCollapse(task.task_id, e)}
                >
                  {isCollapsed
                    ? <ChevronRight size={13} />
                    : <ChevronDown size={13} />}
                </button>
              ) : (
                <span className="w-4 block" />
              )}
            </div>

            {/* Level badge */}
            <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              <Icon size={9} />
              {cfg.label}
            </span>

            {/* Name */}
            <span className="text-sm text-slate-800 flex-1 truncate font-medium">{task.name}</span>

            {/* Phase */}
            {phase && phase !== "backlog" && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${PHASE_COLORS[phase] || "bg-slate-100 text-slate-600"}`}>
                {phase.toUpperCase()}
              </span>
            )}

            {/* Status */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${status.cls}`}>
              {status.label}
            </span>

            {/* JH */}
            {(task.jh_planned > 0 || task.jh_consumed > 0) && (
              <span className="text-[11px] font-mono text-slate-400 flex-shrink-0 hidden lg:block whitespace-nowrap">
                {(task.jh_consumed || 0).toFixed(0)}/{(task.jh_planned || 0).toFixed(0)} JH
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
