import React, { useEffect, useState, useCallback } from "react";
import { Zap, Layers, ArrowRight, Clock, Target, AlertCircle } from "lucide-react";
import { safeAPI, tasksAPI } from "@/api";

const LEVEL_CFG = {
  feature:    { label: "FEATURE",    bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  task:       { label: "TÂCHE",      bg: "bg-slate-50",  text: "text-slate-600",  border: "border-slate-200" },
  user_story: { label: "US",         bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
};

const STATUS_CFG = {
  not_started: { label: "À faire",  cls: "bg-slate-200 text-slate-600" },
  in_progress: { label: "En cours", cls: "bg-blue-500 text-white" },
  done:        { label: "Fait",     cls: "bg-emerald-500 text-white" },
  delayed:     { label: "Retard",   cls: "bg-amber-500 text-white" },
};

function FeatureCard({ task, onAssign, sprints }) {
  const [assigning, setAssigning] = useState(false);
  const cfg = LEVEL_CFG[task.task_level || "task"];
  const status = STATUS_CFG[task.status] || STATUS_CFG.not_started;
  const currentSprint = sprints.find(s => s.sprint_id === task.sprint_id);

  const handleAssign = async (sprintId) => {
    setAssigning(true);
    try {
      await tasksAPI.update(task.task_id, { sprint_id: sprintId || null });
      onAssign();
    } catch (e) { console.error(e); }
    finally { setAssigning(false); }
  };

  return (
    <div className={`bg-white rounded-lg border shadow-sm p-3 hover:shadow-md transition-shadow ${cfg.border}`}
      data-testid={`pi-plan-card-${task.task_id}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {cfg.label}
        </span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
      </div>
      <div className="text-sm font-medium text-slate-800 leading-snug mb-2 line-clamp-2">{task.name}</div>
      {task.jh_planned > 0 && (
        <div className="text-[10px] text-slate-400 mb-2">
          {task.jh_consumed || 0}/{task.jh_planned} JH
        </div>
      )}

      {/* Sélecteur sprint */}
      <select
        className="w-full text-[11px] border border-gray-200 rounded px-2 py-1.5 bg-gray-50 focus:outline-none focus:border-[#0052CC] disabled:opacity-60"
        value={task.sprint_id || ""}
        onChange={(e) => handleAssign(e.target.value)}
        disabled={assigning}
        data-testid={`sprint-assign-${task.task_id}`}
      >
        <option value="">Backlog PI (non assigné)</option>
        {sprints.map(s => (
          <option key={s.sprint_id} value={s.sprint_id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}

function SprintColumn({ sprint, features, onAssign, sprints }) {
  const totalJH = features.reduce((acc, t) => acc + (t.jh_planned || 0), 0);
  const doneJH = features.filter(t => t.status === "done" || t.status === "completed").reduce((acc, t) => acc + (t.jh_planned || 0), 0);
  const loadPct = sprint.capacity_jh ? Math.round(totalJH / sprint.capacity_jh * 100) : null;

  return (
    <div className="flex flex-col min-w-[200px]" data-testid={`sprint-col-${sprint.sprint_id}`}>
      {/* En-tête colonne */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm sticky top-0">
        <div className="font-bold text-sm text-slate-800">{sprint.name}</div>
        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
          <Clock size={9} />
          {sprint.start_date?.slice(0,10)} → {sprint.end_date?.slice(0,10)}
        </div>
        {sprint.capacity_jh && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
              <span>Charge : {totalJH}/{sprint.capacity_jh} JH</span>
              {loadPct != null && (
                <span className={`font-bold ${loadPct > 100 ? "text-rose-600" : loadPct > 80 ? "text-amber-600" : "text-emerald-600"}`}>
                  {loadPct}%
                </span>
              )}
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${loadPct > 100 ? "bg-rose-500" : loadPct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(loadPct || 0, 100)}%` }}
              />
            </div>
          </div>
        )}
        <div className="text-[10px] text-slate-400 mt-1">{features.length} item{features.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Cards features */}
      <div className="space-y-2 flex-1">
        {features.map(f => (
          <FeatureCard key={f.task_id} task={f} sprints={sprints} onAssign={onAssign} />
        ))}
        {features.length === 0 && (
          <div className="border border-dashed border-gray-200 rounded-lg py-6 text-center text-[11px] text-slate-300">
            Vide
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * PIPlanning — Composant kanban pour le planning d'un PI.
 * Colonnes : Backlog PI + un sprint par sprint du PI.
 * Cards : Features/UserStories/Tasks assignées ou non assignées.
 */
export default function PIPlanning({ trainId, piId }) {
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [linkedProjectIds, setLinkedProjectIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  const loadData = useCallback(async () => {
    if (!piId) return;
    setLoading(true);
    try {
      // Sprints du PI
      const sprintsRes = await safeAPI.listSprints({ pi_id: piId });
      setSprints(sprintsRes.data);

      // Capabilities du PI → trouver les projets liés
      const capsRes = await safeAPI.listCapabilities({ pi_id: piId });
      const projectIds = [...new Set(capsRes.data.flatMap(c => c.linked_project_ids || []))];
      setLinkedProjectIds(projectIds);

      // Tasks de tous les projets liés
      const allTasks = [];
      for (const pid of projectIds) {
        const res = await tasksAPI.list(pid);
        allTasks.push(...res.data);
      }
      setTasks(allTasks);
    } catch (e) { console.error("PI Planning load error", e); }
    finally { setLoading(false); }
  }, [piId, refresh]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!piId) return <div className="text-slate-400 text-sm p-4">Sélectionnez un PI.</div>;
  if (loading) return <div className="text-slate-400 text-sm p-4">Chargement du PI Planning…</div>;

  const backlogTasks = tasks.filter(t => !t.sprint_id || !sprints.find(s => s.sprint_id === t.sprint_id));
  const tasksBySprint = Object.fromEntries(sprints.map(s => [
    s.sprint_id,
    tasks.filter(t => t.sprint_id === s.sprint_id),
  ]));

  return (
    <div data-testid="pi-planning-board" className="pb-4">
      <div className="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
        <Target size={11} />
        PI Planning — {linkedProjectIds.length} projet{linkedProjectIds.length !== 1 ? "s" : ""} liés · {tasks.length} tâches
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Colonne Backlog PI */}
        <div className="flex flex-col min-w-[200px]">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2 shadow-sm sticky top-0">
            <div className="font-bold text-sm text-amber-800">Backlog PI</div>
            <div className="text-[10px] text-amber-600 mt-0.5">Non assigné au sprint</div>
            <div className="text-[10px] text-amber-600 mt-1">{backlogTasks.length} item{backlogTasks.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="space-y-2 flex-1">
            {backlogTasks.map(f => (
              <FeatureCard key={f.task_id} task={f} sprints={sprints} onAssign={() => setRefresh(r => r + 1)} />
            ))}
            {backlogTasks.length === 0 && (
              <div className="border border-dashed border-amber-200 rounded-lg py-6 text-center text-[11px] text-amber-300">
                Tout est assigné !
              </div>
            )}
          </div>
        </div>

        {/* Colonnes Sprints */}
        {sprints.map(sprint => (
          <SprintColumn
            key={sprint.sprint_id}
            sprint={sprint}
            features={tasksBySprint[sprint.sprint_id] || []}
            sprints={sprints}
            onAssign={() => setRefresh(r => r + 1)}
          />
        ))}
      </div>
    </div>
  );
}
