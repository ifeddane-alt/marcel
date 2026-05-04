import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutList, ChevronDown, ChevronRight, Lock, Send,
  Filter, Search, RefreshCw, AlertTriangle, CheckCircle, Minus,
  BarChart2, Download, Table2, Kanban as KanbanIcon, GripVertical, Save,
} from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { scopeAPI, projectsAPI, teamsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

/* ── Constantes ─────────────────────────────────────────────────────── */
const SCOPE_OPTIONS = [
  { value: "sec",    label: "SEC",    bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  { value: "etendu", label: "ÉTENDU", bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500" },
  { value: "out",    label: "OUT",    bg: "bg-slate-100",  text: "text-slate-400",   border: "border-slate-200",   dot: "bg-slate-400" },
];
const SCOPE_MAP = Object.fromEntries(SCOPE_OPTIONS.map((o) => [o.value, o]));
const STATUS_COLORS = { vert: "text-emerald-600 bg-emerald-50", orange: "text-amber-600 bg-amber-50", rouge: "text-red-600 bg-red-50" };

/* ── Helpers Timeline ────────────────────────────────────────────────── */
function parsePeriodRef(ref = "") {
  const year = parseInt(ref.match(/\d{4}/)?.[0] || new Date().getFullYear());
  const qMatch = ref.match(/Q(\d)/i);
  const piMatch = ref.match(/PI-?(\d)/i);
  let startMonth = 1;
  if (qMatch) startMonth = (parseInt(qMatch[1]) - 1) * 3 + 1;
  else if (piMatch) startMonth = (parseInt(piMatch[1]) - 1) * 3 + 1;
  const start = new Date(year, startMonth - 1, 1);
  const end   = new Date(year, startMonth + 2, 0);
  const totalDays = Math.ceil((end - start) / 86400000) + 1;
  return { start, end, totalDays, startMonth, year };
}

function computeTeamTimelines(snapshot) {
  if (!snapshot?.features || !snapshot?.capacity_summary) return [];
  const period = parsePeriodRef(snapshot.period_ref);

  return snapshot.capacity_summary
    .map((team) => {
      const capaPerDay = period.totalDays > 0 ? team.capa / period.totalDays : 0;
      const secFeatures = snapshot.features
        .filter((f) => f.team_id === team.team_id && f.scope_status === "sec")
        .map((f) => ({
          ...f,
          total_jh: (f.phase_estimates || []).reduce((s, e) => s + (e.jh_estimated || 0), 0),
        }))
        .filter((f) => f.total_jh > 0);

      let currentDay = 0;
      const bars = secFeatures.map((f) => {
        const durDays = capaPerDay > 0 ? f.total_jh / capaPerDay : 0;
        const bar = {
          id: f.task_id,
          name: f.name,
          startPct: Math.min((currentDay / period.totalDays) * 100, 100),
          widthPct: Math.min((durDays / period.totalDays) * 100, 100 - (currentDay / period.totalDays) * 100),
          durationDays: Math.ceil(durDays),
          totalJh: f.total_jh,
          overflow: currentDay + durDays > period.totalDays,
        };
        currentDay += durDays;
        return bar;
      });

      return {
        ...team,
        bars,
        overloadDays: Math.max(0, Math.ceil(currentDay - period.totalDays)),
      };
    })
    .filter((t) => t.bars.length > 0);
}

/* ── Composant Timeline ──────────────────────────────────────────────── */
function ScopeTimeline({ snapshot }) {
  const period = parsePeriodRef(snapshot?.period_ref);
  const timelines = computeTeamTimelines(snapshot);

  // Génération des marques de mois
  const monthMarks = useMemo(() => {
    const marks = [];
    for (let m = 0; m < 3; m++) {
      const d = new Date(period.year, period.startMonth - 1 + m, 1);
      const pct = (Math.ceil((d - period.start) / 86400000) / period.totalDays) * 100;
      marks.push({ pct, label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) });
    }
    return marks;
  }, [period]);

  if (!snapshot || timelines.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
        Aucune feature SEC dans ce snapshot. Sélectionnez une version avec des features SEC.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="scope-timeline">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <BarChart2 size={16} className="text-slate-500" />
        <span className="font-semibold text-slate-700 text-sm">Timeline — {snapshot.period_ref}</span>
        <span className="text-xs text-slate-400 ml-1">(features SEC par équipe)</span>
      </div>

      <div className="p-4 space-y-5">
        {/* Axe des mois */}
        <div className="relative h-5 ml-[140px]">
          {monthMarks.map((m) => (
            <div key={m.label} className="absolute top-0 flex flex-col items-center" style={{ left: `${m.pct}%` }}>
              <div className="w-px h-3 bg-slate-300" />
              <span className="text-[10px] text-slate-400 whitespace-nowrap">{m.label}</span>
            </div>
          ))}
        </div>

        {/* Lignes par équipe */}
        {timelines.map((team) => (
          <div key={team.team_id} data-testid={`timeline-team-${team.team_id}`}>
            {/* En-tête équipe */}
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-[130px] flex-shrink-0 text-xs font-semibold text-slate-700 truncate text-right pr-2">
                {team.team_name}
              </div>
              <div className={`text-xs font-medium ${team.status === "rouge" ? "text-red-600" : team.status === "orange" ? "text-amber-600" : "text-emerald-600"}`}>
                {team.charge_sec}/{team.capa} JH
                {team.overloadDays > 0 && <span className="ml-1 text-red-500">+{team.overloadDays}j débord.</span>}
              </div>
            </div>

            {/* Barre de capacité totale */}
            <div className="flex items-center gap-3">
              <div className="w-[130px] flex-shrink-0" />
              <div className="flex-1 relative h-7 bg-slate-100 rounded overflow-visible">
                {/* Limite capa */}
                <div className="absolute inset-0 rounded bg-slate-100" />

                {/* Features comme barres */}
                {team.bars.map((bar, idx) => (
                  <div
                    key={bar.id || idx}
                    data-testid={`timeline-bar-${bar.id}`}
                    className={`absolute top-0.5 h-6 rounded cursor-default transition-all group
                      ${bar.overflow ? "bg-red-400/80 border border-red-500" : "bg-emerald-400/80 border border-emerald-500"}`}
                    style={{ left: `${bar.startPct}%`, width: `${Math.max(bar.widthPct, 0.5)}%` }}
                    title={`${bar.name} · ${bar.totalJh} JH · ${bar.durationDays}j`}
                  >
                    <div className="absolute inset-0 flex items-center px-1 overflow-hidden">
                      <span className="text-[9px] text-white font-semibold truncate whitespace-nowrap">
                        {bar.name}
                      </span>
                    </div>
                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-[#0F172A] text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                      {bar.name}<br />{bar.totalJh} JH · {bar.durationDays} jours
                      {bar.overflow && <span className="text-red-300 block">⚠ Dépasse la capacité</span>}
                    </div>
                  </div>
                ))}

                {/* Indicateur de surcharge */}
                {team.status === "rouge" && (
                  <div className="absolute right-0 top-0 h-7 bg-red-200/50 border-l-2 border-red-400 border-dashed"
                    style={{ width: `${Math.min((team.overloadDays / period.totalDays) * 100, 20)}%` }} />
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Légende */}
        <div className="flex items-center gap-4 mt-2 pl-[142px] text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400 inline-block" />Feature SEC dans la capa</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" />Feature SEC en débordement</span>
        </div>
      </div>
    </div>
  );
}

/* ── Inline scope-status dropdown ────────────────────────────────────── */
function ScopeStatusCell({ taskId, current, onChange, canEdit }) {
  const [open, setOpen] = useState(false);
  const opt = SCOPE_MAP[current] || null;

  if (!canEdit) {
    return opt ? (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${opt.bg} ${opt.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
        {opt.label}
      </span>
    ) : <span className="text-slate-400 text-xs">—</span>;
  }

  return (
    <div className="relative">
      <button
        data-testid={`scope-status-btn-${taskId}`}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border cursor-pointer hover:opacity-80 transition-opacity
          ${opt ? `${opt.bg} ${opt.text} ${opt.border}` : "bg-slate-50 text-slate-400 border-slate-200"}`}
      >
        {opt ? <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} /> : <Minus size={10} />}
        <span>{opt ? opt.label : "—"}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[100px] py-1">
          {SCOPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              data-testid={`scope-option-${o.value}`}
              onClick={() => { onChange(taskId, o.value); setOpen(false); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 ${o.text}`}
            >
              <span className={`w-2 h-2 rounded-full ${o.dot}`} />
              {o.label}
            </button>
          ))}
          <button
            onClick={() => { onChange(taskId, null); setOpen(false); }}
            className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50"
          >
            <Minus size={10} />
            Effacer
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Tableau d'arbitrage ─────────────────────────────────────────────── */
function ScopeTable({ candidates, onStatusChange, canEdit }) {
  const sorted = useMemo(() => {
    return [...candidates].sort((a, b) => {
      const pCmp = (a.project_name || "").localeCompare(b.project_name || "");
      if (pCmp !== 0) return pCmp;
      const order = { sec: 0, etendu: 1, out: 2 };
      return (order[a.scope_status] ?? 3) - (order[b.scope_status] ?? 3);
    });
  }, [candidates]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm" data-testid="scope-table">
        <thead>
          <tr className="bg-[#0F172A] text-white">
            {["Feature", "Projet", "Équipe Owner", "Review", "Analyse", "Impl.", "Test", "Hypercare", "Total JH", "Statut Scope"].map((h) => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold whitespace-nowrap first:pl-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={10} className="text-center text-slate-400 py-12 text-sm">
                Aucune feature candidate — modifiez les filtres
              </td>
            </tr>
          )}
          {sorted.map((t) => {
            const s = t.scope_status;
            const rowCls = s === "sec" ? "bg-emerald-50/50" : s === "etendu" ? "bg-blue-50/50" : s === "out" ? "bg-slate-50 opacity-60" : "";
            const lineThroughCls = s === "out" ? "line-through text-slate-400" : "";
            return (
              <tr key={t.task_id} className={`border-t border-slate-100 hover:brightness-95 transition-all ${rowCls}`} data-testid={`scope-row-${t.task_id}`}>
                <td className="px-4 py-2 font-medium text-slate-800 max-w-[200px]">
                  <span className={lineThroughCls}>{t.name}</span>
                  {t.parent_id && <div className="text-[10px] text-slate-400 mt-0.5">↳ Capability</div>}
                </td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap text-xs">{t.project_name}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap text-xs">{t.team_name || t.resource_name || "—"}</td>
                <td className="px-3 py-2 text-right text-slate-700 text-xs">{t.jh_review || "—"}</td>
                <td className="px-3 py-2 text-right text-slate-700 text-xs">{t.jh_analyse || "—"}</td>
                <td className="px-3 py-2 text-right text-slate-700 text-xs">{t.jh_impl || "—"}</td>
                <td className="px-3 py-2 text-right text-slate-700 text-xs">{t.jh_test || "—"}</td>
                <td className="px-3 py-2 text-right text-slate-700 text-xs">{t.jh_hypercare || "—"}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-800 text-xs">
                  {t.total_jh_estimated > 0 ? t.total_jh_estimated : "—"}
                </td>
                <td className="px-3 py-2">
                  <ScopeStatusCell taskId={t.task_id} current={s} onChange={onStatusChange} canEdit={canEdit} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Bloc Capa vs Charge ─────────────────────────────────────────────── */
function CapacityVsLoad({ data }) {
  const [expandedTeams, setExpandedTeams] = useState(new Set());

  const toggle = (tid) => setExpandedTeams((s) => {
    const n = new Set(s);
    n.has(tid) ? n.delete(tid) : n.add(tid);
    return n;
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="capacity-block">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <LayoutList size={16} className="text-slate-500" />
        <span className="font-semibold text-slate-700 text-sm">Capacité vs Charge</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs">
              {["", "Équipe", "Capa dispo (JH)", "Charge SEC (JH)", "Charge ÉTENDU (JH)", "Marge (JH)", "Taux (%)", ""].map((h, i) => (
                <th key={i} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((team) => {
              const isExpanded = expandedTeams.has(team.team_id);
              const colCls = STATUS_COLORS[team.status] || "text-slate-600 bg-slate-50";
              return (
                <React.Fragment key={team.team_id}>
                  <tr className="border-t border-slate-100 font-medium hover:bg-slate-50 cursor-pointer" onClick={() => toggle(team.team_id)} data-testid={`capa-team-${team.team_id}`}>
                    <td className="px-3 py-2.5 w-6">
                      <span className="text-slate-400">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-800">{team.team_name}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{team.capa}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{team.charge_sec}</td>
                    <td className="px-3 py-2.5 text-right text-blue-700">{team.charge_etendu}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${team.marge < 0 ? "text-red-600" : "text-slate-700"}`}>
                      {team.marge > 0 ? "+" : ""}{team.marge}
                    </td>
                    <td className="px-3 py-2.5 text-right">{team.taux_pct}%</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${colCls}`}>
                        {team.status === "rouge" ? "SURCHARGE" : team.status === "orange" ? "Attention" : "OK"}
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (team.resources || []).map((r) => {
                    const rColCls = STATUS_COLORS[r.status] || "";
                    return (
                      <tr key={r.resource_id} className="bg-slate-50/50 border-t border-slate-50 text-xs text-slate-600" data-testid={`capa-res-${r.resource_id}`}>
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5 pl-8 text-slate-500">↳ {r.name}</td>
                        <td className="px-3 py-1.5 text-right">{r.capa}</td>
                        <td className="px-3 py-1.5 text-right text-emerald-600 font-medium">{r.charge_sec}</td>
                        <td className="px-3 py-1.5 text-right text-blue-600">{r.charge_etendu}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${r.marge < 0 ? "text-red-500" : ""}`}>
                          {r.marge > 0 ? "+" : ""}{r.marge}
                        </td>
                        <td className="px-3 py-1.5 text-right">{r.taux_pct}%</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${rColCls}`}>
                            {r.status === "rouge" ? "Surcharge" : r.status === "orange" ? "Att." : "OK"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Kanban Drag & Drop ─────────────────────────────────────────────── */
function KanbanCard({ task, canEdit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.task_id || task.id });
  const cfg = SCOPE_MAP[task.scope_status] || SCOPE_MAP.out;
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`kanban-card-${task.task_id}`}
      className={`bg-white rounded-xl border ${cfg.border} shadow-sm p-3 mb-2 ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default"} select-none hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start gap-2">
        {canEdit && <GripVertical size={13} className="text-slate-300 flex-shrink-0 mt-0.5" {...listeners} {...attributes} />}
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-bold ${cfg.text} mb-0.5`}>{task.name || task.title || "—"}</div>
          <div className="text-[10px] text-slate-400 truncate">{task.project_name || task.project_id || ""}</div>
          {task.total_jh_estimated > 0 && (
            <div className="text-[10px] text-slate-500 mt-1">{task.total_jh_estimated} JH</div>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ id, label, tasks, color, canEdit, isDragOver }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-col-${id}`}
      className={`flex-1 min-w-[220px] rounded-2xl border-2 transition-colors p-4 ${isOver || isDragOver ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-slate-50/60"}`}
    >
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-slate-200`}>
        <span className={`text-sm font-bold ${color}`}>{label}</span>
        <span className="text-xs bg-white border border-slate-200 text-slate-500 font-semibold px-2 py-0.5 rounded-full">{tasks.length}</span>
        {id === "sec" && tasks.length > 0 && (
          <span className="text-[10px] text-emerald-600 ml-auto">
            {tasks.reduce((s, t) => s + (t.total_jh_estimated || 0), 0).toFixed(0)} JH
          </span>
        )}
      </div>
      <SortableContext items={tasks.map(t => t.task_id || t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[120px]">
          {tasks.map(task => (
            <KanbanCard key={task.task_id || task.id} task={task} canEdit={canEdit} />
          ))}
          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-20 text-xs text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
              Déposer ici
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function ScopeKanban({ candidates, onStatusChange, canEdit, unsavedChanges, onSave }) {
  const [local, setLocal] = useState(candidates);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => { setLocal(candidates); }, [candidates]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sec    = local.filter(t => t.scope_status === "sec");
  const etendu = local.filter(t => t.scope_status === "etendu");
  const out    = local.filter(t => t.scope_status === "out" || !t.scope_status);

  const getContainer = (id) => {
    if (sec.find(t => (t.task_id || t.id) === id)) return "sec";
    if (etendu.find(t => (t.task_id || t.id) === id)) return "etendu";
    return "out";
  };

  const handleDragEnd = (e) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = active.id;
    const newStatus = ["sec", "etendu", "out"].includes(over.id) ? over.id : getContainer(over.id);
    const task = local.find(t => (t.task_id || t.id) === taskId);
    if (!task || task.scope_status === newStatus) return;
    setLocal(prev => prev.map(t => (t.task_id || t.id) === taskId ? { ...t, scope_status: newStatus } : t));
    onStatusChange(taskId, newStatus);
  };

  const COLUMNS = [
    { id: "sec",    label: "SEC",    color: "text-emerald-700" },
    { id: "etendu", label: "ÉTENDU", color: "text-blue-700" },
    { id: "out",    label: "OUT",    color: "text-slate-500" },
  ];

  const activeTask = activeId ? local.find(t => (t.task_id || t.id) === activeId) : null;

  return (
    <div>
      {unsavedChanges && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3" data-testid="kanban-unsaved-banner">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertTriangle size={14} />
            <span>Modifications non enregistrées — le recalcul capa est en temps réel.</span>
          </div>
          <button
            onClick={onSave}
            data-testid="kanban-save-btn"
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0052CC] px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save size={13} /> Enregistrer les modifications
          </button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={e => setActiveId(e.active.id)} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              canEdit={canEdit}
              tasks={col.id === "sec" ? sec : col.id === "etendu" ? etendu : out}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && <KanbanCard task={activeTask} canEdit={false} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/* ── Modal Figer ─────────────────────────────────────────────────────── */
function FreezeModal({ projects, nextVersion, onClose, onFreeze }) {
  const [projectId, setProjectId] = useState("");
  const [periodRef, setPeriodRef] = useState("PI-1 2026");
  const [comment, setComment] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-0 sm:p-4" data-testid="freeze-modal">
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full max-h-screen sm:max-h-[90vh] overflow-y-auto sm:max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-[#0052CC]" />
            <h2 className="font-semibold text-slate-800">Figer le scope v{nextVersion}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Projet</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
              data-testid="freeze-project-select">
              <option value="">— Tous les projets —</option>
              {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Référence période</label>
            <input value={periodRef} onChange={(e) => setPeriodRef(e.target.value)}
              placeholder="ex: PI-1 2026 ou 2026-Q2"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
              data-testid="freeze-period-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Commentaire PMO</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052CC] resize-none"
              data-testid="freeze-comment-input" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">Annuler</button>
          <button
            onClick={() => onFreeze({ project_id: projectId || null, period_ref: periodRef, comment })}
            disabled={!periodRef}
            className="px-4 py-2 text-sm bg-[#0F172A] text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
            data-testid="freeze-confirm-btn">
            <Lock size={14} />
            Figer v{nextVersion}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal Transmission ──────────────────────────────────────────────── */
function TransmitModal({ snapshot, users, onClose, onTransmit }) {
  const [targetUserId, setTargetUserId] = useState("");
  const [comment, setComment] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-0 sm:p-4" data-testid="transmit-modal">
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full max-h-screen sm:max-h-[90vh] overflow-y-auto sm:max-w-md">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-[#0052CC]" />
            <h2 className="font-semibold text-slate-800">Transmettre au CP</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            Scope <strong>{snapshot.period_ref}</strong> v{snapshot.version} — {(snapshot.features || []).filter(f => f.scope_status === "sec").length} features SEC
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Destinataire (CP)</label>
            <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
              data-testid="transmit-user-select">
              <option value="">— Choisir un CP —</option>
              {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Commentaire</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0052CC] resize-none"
              data-testid="transmit-comment-input" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">Annuler</button>
          <button
            onClick={() => onTransmit(snapshot.snapshot_id, { target_user_id: targetUserId, comment })}
            disabled={!targetUserId}
            className="px-4 py-2 text-sm bg-[#0052CC] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            data-testid="transmit-confirm-btn">
            <Send size={14} />
            Transmettre
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────────── */
export default function Scope() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canArbitrate = hasPermission("scope.arbitrate");
  const canFreeze    = hasPermission("scope.freeze");
  const canTransmit  = hasPermission("scope.transmit") || hasPermission("scope.freeze");

  // Données
  const [candidates, setCandidates]   = useState([]);
  const [capacity, setCapacity]       = useState([]);
  const [snapshots, setSnapshots]     = useState([]);
  const [projects, setProjects]       = useState([]);
  const [loading, setLoading]         = useState(false);

  // Filtres
  const [filterProject,     setFilterProject]     = useState("");
  const [filterTeam,        setFilterTeam]        = useState("");
  const [filterScopeStatus, setFilterScopeStatus] = useState("");
  const [filterSearch,      setFilterSearch]      = useState("");
  const [filterStartDate,   setFilterStartDate]   = useState("");
  const [filterEndDate,     setFilterEndDate]      = useState("");

  // Modales
  const [showFreeze,   setShowFreeze]   = useState(false);
  const [showTransmit, setShowTransmit] = useState(false);
  const [transmitSnap, setTransmitSnap] = useState(null);
  const [kanbanChanges, setKanbanChanges] = useState({});   // taskId → newStatus (pending save)
  const [cpUsers,      setCpUsers]      = useState([]);

  // Mode d'affichage (tableau | timeline) - timeline dispo uniquement sur snapshot
  const [viewMode, setViewMode] = useState("table");

  // Version sélectionnée pour historique
  const [selectedSnapId, setSelectedSnapId] = useState("");
  const [fullSnapshot,   setFullSnapshot]   = useState(null); // snapshot complet (avec features)

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterProject) params.project_id = filterProject;
      if (filterTeam) params.team_id = filterTeam;
      if (filterScopeStatus) params.scope_status = filterScopeStatus;
      if (filterSearch) params.search = filterSearch;
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;

      const [candRes, capRes, snapRes] = await Promise.all([
        scopeAPI.getCandidates(params),
        scopeAPI.getCapacity({ project_id: filterProject || undefined, start_date: filterStartDate || undefined, end_date: filterEndDate || undefined }),
        scopeAPI.listSnapshots({ project_id: filterProject || undefined }),
      ]);
      setCandidates(candRes.data);
      setCapacity(capRes.data);
      setSnapshots(snapRes.data);
    } catch (e) {
      toast.error("Erreur lors du chargement du scope");
    } finally {
      setLoading(false);
    }
  }, [filterProject, filterTeam, filterScopeStatus, filterSearch, filterStartDate, filterEndDate]);

  useEffect(() => {
    projectsAPI.list().then((r) => setProjects(r.data || [])).catch(() => {});
    loadData();
  }, [loadData]);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await scopeAPI.patchStatus(taskId, { scope_status: newStatus });
      setCandidates((prev) => prev.map((t) => t.task_id === taskId ? { ...t, scope_status: newStatus } : t));
      const capRes = await scopeAPI.getCapacity({
        project_id: filterProject || undefined,
        start_date: filterStartDate || undefined,
        end_date: filterEndDate || undefined,
      });
      setCapacity(capRes.data);
    } catch {
      toast.error("Impossible de mettre à jour le statut scope");
    }
  };

  const handleKanbanStatusChange = (taskId, newStatus) => {
    // Mise à jour optimiste locale — sera sauvegardée en batch
    setCandidates((prev) => prev.map((t) => t.task_id === taskId ? { ...t, scope_status: newStatus } : t));
    setKanbanChanges((prev) => ({ ...prev, [taskId]: newStatus }));
  };

  const saveKanbanChanges = async () => {
    const pending = Object.entries(kanbanChanges);
    if (!pending.length) return;
    let errors = 0;
    for (const [taskId, newStatus] of pending) {
      try { await scopeAPI.patchStatus(taskId, { scope_status: newStatus }); }
      catch { errors++; }
    }
    if (errors === 0) {
      toast.success(`${pending.length} modification(s) enregistrée(s)`);
      setKanbanChanges({});
      const capRes = await scopeAPI.getCapacity({ project_id: filterProject || undefined });
      setCapacity(capRes.data);
    } else {
      toast.error(`${errors} erreur(s) lors de la sauvegarde`);
    }
  };

  const handleFreeze = async (data) => {
    try {
      await scopeAPI.createSnapshot(data);
      setShowFreeze(false);
      toast.success(`Scope figé — v${nextVersion} créé`);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur lors du figeage");
    }
  };

  const handleTransmit = async (snapshotId, data) => {
    if (!data.target_user_id) return;
    try {
      const res = await scopeAPI.transmitSnapshot(snapshotId, data);
      setShowTransmit(false);
      toast.success(`Scope transmis à ${res.data.transmitted_to_name}`);
      // Téléchargement PDF
      if (res.data.pdf_base64) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${res.data.pdf_base64}`;
        link.download = `scope_${snapshotId.slice(0, 8)}.pdf`;
        link.click();
      }
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur lors de la transmission");
    }
  };

  const handleComputeGantt = async (snapshotId) => {
    try {
      const res = await scopeAPI.computeGantt(snapshotId);
      toast.success(`Gantt recalculé — ${res.data.updated_tasks} tâches mises à jour`);
      if (res.data.alerts?.length > 0) {
        res.data.alerts.forEach((a) => toast.warning(a.message));
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur recalcul Gantt");
    }
  };

  const handleExportExcel = async () => {
    try {
      let res;
      if (viewSnap) {
        res = await scopeAPI.exportSnapshotExcel(viewSnap.snapshot_id);
      } else {
        const params = {};
        if (filterProject) params.project_id = filterProject;
        if (filterScopeStatus) params.scope_status = filterScopeStatus;
        if (filterSearch) params.search = filterSearch;
        res = await scopeAPI.exportCandidatesExcel(params);
      }
      const url = URL.createObjectURL(new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const link = document.createElement("a");
      link.href = url;
      link.download = viewSnap
        ? `scope_${viewSnap.period_ref.replace(/ /g, "-")}_v${viewSnap.version}.xlsx`
        : "scope_arbitrage.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Export Excel téléchargé");
    } catch {
      toast.error("Erreur lors de l'export Excel");
    }
  };

  const openTransmit = async (snap) => {
    setTransmitSnap(snap);
    // Charger les utilisateurs CP
    try {
      const res = await scopeAPI.getUsers();
      setCpUsers(res.data || []);
    } catch {
      setCpUsers([]);
    }
    setShowTransmit(true);
  };

  const nextVersion = (snapshots[0]?.version || 0) + 1;
  // viewSnap utilise le snapshot complet (avec features) pour la timeline et le tableau
  const viewSnap = fullSnapshot || (selectedSnapId ? snapshots.find((s) => s.snapshot_id === selectedSnapId) : null);

  // Stats summary
  const secCount    = candidates.filter((t) => t.scope_status === "sec").length;
  const etenduCount = candidates.filter((t) => t.scope_status === "etendu").length;
  const outCount    = candidates.filter((t) => t.scope_status === "out").length;
  const totalJh     = candidates.filter((t) => t.scope_status === "sec")
                                .reduce((s, t) => s + (t.total_jh_estimated || 0), 0);
  const overloadTeams = capacity.filter((t) => t.status === "rouge").length;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 bg-[#F8F9FA] min-h-full">
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-heading">Arbitrage Scope</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sélection, figeage et transmission des features candidates</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Tableau / Timeline */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors
                ${viewMode === "table" ? "bg-[#0F172A] text-white" : "text-slate-600 hover:bg-slate-50"}`}
              data-testid="view-table-btn">
              <Table2 size={13} />Tableau
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              disabled={!!viewSnap}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-40
                ${viewMode === "kanban" ? "bg-[#0F172A] text-white" : "text-slate-600 hover:bg-slate-50"}`}
              data-testid="view-kanban-btn">
              <KanbanIcon size={13} />Kanban
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              disabled={!viewSnap}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${viewMode === "timeline" ? "bg-[#0F172A] text-white" : "text-slate-600 hover:bg-slate-50"}`}
              data-testid="view-timeline-btn"
              title={!viewSnap ? "Sélectionnez une version figée pour afficher la timeline" : ""}>
              <BarChart2 size={13} />Timeline
            </button>
          </div>

          {/* Historique versions */}
          {snapshots.length > 0 && (
            <select
              value={selectedSnapId}
              onChange={async (e) => {
                const id = e.target.value;
                setSelectedSnapId(id);
                setViewMode("table");
                setFullSnapshot(null);
                if (id) {
                  try {
                    const res = await scopeAPI.getSnapshot(id);
                    setFullSnapshot(res.data);
                  } catch { /* silence */ }
                }
              }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0052CC]"
              data-testid="snapshot-version-select"
            >
              <option value="">Version courante</option>
              {snapshots.map((s) => (
                <option key={s.snapshot_id} value={s.snapshot_id}>
                  v{s.version} — {s.period_ref} ({s.status === "transmitted" ? "Transmis" : "Figé"})
                </option>
              ))}
            </select>
          )}

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            data-testid="export-excel-btn"
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            <Download size={14} />Excel
          </button>

          {canFreeze && !viewSnap && (
            <button
              onClick={() => setShowFreeze(true)}
              data-testid="freeze-scope-btn"
              className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] text-white rounded-lg text-sm hover:bg-slate-700 transition-colors"
            >
              <Lock size={14} />
              Figer le scope v{nextVersion}
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "SEC", value: secCount, cls: "text-emerald-700 bg-emerald-50", testid: "kpi-sec" },
          { label: "ÉTENDU", value: etenduCount, cls: "text-blue-700 bg-blue-50", testid: "kpi-etendu" },
          { label: "OUT", value: outCount, cls: "text-slate-500 bg-slate-100", testid: "kpi-out" },
          { label: "JH SEC total", value: `${totalJh.toFixed(0)} JH`, cls: "text-slate-700 bg-white", testid: "kpi-jh" },
          { label: "Équipes surcharge", value: overloadTeams, cls: overloadTeams > 0 ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50", testid: "kpi-overload" },
        ].map(({ label, value, cls, testid }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
            <div className="text-xs text-slate-500 font-medium">{label}</div>
            <div className={`text-xl font-bold mt-1 ${cls}`} data-testid={testid}>{value}</div>
          </div>
        ))}
      </div>

      {/* Barre de filtres */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400 flex-shrink-0" />
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            data-testid="filter-project">
            <option value="">Tous les projets</option>
            {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
          </select>
          <select value={filterScopeStatus} onChange={(e) => setFilterScopeStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            data-testid="filter-scope-status">
            <option value="">Tous les statuts</option>
            {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            <option value="__none__">Non arbitré</option>
          </select>
          <input
            type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            data-testid="filter-start-date" placeholder="Début" />
          <input
            type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            data-testid="filter-end-date" placeholder="Fin" />
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none"
              data-testid="filter-search" />
          </div>
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-50 text-slate-500" data-testid="refresh-btn">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Vue snapshot figé */}
      {viewSnap && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock size={16} className="text-amber-600" />
            <div>
              <span className="font-semibold text-amber-800">Snapshot figé — {viewSnap.period_ref} v{viewSnap.version}</span>
              <span className="ml-2 text-xs text-amber-600">{viewSnap.frozen_at?.slice(0, 10)} · {viewSnap.comment}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canTransmit && viewSnap.status !== "transmitted" && (
              <button onClick={() => openTransmit(viewSnap)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#0052CC] text-white rounded-lg hover:bg-blue-700"
                data-testid="transmit-snapshot-btn">
                <Send size={13} />Transmettre au CP
              </button>
            )}
            {canFreeze && (
              <button onClick={() => handleComputeGantt(viewSnap.snapshot_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white text-slate-700"
                data-testid="compute-gantt-btn">
                <RefreshCw size={13} />Recalculer Gantt
              </button>
            )}
            {viewSnap.status === "transmitted" && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle size={13} />Transmis
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tableau / Kanban / Timeline */}
      {viewMode === "timeline" && viewSnap ? (
        <ScopeTimeline snapshot={viewSnap} />
      ) : viewMode === "kanban" ? (
        <ScopeKanban
          candidates={viewSnap ? (viewSnap.features || []) : candidates}
          onStatusChange={handleKanbanStatusChange}
          canEdit={canArbitrate && !viewSnap}
          unsavedChanges={Object.keys(kanbanChanges).length > 0}
          onSave={saveKanbanChanges}
        />
      ) : (
        <ScopeTable
          candidates={viewSnap ? (viewSnap.features || []) : candidates}
          onStatusChange={handleStatusChange}
          canEdit={canArbitrate && !viewSnap}
        />
      )}

      {/* Capa vs charge (toujours visible, quelle que soit la vue) */}
      <CapacityVsLoad data={viewSnap ? (viewSnap.capacity_summary || []) : capacity} />

      {/* Modales */}
      {showFreeze && (
        <FreezeModal
          projects={projects}
          nextVersion={nextVersion}
          onClose={() => setShowFreeze(false)}
          onFreeze={handleFreeze}
        />
      )}
      {showTransmit && transmitSnap && (
        <TransmitModal
          snapshot={transmitSnap}
          users={cpUsers}
          onClose={() => setShowTransmit(false)}
          onTransmit={handleTransmit}
        />
      )}
    </div>
  );
}
