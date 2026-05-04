import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Train, Target, Zap, BarChart3, ChevronDown, ChevronRight,
  Plus, Pencil, Trash2, Users, Calendar, CheckCircle2,
  AlertCircle, Clock, Circle, ArrowRight, Layout, TrendingUp,
} from "lucide-react";
import { safeAPI } from "@/api";
import Modal from "@/components/Modal";
import PIPlanning from "@/components/PIPlanning";
import OKRDashboard from "@/components/OKRDashboard";

// ─── Constantes ──────────────────────────────────────────────────────────────
const CAP_STATUS = {
  identified: { label: "Identifiée",   bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-300" },
  committed:  { label: "Committée",    bg: "bg-blue-50",     text: "text-blue-700",    border: "border-blue-300" },
  in_progress:{ label: "En cours",     bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-300" },
  done:       { label: "Terminée",     bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-300" },
};
const PI_STATUS = {
  planning:  { label: "Planification", color: "bg-slate-400" },
  active:    { label: "Actif",         color: "bg-emerald-500" },
  completed: { label: "Terminé",       color: "bg-blue-500" },
};
const STATUS_ORDER = ["identified", "committed", "in_progress", "done"];

function CapBadge({ status }) {
  const cfg = CAP_STATUS[status] || CAP_STATUS.identified;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function PIStatusDot({ status }) {
  const cfg = PI_STATUS[status] || PI_STATUS.planning;
  return <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${cfg.color}`} />;
}

// ─── Velocity bar ─────────────────────────────────────────────────────────────
function VelocityBar({ planned, actual }) {
  if (!planned) return null;
  const pct = actual != null ? Math.round((actual / planned) * 100) : null;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
        <span>Vélocité</span>
        <span>{actual != null ? `${actual}/${planned} pts` : `${planned} pts prévus`}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        {actual != null && (
          <div
            className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 80 ? "bg-blue-500" : "bg-amber-500"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Capability Card ─────────────────────────────────────────────────────────
function CapabilityCard({ cap, onEdit, onDelete }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group"
      data-testid={`cap-card-${cap.capability_id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-800 leading-tight truncate">{cap.name}</div>
          {cap.description && (
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{cap.description}</div>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={() => onEdit(cap)}
            className="p-1 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-colors">
            <Pencil size={11} />
          </button>
          <button onClick={() => onDelete(cap)}
            className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <CapBadge status={cap.status} />
        {cap.wsjf != null && (
          <span className="font-mono text-[10px] text-slate-500">WSJF {cap.wsjf}</span>
        )}
      </div>
    </div>
  );
}

// ─── Sprint Card ─────────────────────────────────────────────────────────────
function SprintCard({ sprint }) {
  const statusCfg = PI_STATUS[sprint.status] || PI_STATUS.planning;
  const fmt = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "—";
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3.5 shadow-sm" data-testid={`sprint-card-${sprint.sprint_id}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-sm text-slate-800">{sprint.name}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>
      <div className="text-xs text-slate-500 flex items-center gap-1">
        <Calendar size={10} />
        {fmt(sprint.start_date)} → {fmt(sprint.end_date)}
      </div>
      {sprint.capacity_jh && (
        <div className="text-xs text-slate-400 mt-1">
          Capacité : <strong className="text-slate-600">{sprint.capacity_jh} JH</strong>
        </div>
      )}
      <VelocityBar planned={sprint.velocity_planned} actual={sprint.velocity_actual} />
    </div>
  );
}

// ─── PI Panel ─────────────────────────────────────────────────────────────────
function PIPanel({ pi, onAddCapability, onEditCapability, onDeleteCapability }) {
  const [expanded, setExpanded] = useState(true);
  const statusCfg = PI_STATUS[pi.status] || PI_STATUS.planning;
  const fmt = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

  const capsByStatus = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = (pi.capabilities || []).filter(c => c.status === s);
    return acc;
  }, {});

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
      data-testid={`pi-panel-${pi.pi_id}`}>
      {/* PI Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/70 transition-colors border-b border-gray-100"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0052CC]/10 flex items-center justify-center flex-shrink-0">
            <Target size={18} className="text-[#0052CC]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">{pi.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Calendar size={10} />
              {fmt(pi.start_date)} — {fmt(pi.end_date)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">Capabilities</div>
            <div className="font-bold text-slate-800">{(pi.capabilities || []).length}</div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">Sprints</div>
            <div className="font-bold text-slate-800">{(pi.sprints || []).length}</div>
          </div>
          {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-5 space-y-5">
          {/* Objectifs PI */}
          {pi.objectives && pi.objectives.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Objectifs PI</div>
              <ul className="space-y-1">
                {pi.objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sprints */}
          {(pi.sprints || []).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">Iterations / Sprints</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {pi.sprints.map(s => <SprintCard key={s.sprint_id} sprint={s} />)}
              </div>
            </div>
          )}

          {/* Capabilities Board */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                Capabilities ({(pi.capabilities || []).length})
              </div>
              <button
                onClick={() => onAddCapability(pi)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0052CC] hover:text-[#0047B3] transition-colors"
                data-testid={`add-cap-btn-${pi.pi_id}`}
              >
                <Plus size={12} /> Ajouter
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {STATUS_ORDER.map(status => (
                <div key={status} className="space-y-2">
                  <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded text-center ${CAP_STATUS[status]?.bg} ${CAP_STATUS[status]?.text}`}>
                    {CAP_STATUS[status]?.label} ({capsByStatus[status].length})
                  </div>
                  {capsByStatus[status].map(cap => (
                    <CapabilityCard
                      key={cap.capability_id}
                      cap={cap}
                      onEdit={onEditCapability}
                      onDelete={onDeleteCapability}
                    />
                  ))}
                  {capsByStatus[status].length === 0 && (
                    <div className="text-center py-4 text-[11px] text-slate-300 border border-dashed border-gray-200 rounded">
                      Vide
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function CapabilityModal({ isOpen, onClose, trainId, pi, capability, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setForm(capability ? {
      name: capability.name || "",
      description: capability.description || "",
      status: capability.status || "identified",
      wsjf: capability.wsjf != null ? String(capability.wsjf) : "",
    } : { name: "", description: "", status: "identified", wsjf: "" });
    setErr("");
  }, [isOpen, capability]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Nom requis"); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        status: form.status,
        wsjf: form.wsjf ? Number(form.wsjf) : null,
        train_id: trainId,
        pi_id: pi?.pi_id,
      };
      if (capability) {
        await safeAPI.updateCapability(capability.capability_id, payload);
      } else {
        await safeAPI.createCapability(payload);
      }
      onSaved(); onClose();
    } catch (err) {
      setErr(err.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  };

  const INPUT = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC]";
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={capability ? "Modifier la capability" : "Nouvelle capability"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {err && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{err}</div>}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Nom *</label>
          <input className={INPUT} value={form.name || ""} onChange={set("name")} placeholder="Ex : Onboarding Client Digitalisé" data-testid="cap-form-name" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
          <textarea className={INPUT} rows={2} value={form.description || ""} onChange={set("description")} placeholder="Décrire la business value…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Statut</label>
            <select className={INPUT} value={form.status || "identified"} onChange={set("status")} data-testid="cap-form-status">
              {STATUS_ORDER.map(s => <option key={s} value={s}>{CAP_STATUS[s]?.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">WSJF</label>
            <input type="number" className={INPUT} value={form.wsjf || ""} onChange={set("wsjf")} min="0" step="0.5" placeholder="Ex : 8.5" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50"
            data-testid="cap-form-submit">
            {capability ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function TrainsSafe() {
  const { trainId } = useParams();
  const navigate = useNavigate();
  const [trains, setTrains] = useState([]);
  const [selectedTrainId, setSelectedTrainId] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "planning"
  const [activePIId, setActivePIId] = useState(null);

  // Capability modal state
  const [capModal, setCapModal] = useState({ open: false, pi: null, cap: null });

  const loadTrains = useCallback(async () => {
    try {
      const r = await safeAPI.listTrains();
      setTrains(r.data);
      setLoading(false);
      const firstId = trainId || (r.data[0]?.train_id);
      if (firstId) {
        setSelectedTrainId(firstId);
        setActivePIId(null);
      }
    } catch {
      setError("Erreur lors du chargement des trains");
      setLoading(false);
    }
  }, [trainId]);

  useEffect(() => { loadTrains(); }, [loadTrains]);

  useEffect(() => {
    if (!selectedTrainId) return;
    setLoadingOverview(true);
    safeAPI.getTrainOverview(selectedTrainId)
      .then(r => { setOverview(r.data); setLoadingOverview(false); })
      .catch(() => { setError("Erreur chargement overview"); setLoadingOverview(false); });
  }, [selectedTrainId]);

  const refreshOverview = () => {
    if (!selectedTrainId) return;
    setLoadingOverview(true);
    safeAPI.getTrainOverview(selectedTrainId)
      .then(r => { setOverview(r.data); setLoadingOverview(false); })
      .catch(() => setLoadingOverview(false));
  };

  const handleDeleteCapability = async (cap) => {
    if (!window.confirm(`Supprimer la capability "${cap.name}" ?`)) return;
    try {
      await safeAPI.deleteCapability(cap.capability_id);
      refreshOverview();
    } catch {}
  };

  if (loading) return <div className="p-8 text-slate-400 text-sm">Chargement des trains SAFe…</div>;
  if (error && trains.length === 0) return <div className="p-8 text-rose-600 text-sm">{error}</div>;

  const train = overview?.train;
  const summary = overview?.summary || {};

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="trains-safe-page">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] uppercase tracking-tight flex items-center gap-2">
            <Train size={26} className="text-[#0052CC]" />
            Trains SAFe
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Release Trains Agiles — Programmes Incrémentiels</p>
        </div>
      </div>

      {/* Sélecteur de train */}
      {trains.length > 1 && (
        <div className="flex gap-2 mb-6">
          {trains.map(t => (
            <button
              key={t.train_id}
              onClick={() => setSelectedTrainId(t.train_id)}
              data-testid={`train-tab-${t.train_id}`}
              className={`px-4 py-2 text-sm font-semibold rounded border transition-all ${
                selectedTrainId === t.train_id
                  ? "bg-[#0052CC] text-white border-[#0052CC]"
                  : "bg-white text-slate-600 border-gray-200 hover:border-[#0052CC] hover:text-[#0052CC]"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {trains.length === 0 && (
        <div className="bg-white border border-gray-200 rounded p-12 text-center">
          <Train size={32} className="mx-auto text-slate-300 mb-3" />
          <div className="text-slate-500 text-sm font-medium">Aucun train SAFe configuré</div>
          <div className="text-slate-400 text-xs mt-1">Les trains sont créés par les administrateurs SAFe.</div>
        </div>
      )}

      {train && (
        <>
          {/* Train Info + KPIs */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0052CC]/10 flex items-center justify-center flex-shrink-0">
                  <Train size={22} className="text-[#0052CC]" />
                </div>
                <div>
                  <div className="font-bold text-xl text-slate-800">{train.name}</div>
                  {train.vision && (
                    <div className="text-sm text-slate-500 mt-0.5 max-w-2xl italic">"{train.vision}"</div>
                  )}
                  {overview?.teams && overview.teams.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Users size={12} className="text-slate-400" />
                      {overview.teams.map(t => (
                        <span key={t.team_id} className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* KPI mini-cards */}
              <div className="flex gap-4 flex-shrink-0">
                {[
                  { label: "PIs", value: summary.total_pis, icon: Target },
                  { label: "Sprints", value: summary.total_sprints, icon: Zap },
                  { label: "Capabilities", value: summary.total_capabilities, icon: BarChart3 },
                  { label: "Équipes", value: summary.total_teams, icon: Users },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="text-center">
                    <div className="text-2xl font-bold text-slate-800 font-heading">{value}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1 justify-center">
                      <Icon size={9} />{label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Répartition capabilities */}
            {summary.caps_by_status && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-4 gap-3">
                {STATUS_ORDER.map(s => {
                  const count = summary.caps_by_status[s] || 0;
                  const total = summary.total_capabilities || 1;
                  const cfg = CAP_STATUS[s];
                  return (
                    <div key={s} className={`rounded-lg p-3 border text-center ${cfg.bg} ${cfg.border}`}>
                      <div className={`text-2xl font-bold font-heading ${cfg.text}`}>{count}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-widest ${cfg.text} opacity-80`}>
                        {cfg.label}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{Math.round(count/total*100)}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tabs : Overview | PI Planning | Dashboard Programme */}
          <div className="flex gap-1 mb-5 border-b border-gray-200">
            {[
              { id: "overview",   label: "Vue d'ensemble",       Icon: BarChart3 },
              { id: "planning",   label: "PI Planning",          Icon: Layout },
              { id: "dashboard",  label: "Dashboard Programme",  Icon: TrendingUp },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                data-testid={`train-tab-${id}`}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === id
                    ? "border-[#0052CC] text-[#0052CC]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Onglet Vue d'ensemble */}
          {activeTab === "overview" && (
            <>
              {loadingOverview ? (
                <div className="text-slate-400 text-sm py-8 text-center">Chargement…</div>
              ) : (
                <div className="space-y-5">
                  {(overview?.pis || []).map(pi => (
                    <PIPanel
                      key={pi.pi_id}
                      pi={pi}
                      onAddCapability={(pi) => setCapModal({ open: true, pi, cap: null })}
                      onEditCapability={(cap) => {
                        const pi = overview.pis.find(p => p.capabilities?.some(c => c.capability_id === cap.capability_id));
                        setCapModal({ open: true, pi, cap });
                      }}
                      onDeleteCapability={handleDeleteCapability}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Onglet PI Planning */}
          {activeTab === "planning" && (
            <div>
              {/* Sélecteur PI */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {(overview?.pis || []).map(pi => (
                  <button
                    key={pi.pi_id}
                    data-testid={`pi-select-btn-${pi.pi_id}`}
                    onClick={() => setActivePIId(pi.pi_id)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded border transition-all ${
                      activePIId === pi.pi_id
                        ? "bg-[#0052CC] text-white border-[#0052CC]"
                        : "bg-white text-slate-600 border-gray-200 hover:border-[#0052CC]"
                    }`}
                  >
                    {pi.name}
                  </button>
                ))}
                {!activePIId && overview?.pis?.length > 0 && (
                  <button
                    onClick={() => setActivePIId(overview.pis[0].pi_id)}
                    className="text-[#0052CC] text-sm underline"
                  >
                    Sélectionner un PI →
                  </button>
                )}
              </div>
              <PIPlanning
                trainId={selectedTrainId}
                piId={activePIId || overview?.pis?.[0]?.pi_id}
              />
            </div>
          )}

          {/* Onglet Dashboard Programme */}
          {activeTab === "dashboard" && (
            <OKRDashboard selectedTrainId={selectedTrainId} />
          )}
        </>
      )}

      {/* Modal Capability */}
      <CapabilityModal
        isOpen={capModal.open}
        onClose={() => setCapModal({ open: false, pi: null, cap: null })}
        trainId={selectedTrainId}
        pi={capModal.pi}
        capability={capModal.cap}
        onSaved={refreshOverview}
      />
    </div>
  );
}
