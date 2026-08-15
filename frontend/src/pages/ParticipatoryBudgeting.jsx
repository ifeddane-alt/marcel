import React, { useState, useEffect, useCallback } from "react";
import { HandCoins, Plus, Trash2, X, Vote, BarChart3, Lock, CheckCircle2 } from "lucide-react";
import { pbAPI, safeAPI } from "@/api";
import { toast } from "sonner";
import { formatEuro } from "@/utils/format";
import { usePermissions } from "@/hooks/usePermissions";
import ConfirmDialog from "@/components/ConfirmDialog";

const inputCls = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600";
const labelCls = "block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5";
const ST_CFG = {
  open: { label: "Vote ouvert", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  closed: { label: "Clôturée", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  decided: { label: "Décidée", cls: "bg-blue-50 text-blue-700 border-blue-200" },
};
const CONSENSUS = {
  fort: { label: "Consensus fort", cls: "text-emerald-600" },
  moyen: { label: "Consensus moyen", cls: "text-amber-600" },
  faible: { label: "Fort désaccord", cls: "text-rose-600" },
};

function CreateModal({ onClose, onSave }) {
  const [mode, setMode] = useState("safe"); // safe | manual
  const [form, setForm] = useState({ name: "", envelope: "", deadline: "" });
  const [items, setItems] = useState([{ label: "", cost: "" }, { label: "", cost: "" }]);
  const [weighted, setWeighted] = useState(false);
  const [directionWeight, setDirectionWeight] = useState("2");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [trains, setTrains] = useState([]);
  const [pis, setPis] = useState([]);
  const [trainId, setTrainId] = useState("");
  const [piId, setPiId] = useState("");
  const [piFeatures, setPiFeatures] = useState(null);

  useEffect(() => {
    safeAPI.listTrains().then((r) => {
      setTrains(r.data || []);
      if (r.data?.length === 1) setTrainId(r.data[0].train_id);
    }).catch(() => setTrains([]));
  }, []);
  useEffect(() => {
    if (!trainId) { setPis([]); return; }
    safeAPI.listPIs({ train_id: trainId }).then((r) => setPis(r.data || [])).catch(() => setPis([]));
    setPiId("");
    setPiFeatures(null);
  }, [trainId]);
  useEffect(() => {
    if (!piId) { setPiFeatures(null); return; }
    safeAPI.piFeatures(piId).then((r) => setPiFeatures(r.data || [])).catch(() => setPiFeatures([]));
  }, [piId]);

  const totalCost = (piFeatures || []).reduce((s, f) => s + (f.cost_eur || 0), 0);
  const setItem = (i, k, v) => setItems((arr) => arr.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        envelope: parseFloat(form.envelope) || 0,
        weighted,
        direction_weight: parseFloat(directionWeight) || 2,
      };
      if (mode === "safe") {
        payload.pi_id = piId;
      } else {
        payload.items = items.filter((it) => it.label.trim()).map((it) => ({ label: it.label, cost: parseFloat(it.cost) || 0 }));
      }
      await onSave(payload);
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur");
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="pb-create-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-heading text-lg font-bold text-zinc-950">Nouvelle session de budget participatif</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden w-fit" data-testid="pb-mode-toggle">
            {[{ id: "safe", label: "Features d'un PI (SAFe)" }, { id: "manual", label: "Candidats libres" }].map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)} data-testid={`pb-mode-${m.id}`}
                className={`px-3.5 py-2 text-xs font-semibold transition-colors ${mode === m.id ? "bg-[#352c6e] text-white" : "bg-white text-zinc-500 hover:bg-zinc-50"}`}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className={labelCls}>Nom *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                placeholder="Arbitrage PI-2 2026" data-testid="pb-name-input" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Enveloppe (€) *</label>
              <input type="number" min="1" value={form.envelope} onChange={(e) => setForm({ ...form, envelope: e.target.value })} required
                data-testid="pb-envelope-input" className={`${inputCls} font-mono-data`} />
            </div>
            <div>
              <label className={labelCls}>Date limite</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                data-testid="pb-deadline-input" className={inputCls} />
            </div>
          </div>

          {mode === "safe" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Train (ART) *</label>
                  <select value={trainId} onChange={(e) => setTrainId(e.target.value)} required data-testid="pb-train-select" className={inputCls}>
                    <option value="">— Choisir un train —</option>
                    {trains.map((t) => <option key={t.train_id} value={t.train_id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Program Increment *</label>
                  <select value={piId} onChange={(e) => setPiId(e.target.value)} required disabled={!trainId} data-testid="pb-pi-select" className={inputCls}>
                    <option value="">— Choisir un PI —</option>
                    {pis.map((p) => <option key={p.pi_id} value={p.pi_id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              {piId && piFeatures !== null && (
                piFeatures.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-testid="pb-no-features-warning">
                    Aucune feature affectée à ce PI. Affectez les features depuis Trains SAFe → « Gérer les features ».
                  </p>
                ) : (
                  <div className="border border-zinc-100 rounded-lg overflow-hidden" data-testid="pb-pi-features-preview">
                    <div className="flex items-center justify-between px-3 py-2 bg-[#f7f6fb] text-[11px] font-semibold text-zinc-600">
                      <span>{piFeatures.length} features valorisées (charge × TJM ou budget saisi)</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, envelope: String(totalCost) }))}
                        data-testid="pb-use-total-btn" className="text-blue-600 hover:underline font-mono-data">
                        Total : {formatEuro(totalCost)}
                      </button>
                    </div>
                    <div className="max-h-44 overflow-y-auto divide-y divide-zinc-50">
                      {piFeatures.map((f) => (
                        <div key={f.task_id} className="flex items-center justify-between px-3 py-1.5 text-xs" data-testid={`pb-preview-feature-${f.task_id}`}>
                          <span className="text-zinc-700 truncate flex-1">
                            {f.name}{f.project_code ? <span className="font-mono-data text-[10px] text-zinc-400 ml-1">{f.project_code}</span> : null}
                            {f.wsjf != null && <span className="ml-1.5 px-1 py-px text-[9px] font-bold rounded bg-[#f0eefc] text-[#352c6e] font-mono-data">WSJF {f.wsjf}</span>}
                          </span>
                          <span className="font-mono-data text-zinc-500 ml-2 flex-shrink-0">{f.jh_planned || 0} jh · {formatEuro(f.cost_eur || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
          <div>
            <label className={labelCls}>Candidats (value streams / epics) *</label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={it.label} onChange={(e) => setItem(i, "label", e.target.value)}
                    placeholder={`Candidat ${i + 1} — ex : Value stream Digital Client`}
                    data-testid={`pb-item-label-${i}`} className={`${inputCls} flex-1`} />
                  <input type="number" min="0" value={it.cost} onChange={(e) => setItem(i, "cost", e.target.value)}
                    placeholder="Coût €" data-testid={`pb-item-cost-${i}`} className={`${inputCls} w-32 font-mono-data`} />
                  {items.length > 2 && (
                    <button type="button" onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}
                      className="p-1 text-zinc-300 hover:text-rose-500"><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setItems((arr) => [...arr, { label: "", cost: "" }])}
              data-testid="pb-add-item-btn"
              className="flex items-center gap-1 mt-2 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
              <Plus size={11} /> Ajouter un candidat
            </button>
          </div>
          )}
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div className="flex flex-wrap items-center gap-3 border border-zinc-100 rounded-lg p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 cursor-pointer">
              <input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} data-testid="pb-weighted-toggle" />
              Pondérer les votes par profil
            </label>
            {weighted && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                Poids des votes Direction (ADMIN / CIO) :
                <input type="number" min="1" step="0.5" value={directionWeight} onChange={(e) => setDirectionWeight(e.target.value)}
                  data-testid="pb-direction-weight-input"
                  className="w-16 text-sm border border-zinc-200 rounded-lg px-2 py-1 font-mono-data" />
                <span className="text-zinc-400">× (autres profils ×1)</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">Annuler</button>
            <button type="submit" disabled={saving} data-testid="pb-create-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? "..." : "Ouvrir le vote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VoteModal({ session, onClose, onVoted }) {
  const [detail, setDetail] = useState(null);
  const [alloc, setAlloc] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    pbAPI.get(session.session_id).then((r) => {
      setDetail(r.data);
      setAlloc(r.data.my_vote?.allocations || {});
    });
  }, [session.session_id]);
  if (!detail) return null;
  const total = Object.values(alloc).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const remaining = detail.envelope - total;
  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const clean = {};
      Object.entries(alloc).forEach(([k, v]) => { clean[k] = parseFloat(v) || 0; });
      await pbAPI.vote(session.session_id, clean);
      toast.success("Vote enregistré");
      onVoted();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur");
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="pb-vote-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="font-heading text-lg font-bold text-zinc-950">Ma répartition — {detail.name}</h2>
            <p className="text-[11px] text-zinc-400">Répartissez l'enveloppe de {formatEuro(detail.envelope)} sur les candidats</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {detail.items.map((it) => (
            <div key={it.item_id} className="flex items-center gap-3" data-testid={`pb-vote-item-${it.item_id}`}>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-zinc-800 truncate flex items-center gap-1.5">
                  <span className="truncate">{it.label}</span>
                  {it.wsjf != null && (
                    <span className="flex-shrink-0 px-1.5 py-px text-[9px] font-bold rounded bg-[#f0eefc] text-[#352c6e] border border-[#352c6e]/20 font-mono-data" data-testid={`pb-vote-wsjf-${it.item_id}`}>
                      WSJF {it.wsjf}
                    </span>
                  )}
                </div>
                {it.cost > 0 && <div className="font-mono-data text-[10px] text-zinc-400">coût estimé : {formatEuro(it.cost)}</div>}
              </div>
              <input type="number" min="0" step="1000" value={alloc[it.item_id] ?? ""}
                onChange={(e) => setAlloc((a) => ({ ...a, [it.item_id]: e.target.value }))}
                placeholder="0" data-testid={`pb-alloc-input-${it.item_id}`}
                className="w-32 text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-600 font-mono-data text-right" />
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[#ece9f4] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-[width]"
                style={{ width: `${Math.min(total / detail.envelope * 100, 100)}%`, background: remaining < 0 ? "#e11d48" : "#2e5fe8" }} />
            </div>
            <span className={`font-mono-data text-xs font-bold ${remaining < 0 ? "text-rose-600" : "text-zinc-700"}`} data-testid="pb-remaining">
              reste {formatEuro(remaining)}
            </span>
          </div>
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">Annuler</button>
            <button onClick={submit} disabled={saving || remaining < 0} data-testid="pb-vote-submit-btn"
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {saving ? "..." : detail.my_vote ? "Mettre à jour mon vote" : "Soumettre mon vote"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsModal({ session, onClose }) {
  const [res, setRes] = useState(null);
  useEffect(() => { pbAPI.results(session.session_id).then((r) => setRes(r.data)); }, [session.session_id]);
  if (!res) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="pb-results-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="font-heading text-lg font-bold text-zinc-950">Restitution — {res.session.name}</h2>
            <p className="text-[11px] text-zinc-400">
              {res.participation} votant{res.participation > 1 ? "s" : ""} · financement collectif moyen : {formatEuro(res.total_avg_allocated)} / {formatEuro(res.session.envelope)}
              {res.session.weighted && <span className="ml-1 text-[#5b4bc4] font-semibold">· moyenne pondérée (Direction ×{res.session.direction_weight})</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {res.session.mode === "safe" && res.participation > 0 && (
            <div className="flex items-center justify-between bg-[#f7f6fb] border border-[#e8e6f0] rounded-lg px-3 py-2 text-xs" data-testid="pb-cutline-summary">
              <span className="font-semibold text-[#352c6e]">
                Ligne de coupe : {res.retained_count} feature{res.retained_count > 1 ? "s" : ""} retenue{res.retained_count > 1 ? "s" : ""}
              </span>
              <span className="font-mono-data text-zinc-500">{formatEuro(res.retained_cost)} / {formatEuro(res.session.envelope)}</span>
            </div>
          )}
          {res.session.decision && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2" data-testid="pb-decision-applied">
              Arbitrage appliqué au scope le {new Date(res.session.decision.applied_at).toLocaleDateString("fr-FR")} : {res.session.decision.features_sec} sécurisée{res.session.decision.features_sec > 1 ? "s" : ""}, {res.session.decision.features_etendu} reportée{res.session.decision.features_etendu > 1 ? "s" : ""}
            </p>
          )}
          {res.participation === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6">Aucun vote soumis pour l'instant.</p>
          ) : res.items.map((it, rank) => (
            <div key={it.item_id} data-testid={`pb-result-item-${it.item_id}`}>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                <span className="text-xs font-semibold text-zinc-800">
                  <span className="font-mono-data text-zinc-400 mr-1.5">#{rank + 1}</span>{it.label}
                  {it.wsjf != null && (
                    <span className="ml-1.5 px-1.5 py-px text-[9px] font-bold rounded bg-[#f0eefc] text-[#352c6e] border border-[#352c6e]/20 font-mono-data">WSJF {it.wsjf}</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {it.consensus && <span className={`text-[10px] font-bold ${CONSENSUS[it.consensus].cls}`}>{CONSENSUS[it.consensus].label}</span>}
                  {res.session.mode === "safe" ? (
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${
                      it.retained ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 text-zinc-400 border-zinc-200"}`}
                      data-testid={`pb-retained-badge-${it.item_id}`}>
                      {it.retained ? "Retenue" : "Reportée"}
                    </span>
                  ) : (
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${
                    it.funded === "financé" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : it.funded === "partiel" ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-zinc-50 text-zinc-400 border-zinc-200"}`}>
                    {it.funded === "non_financé" ? "Non financé" : it.funded}
                  </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 bg-[#ece9f4] rounded-full overflow-hidden relative">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.min((it.avg_allocation / (res.session.envelope || 1)) * 100, 100)}%`,
                             background: it.funded === "financé" ? "#3f8a34" : it.funded === "partiel" ? "#e0a800" : "#c8c4d8" }} />
                </div>
                <span className="font-mono-data text-xs font-bold text-zinc-700 w-24 text-right">{formatEuro(it.avg_allocation)}</span>
              </div>
              <div className="font-mono-data text-[10px] text-zinc-400 mt-0.5">
                coût : {formatEuro(it.cost)}{it.funding_pct != null ? ` · couvert à ${it.funding_pct}%` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ParticipatoryBudgeting() {
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission("*", "portfolio.edit", "projects.create", "projects.edit");
  const [sessions, setSessions] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [voteSession, setVoteSession] = useState(null);
  const [resultsSession, setResultsSession] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    pbAPI.list().then((r) => setSessions(r.data)).catch(() => setSessions([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (data) => {
    await pbAPI.create(data);
    toast.success("Session ouverte — les participants peuvent voter");
    setCreateOpen(false);
    load();
  };
  const setStatus = async (s, status) => {
    const r = await pbAPI.update(s.session_id, { status });
    if (status === "decided" && r.data?.decision) {
      toast.success(`Arbitrage appliqué : ${r.data.decision.features_sec} feature(s) sécurisée(s), ${r.data.decision.features_etendu} reportée(s)`);
    } else {
      toast.success(status === "closed" ? "Vote clôturé" : "Répartition validée");
    }
    load();
  };
  const del = async () => {
    await pbAPI.remove(confirmDelete.session_id);
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="pb-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-extrabold text-[#26243a] flex items-center gap-2">
            <HandCoins size={20} className="text-[#352c6e]" /> Budget participatif
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Rituel SAFe LPM — répartition collective du budget entre value streams et epics</p>
        </div>
        {canManage && (
          <button onClick={() => setCreateOpen(true)} data-testid="btn-new-pb-session"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
            <Plus size={13} /> Nouvelle session
          </button>
        )}
      </div>

      {sessions === null ? (
        <div className="text-sm text-zinc-400 p-4">Chargement…</div>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-[#e8e6f0] rounded-xl p-12 text-center" data-testid="pb-empty">
          <HandCoins size={32} className="mx-auto text-zinc-200 mb-3" />
          <p className="text-sm text-zinc-400">Aucune session — créez la première session de budget participatif pour votre prochain PI.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sessions.map((s) => {
            const st = ST_CFG[s.status] || ST_CFG.open;
            return (
              <div key={s.session_id} className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4" data-testid={`pb-session-${s.session_id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-heading text-sm font-bold text-[#26243a]">{s.name}</div>
                    {s.mode === "safe" && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg bg-[#f0eefc] text-[#352c6e] border border-[#352c6e]/20" data-testid={`pb-pi-badge-${s.session_id}`}>
                        {s.train_name ? `${s.train_name} · ` : ""}{s.pi_name}
                      </span>
                    )}
                    <div className="font-mono-data text-[11px] text-zinc-400 mt-0.5">
                      Enveloppe {formatEuro(s.envelope)} · {s.items?.length || 0} {s.mode === "safe" ? "features" : "candidats"}
                      {s.deadline ? ` · échéance ${new Date(s.deadline).toLocaleDateString("fr-FR")}` : ""}
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border flex-shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-2 mt-3 text-[11px] text-zinc-500">
                  <Vote size={12} className="text-zinc-400" /> {s.votes_count} vote{s.votes_count > 1 ? "s" : ""} soumis
                  {s.my_vote_submitted && <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 size={11} /> vous avez voté</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  {s.status === "open" && (
                    <button onClick={() => setVoteSession(s)} data-testid={`pb-vote-btn-${s.session_id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Vote size={11} /> {s.my_vote_submitted ? "Modifier mon vote" : "Voter"}
                    </button>
                  )}
                  <button onClick={() => setResultsSession(s)} data-testid={`pb-results-btn-${s.session_id}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">
                    <BarChart3 size={11} /> Restitution
                  </button>
                  {canManage && s.status === "open" && (
                    <button onClick={() => setStatus(s, "closed")} data-testid={`pb-close-btn-${s.session_id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50">
                      <Lock size={11} /> Clôturer
                    </button>
                  )}
                  {canManage && s.status === "closed" && (
                    <button onClick={() => setStatus(s, "decided")} data-testid={`pb-decide-btn-${s.session_id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                      <CheckCircle2 size={11} /> {s.mode === "safe" ? "Appliquer l'arbitrage au scope" : "Valider la répartition"}
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => setConfirmDelete(s)} className="p-1.5 text-zinc-300 hover:text-rose-500 ml-auto"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onSave={create} />}
      {voteSession && <VoteModal session={voteSession} onClose={() => setVoteSession(null)}
        onVoted={() => { setVoteSession(null); load(); }} />}
      {resultsSession && <ResultsModal session={resultsSession} onClose={() => setResultsSession(null)} />}
      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={del}
        title="Supprimer la session" message={`Supprimer "${confirmDelete?.name}" et tous ses votes ?`} />
    </div>
  );
}
