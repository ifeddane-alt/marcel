import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, LayoutGrid, List, RefreshCw, Filter, Euro, User,
  TrendingUp, AlertTriangle, CheckCircle, Clock, XCircle,
  Zap, ArrowRight, Search,
} from "lucide-react";
import { demandsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import DemandModal from "@/components/DemandModal";
import ConvertProjectModal from "@/components/ConvertProjectModal";

// ─── Config ────────────────────────────────────────────────────────────────
const URGENCY_CFG = {
  low:      { label: "Faible",   cls: "bg-slate-100 text-slate-600 border-slate-200" },
  medium:   { label: "Moyen",    cls: "bg-blue-50 text-blue-700 border-blue-200" },
  high:     { label: "Élevé",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  critical: { label: "Critique", cls: "bg-rose-50 text-rose-700 border-rose-200 font-bold" },
};

const STATUS_COLS = [
  { key: "nouvelle",  label: "Nouvelle",  icon: Clock,         color: "border-t-slate-400",    hdr: "bg-slate-50",   dot: "bg-slate-400" },
  { key: "qualifiee", label: "Qualifiée", icon: CheckCircle,   color: "border-t-blue-500",     hdr: "bg-blue-50",    dot: "bg-blue-500" },
  { key: "priorisee", label: "Priorisée", icon: TrendingUp,    color: "border-t-violet-500",   hdr: "bg-violet-50",  dot: "bg-violet-500" },
  { key: "acceptee",  label: "Acceptée",  icon: CheckCircle,   color: "border-t-emerald-500",  hdr: "bg-emerald-50", dot: "bg-emerald-500" },
  { key: "refusee",   label: "Refusée",   icon: XCircle,       color: "border-t-rose-500",     hdr: "bg-rose-50",    dot: "bg-rose-500" },
  { key: "convertie", label: "Convertie", icon: ArrowRight,    color: "border-t-teal-500",     hdr: "bg-teal-50",    dot: "bg-teal-500" },
];

// Transitions valides pour drag & drop
const DND_TRANSITIONS = {
  nouvelle:  { qualify:    "qualifiee" },
  qualifiee: { prioritize: "priorisee" },
  priorisee: { accept:     "acceptee", refuse: "refusee" },
};

function fmt(n) {
  if (!n) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function timeSince(isoStr) {
  if (!isoStr) return "";
  const d = (Date.now() - new Date(isoStr)) / 86400000;
  if (d < 1) return "Aujourd'hui";
  if (d < 2) return "Hier";
  return `Il y a ${Math.round(d)}j`;
}

// ─── Carte Kanban ──────────────────────────────────────────────────────────
function DemandCard({ demand, onClick, onDragStart }) {
  const urg = URGENCY_CFG[demand.urgency] || URGENCY_CFG.medium;
  return (
    <div
      data-testid={`demand-card-${demand.demand_id}`}
      draggable
      onDragStart={(e) => onDragStart(e, demand)}
      onClick={() => onClick(demand)}
      className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer p-4 select-none group"
    >
      {/* Urgency + score */}
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${urg.cls}`}>
          {demand.urgency === "critical" && <Zap size={9} className="mr-0.5" />}
          {urg.label}
        </span>
        {demand.priority_score != null && (
          <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
            #{demand.priority_score}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="text-sm font-semibold text-slate-800 line-clamp-2 mb-2 group-hover:text-[#0052CC] transition-colors">
        {demand.title}
      </div>

      {/* Requester */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
        <User size={11} />
        <span className="truncate">{demand.requester}</span>
        {demand.requester_department && (
          <span className="text-slate-400 truncate">• {demand.requester_department}</span>
        )}
      </div>

      {/* Budget + date */}
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Euro size={10} />
          {fmt(demand.estimated_budget)}
        </span>
        <span>{timeSince(demand.created_at)}</span>
      </div>

      {/* Rejection reason indicator */}
      {demand.rejection_reason && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-rose-600 bg-rose-50 rounded-lg px-2 py-1">
          <AlertTriangle size={10} />
          <span className="line-clamp-1">{demand.rejection_reason}</span>
        </div>
      )}
    </div>
  );
}

// ─── Colonne Kanban ────────────────────────────────────────────────────────
function KanbanColumn({ col, demands, onCardClick, onDragStart, onDrop, canWrite }) {
  const [over, setOver] = useState(false);

  return (
    <div
      data-testid={`kanban-col-${col.key}`}
      className={`flex flex-col rounded-2xl border border-slate-200 min-h-[400px] w-56 flex-shrink-0 overflow-hidden
        border-t-4 ${col.color} transition-all
        ${over && canWrite ? "ring-2 ring-[#0052CC]/30 bg-blue-50/30" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); onDrop(e, col.key); }}
    >
      {/* Header */}
      <div className={`${col.hdr} px-4 py-3 flex items-center justify-between border-b border-slate-200`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${col.dot}`} />
          <span className="text-xs font-bold text-slate-700">{col.label}</span>
        </div>
        <span className="text-xs font-bold text-slate-500 bg-white rounded-full w-6 h-6 flex items-center justify-center border border-slate-200">
          {demands.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {demands.map((d) => (
          <DemandCard
            key={d.demand_id}
            demand={d}
            onClick={onCardClick}
            onDragStart={onDragStart}
          />
        ))}
        {demands.length === 0 && (
          <div className="text-center text-xs text-slate-400 py-8">
            Aucune demande
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ────────────────────────────────────────────────────────
export default function Demands() {
  const { user } = useAuth();
  const canWrite = user?.role !== "READ_ONLY";

  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("kanban");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");

  // Modals
  const [selectedDemand, setSelectedDemand] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [convertDemand, setConvertDemand] = useState(null);

  // DnD refs
  const dragItem = useRef(null);
  // Quick dialog for transitions that need extra info
  const [dndDialog, setDndDialog] = useState(null); // {demand, targetStatus, action}
  const [dndPriorityScore, setDndPriorityScore] = useState(50);
  const [dndRefuseReason, setDndRefuseReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterUrgency) params.urgency = filterUrgency;
      const res = await demandsAPI.list(params);
      setDemands(res.data);
    } catch {
      toast.error("Impossible de charger les demandes");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterUrgency]);

  useEffect(() => { load(); }, [load]);

  // Seed auto si vide
  useEffect(() => {
    if (!loading && demands.length === 0 && canWrite) {
      demandsAPI.seed().then(load).catch(() => {});
    }
  }, [loading, demands.length, canWrite, load]);

  // ─── DnD handlers ────────────────────────────────────────────────────────
  function handleDragStart(e, demand) {
    dragItem.current = demand;
    e.dataTransfer.effectAllowed = "move";
  }

  async function handleDrop(e, targetStatus) {
    e.preventDefault();
    const demand = dragItem.current;
    dragItem.current = null;
    if (!demand || demand.status === targetStatus) return;
    if (!canWrite) return;

    const allowed = DND_TRANSITIONS[demand.status] || {};
    const action = Object.keys(allowed).find((a) => allowed[a] === targetStatus);
    if (!action) {
      toast.error(`Transition vers "${targetStatus}" non autorisée`);
      return;
    }

    if (action === "prioritize") {
      setDndDialog({ demand, targetStatus, action });
      setDndPriorityScore(50);
      return;
    }
    if (action === "refuse") {
      setDndDialog({ demand, targetStatus, action });
      setDndRefuseReason("");
      return;
    }

    // Direct transition
    try {
      await demandsAPI.transition(demand.demand_id, { action });
      toast.success("Statut mis à jour");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  }

  async function confirmDndDialog() {
    if (!dndDialog) return;
    const { demand, action } = dndDialog;
    try {
      if (action === "prioritize") {
        await demandsAPI.transition(demand.demand_id, { action, priority_score: dndPriorityScore });
      } else if (action === "refuse") {
        if (!dndRefuseReason.trim()) return toast.error("Le motif est obligatoire");
        await demandsAPI.transition(demand.demand_id, { action, rejection_reason: dndRefuseReason });
      }
      toast.success("Statut mis à jour");
      setDndDialog(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  }

  // ─── Filtres & tri ────────────────────────────────────────────────────────
  const filtered = demands.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) &&
        !d.requester?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Grouped by status pour kanban
  const byStatus = {};
  STATUS_COLS.forEach((c) => { byStatus[c.key] = []; });
  filtered.forEach((d) => {
    if (byStatus[d.status]) byStatus[d.status].push(d);
  });

  // Sorted pour table
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "urgency") {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.urgency] ?? 9) - (order[b.urgency] ?? 9);
    }
    if (sortBy === "priority_score") return (b.priority_score ?? -1) - (a.priority_score ?? -1);
    if (sortBy === "budget") return (b.estimated_budget ?? 0) - (a.estimated_budget ?? 0);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // ─── KPIs header ─────────────────────────────────────────────────────────
  const kpis = {
    total:     demands.length,
    nouvelles: demands.filter((d) => d.status === "nouvelle").length,
    acceptees: demands.filter((d) => d.status === "acceptee").length,
    critiques: demands.filter((d) => d.urgency === "critical").length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Gestion de la Demande</h1>
            <p className="text-sm text-slate-500 mt-0.5">Qualification et priorisation des demandes projets</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
            {/* View toggle */}
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
              <button
                data-testid="view-kanban-btn"
                onClick={() => setView("kanban")}
                className={`px-3 py-2 flex items-center gap-1.5 text-xs font-medium transition-colors
                  ${view === "kanban" ? "bg-[#0052CC] text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <LayoutGrid size={14} />
                Kanban
              </button>
              <button
                data-testid="view-table-btn"
                onClick={() => setView("table")}
                className={`px-3 py-2 flex items-center gap-1.5 text-xs font-medium transition-colors
                  ${view === "table" ? "bg-[#0052CC] text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <List size={14} />
                Tableau
              </button>
            </div>
            {canWrite && (
              <button
                data-testid="new-demand-btn"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#0052CC] text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus size={15} />
                Nouvelle demande
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "Total", value: kpis.total, color: "text-slate-700", bg: "bg-slate-50 border-slate-200", testId: "kpi-total" },
            { label: "Nouvelles", value: kpis.nouvelles, color: "text-slate-600", bg: "bg-slate-50 border-slate-200", testId: "kpi-nouvelles" },
            { label: "Acceptées", value: kpis.acceptees, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", testId: "kpi-acceptees" },
            { label: "Critiques", value: kpis.critiques, color: "text-rose-700", bg: "bg-rose-50 border-rose-200", testId: "kpi-critiques" },
          ].map((k) => (
            <div key={k.testId} data-testid={k.testId} className={`rounded-xl border p-3 flex items-center gap-3 ${k.bg}`}>
              <div className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</div>
              <div className="text-xs text-slate-500 font-medium">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              data-testid="search-demands"
              type="text"
              placeholder="Rechercher…"
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            data-testid="filter-status"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 bg-white"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            {STATUS_COLS.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <select
            data-testid="filter-urgency"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 bg-white"
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
          >
            <option value="">Toutes urgences</option>
            <option value="critical">Critique</option>
            <option value="high">Élevé</option>
            <option value="medium">Moyen</option>
            <option value="low">Faible</option>
          </select>
          {view === "table" && (
            <select
              data-testid="sort-demands"
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 bg-white"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="created_at">Date création</option>
              <option value="urgency">Urgence</option>
              <option value="priority_score">Score priorité</option>
              <option value="budget">Budget</option>
            </select>
          )}
          {(filterStatus || filterUrgency || search) && (
            <button
              onClick={() => { setFilterStatus(""); setFilterUrgency(""); setSearch(""); }}
              className="text-xs text-slate-500 hover:text-rose-600 transition-colors"
            >
              Effacer filtres
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            Chargement…
          </div>
        ) : view === "kanban" ? (
          /* ─── KANBAN ─────────────────────────────────────────────────── */
          <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
            {STATUS_COLS.map((col) => (
              <KanbanColumn
                key={col.key}
                col={col}
                demands={byStatus[col.key] || []}
                onCardClick={setSelectedDemand}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                canWrite={canWrite}
              />
            ))}
          </div>
        ) : (
          /* ─── TABLE ──────────────────────────────────────────────────── */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-2/5">Demande</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Demandeur</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Urgence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Budget</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Créée</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d, i) => {
                  const urg = URGENCY_CFG[d.urgency] || URGENCY_CFG.medium;
                  const st  = STATUS_COLS.find((c) => c.key === d.status);
                  return (
                    <tr
                      key={d.demand_id}
                      data-testid={`table-row-${d.demand_id}`}
                      onClick={() => setSelectedDemand(d)}
                      className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 line-clamp-1">{d.title}</div>
                        {d.requester_department && (
                          <div className="text-xs text-slate-400 mt-0.5">{d.requester_department}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{d.requester}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${urg.cls}`}>
                          {d.urgency === "critical" && <Zap size={9} className="mr-0.5" />}
                          {urg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {st && (
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                            <span className="text-xs text-slate-600">{st.label}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{fmt(d.estimated_budget)}</td>
                      <td className="px-4 py-3 text-right">
                        {d.priority_score != null ? (
                          <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                            {d.priority_score}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400">
                        {new Date(d.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      Aucune demande trouvée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── DnD Quick Dialog ─────────────────────────────────────────────── */}
      {dndDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800">
              {dndDialog.action === "prioritize" ? "Score de priorité requis" : "Motif de refus requis"}
            </h3>
            {dndDialog.action === "prioritize" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Score (0–100)</label>
                <input
                  data-testid="dnd-priority-score"
                  type="number"
                  min="0"
                  max="100"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={dndPriorityScore}
                  onChange={(e) => setDndPriorityScore(Number(e.target.value))}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Motif de refus</label>
                <textarea
                  data-testid="dnd-refuse-reason"
                  rows={3}
                  className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm resize-none"
                  placeholder="Motif obligatoire..."
                  value={dndRefuseReason}
                  onChange={(e) => setDndRefuseReason(e.target.value)}
                />
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDndDialog(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                data-testid="dnd-confirm-btn"
                onClick={confirmDndDialog}
                className="px-4 py-2 bg-[#0052CC] text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modals ─────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <DemandModal
          demand={null}
          canWrite={canWrite}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); load(); }}
        />
      )}

      {selectedDemand && !convertDemand && (
        <DemandModal
          demand={selectedDemand}
          canWrite={canWrite}
          onClose={() => setSelectedDemand(null)}
          onSaved={() => { setSelectedDemand(null); load(); }}
          onConvert={() => { setConvertDemand(selectedDemand); setSelectedDemand(null); }}
        />
      )}

      {convertDemand && (
        <ConvertProjectModal
          demand={convertDemand}
          onClose={() => setConvertDemand(null)}
          onConverted={() => { setConvertDemand(null); load(); }}
        />
      )}
    </div>
  );
}
