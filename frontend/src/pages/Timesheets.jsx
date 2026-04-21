import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight,
  Download, Filter, Send, RefreshCw, X, Users, Briefcase, Shield,
  ArrowRight, Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { timesheetsAPI, resourcesAPI } from "@/api";
import { toast } from "sonner";

// ─── Constantes ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  draft:       { label: "Brouillon",      bg: "bg-gray-100",     text: "text-gray-600",    border: "border-gray-200" },
  submitted:   { label: "Soumis",         bg: "bg-blue-50",      text: "text-blue-700",    border: "border-blue-200" },
  cp_reviewed: { label: "Validé N+1",     bg: "bg-amber-50",     text: "text-amber-700",   border: "border-amber-200" },
  validated:   { label: "Validé CP",      bg: "bg-emerald-50",   text: "text-emerald-700", border: "border-emerald-200" },
  rejected:    { label: "Rejeté",         bg: "bg-rose-50",      text: "text-rose-700",    border: "border-rose-200" },
};

// Étapes du workflow pour l'indicateur visuel
const WORKFLOW_STEPS = [
  { key: "draft",       label: "Brouillon" },
  { key: "submitted",   label: "Soumis" },
  { key: "cp_reviewed", label: "Validé N+1" },
  { key: "validated",   label: "Validé CP" },
];

function weekLabel(weekStart) {
  if (!weekStart) return "";
  const d = new Date(weekStart + "T00:00:00");
  const end = new Date(d); end.setDate(end.getDate() + 4);
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function getThisMonday() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  return d.toISOString().split("T")[0];
}

function shiftWeek(weekStart, delta) {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().split("T")[0];
}

const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

