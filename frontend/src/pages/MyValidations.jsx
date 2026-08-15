import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { lifecycleAPI } from "@/api";
import { toast } from "sonner";
import { Check, X, AlertTriangle } from "lucide-react";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const GATE_BADGES = {
  en_validation: { label: "En validation", cls: "bg-[#fdf6e3] text-[#8a6d1a]" },
  pret:          { label: "Prêt", cls: "bg-m-blue-soft text-m-blue" },
  go:            { label: "Go", cls: "bg-m-green-soft text-m-green" },
  go_reserves:   { label: "Go avec réserves", cls: "bg-[#d5efec] text-[#22766c]" },
  no_go:         { label: "No-Go", cls: "bg-m-red-soft text-m-red" },
  annule:        { label: "Annulé", cls: "bg-zinc-100 text-zinc-500" },
};
const VALIDATOR_CHIPS = {
  ARCHITECTE: { label: "Architecture", cls: "bg-[#eceafd] text-[#5b4bc4]" },
  SECURITE:   { label: "Sécurité", cls: "bg-m-red-soft text-[#a63c33]" },
  PMO:        { label: "PMO", cls: "bg-m-blue-soft text-m-blue" },
};

export default function MyValidations() {
  const [tab, setTab] = useState("reviews");
  const [reviews, setReviews] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [comments, setComments] = useState({});

  const load = useCallback(() => {
    lifecycleAPI.myReviews().then((r) => setReviews(r.data || [])).catch(() => {});
    lifecycleAPI.portfolio().then((r) => setPortfolio(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (item, status) => {
    try {
      await lifecycleAPI.reviewDeliverable(item.gate_id, item.deliverable.key, {
        status,
        comment: comments[`${item.gate_id}:${item.deliverable.key}`] || "",
      });
      toast.success("Avis enregistré");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const phaseLabel = (k) => portfolio?.phases?.find((p) => p.key === k)?.label || k;

  return (
    <div className="space-y-5" data-testid="validations-page">
      <div>
        <div className="text-xs text-m-muted">Accueil / <span className="text-m-primary font-semibold">Validations</span></div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-m-ink tracking-tight mt-1">Validations & passages de phase</h1>
      </div>

      <div className="border-b border-m-border-lav flex gap-5">
        {[
          { id: "reviews", label: `À valider (${reviews.length})` },
          { id: "portfolio", label: "Passages du portefeuille" },
        ].map((t) => (
          <button
            key={t.id}
            data-testid={`validations-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`pb-2 text-sm font-semibold ${tab === t.id ? "text-m-blue border-b-[3px] border-m-blue -mb-px" : "text-zinc-400 hover:text-zinc-600"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "reviews" && (
        <div className="space-y-3">
          {reviews.length === 0 && (
            <div className="bg-white border border-m-border rounded-xl p-6 text-sm text-zinc-400" data-testid="reviews-empty">
              Aucun livrable en attente de votre validation.
            </div>
          )}
          {reviews.map((item) => {
            const chip = VALIDATOR_CHIPS[item.deliverable.validator] || VALIDATOR_CHIPS.PMO;
            const rk = `${item.gate_id}:${item.deliverable.key}`;
            return (
              <div key={rk} data-testid={`review-item-${item.deliverable.key}`} className="bg-white border border-m-border rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <div className="font-semibold text-sm text-m-ink">{item.deliverable.label}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    <Link to={`/projects/${item.project_id}`} className="text-m-blue hover:underline" data-testid={`review-project-link-${item.deliverable.key}`}>
                      {item.project_code || item.project_name}
                    </Link>
                    {" · "}{phaseLabel(item.from_phase)} → {phaseLabel(item.to_phase)} · Cible : {fmtDate(item.target_date)}
                  </div>
                  {item.deliverable.provided ? (
                    <div className="text-xs text-zinc-500 mt-0.5">Référence : {item.deliverable.reference || "fournie sans lien"}</div>
                  ) : (
                    <div className="text-xs text-[#8a6d1a] mt-0.5">Livrable pas encore fourni par le chef de projet</div>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${chip.cls}`}>{chip.label}</span>
                <input
                  className="border border-m-border rounded-md px-2 py-1.5 text-xs w-44"
                  placeholder="Commentaire"
                  value={comments[rk] || ""}
                  onChange={(e) => setComments((c) => ({ ...c, [rk]: e.target.value }))}
                  data-testid={`review-comment-input-${item.deliverable.key}`}
                />
                <div className="flex gap-1.5">
                  <button data-testid={`review-valide-${item.deliverable.key}`} onClick={() => review(item, "valide")} disabled={!item.deliverable.provided} className="px-2.5 py-1.5 rounded-md bg-m-green-soft text-m-green text-xs font-semibold hover:opacity-80 disabled:opacity-40 inline-flex items-center gap-1"><Check size={13} /> Valider</button>
                  <button data-testid={`review-reserves-${item.deliverable.key}`} onClick={() => review(item, "valide_reserves")} disabled={!item.deliverable.provided} className="px-2.5 py-1.5 rounded-md bg-[#fdf6e3] text-[#8a6d1a] text-xs font-semibold hover:opacity-80 disabled:opacity-40 inline-flex items-center gap-1"><AlertTriangle size={13} /> Réserves</button>
                  <button data-testid={`review-refuse-${item.deliverable.key}`} onClick={() => review(item, "refuse")} disabled={!item.deliverable.provided} className="px-2.5 py-1.5 rounded-md bg-m-red-soft text-m-red text-xs font-semibold hover:opacity-80 disabled:opacity-40 inline-flex items-center gap-1"><X size={13} /> Refuser</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "portfolio" && portfolio && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" data-testid="phase-counts">
            {portfolio.phases.map((p) => (
              <div key={p.key} className="bg-white border border-m-border rounded-xl px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{p.label}</div>
                <div className="font-mono-data font-bold text-zinc-950 text-lg" data-testid={`phase-count-${p.key}`}>{portfolio.phase_counts[p.key] ?? 0}</div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-m-border rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-m-bg border-b border-m-border text-[10.5px] uppercase tracking-wider font-bold text-m-muted">
                  <th className="text-left px-4 py-2.5">Projet</th>
                  <th className="text-left px-4 py-2.5">Passage</th>
                  <th className="text-left px-4 py-2.5">Statut</th>
                  <th className="text-left px-4 py-2.5">Livrables</th>
                  <th className="text-left px-4 py-2.5">Date cible</th>
                  <th className="text-left px-4 py-2.5">Comité</th>
                  <th className="text-left px-4 py-2.5">Demandé par</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.gates.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-sm text-zinc-400" data-testid="portfolio-gates-empty">Aucun passage de phase demandé.</td></tr>
                )}
                {portfolio.gates.map((g) => {
                  const b = GATE_BADGES[g.status] || GATE_BADGES.en_validation;
                  return (
                    <tr key={g.gate_id} className="border-b border-[#f1eff8]" data-testid={`portfolio-gate-${g.gate_id}`}>
                      <td className="px-4 py-2.5">
                        <Link to={`/projects/${g.project_id}`} className="text-m-blue hover:underline font-medium">{g.project_code || g.project_name}</Link>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">{phaseLabel(g.from_phase)} → {phaseLabel(g.to_phase)}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${b.cls}`}>{b.label}</span></td>
                      <td className="px-4 py-2.5 font-mono-data">{g.validated_count}/{g.deliverable_count}</td>
                      <td className="px-4 py-2.5">{fmtDate(g.target_date)}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500">{g.governance ? `${g.governance.name} · ${fmtDate(g.governance.date_scheduled)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500">{g.requested_by_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
