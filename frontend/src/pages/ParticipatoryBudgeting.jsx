import React, { useState, useEffect, useCallback } from "react";
import { HandCoins, Plus, Trash2, X, Vote, BarChart3, Lock, CheckCircle2 } from "lucide-react";
import { pbAPI } from "@/api";
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
  const [form, setForm] = useState({ name: "", envelope: "", deadline: "" });
  const [items, setItems] = useState([{ label: "", cost: "" }, { label: "", cost: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const setItem = (i, k, v) => setItems((arr) => arr.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...form,
        envelope: parseFloat(form.envelope) || 0,
        items: items.filter((it) => it.label.trim()).map((it) => ({ label: it.label, cost: parseFloat(it.cost) || 0 })),
      });
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className={labelCls}>Nom *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                placeholder="PB PI-4 2026" data-testid="pb-name-input" className={inputCls} />
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
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
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
                <div className="text-xs font-semibold text-zinc-800 truncate">{it.label}</div>
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
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {res.participation === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6">Aucun vote soumis pour l'instant.</p>
          ) : res.items.map((it, rank) => (
            <div key={it.item_id} data-testid={`pb-result-item-${it.item_id}`}>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                <span className="text-xs font-semibold text-zinc-800">
                  <span className="font-mono-data text-zinc-400 mr-1.5">#{rank + 1}</span>{it.label}
                </span>
                <span className="flex items-center gap-2">
                  {it.consensus && <span className={`text-[10px] font-bold ${CONSENSUS[it.consensus].cls}`}>{CONSENSUS[it.consensus].label}</span>}
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${
                    it.funded === "financé" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : it.funded === "partiel" ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-zinc-50 text-zinc-400 border-zinc-200"}`}>
                    {it.funded === "non_financé" ? "Non financé" : it.funded}
                  </span>
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
    await pbAPI.update(s.session_id, { status });
    toast.success(status === "closed" ? "Vote clôturé" : "Répartition validée");
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
                    <div className="font-mono-data text-[11px] text-zinc-400 mt-0.5">
                      Enveloppe {formatEuro(s.envelope)} · {s.items?.length || 0} candidats
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
                      <CheckCircle2 size={11} /> Valider la répartition
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