// ─── WorkflowStepper ─────────────────────────────────────────────────────────
function WorkflowStepper({ currentStatus }) {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === currentStatus);
  return (
    <div className="flex items-center gap-1 text-[10px]">
      {WORKFLOW_STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold border transition-all ${
            i < idx  ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
            i === idx ? "bg-[#0052CC] text-white border-[#0052CC]" :
                        "bg-gray-50 text-gray-400 border-gray-200"
          }`}>
            {i < idx && <CheckCircle size={9} />}
            {step.label}
          </div>
          {i < WORKFLOW_STEPS.length - 1 && (
            <ArrowRight size={10} className={i < idx ? "text-emerald-400" : "text-gray-300"} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── ONGLET 1 : Saisie des temps ─────────────────────────────────────────────
function TimesheetGrid({ resourceId, onResourceChange, allResources, user }) {
  const [weekStart, setWeekStart]   = useState(getThisMonday);
  const [grid, setGrid]             = useState(null);
  const [cells, setCells]           = useState({});
  const [loading, setLoading]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef({});

  const loadGrid = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    try {
      const r = await timesheetsAPI.getGrid(resourceId, weekStart);
      setGrid(r.data);
      const init = {};
      r.data.rows.forEach((row) => {
        r.data.days.forEach((day) => {
          const e = row.entries[day];
          init[`${row.work_allocation_id}__${day}`] = e?.jh_value ?? 0;
        });
      });
      setCells(init);
    } catch { toast.error("Erreur chargement grille"); }
    finally { setLoading(false); }
  }, [resourceId, weekStart]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  const handleCell = useCallback((waId, day, raw) => {
    const val = Math.max(0, parseFloat(raw) || 0);
    const key = `${waId}__${day}`;
    setCells((p) => ({ ...p, [key]: raw === "" ? "" : val }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      try {
        await timesheetsAPI.upsertEntry({ resource_id: resourceId, work_allocation_id: waId, date: day, jh_value: val });
        setGrid((g) => {
          if (!g) return g;
          return {
            ...g,
            rows: g.rows.map((r) => {
              if (r.work_allocation_id !== waId) return r;
              const newEntries = { ...r.entries, [day]: { ...r.entries[day], jh_value: val, status: "draft" } };
              const wt = Object.values(newEntries).reduce((s, e) => s + (e.jh_value || 0), 0);
              return { ...r, entries: newEntries, week_total: Math.round(wt * 10) / 10 };
            }),
          };
        });
      } catch (err) {
        toast.error(err.response?.data?.detail || "Erreur sauvegarde");
        setCells((p) => ({ ...p, [key]: 0 }));
      }
    }, 500);
  }, [resourceId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await timesheetsAPI.submitWeek({ resource_id: resourceId, week_start: weekStart });
      toast.success(`${r.data.submitted} entrée(s) soumise(s) pour validation`);
      loadGrid();
    } catch (err) { toast.error(err.response?.data?.detail || "Erreur soumission"); }
    finally { setSubmitting(false); }
  };

  const canEdit  = (status) => !status || status === "draft" || status === "rejected";
  const cellBg   = (status) => {
    if (!status || status === "draft")     return "";
    if (status === "submitted")            return "bg-blue-50";
    if (status === "cp_reviewed")          return "bg-amber-50";
    if (status === "validated")            return "bg-emerald-50";
    if (status === "rejected")             return "bg-rose-50/60";
    return "";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select value={resourceId || ""} onChange={(e) => onResourceChange(e.target.value)}
            data-testid="resource-picker"
            className="text-sm border border-gray-200 rounded px-3 py-2 text-slate-700 focus:outline-none focus:border-[#0052CC] bg-white min-w-[200px]">
            <option value="">— Sélectionner une ressource —</option>
            {allResources.map((r) => (
              <option key={r.resource_id} value={r.resource_id}>
                {r.name}{r.resource_id === user?.resource_id ? " (moi)" : ""}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 border border-gray-200 rounded overflow-hidden">
            <button onClick={() => setWeekStart((w) => shiftWeek(w, -1))} data-testid="week-prev"
              className="p-2 hover:bg-gray-50 text-slate-500"><ChevronLeft size={14} /></button>
            <span className="px-3 text-sm text-slate-700 font-medium whitespace-nowrap" data-testid="week-label">
              {weekLabel(weekStart)}
            </span>
            <button onClick={() => setWeekStart((w) => shiftWeek(w, 1))} data-testid="week-next"
              className="p-2 hover:bg-gray-50 text-slate-500"><ChevronRight size={14} /></button>
          </div>
          <button onClick={() => setWeekStart(getThisMonday())}
            className="text-xs text-[#0052CC] hover:underline px-2">Semaine en cours</button>
        </div>
        <button onClick={handleSubmit}
          disabled={!grid?.can_submit || submitting || !resourceId}
          data-testid="submit-week-btn"
          className="flex items-center gap-2 px-4 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-40 transition-colors">
          {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
          Soumettre la semaine
        </button>
      </div>

      {/* Info workflow */}
      <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
        <Info size={13} className="text-blue-500 shrink-0" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-blue-700 font-medium">Circuit de validation :</span>
          <WorkflowStepper currentStatus="draft" />
        </div>
      </div>

      {!resourceId ? (
        <div className="py-16 text-center text-slate-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          Sélectionnez une ressource pour saisir ses temps
        </div>
      ) : loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Chargement...</div>
      ) : !grid || grid.rows.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          Aucune allocation de travail pour cette ressource
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto" data-testid="timesheet-grid">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 min-w-[240px]">
                  Projet / Tâche / Phase
                </th>
                {grid.days.map((day, i) => (
                  <th key={day} className="px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 min-w-[80px]">
                    <div>{DOW[i]}</div>
                    <div className="text-[9px] text-slate-400 font-normal mt-0.5">
                      {new Date(day + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 min-w-[70px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((row) => (
                <tr key={row.work_allocation_id} className="border-b border-gray-50 hover:bg-gray-50/50"
                  data-testid={`grid-row-${row.work_allocation_id}`}>
                  <td className="px-4 py-2.5">
                    <div className="text-xs font-semibold text-slate-800 leading-snug truncate max-w-[220px]">
                      {row.project_name.split("—")[0].trim().slice(0, 30)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {row.task_name.slice(0, 40)}
                      {row.phase && row.phase !== "—" && <span className="ml-1 text-slate-400">· {row.phase}</span>}
                    </div>
                  </td>
                  {grid.days.map((day) => {
                    const e   = row.entries[day];
                    const key = `${row.work_allocation_id}__${day}`;
                    const editable = canEdit(e?.status);
                    return (
                      <td key={day} className={`px-2 py-1.5 text-center ${cellBg(e?.status)}`}>
                        <div className="relative group">
                          <input type="number" min={0} max={grid.daily_cap_jh * 2} step={0.5}
                            value={cells[key] ?? 0}
                            onChange={(ev) => handleCell(row.work_allocation_id, day, ev.target.value)}
                            disabled={!editable}
                            data-testid={`cell-${row.work_allocation_id}-${day}`}
                            className={`w-16 text-center text-xs rounded border py-1 px-1 transition-colors
                              ${editable
                                ? "border-gray-200 focus:border-[#0052CC] focus:outline-none focus:ring-1 focus:ring-[#0052CC]/30"
                                : "border-transparent bg-transparent text-slate-500 cursor-not-allowed"}
                              ${e?.status === "submitted"   ? "text-blue-700" : ""}
                              ${e?.status === "cp_reviewed" ? "text-amber-700 font-semibold" : ""}
                              ${e?.status === "validated"   ? "text-emerald-700 font-semibold" : ""}
                              ${e?.status === "rejected"    ? "text-rose-600" : ""}
                            `}
                          />
                          {/* Tooltip motif rejet */}
                          {e?.status === "rejected" && e?.rejection_reason && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-rose-800 text-white text-[10px] rounded shadow-lg z-10 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              Rejeté : {e.rejection_reason}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 tabular-nums">
                    {row.week_total > 0 ? row.week_total : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#EBF2FF] border-t-2 border-[#0052CC]/20">
                <td className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#0052CC]">Total / jour</td>
                {grid.days.map((day) => (
                  <td key={day} className="px-2 py-2 text-center text-xs font-bold text-[#0052CC] tabular-nums">
                    {grid.day_totals[day] > 0 ? grid.day_totals[day] : "—"}
                    {grid.daily_cap_jh > 0 && grid.day_totals[day] > grid.daily_cap_jh && (
                      <AlertTriangle size={10} className="inline ml-1 text-rose-500" />
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-xs font-bold text-[#0052CC] tabular-nums">
                  {grid.week_grand_total || "—"}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="px-4 py-2 text-[10px] text-slate-400 border-t border-gray-100">
            Capacité journalière : {grid.daily_cap_jh} JH · {grid.resource_name}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Composant partagé : carte groupe ────────────────────────────────────────
function GroupCard({
  g, idx, open, onToggle,
  selected, onSelect,
  actionLabel, actionIcon: ActionIcon, actionClass,
  onAction, onReject,
  showTimeout = false,
  showStatus = false,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm mb-4"
      data-testid={`validation-group-${g.resource_id}`}>
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-gray-100 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={!!selected}
            onChange={(e) => { e.stopPropagation(); onSelect(e.target.checked); }}
            className="accent-[#0052CC]" data-testid={`group-check-${g.resource_id}`} />
          <div>
            <span className="font-semibold text-slate-800 text-sm">{g.resource_name}</span>
            <span className="text-slate-400 text-xs ml-2">Semaine du {g.week_start}</span>
          </div>
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            {g.total_jh} JH
          </span>
          {showStatus && <StatusBadge status={g.status} />}
          {showTimeout && g.timeout && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full"
              data-testid={`timeout-badge-${g.resource_id}`}>
              <AlertTriangle size={10} /> Timeout {g.timeout_days}j
            </span>
          )}
          {/* Projets */}
          {g.project_names?.length > 0 && (
            <span className="text-[10px] text-slate-400 hidden md:block truncate max-w-[160px]">
              {g.project_names[0]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onAction(g.ts_ids); }}
            data-testid={`action-btn-${g.resource_id}`}
            className={`flex items-center gap-1 px-3 py-1.5 text-white text-xs font-semibold rounded ${actionClass}`}>
            <ActionIcon size={11} /> {actionLabel}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onReject(g.ts_ids); }}
            data-testid={`reject-btn-${g.resource_id}`}
            className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded hover:bg-rose-700">
            <X size={11} /> Rejeter
          </button>
        </div>
      </div>
      {open && (
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Projet</th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Tâche</th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Phase</th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Date</th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-widest text-slate-400 font-semibold">JH</th>
              {showStatus && <th className="px-3 py-2 text-center text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Statut</th>}
            </tr>
          </thead>
          <tbody>
            {g.entries.map((e) => (
              <tr key={e.timesheet_id} className="border-t border-gray-50 hover:bg-blue-50/20">
                <td className="px-4 py-2 text-slate-700 truncate max-w-[180px]">{e.project_name}</td>
                <td className="px-3 py-2 text-slate-600 truncate max-w-[160px]">{e.task_name}</td>
                <td className="px-3 py-2 text-slate-500">{e.phase}</td>
                <td className="px-3 py-2 text-slate-500 font-mono">
                  {new Date(e.date + "T00:00:00").toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-amber-700 tabular-nums">{e.jh_value}</td>
                {showStatus && <td className="px-3 py-2 text-center"><StatusBadge status={e.status} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Modale de rejet ─────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" data-testid="reject-modal">
        <h3 className="font-bold text-slate-800 text-base mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-rose-500" /> Motif du rejet
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Le motif sera transmis à la ressource. La feuille de temps sera remise en brouillon pour correction.
        </p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Expliquez la raison du rejet (obligatoire)…"
          className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200"
          rows={3} data-testid="reject-reason-input" />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={() => onConfirm(reason)} disabled={!reason.trim()}
            data-testid="confirm-reject-btn"
            className="px-4 py-2 text-sm text-white bg-rose-600 rounded hover:bg-rose-700 disabled:opacity-40">
            Confirmer le rejet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-vue générique de validation ─────────────────────────────────────────
function ValidationSubView({ view, actionLabel, actionIcon: ActionIcon, actionClass, actionToastFn, showTimeout, showStatus, refresh }) {
  const [groups, setGroups]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState({});
  const [open, setOpen]           = useState({});
  const [rejectIds, setRejectIds] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await timesheetsAPI.getValidation(view);
      setGroups(r.data);
      setOpen(Object.fromEntries(r.data.map((_, i) => [i, true])));
    } catch { toast.error("Erreur chargement"); }
    finally { setLoading(false); }
  }, [view]);

  useEffect(() => { load(); }, [load, refresh]);

  const handleAction = async (ids) => {
    try {
      const r = await timesheetsAPI.validateTimesheets({ timesheet_ids: ids });
      toast.success(actionToastFn(r.data));
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Erreur"); }
  };

  const handleRejectConfirm = async (reason) => {
    try {
      const r = await timesheetsAPI.rejectTimesheets({ timesheet_ids: rejectIds, rejection_reason: reason });
      toast.success(`${r.data.rejected} timesheet(s) rejeté(s) et remis en brouillon`);
      setRejectIds(null); load();
    } catch (err) { toast.error(err.response?.data?.detail || "Erreur rejet"); }
  };

  const selectedAll = groups.flatMap((g, i) => selected[i] ? g.ts_ids : []);

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">Chargement...</div>;
  if (!groups.length) return (
    <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-lg" data-testid={`validation-empty-${view}`}>
      <CheckCircle size={32} className="text-emerald-300 mx-auto mb-2" />
      <p className="text-sm text-slate-400">Aucune soumission en attente</p>
    </div>
  );

  return (
    <div data-testid={`validation-view-${view}`}>
      {/* Bulk actions */}
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox"
            checked={groups.length > 0 && groups.every((_, i) => selected[i])}
            onChange={(e) => setSelected(Object.fromEntries(groups.map((_, i) => [i, e.target.checked])))}
            data-testid="bulk-select-all" className="accent-[#0052CC]" />
          Tout sélectionner
          {selectedAll.length > 0 && (
            <span className="text-[#0052CC] font-semibold ml-1">({selectedAll.length})</span>
          )}
        </label>
        {selectedAll.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => handleAction(selectedAll)} data-testid="bulk-validate-btn"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded ${actionClass}`}>
              <ActionIcon size={12} /> Valider la sélection
            </button>
            <button onClick={() => setRejectIds(selectedAll)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded hover:bg-rose-700">
              <X size={12} /> Rejeter
            </button>
          </div>
        )}
      </div>

      {groups.map((g, i) => (
        <GroupCard key={i} g={g} idx={i}
          open={!!open[i]} onToggle={() => setOpen((p) => ({ ...p, [i]: !p[i] }))}
          selected={!!selected[i]} onSelect={(v) => setSelected((p) => ({ ...p, [i]: v }))}
          actionLabel={actionLabel} actionIcon={ActionIcon} actionClass={actionClass}
          onAction={handleAction} onReject={(ids) => setRejectIds(ids)}
          showTimeout={showTimeout} showStatus={showStatus}
        />
      ))}

      {rejectIds && (
        <RejectModal
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectIds(null)}
        />
      )}
    </div>
  );
}

