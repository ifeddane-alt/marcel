import React, { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { Map, Filter, ZoomIn, ZoomOut, X, ExternalLink } from "lucide-react";
import { projectsAPI, programsAPI, milestonesAPI } from "@/api";
import RAGBadge from "@/components/RAGBadge";
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

const COL_WIDTH_MONTH   = 80;  // px par mois
const COL_WIDTH_QUARTER = 200; // px par trimestre
const ROW_HEIGHT        = 40;  // px par projet
const LEFT_PANEL_W      = 220; // px colonne gauche (noms projets)

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
  // deduplicate
  const seen = new Set();
  return headers.filter((h) => { if (seen.has(h.ts)) return false; seen.add(h.ts); return true; });
}

export default function Roadmap() {
  const [projects, setProjects]   = useState([]);
  const [programs, setPrograms]   = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterProgram, setFilterProgram] = useState("");
  const [filterRag, setFilterRag]         = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [isQuarter, setIsQuarter]         = useState(false);
  const [tooltip, setTooltip]     = useState(null); // {x, y, content}
  const scrollRef = useRef(null);

  useEffect(() => {
    Promise.all([projectsAPI.list(), programsAPI.list(), milestonesAPI.list()])
      .then(([pRes, pgRes, mRes]) => {
        setProjects(pRes.data);
        setPrograms(pgRes.data);
        setMilestones(mRes.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  // Time range
  const { timeMin, timeMax } = useMemo(() => {
    if (!filtered.length) return { timeMin: Date.now(), timeMax: Date.now() + 365 * 24 * 3600 * 1000 };
    const starts = filtered.map((p) => dateToMs(p.start_date)).filter(Boolean);
    const ends   = filtered.map((p) => dateToMs(p.end_date_forecast || p.end_date_baseline)).filter(Boolean);
    if (!starts.length) return { timeMin: Date.now(), timeMax: Date.now() + 365 * 24 * 3600 * 1000 };
    const pad = 30.5 * 24 * 3600 * 1000; // 1 month padding
    return {
      timeMin: Math.min(...starts) - pad,
      timeMax: Math.max(...ends) + pad,
    };
  }, [filtered]);

  const colWidth = isQuarter ? COL_WIDTH_QUARTER : COL_WIDTH_MONTH;
  const headers  = useMemo(() => buildHeaders(timeMin, timeMax, isQuarter), [timeMin, timeMax, isQuarter]);
  const totalW   = headers.length * colWidth;

  // Group projects by program
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

  // Milestones map by project
  const milestonesByProject = useMemo(() => {
    const m = {};
    milestones.filter((ms) => ms.is_governance).forEach((ms) => {
      if (!m[ms.project_id]) m[ms.project_id] = [];
      m[ms.project_id].push(ms);
    });
    return m;
  }, [milestones]);

  const toX = (ms) => msToX(ms, timeMin, colWidth, isQuarter);
  const todayX = toX(Date.now());

  const resetFilters = () => { setFilterProgram(""); setFilterRag(""); setFilterStatus(""); };
  const hasFilters = filterProgram || filterRag || filterStatus;

  if (loading) {
    return <div className="p-8 text-slate-400 text-sm">Chargement de la roadmap...</div>;
  }

  return (
    <div className="p-8" data-testid="roadmap-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Map size={18} className="text-[#0052CC]" />
              <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
                Roadmap Portefeuille
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Vue consolidée multi-projets — {filtered.length} projet{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          {/* Zoom controls */}
          <div className="flex items-center gap-2" data-testid="roadmap-zoom-controls">
            <button
              onClick={() => setIsQuarter(false)}
              data-testid="zoom-month-btn"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                !isQuarter ? "bg-[#0052CC] text-white" : "border border-gray-200 text-slate-600 hover:bg-gray-50"
              }`}
            >
              <ZoomIn size={12} /> Mois
            </button>
            <button
              onClick={() => setIsQuarter(true)}
              data-testid="zoom-quarter-btn"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                isQuarter ? "bg-[#0052CC] text-white" : "border border-gray-200 text-slate-600 hover:bg-gray-50"
              }`}
            >
              <ZoomOut size={12} /> Trimestre
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded shadow-sm p-4 mb-6" data-testid="roadmap-filters">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <Filter size={11} /> Filtres
          </div>
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            data-testid="filter-program"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white"
          >
            <option value="">Tous programmes</option>
            {programs.map((p) => (
              <option key={p.program_id} value={p.program_id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterRag}
            onChange={(e) => setFilterRag(e.target.value)}
            data-testid="filter-rag"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white"
          >
            <option value="">Tous RAG</option>
            <option value="green">Vert</option>
            <option value="orange">Orange</option>
            <option value="red">Rouge</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            data-testid="filter-status"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-[#0052CC] bg-white"
          >
            <option value="">Tous statuts</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={resetFilters}
              data-testid="filter-reset"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 border border-gray-200 px-2 py-1 rounded"
            >
              <X size={10} /> Réinitialiser
            </button>
          )}
          <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Vert</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Orange</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" /> Rouge</span>
            <span className="flex items-center gap-1"><span className="inline-block text-[#0052CC] font-bold">◆</span> Jalon gouvernance</span>
          </div>
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
                  <div
                    key={i}
                    className="text-center text-[10px] font-semibold text-slate-500 py-2 border-r border-gray-100 flex-shrink-0"
                    style={{ width: colWidth }}
                  >
                    {h.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline body */}
          <div className="overflow-x-auto" data-testid="roadmap-timeline">
            <div style={{ minWidth: LEFT_PANEL_W + totalW }}>
              {grouped.map(([programId, projList], gi) => (
                <div key={programId}>
                  {/* Program group header */}
                  <div className="flex items-center bg-slate-50 border-b border-gray-100 px-4 py-1.5"
                    style={{ minWidth: LEFT_PANEL_W + totalW }}>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500" style={{ width: LEFT_PANEL_W - 16 }}>
                      {programId === "__none__" ? "Sans programme" : (programMap[programId] || programId)}
                    </div>
                    <div className="text-[10px] text-slate-400 ml-4">
                      {projList.length} projet{projList.length > 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Project rows */}
                  {projList.map((p, ri) => {
                    const startMs = dateToMs(p.start_date);
                    const endMs   = dateToMs(p.end_date_forecast || p.end_date_baseline);
                    const ragCfg  = RAG_BAR_COLORS[p.status_rag] || RAG_BAR_COLORS.green;
                    const pMilestones = milestonesByProject[p.project_id] || [];

                    let barLeft = null, barWidth = null;
                    if (startMs && endMs) {
                      barLeft  = Math.max(toX(startMs), 0);
                      barWidth = Math.max(toX(endMs) - barLeft, 6);
                    }

                    return (
                      <div
                        key={p.project_id}
                        className="flex items-center border-b border-gray-50 hover:bg-blue-50/30 transition-colors"
                        style={{ height: ROW_HEIGHT }}
                        data-testid={`roadmap-row-${p.project_id}`}
                      >
                        {/* Left: project name */}
                        <div
                          className="flex-shrink-0 flex items-center gap-2 px-4 border-r border-gray-100"
                          style={{ width: LEFT_PANEL_W, minWidth: LEFT_PANEL_W }}
                        >
                          <span className={`w-1.5 h-4 rounded-sm flex-shrink-0 ${ragCfg.bg}`} />
                          <Link
                            to={`/projects/${p.project_id}`}
                            className="text-xs text-slate-700 font-medium hover:text-[#0052CC] truncate flex-1"
                            title={p.name}
                            data-testid={`roadmap-project-link-${p.project_id}`}
                          >
                            {p.name.split("—")[0].trim().slice(0, 26)}
                          </Link>
                          <ExternalLink size={9} className="text-slate-300 flex-shrink-0" />
                        </div>

                        {/* Right: timeline bar */}
                        <div className="relative flex-1" style={{ minWidth: totalW, height: ROW_HEIGHT }}>
                          {/* Today line */}
                          {todayX >= 0 && todayX <= totalW && (
                            <div
                              className="absolute top-0 bottom-0 w-px bg-[#0052CC]/30 z-10 pointer-events-none"
                              style={{ left: todayX }}
                            />
                          )}

                          {/* Column separators */}
                          {headers.map((h, i) => (
                            <div key={i}
                              className="absolute top-0 bottom-0 border-r border-gray-50 pointer-events-none"
                              style={{ left: i * colWidth, width: colWidth }}
                            />
                          ))}

                          {/* Project bar */}
                          {barLeft !== null && (
                            <div
                              className={`absolute top-2.5 h-5 rounded ${ragCfg.bg} ${ragCfg.border} border cursor-pointer flex items-center px-1.5 overflow-hidden z-20 transition-opacity hover:opacity-90`}
                              style={{ left: barLeft, width: barWidth, minWidth: 6 }}
                              title={`${p.name}\n${formatDate(p.start_date)} → ${formatDate(p.end_date_forecast || p.end_date_baseline)}`}
                              onClick={() => setTooltip(tooltip?.id === p.project_id ? null : {
                                id: p.project_id,
                                name: p.name,
                                start: formatDate(p.start_date),
                                end: formatDate(p.end_date_forecast || p.end_date_baseline),
                                rag: p.status_rag,
                                status: STATUS_LABELS[p.status] || p.status,
                                budget: p.budget_total,
                              })}
                              data-testid={`roadmap-bar-${p.project_id}`}
                            >
                              {barWidth > 40 && (
                                <span className={`text-[10px] font-semibold ${ragCfg.text} truncate`}>
                                  {p.name.split("—")[0].trim().slice(0, 20)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Governance milestones */}
                          {pMilestones.map((ms) => {
                            const msMs = dateToMs(ms.date_forecast || ms.date_baseline);
                            if (!msMs) return null;
                            const mx = toX(msMs);
                            const ragMs = ms.status === "atteint" ? "#10B981" : ms.status === "en_retard" ? "#EF4444" : "#0052CC";
                            return (
                              <div
                                key={ms.milestone_id}
                                className="absolute top-1/2 -translate-y-1/2 z-30 cursor-pointer"
                                style={{ left: mx - 7, width: 14, height: 14 }}
                                title={`${ms.name}\n${formatDate(ms.date_forecast || ms.date_baseline)}`}
                                data-testid={`roadmap-milestone-${ms.milestone_id}`}
                              >
                                <svg viewBox="0 0 14 14" style={{ fill: ragMs, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.3))" }}>
                                  <polygon points="7,1 13,7 7,13 1,7" />
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
              <div className="relative h-6 border-t border-gray-100 bg-gray-50" style={{ minWidth: LEFT_PANEL_W + totalW }}>
                <div style={{ marginLeft: LEFT_PANEL_W }}>
                  {todayX >= 0 && todayX <= totalW && (
                    <div className="absolute top-1" style={{ left: LEFT_PANEL_W + todayX - 20 }}>
                      <span className="text-[9px] font-bold text-[#0052CC] bg-blue-50 border border-blue-200 rounded px-1 py-0.5">
                        Aujourd'hui
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip card */}
      {tooltip && (
        <div
          className="fixed bottom-6 right-6 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-50 min-w-[220px]"
          data-testid="roadmap-tooltip"
        >
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
          <Link
            to={`/projects/${tooltip.id}`}
            className="mt-3 flex items-center gap-1 text-[11px] text-[#0052CC] hover:underline"
          >
            <ExternalLink size={10} /> Voir le projet
          </Link>
        </div>
      )}
    </div>
  );
}
