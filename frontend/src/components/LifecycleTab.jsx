import { useEffect, useState, useCallback } from "react";
import { lifecycleAPI, governanceAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Check, X, AlertTriangle, Plus, ChevronRight, Diamond, Trash2 } from "lucide-react";
import DateField from "@/components/ui/DateField";
import { EngagementPanel } from "@/components/EngagementPanel";

const GATE_BADGES = {
  en_validation: { label: "En validation", cls: "bg-[#fdf6e3] text-[#8a6d1a] border-[#eadfb8]" },
  pret:          { label: "Prêt pour le comité", cls: "bg-m-blue-soft text-m-blue border-[#c9d8fb]" },
  go:            { label: "Go", cls: "bg-m-green-soft text-m-green border-[#bfe0b6]" },
  go_reserves:   { label: "Go avec réserves", cls: "bg-[#d5efec] text-[#22766c] border-[#aedcd6]" },
  no_go:         { label: "No-Go", cls: "bg-m-red-soft text-m-red border-[#f3c1bc]" },
  annule:        { label: "Annulé", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};
const REVIEW_BADGES = {
  pending:         { label: "En attente", cls: "bg-zinc-100 text-zinc-500" },
  valide:          { label: "Validé", cls: "bg-m-green-soft text-m-green" },
  valide_reserves: { label: "Validé avec réserves", cls: "bg-[#fdf6e3] text-[#8a6d1a]" },
  refuse:          { label: "Refusé", cls: "bg-m-red-soft text-m-red" },
};
const VALIDATOR_CHIPS = {
  ARCHITECTE: { label: "Architecture", cls: "bg-[#eceafd] text-[#5b4bc4]" },
  SECURITE:   { label: "Sécurité", cls: "bg-m-red-soft text-[#a63c33]" },
  PMO:        { label: "PMO", cls: "bg-m-blue-soft text-m-blue" },
};
const VALIDATOR_PERMS = {
  ARCHITECTE: "lifecycle.review_architecture",
  SECURITE: "lifecycle.review_security",
  PMO: "lifecycle.review_pmo",
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

export const LifecycleTab = ({ projectId }) => {
  const { hasPermission } = usePermissions();
  const canRequest = hasPermission("lifecycle.request");
  const canDecide = hasPermission("lifecycle.decide");

  const [data, setData] = useState(null);
  const [governances, setGovernances] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ target_date: "", governance_id: "", mode: "existing", newName: "", newType: "copil", newDate: "" });
  const [refs, setRefs] = useState({});
  const [comments, setComments] = useState({});
  const [decisionComment, setDecisionComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    lifecycleAPI.project(projectId).then((r) => setData(r.data)).catch(() => {});
    governanceAPI.list().then((r) => setGovernances(r.data || [])).catch(() => {});
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="text-sm text-zinc-400 py-6">Chargement…</div>;

  const { phases, current_phase, gates } = data;
  const currentIdx = phases.findIndex((p) => p.key === current_phase);
  const phaseLabel = (k) => phases.find((p) => p.key === k)?.label || k;
  const openGate = gates.find((g) => ["en_validation", "pret"].includes(g.status));
  const govName = (id) => {
    const g = governances.find((x) => x.governance_id === id);
    return g ? `${g.name} · ${fmtDate(g.date_scheduled)}` : null;
  };
  const futureGovs = governances.filter((g) => g.status === "planifie");

  const requestGate = async () => {
    setBusy(true);
    const payload = { target_date: form.target_date };
    if (form.mode === "new" && form.newName && form.newDate) {
      payload.new_governance = { name: form.newName, type: form.newType, date_scheduled: form.newDate };
    } else if (form.governance_id) {
      payload.governance_id = form.governance_id;
    }
    try {
      await lifecycleAPI.requestGate(projectId, payload);
      toast.success("Demande de passage créée — valideurs notifiés");
      setShowModal(false);
      setForm({ target_date: "", governance_id: "", mode: "existing", newName: "", newType: "copil", newDate: "" });
      load();
    } catch (e) {
      const det = e.response?.data?.detail;
      if (e.response?.status === 422 && det?.mandatory_missing) {
        if (window.confirm(
          `Dossier d'engagement incomplet (prêt à ${det.score_pct}%).\n\nCritères obligatoires manquants :\n- ${det.mandatory_missing.join("\n- ")}\n\nPasser outre ? (dérogation tracée sur le passage)`)) {
          try {
            await lifecycleAPI.requestGate(projectId, { ...payload, readiness_override: true });
            toast.success("Demande créée avec dérogation de complétude");
            setShowModal(false);
            load();
          } catch (e2) { toast.error(e2.response?.data?.detail || "Erreur"); }
        }
      } else {
        toast.error(typeof det === "string" ? det : "Erreur lors de la demande");
      }
    } finally { setBusy(false); }
  };

  const saveDeliverable = async (gate, key, provided) => {
    try {
      await lifecycleAPI.updateDeliverable(gate.gate_id, key, {
        provided,
        reference: refs[`${gate.gate_id}:${key}`] ?? gate.deliverables.find((d) => d.key === key)?.reference ?? "",
      });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const review = async (gate, key, status) => {
    try {
      await lifecycleAPI.reviewDeliverable(gate.gate_id, key, { status, comment: comments[`${gate.gate_id}:${key}`] || "" });
      toast.success("Avis enregistré");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const decide = async (gate, outcome) => {
    if (outcome !== "no_go" && !gate.ready &&
        !window.confirm("Tous les livrables ne sont pas validés. Prononcer le Go vaudra dérogation tracée. Continuer ?")) return;
    try {
      await lifecycleAPI.decide(gate.gate_id, { outcome, comment: decisionComment });
      toast.success("Décision enregistrée");
      setDecisionComment("");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const cancelGate = async (gate) => {
    if (!window.confirm("Annuler cette demande de passage ?")) return;
    try { await lifecycleAPI.cancelGate(gate.gate_id); load(); } catch (e) { toast.error("Erreur"); }
  };

  return (
    <div className="space-y-5" data-testid="lifecycle-tab">
      <EngagementPanel projectId={projectId} />
      {/* Frise des phases */}
      <div className="bg-white border border-m-border rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-m-ink">Cycle de vie</h3>
          {canDecide && (
            <select
              data-testid="set-phase-select"
              className="text-xs border border-m-border rounded-md px-2 py-1.5 text-zinc-600"
              value={current_phase}
              onChange={async (e) => {
                await lifecycleAPI.setPhase(projectId, e.target.value).catch(() => toast.error("Erreur"));
                load();
              }}
            >
              {phases.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {phases.map((p, i) => (
            <div key={p.key} className="flex items-center gap-1.5">
              <span
                data-testid={`lifecycle-phase-${p.key}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  i < currentIdx ? "bg-m-green-soft text-m-green border-[#bfe0b6]"
                  : i === currentIdx ? "bg-m-primary text-white border-m-primary"
                  : "bg-white text-zinc-400 border-m-border"
                }`}
              >
                {p.label}
              </span>
              {i < phases.length - 1 && <ChevronRight size={13} className="text-zinc-300" />}
            </div>
          ))}
        </div>
        {canRequest && !openGate && currentIdx < phases.length - 1 && (
          <button
            data-testid="gate-request-btn"
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-m-blue text-white text-xs font-semibold hover:bg-m-blue-dark transition-colors"
          >
            <Plus size={14} /> Demander le passage → {phaseLabel(phases[currentIdx + 1]?.key)}
          </button>
        )}
      </div>

      {/* Gates */}
      {gates.length === 0 && (
        <div className="text-sm text-zinc-400 bg-white border border-m-border rounded-xl p-5" data-testid="lifecycle-no-gates">
          Aucun passage demandé pour ce projet.
        </div>
      )}
      {gates.map((gate) => {
        const badge = GATE_BADGES[gate.status] || GATE_BADGES.en_validation;
        const isOpen = ["en_validation", "pret"].includes(gate.status);
        return (
          <div key={gate.gate_id} data-testid={`gate-card-${gate.gate_id}`} className="bg-white border border-m-border rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Diamond size={16} className="text-m-primary" />
              <span className="font-heading font-bold text-m-ink text-sm">
                {phaseLabel(gate.from_phase)} → {phaseLabel(gate.to_phase)}
              </span>
              <span data-testid={`gate-status-${gate.gate_id}`} className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.cls}`}>{badge.label}</span>
              {gate.decision?.override && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#8a6d1a] font-semibold"><AlertTriangle size={12} /> Dérogation</span>
              )}
              <span className="text-xs text-zinc-400 ml-auto">
                Cible : {fmtDate(gate.target_date)}{gate.governance_id && govName(gate.governance_id) ? ` · Comité : ${govName(gate.governance_id)}` : ""}
              </span>
              {isOpen && canRequest && (
                <button data-testid={`gate-cancel-${gate.gate_id}`} onClick={() => cancelGate(gate)} className="text-zinc-300 hover:text-m-red" title="Annuler la demande">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-m-bg border-b border-m-border text-[10.5px] uppercase tracking-wider font-bold text-m-muted">
                  <th className="text-left px-3 py-2">Livrable</th>
                  <th className="text-left px-3 py-2">Valideur</th>
                  <th className="text-left px-3 py-2">Fourni / référence</th>
                  <th className="text-left px-3 py-2">Avis</th>
                  {isOpen && <th className="text-left px-3 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {gate.deliverables.map((d) => {
                  const chip = VALIDATOR_CHIPS[d.validator] || VALIDATOR_CHIPS.PMO;
                  const rb = REVIEW_BADGES[d.review_status] || REVIEW_BADGES.pending;
                  const canReviewThis = isOpen && hasPermission(VALIDATOR_PERMS[d.validator]) && d.provided && d.review_status === "pending";
                  const rk = `${gate.gate_id}:${d.key}`;
                  return (
                    <tr key={d.key} data-testid={`deliverable-row-${d.key}`} className="border-b border-[#f1eff8] align-top">
                      <td className="px-3 py-2.5 font-medium text-m-ink">{d.label}</td>
                      <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span></td>
                      <td className="px-3 py-2.5">
                        {isOpen && canRequest ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              data-testid={`deliverable-provided-${d.key}`}
                              checked={d.provided}
                              onChange={(e) => saveDeliverable(gate, d.key, e.target.checked)}
                            />
                            <input
                              data-testid={`deliverable-ref-${d.key}`}
                              className="border border-m-border rounded-md px-2 py-1 text-xs w-44"
                              placeholder="Lien / référence du document"
                              defaultValue={d.reference}
                              onChange={(e) => setRefs((r) => ({ ...r, [rk]: e.target.value }))}
                              onBlur={() => saveDeliverable(gate, d.key, d.provided)}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500">{d.provided ? (d.reference || "Fourni") : "Non fourni"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${rb.cls}`}>{rb.label}</span>
                        {d.review_comment && <div className="text-[11px] text-zinc-400 mt-1">{d.review_comment} — {d.reviewed_by_name}</div>}
                        {!d.review_comment && d.reviewed_by_name && <div className="text-[11px] text-zinc-400 mt-1">{d.reviewed_by_name}</div>}
                      </td>
                      {isOpen && (
                        <td className="px-3 py-2.5">
                          {canReviewThis ? (
                            <div className="space-y-1.5">
                              <input
                                data-testid={`review-comment-${d.key}`}
                                className="border border-m-border rounded-md px-2 py-1 text-xs w-40"
                                placeholder="Commentaire (optionnel)"
                                value={comments[rk] || ""}
                                onChange={(e) => setComments((c) => ({ ...c, [rk]: e.target.value }))}
                              />
                              <div className="flex gap-1">
                                <button data-testid={`review-btn-valide-${d.key}`} onClick={() => review(gate, d.key, "valide")} className="px-2 py-1 rounded-md bg-m-green-soft text-m-green text-[11px] font-semibold hover:opacity-80" title="Valider"><Check size={12} /></button>
                                <button data-testid={`review-btn-reserves-${d.key}`} onClick={() => review(gate, d.key, "valide_reserves")} className="px-2 py-1 rounded-md bg-[#fdf6e3] text-[#8a6d1a] text-[11px] font-semibold hover:opacity-80" title="Valider avec réserves"><AlertTriangle size={12} /></button>
                                <button data-testid={`review-btn-refuse-${d.key}`} onClick={() => review(gate, d.key, "refuse")} className="px-2 py-1 rounded-md bg-m-red-soft text-m-red text-[11px] font-semibold hover:opacity-80" title="Refuser"><X size={12} /></button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-300">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isOpen && canDecide && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#f1eff8]" data-testid={`gate-decision-bar-${gate.gate_id}`}>
                {!gate.ready && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#8a6d1a]"><AlertTriangle size={12} /> Livrables non tous validés</span>
                )}
                <input
                  data-testid="gate-decision-comment"
                  className="border border-m-border rounded-md px-2 py-1.5 text-xs flex-1 min-w-[180px]"
                  placeholder="Commentaire de décision (comité)"
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                />
                <button data-testid="gate-decision-go" onClick={() => decide(gate, "go")} className="px-3 py-1.5 rounded-lg bg-m-green text-white text-xs font-semibold hover:opacity-90">Go</button>
                <button data-testid="gate-decision-go-reserves" onClick={() => decide(gate, "go_reserves")} className="px-3 py-1.5 rounded-lg bg-[#22766c] text-white text-xs font-semibold hover:opacity-90">Go avec réserves</button>
                <button data-testid="gate-decision-nogo" onClick={() => decide(gate, "no_go")} className="px-3 py-1.5 rounded-lg bg-m-red text-white text-xs font-semibold hover:opacity-90">No-Go</button>
              </div>
            )}
            {gate.decision && (
              <div className="text-xs text-zinc-500" data-testid={`gate-decision-info-${gate.gate_id}`}>
                Décision : <b>{GATE_BADGES[gate.status]?.label}</b> par {gate.decision.decided_by_name} le {fmtDate(gate.decision.decided_at)}
                {gate.decision.comment ? ` — ${gate.decision.comment}` : ""}
              </div>
            )}
          </div>
        );
      })}

      {/* Modal demande de passage */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()} data-testid="gate-request-modal">
            <h3 className="font-heading font-bold text-m-ink">
              Demander le passage {phaseLabel(current_phase)} → {phaseLabel(phases[currentIdx + 1]?.key)}
            </h3>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-bold text-m-muted">Date de passage souhaitée</label>
              <DateField value={form.target_date} onChange={(v) => setForm((f) => ({ ...f, target_date: v }))} testId="gate-target-date" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider font-bold text-m-muted">Instance de gouvernance</label>
              <div className="flex gap-2 mt-1 mb-2">
                <button onClick={() => setForm((f) => ({ ...f, mode: "existing" }))} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${form.mode === "existing" ? "bg-m-blue-soft text-m-blue border-[#c9d8fb]" : "text-zinc-400 border-m-border"}`} data-testid="gate-gov-mode-existing">Comité existant</button>
                <button onClick={() => setForm((f) => ({ ...f, mode: "new" }))} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${form.mode === "new" ? "bg-m-blue-soft text-m-blue border-[#c9d8fb]" : "text-zinc-400 border-m-border"}`} data-testid="gate-gov-mode-new">Nouveau comité</button>
              </div>
              {form.mode === "existing" ? (
                <select
                  data-testid="gate-gov-select"
                  className="w-full border border-m-border rounded-md px-2 py-2 text-sm"
                  value={form.governance_id}
                  onChange={(e) => setForm((f) => ({ ...f, governance_id: e.target.value }))}
                >
                  <option value="">— Aucun (à rattacher plus tard) —</option>
                  {futureGovs.map((g) => (
                    <option key={g.governance_id} value={g.governance_id}>{g.name} · {fmtDate(g.date_scheduled)}</option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <input data-testid="gate-gov-new-name" className="w-full border border-m-border rounded-md px-2 py-2 text-sm" placeholder="Nom du comité (ex. COPIL Projet X)" value={form.newName} onChange={(e) => setForm((f) => ({ ...f, newName: e.target.value }))} />
                  <div className="flex gap-2">
                    <select data-testid="gate-gov-new-type" className="border border-m-border rounded-md px-2 py-2 text-sm" value={form.newType} onChange={(e) => setForm((f) => ({ ...f, newType: e.target.value }))}>
                      {["copil", "coproj", "comex", "codir", "steering", "autre"].map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                    </select>
                    <input data-testid="gate-gov-new-date" type="datetime-local" className="flex-1 border border-m-border rounded-md px-2 py-2 text-sm" value={form.newDate} onChange={(e) => setForm((f) => ({ ...f, newDate: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-50" data-testid="gate-modal-cancel">Annuler</button>
              <button onClick={requestGate} disabled={busy} className="px-3.5 py-2 rounded-lg bg-m-blue text-white text-xs font-semibold hover:bg-m-blue-dark disabled:opacity-50" data-testid="gate-modal-submit">
                {busy ? "Création…" : "Créer la demande"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
