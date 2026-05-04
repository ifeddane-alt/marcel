import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { Map, Filter, ZoomIn, ZoomOut, X, ExternalLink, Diamond, GitCompare, Layers, RefreshCw } from "lucide-react";
import { projectsAPI, programsAPI, milestonesAPI, projectDependenciesAPI, scopeAPI } from "@/api";
import RAGBadge from "@/components/RAGBadge";
import { FAMILY_CONFIG } from "@/components/MilestoneModal";
import { formatDate } from "@/utils/format";

const RAG_BAR_COLORS = {
  green:  { bg: "bg-emerald-500", border: "border-emerald-600", text: "text-white" },
  orange: { bg: "bg-amber-500",   border: "border-amber-600",   text: "text-white" },
  red:    { bg: "bg-rose-500",    border: "border-rose-600",    text: "text-white" },
};

const STATUS_LABELS = {
  active: "Actif", on_hold: "En pause", completed: "Terminé",
  cancelled: "Annulé", planning: "Planification",
};

const IMPACT_COLORS = {
  critical: "#EF4444", high: "#F97316", medium: "#F59E0B", low: "#10B981",
};

const COL_WIDTH_MONTH   = 80;
const COL_WIDTH_QUARTER = 200;
const ROW_HEIGHT        = 40;
const LEFT_PANEL_W      = 220;
const GROUP_HEADER_H    = 28;

function dateToMs(d) {
  if (!d) return null;
  return new Date(d).getTime();
}

function msToX(ms, timeMin, colWidth, isQuarter) {
  const msPerMonth = 30.5 * 24 * 3600 * 1000;
  const months = (ms - timeMin) / msPerMonth;
  return isQuarter ? months * (colWidth / 3) : months * colWidth;
}

function buildHeaders(timeMin, timeMax, isQuarter) {
  const headers = [];
  let d = new Date(timeMin);
  d.setDate(1);
  while (d.getTime() <= timeMax) {
    if (isQuarter) {
      const q = Math.floor(d.getMonth() / 3) + 1;
      const label = `T${q} ${d.getFullYear()}`;
      const start = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
      headers.push({ label, ts: start, isQ: true });
      d.setMonth(d.getMonth() + 3);
    } else {
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      headers.push({ label, ts: d.getTime() });
      d.setMonth(d.getMonth() + 1);
    }
  }
  const seen = new Set();
  return headers.filter((h) => { if (seen.has(h.ts)) return false; seen.add(h.ts); return true; });
}

// ─────────────────────────────────────────────────────────────────────────────
// ScopeVsReelView — Comparaison dates scope figé vs réel par projet
// ─────────────────────────────────────────────────────────────────────────────

function ScopeBar({ label, start, end, timeMin, timeMax, color, icon }) {
  const totalMs = timeMax - timeMin;
  if (!start || !end || totalMs <= 0) return null;
  const left = Math.max(0, Math.min(((start - timeMin) / totalMs) * 100, 100));
  const width = Math.max(0.5, Math.min(((end - start) / totalMs) * 100, 100 - left));
  return (
    <div className="relative h-5 mb-1">
      <div
        className={`absolute top-0 h-5 rounded flex items-center px-1.5 overflow-hidden ${color}`}
        style={{ left: `${left}%`, width: `${width}%`, minWidth: "3px" }}
        title={`${label}: ${new Date(start).toLocaleDateString("fr-FR")} → ${new Date(end).toLocaleDateString("fr-FR")}`}
      >
        <span className="text-[9px] text-white font-semibold truncate">{label}</span>
      </div>
    </div>
  );
}

