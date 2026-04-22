import React, { useEffect, useState, useCallback } from "react";
import {
  Target, TrendingUp, Zap, BarChart3, Plus, Pencil, Trash2,
  ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Clock,
  Award, Layers, RefreshCw, Info,
} from "lucide-react";
import { okrsAPI, safeAPI } from "@/api";
import Modal from "@/components/Modal";

// ─── Constantes ───────────────────────────────────────────────────────────────

const OKR_STATUS = {
  on_track: { label: "On track",  bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", dot: "bg-emerald-500" },
  at_risk:  { label: "À risque",  bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-300",   dot: "bg-amber-500" },
  behind:   { label: "En retard", bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-300",    dot: "bg-rose-500" },
  achieved: { label: "Atteint",   bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-300",    dot: "bg-blue-500" },
};

const CAP_STATUS_LABEL = {
  identified:  "Identifiée",
  committed:   "Committée",
  in_progress: "En cours",
  done:        "Terminée",
};

const WSJF_FIBONACCI = [1, 2, 3, 5, 8, 13, 21];

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] bg-white";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = OKR_STATUS[status] || OKR_STATUS.on_track;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ProgressRing({ pct, size = 40 }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize={size * 0.22} fontWeight="700" fill={color}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function KRProgressBar({ kr }) {
  const pct = kr.target_value > 0 ? Math.min((kr.current_value / kr.target_value) * 100, 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-slate-600 flex-1 pr-2 leading-snug">{kr.description}</span>
        <span className="font-mono text-[11px] text-slate-500 flex-shrink-0">
          {kr.current_value}/{kr.target_value} {kr.unit}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function WSJFScore({ value }) {
  if (value == null) return <span className="text-[11px] text-slate-400 italic">Non calculé</span>;
  const color = value >= 8 ? "text-emerald-700 bg-emerald-50 border-emerald-300"
    : value >= 4 ? "text-amber-700 bg-amber-50 border-amber-300"
    : "text-slate-600 bg-slate-50 border-slate-300";
  return (
    <span className={`font-mono font-bold text-sm px-2.5 py-1 rounded border inline-block ${color}`}>
      WSJF {value}
    </span>
  );
}

// ─── OKR Modal ────────────────────────────────────────────────────────────────

function OKRModal({ isOpen, onClose, okr, trains, capabilities, onSaved }) {
  const [form, setForm] = useState({});
  const [krs, setKrs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [selectedCaps, setSelectedCaps] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    if (okr) {
      setForm({
        objective: okr.objective || "",
        description: okr.description || "",
        status: okr.status || "on_track",
        train_id: okr.train_id || "",
      });
      setKrs((okr.key_results || []).map(kr => ({ ...kr })));
      setSelectedCaps(okr.linked_capability_ids || []);
    } else {
      setForm({ objective: "", description: "", status: "on_track", train_id: trains[0]?.train_id || "" });
      setKrs([]);
      setSelectedCaps([]);
    }
    setErr("");
  }, [isOpen, okr, trains]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const addKR = () => setKrs(ks => [...ks, { kr_id: null, description: "", target_value: 100, current_value: 0, unit: "%" }]);
  const removeKR = (i) => setKrs(ks => ks.filter((_, idx) => idx !== i));
  const setKR = (i, k, v) => setKrs(ks => ks.map((kr, idx) => idx === i ? { ...kr, [k]: v } : kr));

  const toggleCap = (capId) => setSelectedCaps(prev =>
    prev.includes(capId) ? prev.filter(id => id !== capId) : [...prev, capId]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.objective.trim()) { setErr("L'objectif est requis"); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        objective: form.objective.trim(),
        description: form.description || null,
        status: form.status,
        train_id: form.train_id || null,
        key_results: krs.map(kr => ({
          kr_id: kr.kr_id || null,
          description: kr.description,
          target_value: Number(kr.target_value) || 100,
          current_value: Number(kr.current_value) || 0,
          unit: kr.unit || "%",
        })),
        linked_capability_ids: selectedCaps,
      };
      if (okr) {
        await okrsAPI.update(okr.okr_id, payload);
      } else {
        await okrsAPI.create(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={okr ? "Modifier l'OKR" : "Nouvel OKR"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="okr-form">
        {err && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{err}</div>}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Objectif *</label>
          <input
            data-testid="okr-form-objective"
            className={INPUT_CLS}
            value={form.objective || ""}
            onChange={set("objective")}
            placeholder="Ex : Améliorer l'expérience digitale client"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
          <textarea className={INPUT_CLS} rows={2} value={form.description || ""} onChange={set("description")}
            placeholder="Contexte stratégique…" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Statut</label>
            <select data-testid="okr-form-status" className={INPUT_CLS} value={form.status || "on_track"} onChange={set("status")}>
              {Object.entries(OKR_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Train SAFe</label>
            <select className={INPUT_CLS} value={form.train_id || ""} onChange={set("train_id")} data-testid="okr-form-train">
              <option value="">— Tous les trains —</option>
              {trains.map(t => <option key={t.train_id} value={t.train_id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {/* Key Results */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-600">Key Results</label>
            <button type="button" onClick={addKR}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#0052CC] hover:text-[#0047B3]"
              data-testid="okr-add-kr-btn">
              <Plus size={11} /> Ajouter un KR
            </button>
          </div>
          <div className="space-y-2">
            {krs.map((kr, i) => (
              <div key={i} className="border border-gray-100 rounded p-3 bg-gray-50/50" data-testid={`kr-row-${i}`}>
                <div className="flex gap-2 mb-2">
                  <input
                    className={`${INPUT_CLS} flex-1`}
                    value={kr.description}
                    onChange={(e) => setKR(i, "description", e.target.value)}
                    placeholder="Description du key result…"
                    data-testid={`kr-desc-${i}`}
                  />
                  <button type="button" onClick={() => removeKR(i)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 mb-0.5 block">Valeur cible</label>
                    <input type="number" className={INPUT_CLS} value={kr.target_value}
                      onChange={(e) => setKR(i, "target_value", e.target.value)} min="0" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 mb-0.5 block">Valeur actuelle</label>
                    <input type="number" className={INPUT_CLS} value={kr.current_value}
                      onChange={(e) => setKR(i, "current_value", e.target.value)} min="0" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 mb-0.5 block">Unité</label>
                    <input className={INPUT_CLS} value={kr.unit}
                      onChange={(e) => setKR(i, "unit", e.target.value)} placeholder="%" />
                  </div>
                </div>
              </div>
            ))}
            {krs.length === 0 && (
              <div className="border border-dashed border-gray-200 rounded p-4 text-center text-[11px] text-slate-400">
                Aucun Key Result — cliquez sur "Ajouter un KR"
              </div>
            )}
          </div>
        </div>

        {/* Capabilities liées */}
        {capabilities.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Capabilities liées ({selectedCaps.length} sélectionnées)
            </label>
            <div className="max-h-36 overflow-y-auto border border-gray-200 rounded divide-y divide-gray-50">
              {capabilities.map(cap => (
                <label key={cap.capability_id}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${selectedCaps.includes(cap.capability_id) ? "bg-blue-50/50" : ""}`}
                  data-testid={`okr-cap-checkbox-${cap.capability_id}`}
                >
                  <input type="checkbox" className="accent-[#0052CC]"
                    checked={selectedCaps.includes(cap.capability_id)}
                    onChange={() => toggleCap(cap.capability_id)} />
                  <span className="text-xs text-slate-700 flex-1 line-clamp-1">{cap.name}</span>
                  <WSJFScore value={cap.wsjf} />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={saving} data-testid="okr-form-submit"
            className="px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50">
            {okr ? "Enregistrer" : "Créer l'OKR"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── WSJF Modal ───────────────────────────────────────────────────────────────

function WSJFModal({ isOpen, onClose, cap, onSaved }) {
  const [form, setForm] = useState({ business_value: 1, time_criticality: 1, risk_reduction: 1, job_size: 1 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isOpen || !cap) return;
    setForm({
      business_value:  cap.business_value  || 1,
      time_criticality: cap.time_criticality || 1,
      risk_reduction:  cap.risk_reduction  || 1,
      job_size:        cap.job_size        || 1,
    });
    setErr("");
  }, [isOpen, cap]);

  const setCost = (k) => (e) => setForm(f => ({ ...f, [k]: Number(e.target.value) }));

  const previewWSJF = () => {
    const { business_value: bv, time_criticality: tc, risk_reduction: rr, job_size: js } = form;
    if (bv && tc && rr && js) return ((bv + tc + rr) / js).toFixed(2);
    return "—";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cap) return;
    setSaving(true); setErr("");
    try {
      await okrsAPI.updateWSJF(cap.capability_id, form);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.detail || "Erreur lors de la mise à jour");
    } finally { setSaving(false); }
  };

  const FIELDS = [
    { key: "business_value",   label: "Business Value (BV)",      tooltip: "Impact business et valeur stratégique" },
    { key: "time_criticality", label: "Time Criticality (TC)",     tooltip: "Urgence et impact du délai" },
    { key: "risk_reduction",   label: "Risk Reduction / Enabler",  tooltip: "Réduction du risque ou valeur d'habilitateur" },
    { key: "job_size",         label: "Job Size (Durée)",          tooltip: "Estimation de l'effort (Fibonacci)" },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scoring WSJF" size="md">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="wsjf-form">
        {err && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{err}</div>}

        {cap && (
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Capability</div>
            <div className="font-bold text-slate-800 text-sm">{cap.name}</div>
          </div>
        )}

        <div className="bg-[#0052CC]/5 border border-[#0052CC]/20 rounded-lg p-4 text-center">
          <div className="text-[10px] uppercase tracking-widest text-[#0052CC] font-bold mb-1">
            WSJF = (BV + TC + RR) ÷ Job Size
          </div>
          <div className="text-3xl font-heading font-bold text-[#0052CC]">{previewWSJF()}</div>
        </div>

        <div className="space-y-3">
          {FIELDS.map(({ key, label, tooltip }) => (
            <div key={key}>
              <div className="flex items-center gap-1.5 mb-1">
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                <span className="text-[10px] text-slate-400 italic">({tooltip})</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {WSJF_FIBONACCI.map(v => (
                  <button
                    key={v}
                    type="button"
                    data-testid={`wsjf-${key}-${v}`}
                    onClick={() => setForm(f => ({ ...f, [key]: v }))}
                    className={`w-9 h-9 text-sm font-bold rounded border transition-all ${
                      form[key] === v
                        ? "bg-[#0052CC] text-white border-[#0052CC]"
                        : "bg-white text-slate-600 border-gray-200 hover:border-[#0052CC] hover:text-[#0052CC]"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={saving} data-testid="wsjf-form-submit"
            className="px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50">
            Calculer & Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── OKR Card ─────────────────────────────────────────────────────────────────

function OKRCard({ okr, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const krs = okr.key_results || [];
  const caps = okr.linked_capabilities || [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
      data-testid={`okr-card-${okr.okr_id}`}>
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <ProgressRing pct={okr.overall_progress || 0} size={52} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 text-sm leading-snug">{okr.objective}</span>
            <StatusBadge status={okr.status} />
          </div>
          {okr.description && (
            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{okr.description}</div>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            {krs.length > 0 && (
              <span className="text-[10px] text-slate-400">{krs.length} KR{krs.length > 1 ? "s" : ""}</span>
            )}
            {caps.length > 0 && (
              <span className="text-[10px] text-slate-400">{caps.length} capability{caps.length > 1 ? "s" : ""} liée{caps.length > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(okr); }}
            className="p-1.5 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-colors"
            data-testid={`okr-edit-${okr.okr_id}`}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(okr); }}
            className="p-1.5 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors"
            data-testid={`okr-delete-${okr.okr_id}`}
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronDown size={14} className="text-slate-400 ml-1" /> : <ChevronRight size={14} className="text-slate-400 ml-1" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/30">
          {/* Key Results */}
          {krs.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Key Results</div>
              {krs.map((kr, i) => <KRProgressBar key={i} kr={kr} />)}
            </div>
          )}

          {/* Capabilities liées */}
          {caps.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Capabilities liées</div>
              <div className="flex flex-wrap gap-2">
                {caps.map(cap => (
                  <div key={cap.capability_id}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded text-xs text-slate-700 shadow-sm">
                    <Layers size={10} className="text-slate-400" />
                    {cap.name}
                    <span className="text-[10px] text-slate-400">· {CAP_STATUS_LABEL[cap.status] || cap.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {krs.length === 0 && caps.length === 0 && (
            <div className="text-[11px] text-slate-400 italic text-center py-2">
              Aucun key result ni capability liée
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function OKRDashboard({ selectedTrainId }) {
  const [dashboard, setDashboard] = useState(null);
  const [okrs, setOkrs] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  // Modals
  const [okrModal, setOkrModal]   = useState({ open: false, okr: null });
  const [wsjfModal, setWsjfModal] = useState({ open: false, cap: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, okrsRes, trainRes, capsRes] = await Promise.all([
        okrsAPI.dashboard(),
        okrsAPI.list(selectedTrainId ? { train_id: selectedTrainId } : {}),
        import("@/api").then(m => m.safeAPI.listTrains()),
        safeAPI.listCapabilities(selectedTrainId ? { train_id: selectedTrainId } : {}),
      ]);
      setDashboard(dashRes.data);
      setOkrs(okrsRes.data);
      setTrains(trainRes.data);
      setCapabilities(capsRes.data);
    } catch (e) {
      console.error("OKR Dashboard load error", e);
    } finally {
      setLoading(false);
    }
  }, [selectedTrainId, refresh]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteOkr = async (okr) => {
    if (!window.confirm(`Supprimer l'OKR "${okr.objective}" ?`)) return;
    try {
      await okrsAPI.delete(okr.okr_id);
      setRefresh(r => r + 1);
    } catch (e) { console.error(e); }
  };

  const summary = dashboard?.summary || {};
  const topCaps = dashboard?.top_capabilities || [];
  const piVelocity = dashboard?.pi_velocity || [];
  const capsByStatus = dashboard?.caps_by_status || {};

  // Filtrer OKRs par train si sélectionné
  const filteredOkrs = selectedTrainId
    ? okrs.filter(o => !o.train_id || o.train_id === selectedTrainId)
    : okrs;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        <RefreshCw size={16} className="animate-spin mr-2" />
        Chargement du Dashboard Programme…
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="okr-dashboard">

      {/* ─── KPIs Programme ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: "Trains",      value: summary.total_trains,       icon: Award,       accent: "#0052CC" },
          { label: "PIs",         value: summary.total_pis,          icon: Target,      accent: "#7c3aed" },
          { label: "Sprints",     value: summary.total_sprints,      icon: Zap,         accent: "#0891b2" },
          { label: "Capabilities",value: summary.total_capabilities, icon: Layers,      accent: "#059669" },
          { label: "OKRs",        value: summary.total_okrs,         icon: TrendingUp,  accent: "#d97706" },
          { label: "WSJF Moyen",  value: summary.avg_wsjf || "—",    icon: BarChart3,   accent: "#dc2626" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            style={{ borderTopWidth: 3, borderTopColor: accent }}
            data-testid={`kpi-${label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{label}</span>
              <Icon size={13} style={{ color: accent }} />
            </div>
            <div className="font-heading text-2xl font-bold text-slate-800">{value ?? 0}</div>
          </div>
        ))}
      </div>

      {/* ─── Répartition capabilities + PI Velocity ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Caps by status */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-4">
            Capabilities par statut
          </div>
          {Object.keys(capsByStatus).length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">Aucune donnée</div>
          ) : (
            <div className="space-y-2.5">
              {[
                { key: "identified",  label: "Identifiées",  color: "#94a3b8" },
                { key: "committed",   label: "Committées",   color: "#3b82f6" },
                { key: "in_progress", label: "En cours",     color: "#f59e0b" },
                { key: "done",        label: "Terminées",    color: "#10b981" },
              ].map(({ key, label, color }) => {
                const count = capsByStatus[key] || 0;
                const total = summary.total_capabilities || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-24 flex-shrink-0">{label}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded flex items-center px-2 transition-all"
                        style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                      >
                        {pct > 10 && <span className="text-[10px] text-white font-bold">{count}</span>}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-slate-500 w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PI Velocity */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-4">
            Vélocité par PI
          </div>
          {piVelocity.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-4">Aucun PI trouvé</div>
          ) : (
            <div className="space-y-3">
              {piVelocity.map(pi => {
                const pct = pi.velocity_planned > 0 ? Math.round((pi.velocity_actual / pi.velocity_planned) * 100) : 0;
                return (
                  <div key={pi.pi_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-700 flex-1 truncate">{pi.pi_name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">
                        {pi.velocity_actual}/{pi.velocity_planned} pts · {pi.n_sprints} sprints
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-blue-500" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── OKRs ─────────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <TrendingUp size={16} className="text-[#0052CC]" />
              Objectifs & Key Results (OKR)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filteredOkrs.length} OKR{filteredOkrs.length !== 1 ? "s" : ""} défini{filteredOkrs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setOkrModal({ open: true, okr: null })}
            data-testid="create-okr-btn"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] transition-colors"
          >
            <Plus size={14} /> Nouvel OKR
          </button>
        </div>

        <div className="space-y-3" data-testid="okr-list">
          {filteredOkrs.map(okr => (
            <OKRCard
              key={okr.okr_id}
              okr={okr}
              onEdit={(o) => setOkrModal({ open: true, okr: o })}
              onDelete={handleDeleteOkr}
            />
          ))}
          {filteredOkrs.length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-lg py-12 text-center">
              <TrendingUp size={28} className="mx-auto text-slate-300 mb-3" />
              <div className="text-slate-500 text-sm font-medium">Aucun OKR défini</div>
              <div className="text-slate-400 text-xs mt-1 mb-4">Créez votre premier objectif stratégique</div>
              <button
                onClick={() => setOkrModal({ open: true, okr: null })}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3]"
              >
                <Plus size={13} /> Créer un OKR
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Top Capabilities WSJF ────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Top Capabilities — Score WSJF
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Info size={10} />
              WSJF = (Business Value + Time Criticality + Risk Reduction) ÷ Job Size
            </div>
          </div>
        </div>
        <div className="space-y-2" data-testid="wsjf-leaderboard">
          {topCaps.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-6">
              Aucune capability avec score WSJF. Cliquez sur "Scorer" pour calculer.
            </div>
          ) : (
            topCaps.map((cap, idx) => (
              <div key={cap.capability_id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50/70 transition-colors group"
                data-testid={`wsjf-cap-row-${cap.capability_id}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                  idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-slate-100 text-slate-600" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{cap.name}</div>
                  <div className="text-[10px] text-slate-400">
                    BV={cap.business_value} · TC={cap.time_criticality} · RR={cap.risk_reduction} · Size={cap.job_size}
                  </div>
                </div>
                <WSJFScore value={cap.wsjf} />
                <button
                  onClick={() => setWsjfModal({ open: true, cap })}
                  className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-[#0052CC] hover:text-[#0047B3] transition-all ml-1"
                  data-testid={`wsjf-edit-${cap.capability_id}`}
                >
                  <Pencil size={11} /> Scorer
                </button>
              </div>
            ))
          )}
        </div>

        {/* Bouton scorer une capability non encore scorée */}
        {capabilities.filter(c => c.wsjf == null).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
              Non scorées ({capabilities.filter(c => c.wsjf == null).length})
            </div>
            <div className="flex flex-wrap gap-2">
              {capabilities.filter(c => c.wsjf == null).slice(0, 6).map(cap => (
                <button
                  key={cap.capability_id}
                  onClick={() => setWsjfModal({ open: true, cap })}
                  data-testid={`wsjf-unscore-${cap.capability_id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 rounded text-xs text-slate-500 hover:border-[#0052CC] hover:text-[#0052CC] transition-colors"
                >
                  <Zap size={10} /> {cap.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ───────────────────────────────────────────────────────────── */}
      <OKRModal
        isOpen={okrModal.open}
        onClose={() => setOkrModal({ open: false, okr: null })}
        okr={okrModal.okr}
        trains={trains}
        capabilities={capabilities}
        onSaved={() => setRefresh(r => r + 1)}
      />
      <WSJFModal
        isOpen={wsjfModal.open}
        onClose={() => setWsjfModal({ open: false, cap: null })}
        cap={wsjfModal.cap}
        onSaved={() => setRefresh(r => r + 1)}
      />
    </div>
  );
}