// ─── ONGLET 2 : Validation (3 sous-vues) ─────────────────────────────────────
function ValidationView({ user, refresh }) {
  const isPmo = user?.role === "TENANT_ADMIN" || user?.role === "PMO_USER";
  const [subView, setSubView] = useState("valideur");

  const SUB_TABS = [
    { id: "valideur", label: "Valideur N+1",    icon: Users,
      desc: "Timesheets soumis à valider en tant que N+1 de la ressource" },
    { id: "cp",       label: "Chef de Projet",  icon: Briefcase,
      desc: "Timesheets déjà validés N+1, à approuver définitivement" },
    ...(isPmo ? [{ id: "pmo", label: "PMO / Admin", icon: Shield,
      desc: "Vue complète — bypass possible sur tous les statuts" }] : []),
  ];

  const viewConfig = {
    valideur: {
      actionLabel: "Valider (→ CP)",
      actionIcon: CheckCircle,
      actionClass: "bg-[#0052CC] hover:bg-[#0047B3]",
      actionToastFn: (d) => `${d.advanced_to_cp_reviewed ?? 0} timesheet(s) transmis au Chef de Projet`,
      showTimeout: false, showStatus: false,
    },
    cp: {
      actionLabel: "Valider définitivement",
      actionIcon: CheckCircle,
      actionClass: "bg-emerald-600 hover:bg-emerald-700",
      actionToastFn: (d) => `${d.validated ?? 0} timesheet(s) validé(s) définitivement`,
      showTimeout: true, showStatus: false,
    },
    pmo: {
      actionLabel: "Bypass → Valider",
      actionIcon: Shield,
      actionClass: "bg-violet-600 hover:bg-violet-700",
      actionToastFn: (d) => `${d.validated ?? 0} timesheet(s) validé(s) en bypass PMO`,
      showTimeout: true, showStatus: true,
    },
  };

  const cfg = viewConfig[subView];

  return (
    <div data-testid="validation-view">
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {SUB_TABS.map(({ id, label, icon: Icon, desc }) => (
          <button key={id} onClick={() => setSubView(id)}
            data-testid={`sub-tab-${id}`}
            title={desc}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              subView === id
                ? "border-[#0052CC] text-[#0052CC]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Description de la vue active */}
      <div className="flex items-start gap-2 mb-4 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
        <Info size={13} className="text-slate-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-slate-500">
          {SUB_TABS.find((t) => t.id === subView)?.desc}
        </p>
      </div>

      <ValidationSubView
        key={subView}
        view={subView}
        actionLabel={cfg.actionLabel}
        actionIcon={cfg.actionIcon}
        actionClass={cfg.actionClass}
        actionToastFn={cfg.actionToastFn}
        showTimeout={cfg.showTimeout}
        showStatus={cfg.showStatus}
        refresh={refresh}
      />
    </div>
  );
}

// ─── ONGLET 3 : Rapports ──────────────────────────────────────────────────────
function ReportsView() {
  const today  = new Date().toISOString().split("T")[0];
  const past90 = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
  const [dim, setDim]   = useState("resource");
  const [start, setStart] = useState(past90);
  const [end, setEnd]     = useState(today);
  const [rows, setRows]   = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await timesheetsAPI.getReport(dim, start, end); setRows(r.data); }
    catch { toast.error("Erreur chargement rapport"); }
    finally { setLoading(false); }
  };

  const allPeriods = [...new Set(rows.flatMap((r) => Object.keys(r.periods)))].sort();

  const downloadCsv = async () => {
    try {
      const r = await timesheetsAPI.getReportCsv(dim, start, end);
      const blob = new Blob([r.data], { type: "text/csv;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "timesheets_report.csv";
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Erreur export CSV"); }
  };

  return (
    <div data-testid="reports-view">
      <div className="bg-white border border-gray-200 rounded shadow-sm p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <Filter size={11} /> Filtres
          </div>
          <select value={dim} onChange={(e) => setDim(e.target.value)} data-testid="report-dimension"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#0052CC] bg-white text-slate-600">
            <option value="resource">Par ressource</option>
            <option value="team">Par équipe</option>
            <option value="project">Par projet</option>
          </select>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="report-start"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#0052CC]" />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="report-end"
            className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#0052CC]" />
          <button onClick={load} disabled={loading} data-testid="report-load-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] text-white text-xs font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50">
            {loading ? <RefreshCw size={11} className="animate-spin" /> : <Filter size={11} />}
            Actualiser
          </button>
          {rows.length > 0 && (
            <button onClick={downloadCsv} data-testid="export-csv-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-slate-600 text-xs font-semibold rounded hover:bg-gray-50 ml-auto">
              <Download size={11} /> Exporter CSV
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-lg text-slate-400 text-sm">
          {loading ? "Chargement…" : "Aucune donnée validée sur la période. Cliquez sur Actualiser."}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto" data-testid="report-table">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-slate-500 font-bold min-w-[180px]">
                  {dim === "resource" ? "Ressource" : dim === "team" ? "Équipe" : "Projet"}
                </th>
                {allPeriods.map((p) => (
                  <th key={p} className="px-3 py-2.5 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap min-w-[80px]">
                    {p}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-widest text-[#0052CC] font-bold">Total JH</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dimension_id} className="border-b border-gray-50 hover:bg-blue-50/20">
                  <td className="px-4 py-2.5 font-semibold text-slate-800 truncate max-w-[200px]">{r.dimension_label}</td>
                  {allPeriods.map((p) => (
                    <td key={p} className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {r.periods[p] || <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-bold text-[#0052CC] tabular-nums">{r.total_jh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Timesheets() {
  const { user } = useAuth();
  const [tab, setTab]               = useState("saisie");
  const [resourceId, setResourceId] = useState(user?.resource_id || null);
  const [allResources, setAllResources] = useState([]);
  const [validRefresh, setValidRefresh] = useState(0);

  useEffect(() => {
    resourcesAPI.list().then((r) => setAllResources(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!resourceId && user?.resource_id) setResourceId(user.resource_id);
  }, [user, resourceId]);

  const canValidate = user?.role !== "READ_ONLY";
  const TABS = [
    { id: "saisie",     label: "Ma saisie",  icon: Clock },
    ...(canValidate ? [{ id: "validation", label: "Validation", icon: CheckCircle }] : []),
    { id: "rapports",   label: "Rapports",   icon: Download },
  ];

  return (
    <div className="p-8" data-testid="timesheets-page">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={18} className="text-[#0052CC]" />
          <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">Timesheets</h1>
        </div>
        <p className="text-sm text-slate-500">
          Saisie des temps · Validation multi-acteurs (N+1 → Chef de Projet → PMO)
        </p>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); if (id === "validation") setValidRefresh((n) => n + 1); }}
            data-testid={`tab-${id}`}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === id ? "border-[#0052CC] text-[#0052CC]" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === "saisie" && (
        <TimesheetGrid
          resourceId={resourceId}
          onResourceChange={setResourceId}
          allResources={allResources}
          user={user}
        />
      )}
      {tab === "validation" && canValidate && (
        <ValidationView user={user} refresh={validRefresh} />
      )}
      {tab === "rapports" && <ReportsView />}
    </div>
  );
}