function ScopeVsReelView({ projects, snapshots, selectedSnapshotId, setSelectedSnapshotId, snapshotData, scopeDates, loading }) {
  const today = Date.now();

  // Compute time range across all projects + scope dates
  const timeRange = useMemo(() => {
    const allMs = [];
    projects.forEach(p => {
      allMs.push(dateToMs(p.start_date));
      allMs.push(dateToMs(p.end_date_forecast || p.end_date_baseline));
    });
    Object.values(scopeDates).forEach(({ start, end }) => {
      if (start) allMs.push(start);
      if (end) allMs.push(end);
    });
    const valid = allMs.filter(Boolean);
    if (!valid.length) return { timeMin: today - 180 * 864e5, timeMax: today + 365 * 864e5 };
    const pad = 30 * 864e5;
    return { timeMin: Math.min(...valid) - pad, timeMax: Math.max(...valid) + pad };
  }, [projects, scopeDates]); // eslint-disable-line

  const { timeMin, timeMax } = timeRange;

  // Determine if project is delayed vs scope
  const getDelayStatus = (p) => {
    const scope = scopeDates[p.project_id];
    if (!scope?.end) return "no_scope";
    const realEnd = dateToMs(p.end_date_forecast || p.end_date_baseline);
    if (!realEnd) return "no_data";
    return realEnd > scope.end ? "delayed" : "on_time";
  };

  const delayedCount = projects.filter(p => getDelayStatus(p) === "delayed").length;
  const onTimeCount  = projects.filter(p => getDelayStatus(p) === "on_time").length;
  const noScopeCount = projects.filter(p => getDelayStatus(p) === "no_scope").length;

  return (
    <div data-testid="scope-vs-reel-view">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[#0052CC]" />
          <span className="text-sm font-semibold text-slate-700">Snapshot de référence</span>
        </div>
        {snapshots.length > 0 ? (
          <select
            value={selectedSnapshotId}
            onChange={e => setSelectedSnapshotId(e.target.value)}
            data-testid="scope-snapshot-select"
            className="text-xs border border-gray-200 rounded px-3 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white"
          >
            {snapshots.map(s => (
              <option key={s.snapshot_id || s._id} value={s.snapshot_id || s._id}>
                {s.name || s.label || s.snapshot_id?.slice(0, 8)} —{" "}
                {s.created_at ? new Date(s.created_at).toLocaleDateString("fr-FR") : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-slate-400">Aucun snapshot disponible — créez un snapshot SEC dans le module Scope</span>
        )}

        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <RefreshCw size={11} className="animate-spin" /> Chargement…
          </span>
        )}
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 rounded-lg p-3">
          <div className="text-xs text-rose-500 font-semibold uppercase tracking-wider mb-1">En retard</div>
          <div className="text-2xl font-bold text-rose-700">{delayedCount}</div>
          <div className="text-[10px] text-rose-400">projet{delayedCount > 1 ? "s" : ""} dépassant le scope figé</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-500 rounded-lg p-3">
          <div className="text-xs text-emerald-500 font-semibold uppercase tracking-wider mb-1">Dans les délais</div>
          <div className="text-2xl font-bold text-emerald-700">{onTimeCount}</div>
          <div className="text-[10px] text-emerald-400">projet{onTimeCount > 1 ? "s" : ""} respectant le scope</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-slate-300 rounded-lg p-3">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Sans scope</div>
          <div className="text-2xl font-bold text-slate-500">{noScopeCount}</div>
          <div className="text-[10px] text-slate-400">pas de données dans le snapshot</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-500 mb-4">
        <span className="flex items-center gap-1">
          <span className="w-8 h-3 rounded bg-[#0052CC] inline-block opacity-70" /> Scope figé (snapshot)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-8 h-3 rounded bg-emerald-500 inline-block" /> Réel (dans les délais)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-8 h-3 rounded bg-rose-500 inline-block" /> Réel (en retard)
        </span>
      </div>

      {/* Gantt Comparison */}
      {projects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg py-16 text-center text-slate-400 text-sm">
          Aucun projet disponible.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          {/* Header timeline */}
          <div className="flex border-b border-gray-200 bg-slate-50 text-[10px] text-slate-400 uppercase font-semibold">
            <div className="flex-shrink-0 border-r border-gray-200 px-4 py-2" style={{ width: 240 }}>
              Projet
            </div>
            <div className="flex-1 px-4 py-2">
              <div className="relative flex items-center gap-4">
                <span>Chronologie comparée</span>
                <span className="text-[9px] text-slate-300 ml-auto">
                  {new Date(timeMin).getFullYear()} — {new Date(timeMax).getFullYear()}
                </span>
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {projects.map(p => {
              const status = getDelayStatus(p);
              const scope = scopeDates[p.project_id];
              const realStart = dateToMs(p.start_date);
              const realEnd   = dateToMs(p.end_date_forecast || p.end_date_baseline);
              const realColor  = status === "delayed" ? "bg-rose-500" : status === "on_time" ? "bg-emerald-500" : "bg-slate-300";
              const statusBadge = status === "delayed"
                ? <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full ml-2">Retard</span>
                : status === "on_time"
                ? <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full ml-2">OK</span>
                : null;

              return (
                <div key={p.project_id} className="flex items-center hover:bg-slate-50 transition-colors"
                  style={{ minHeight: 68 }}
                  data-testid={`svr-row-${p.project_id}`}>
                  {/* Left label */}
                  <div className="flex-shrink-0 border-r border-gray-100 px-4 py-3" style={{ width: 240 }}>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status_rag === "green" ? "bg-emerald-500" : p.status_rag === "orange" ? "bg-amber-500" : p.status_rag === "red" ? "bg-rose-500" : "bg-slate-300"}`} />
                      <span className="text-xs font-semibold text-slate-700 truncate">{p.name}</span>
                      {statusBadge}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{p.owner || ""}</div>
                    {scope?.end && realEnd && (
                      <div className={`text-[10px] mt-0.5 ${status === "delayed" ? "text-rose-500 font-semibold" : "text-emerald-500"}`}>
                        {status === "delayed"
                          ? `+${Math.ceil((realEnd - scope.end) / 864e5)}j de retard`
                          : `${Math.ceil((scope.end - realEnd) / 864e5)}j d'avance`}
                      </div>
                    )}
                  </div>

                  {/* Right bars */}
                  <div className="flex-1 px-4 py-3">
                    {/* Scope bar */}
                    {scope?.start && scope?.end && (
                      <ScopeBar
                        label="Scope figé"
                        start={scope.start}
                        end={scope.end}
                        timeMin={timeMin}
                        timeMax={timeMax}
                        color="bg-[#0052CC] opacity-60"
                      />
                    )}
                    {!scope?.start && (
                      <div className="text-[9px] text-slate-300 italic h-5 mb-1 flex items-center">
                        Pas de données scope dans ce snapshot
                      </div>
                    )}
                    {/* Réel bar */}
                    {realStart && realEnd && (
                      <ScopeBar
                        label="Réel"
                        start={realStart}
                        end={realEnd}
                        timeMin={timeMin}
                        timeMax={timeMax}
                        color={realColor}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Roadmap component
// ─────────────────────────────────────────────────────────────────────────────

export default function Roadmap() {
  const [projects,    setProjects]    = useState([]);
  const [programs,    setPrograms]    = useState([]);
  const [milestones,  setMilestones]  = useState([]);
  const [allDeps,     setAllDeps]     = useState([]);
  const [loading,     setLoading]     = useState(true);

  // Tab principal
  const [activeRoadmapTab, setActiveRoadmapTab] = useState("timeline");

  // Scope vs Réel states
  const [snapshots,          setSnapshots]          = useState([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [snapshotData,       setSnapshotData]       = useState(null);
  const [loadingScope,       setLoadingScope]       = useState(false);
  const [scopeDates,         setScopeDates]         = useState({}); // projectId → {start, end}

  // Existing filters
  const [filterProgram, setFilterProgram] = useState("");
  const [filterRag,     setFilterRag]     = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");

  // New milestone filters
  const [filterMsFamily,    setFilterMsFamily]    = useState("");
  const [filterMsType,      setFilterMsType]      = useState("");
  const [filterMsAttribute, setFilterMsAttribute] = useState("");
  const [filterMsBlocking,  setFilterMsBlocking]  = useState(false);

  const [showDeps, setShowDeps] = useState(true);
  const [isQuarter, setIsQuarter] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    Promise.all([
      projectsAPI.list(),
      programsAPI.list(),
      milestonesAPI.list(),
      projectDependenciesAPI.listAll(),
    ]).then(([pRes, pgRes, mRes, dRes]) => {
      setProjects(pRes.data);
      setPrograms(pgRes.data);
      setMilestones(mRes.data);
      setAllDeps(dRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const programMap = useMemo(() => {
    const m = {};
    programs.forEach((p) => { m[p.program_id] = p.name; });
    return m;
  }, [programs]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filterProgram && p.program_id !== filterProgram) return false;
      if (filterRag && p.status_rag !== filterRag) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    });
  }, [projects, filterProgram, filterRag, filterStatus]);

  const filteredProjectIds = useMemo(() => new Set(filtered.map((p) => p.project_id)), [filtered]);

  // Time range
  const { timeMin, timeMax } = useMemo(() => {
    if (!filtered.length) return { timeMin: Date.now(), timeMax: Date.now() + 365 * 24 * 3600 * 1000 };
    const starts = filtered.map((p) => dateToMs(p.start_date)).filter(Boolean);
    const ends   = filtered.map((p) => dateToMs(p.end_date_forecast || p.end_date_baseline)).filter(Boolean);
    if (!starts.length) return { timeMin: Date.now(), timeMax: Date.now() + 365 * 24 * 3600 * 1000 };
    const pad = 30.5 * 24 * 3600 * 1000;
    return { timeMin: Math.min(...starts) - pad, timeMax: Math.max(...ends) + pad };
  }, [filtered]);

  const colWidth = isQuarter ? COL_WIDTH_QUARTER : COL_WIDTH_MONTH;
  const headers  = useMemo(() => buildHeaders(timeMin, timeMax, isQuarter), [timeMin, timeMax, isQuarter]);
  const totalW   = headers.length * colWidth;

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((p) => {
      const pId = p.program_id || "__none__";
      if (!groups[pId]) groups[pId] = [];
      groups[pId].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return (programMap[a] || "").localeCompare(programMap[b] || "");
    });
  }, [filtered, programMap]);

  const toX = (ms) => msToX(ms, timeMin, colWidth, isQuarter);
  const todayX = toX(Date.now());

  // Compute milestone types available for selected family
  const availableTypes = filterMsFamily ? (FAMILY_CONFIG[filterMsFamily]?.types || []) : [];

  // Milestone filtering by family/type/attribute/blocking
  const filteredMilestones = useMemo(() => {
    return milestones.filter((ms) => {
      if (filterMsFamily && ms.family !== filterMsFamily) return false;
      if (filterMsType && ms.type !== filterMsType) return false;
      if (filterMsAttribute && ms.attribute !== filterMsAttribute) return false;
      if (filterMsBlocking && !ms.is_blocking) return false;
      return true;
    });
  }, [milestones, filterMsFamily, filterMsType, filterMsAttribute, filterMsBlocking]);

  // Milestones map by project (respects filters)
  const milestonesByProject = useMemo(() => {
    const m = {};
    const hasFilter = filterMsFamily || filterMsType || filterMsAttribute || filterMsBlocking;
    // If no milestone filter active: show only governance milestones (backward compat)
    // If filter active: show all matching milestones
    const msToShow = hasFilter ? filteredMilestones : milestones.filter((ms) => ms.is_governance);
    msToShow.forEach((ms) => {
      if (!m[ms.project_id]) m[ms.project_id] = [];
      m[ms.project_id].push(ms);
    });
    return m;
  }, [milestones, filteredMilestones, filterMsFamily, filterMsType, filterMsAttribute, filterMsBlocking]);

  // Project bar X positions (for dependency arrows)
  const projectBarX = useMemo(() => {
    const map = {};
    filtered.forEach((p) => {
      const startMs = dateToMs(p.start_date);
      const endMs   = dateToMs(p.end_date_forecast || p.end_date_baseline);
      if (startMs && endMs) {
        const bl = Math.max(toX(startMs), 0);
        const br = Math.max(toX(endMs), bl + 6);
        map[p.project_id] = { left: bl, right: br };
      }
    });
    return map;
  }, [filtered, toX]); // eslint-disable-line

  // Project Y positions in timeline body (for dependency arrows)
  const projectY = useMemo(() => {
    const map = {};
    let cY = 0;
    grouped.forEach(([, projList]) => {
      cY += GROUP_HEADER_H;
      projList.forEach((p, ri) => {
        map[p.project_id] = cY + ri * ROW_HEIGHT + ROW_HEIGHT / 2;
      });
      cY += projList.length * ROW_HEIGHT;
    });
    return map;
  }, [grouped]);

  // Dependencies to render on roadmap (both projects visible)
  const visibleDeps = useMemo(() => {
    if (!showDeps) return [];
    return allDeps.filter((dep) =>
      filteredProjectIds.has(dep.source_project_id) &&
      filteredProjectIds.has(dep.target_project_id)
    );
  }, [allDeps, filteredProjectIds, showDeps]);

  const totalTimelineH = useMemo(() => {
    let h = 0;
    grouped.forEach(([, projList]) => { h += GROUP_HEADER_H + projList.length * ROW_HEIGHT; });
    return h + 24; // today label row
  }, [grouped]);

  const resetFilters = () => {
    setFilterProgram(""); setFilterRag(""); setFilterStatus("");
    setFilterMsFamily(""); setFilterMsType(""); setFilterMsAttribute(""); setFilterMsBlocking(false);
  };
  const hasFilters = filterProgram || filterRag || filterStatus || filterMsFamily || filterMsType || filterMsAttribute || filterMsBlocking;

  // ── Scope vs Réel logic ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeRoadmapTab !== "scope_vs_reel") return;
    setLoadingScope(true);
    scopeAPI.listSnapshots().then(res => {
      const snaps = res.data || [];
      setSnapshots(snaps);
      if (snaps.length > 0 && !selectedSnapshotId) {
        setSelectedSnapshotId(snaps[0].snapshot_id || snaps[0]._id || "");
      }
      setLoadingScope(false);
    }).catch(() => setLoadingScope(false));
  }, [activeRoadmapTab]); // eslint-disable-line

  useEffect(() => {
    if (!selectedSnapshotId) return;
    setLoadingScope(true);
    scopeAPI.getSnapshot(selectedSnapshotId).then(res => {
      const snap = res.data;
      setSnapshotData(snap);
      // Compute scope dates per project from SEC features
      const datesMap = {};
      (snap.features || snap.tasks || []).forEach(f => {
        if (f.scope_status !== "sec") return;
        const pid = f.project_id;
        if (!pid) return;
        const startMs = dateToMs(f.start_date || f.date_start_planned);
        const endMs   = dateToMs(f.end_date || f.end_date_deadline || f.date_end_planned);
        if (!datesMap[pid]) datesMap[pid] = { starts: [], ends: [] };
        if (startMs) datesMap[pid].starts.push(startMs);
        if (endMs)   datesMap[pid].ends.push(endMs);
      });
      const computed = {};
      Object.entries(datesMap).forEach(([pid, { starts, ends }]) => {
        computed[pid] = {
          start: starts.length ? Math.min(...starts) : null,
          end:   ends.length   ? Math.max(...ends)   : null,
        };
      });
      setScopeDates(computed);
      setLoadingScope(false);
    }).catch(() => setLoadingScope(false));
  }, [selectedSnapshotId]);

  if (loading) return <div className="p-8 text-slate-400 text-sm">Chargement de la roadmap...</div>;

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="roadmap-page">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Map size={18} className="text-[#0052CC]" />
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
                Roadmap Portefeuille
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Vue consolidée multi-projets — {filtered.length} projet{filtered.length !== 1 ? "s" : ""}
              {visibleDeps.length > 0 && (
                <span className="ml-2 text-violet-500 font-medium">
                  · {visibleDeps.length} dépendance{visibleDeps.length > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          {activeRoadmapTab === "timeline" && (
            <div className="flex items-center gap-2" data-testid="roadmap-zoom-controls">
              <button onClick={() => setIsQuarter(false)} data-testid="zoom-month-btn"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors ${!isQuarter ? "bg-[#0052CC] text-white" : "border border-gray-200 text-slate-600 hover:bg-gray-50"}`}>
                <ZoomIn size={12} /> Mois
              </button>
              <button onClick={() => setIsQuarter(true)} data-testid="zoom-quarter-btn"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors ${isQuarter ? "bg-[#0052CC] text-white" : "border border-gray-200 text-slate-600 hover:bg-gray-50"}`}>
                <ZoomOut size={12} /> Trimestre
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
        {[
          { key: "timeline",      icon: Map,        label: "Timeline Projets" },
          { key: "scope_vs_reel", icon: GitCompare, label: "Scope vs Réel" },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveRoadmapTab(key)}
            data-testid={`roadmap-tab-${key}`}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeRoadmapTab === key
                ? "border-[#0052CC] text-[#0052CC]"
                : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          TAB 1 — TIMELINE PROJETS (existing)
      ══════════════════════════════════════════════════ */}
      {activeRoadmapTab === "timeline" && (
      <>
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-4 mb-6" data-testid="roadmap-filters">
        {/* Row 1: project filters */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <Filter size={11} /> Projets
          </div>
          <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} data-testid="filter-program"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white">
            <option value="">Tous programmes</option>
            {programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.name}</option>)}
          </select>
          <select value={filterRag} onChange={(e) => setFilterRag(e.target.value)} data-testid="filter-rag"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white">
            <option value="">Tous RAG</option>
            <option value="green">Vert</option>
            <option value="orange">Orange</option>
            <option value="red">Rouge</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="filter-status"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white">
            <option value="">Tous statuts</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Row 2: milestone filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-500 uppercase tracking-widest">
            <Diamond size={11} /> Jalons
          </div>
          <select value={filterMsFamily} onChange={(e) => { setFilterMsFamily(e.target.value); setFilterMsType(""); }}
            data-testid="filter-ms-family"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-violet-400 bg-white">
            <option value="">Toutes familles</option>
            {Object.entries(FAMILY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterMsType} onChange={(e) => setFilterMsType(e.target.value)}
            disabled={!filterMsFamily} data-testid="filter-ms-type"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-violet-400 bg-white disabled:opacity-50">
            <option value="">Tous types</option>
            {availableTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterMsAttribute} onChange={(e) => setFilterMsAttribute(e.target.value)}
            data-testid="filter-ms-attribute"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-violet-400 bg-white">
            <option value="">Tous attributs</option>
            <option value="critical">Critical</option>
            <option value="strategic">Strategic</option>
          </select>
          <button type="button" onClick={() => setFilterMsBlocking(!filterMsBlocking)}
            data-testid="filter-ms-blocking"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors ${filterMsBlocking ? "bg-rose-50 border-rose-300 text-rose-700" : "border-gray-200 text-slate-500 hover:bg-gray-50"}`}>
            ⚑ Bloquants uniquement
          </button>
          <button type="button" onClick={() => setShowDeps(!showDeps)}
            data-testid="toggle-deps"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded border transition-colors ${showDeps ? "bg-violet-50 border-violet-300 text-violet-700" : "border-gray-200 text-slate-500 hover:bg-gray-50"}`}>
            ⟶ Dépendances
          </button>
          {hasFilters && (
            <button onClick={resetFilters} data-testid="filter-reset"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 border border-gray-200 px-2 py-1 rounded">
              <X size={10} /> Tout réinitialiser
            </button>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Vert</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Orange</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" /> Rouge</span>
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5" fill="#EAB308"/></svg>
            Epic Lifecycle
          </span>
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5" fill="#8B5CF6"/></svg>
            Epic Milestone
          </span>
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5" fill="#10B981"/></svg>
            Transversal
          </span>
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5" fill="#EAB308" stroke="#EF4444" strokeWidth="2"/></svg>
            Critical
          </span>
          <span className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="5,1 9,5 5,9 1,5" fill="#8B5CF6" stroke="#3B82F6" strokeWidth="2"/></svg>
            Strategic
          </span>
          {visibleDeps.length > 0 && (
            <span className="flex items-center gap-1">
              <svg width="20" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="3 2"/><polygon points="14,1.5 20,4 14,6.5" fill="#8B5CF6"/></svg>
              Dépendance
            </span>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded shadow-sm py-16 text-center text-slate-400 text-sm">
          Aucun projet ne correspond aux filtres sélectionnés.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden" data-testid="roadmap-chart">
          {/* Sticky header row */}
          <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
            <div className="flex-shrink-0 bg-gray-50 z-20 border-r border-gray-200 flex items-center px-4"
              style={{ width: LEFT_PANEL_W, minWidth: LEFT_PANEL_W }}>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Projet</span>
            </div>
            <div className="overflow-hidden" ref={scrollRef}>
              <div className="flex" style={{ width: totalW }}>
                {headers.map((h, i) => (
                  <div key={i}
                    className="text-center text-[10px] font-semibold text-slate-500 py-2 border-r border-gray-100 flex-shrink-0"
                    style={{ width: colWidth }}>
                    {h.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline body */}
          <div className="overflow-x-auto" data-testid="roadmap-timeline">
            <div style={{ minWidth: LEFT_PANEL_W + totalW, position: "relative" }}>
              {grouped.map(([programId, projList]) => (
                <div key={programId}>
                  {/* Program group header */}
                  <div className="flex items-center bg-slate-50 border-b border-gray-100 px-4"
                    style={{ minWidth: LEFT_PANEL_W + totalW, height: GROUP_HEADER_H }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500" style={{ width: LEFT_PANEL_W - 16 }}>
                      {programId === "__none__" ? "Sans programme" : (programMap[programId] || programId)}
                    </div>
                    <div className="text-[10px] text-slate-400 ml-4">
                      {projList.length} projet{projList.length > 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Project rows */}
                  {projList.map((p) => {
                    const startMs = dateToMs(p.start_date);
                    const endMs   = dateToMs(p.end_date_forecast || p.end_date_baseline);
                    const ragCfg  = RAG_BAR_COLORS[p.status_rag] || RAG_BAR_COLORS.green;
                    const pMilestones = milestonesByProject[p.project_id] || [];
                    const barX = projectBarX[p.project_id];

                    return (
                      <div key={p.project_id}
                        className="flex items-center border-b border-gray-50 hover:bg-blue-50/30 transition-colors"
                        style={{ height: ROW_HEIGHT }}
                        data-testid={`roadmap-row-${p.project_id}`}>
                        {/* Left: project name */}
                        <div className="flex-shrink-0 flex items-center gap-2 px-4 border-r border-gray-100"
                          style={{ width: LEFT_PANEL_W, minWidth: LEFT_PANEL_W }}>
                          <span className={`w-1.5 h-4 rounded-sm flex-shrink-0 ${ragCfg.bg}`} />
                          <Link to={`/projects/${p.project_id}`}
                            className="text-xs text-slate-700 font-medium hover:text-[#0052CC] truncate flex-1"
                            title={p.name} data-testid={`roadmap-project-link-${p.project_id}`}>
                            {p.name.split("—")[0].trim().slice(0, 26)}
                          </Link>
                          <ExternalLink size={9} className="text-slate-300 flex-shrink-0" />
                        </div>

                        {/* Right: timeline bar */}
                        <div className="relative flex-1" style={{ minWidth: totalW, height: ROW_HEIGHT }}>
                          {/* Today line */}
                          {todayX >= 0 && todayX <= totalW && (
                            <div className="absolute top-0 bottom-0 w-px bg-[#0052CC]/30 z-10 pointer-events-none"
                              style={{ left: todayX }} />
                          )}
                          {/* Column separators */}
                          {headers.map((h, i) => (
                            <div key={i}
                              className="absolute top-0 bottom-0 border-r border-gray-50 pointer-events-none"
                              style={{ left: i * colWidth, width: colWidth }} />
                          ))}
                          {/* Project bar */}
                          {barX && (
                            <div
                              className={`absolute top-2.5 h-5 rounded ${ragCfg.bg} ${ragCfg.border} border cursor-pointer flex items-center px-1.5 overflow-hidden z-20 transition-opacity hover:opacity-90`}
                              style={{ left: barX.left, width: Math.max(barX.right - barX.left, 6) }}
                              title={`${p.name}\n${formatDate(p.start_date)} → ${formatDate(p.end_date_forecast || p.end_date_baseline)}`}
                              onClick={() => setTooltip(tooltip?.id === p.project_id ? null : {
                                id: p.project_id, name: p.name,
                                start: formatDate(p.start_date),
                                end: formatDate(p.end_date_forecast || p.end_date_baseline),
                                rag: p.status_rag, status: STATUS_LABELS[p.status] || p.status, budget: p.budget_total,
                              })}
                              data-testid={`roadmap-bar-${p.project_id}`}>
                              {(barX.right - barX.left) > 40 && (
                                <span className={`text-[10px] font-semibold ${ragCfg.text} truncate`}>
                                  {p.name.split("—")[0].trim().slice(0, 20)}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Milestones */}
                          {pMilestones.map((ms) => {
                            const msMs = dateToMs(ms.date_forecast || ms.date_baseline);
                            if (!msMs) return null;
                            const mx = toX(msMs);
                            const fCfg = FAMILY_CONFIG[ms.family];
                            const fill = fCfg?.fill || "#0052CC";
                            const stroke = ms.attribute === "critical" ? "#EF4444" : ms.attribute === "strategic" ? "#3B82F6" : "none";
                            const typeLabel = fCfg?.types?.find((t) => t.value === ms.type)?.label || ms.type || "";
                            const tooltipTxt = [ms.name, typeLabel, ms.deliverable, ms.comment, ms.is_blocking ? "⚑ Bloquant" : null].filter(Boolean).join(" | ");
                            return (
                              <div key={ms.milestone_id}
                                className="absolute top-1/2 -translate-y-1/2 z-30 cursor-pointer"
                                style={{ left: mx - 8, width: 16, height: 16 }}
                                title={tooltipTxt}
                                data-testid={`roadmap-milestone-${ms.milestone_id}`}>
                                <svg viewBox="0 0 16 16">
                                  <polygon points="8,1 15,8 8,15 1,8"
                                    fill={fill}
                                    stroke={stroke} strokeWidth={ms.attribute ? "2.5" : "0"}
                                    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.25))" }} />
                                </svg>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Today label at bottom */}
              <div className="relative border-t border-gray-100 bg-gray-50" style={{ minWidth: LEFT_PANEL_W + totalW, height: 24 }}>
                {todayX >= 0 && todayX <= totalW && (
                  <div className="absolute top-1" style={{ left: LEFT_PANEL_W + todayX - 20 }}>
                    <span className="text-[9px] font-bold text-[#0052CC] bg-blue-50 border border-blue-200 rounded px-1 py-0.5">
                      Aujourd'hui
                    </span>
                  </div>
                )}
              </div>

              {/* SVG overlay for dependency arrows */}
              {visibleDeps.length > 0 && (
                <div className="absolute top-0 pointer-events-none overflow-visible z-25"
                  style={{ left: LEFT_PANEL_W, top: 0, width: totalW, height: totalTimelineH }}>
                  <svg width={totalW} height={totalTimelineH} style={{ overflow: "visible" }}>
                    <defs>
                      {["critical","high","medium","low"].map((imp) => (
                        <marker key={imp} id={`arrow-${imp}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                          <polygon points="0 0, 8 3, 0 6" fill={IMPACT_COLORS[imp]} />
                        </marker>
                      ))}
                    </defs>
                    {visibleDeps.map((dep) => {
                      const sBarX = projectBarX[dep.source_project_id];
                      const tBarX = projectBarX[dep.target_project_id];
                      const sY    = projectY[dep.source_project_id];
                      const tY    = projectY[dep.target_project_id];
                      if (!sBarX || !tBarX || sY === undefined || tY === undefined) return null;
                      const sX  = sBarX.right + 2;
                      const tX  = tBarX.left - 2;
                      const color = IMPACT_COLORS[dep.impact] || "#8B5CF6";
                      const midX = (sX + tX) / 2;
                      return (
                        <path key={dep.dependency_id}
                          d={`M ${sX} ${sY} C ${midX} ${sY}, ${midX} ${tY}, ${tX} ${tY}`}
                          fill="none"
                          stroke={color}
                          strokeWidth="1.5"
                          strokeDasharray="5 3"
                          markerEnd={`url(#arrow-${dep.impact})`}
                          opacity="0.75">
                          <title>{dep.source_project_name} → {dep.target_project_name}: {dep.description}</title>
                        </path>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tooltip card */}
      {tooltip && (
        <div className="fixed bottom-6 right-6 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-50 min-w-[220px]"
          data-testid="roadmap-tooltip">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="text-sm font-bold text-slate-800 leading-snug">{tooltip.name}</div>
            <button onClick={() => setTooltip(null)} className="text-slate-300 hover:text-slate-600">
              <X size={13} />
            </button>
          </div>
          <RAGBadge status={tooltip.rag} />
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between"><span className="text-slate-400">Début</span><span>{tooltip.start}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Fin forecast</span><span>{tooltip.end}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Statut</span><span>{tooltip.status}</span></div>
            {tooltip.budget && (
              <div className="flex justify-between">
                <span className="text-slate-400">Budget</span>
                <span className="font-mono-data">{Math.round(tooltip.budget / 1000).toLocaleString("fr-FR")} K€</span>
              </div>
            )}
          </div>
          <Link to={`/projects/${tooltip.id}`}
            className="mt-3 flex items-center gap-1 text-[11px] text-[#0052CC] hover:underline">
            <ExternalLink size={10} /> Voir le projet
          </Link>
        </div>
      )}
      </>)}

      {/* ══════════════════════════════════════════════════
          TAB 2 — SCOPE vs RÉEL
      ══════════════════════════════════════════════════ */}
      {activeRoadmapTab === "scope_vs_reel" && (
        <ScopeVsReelView
          projects={projects}
          snapshots={snapshots}
          selectedSnapshotId={selectedSnapshotId}
          setSelectedSnapshotId={setSelectedSnapshotId}
          snapshotData={snapshotData}
          scopeDates={scopeDates}
          loading={loadingScope}
        />
      )}
    </div>
  );
}
