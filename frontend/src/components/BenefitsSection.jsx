import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, Plus, Pencil, Trash2, X } from "lucide-react";
import { projectsAPI } from "@/api";
import { toast } from "sonner";
import { formatEuro } from "@/utils/format";
import ConfirmDialog from "@/components/ConfirmDialog";

const CATEGORIES = [
  { value: "financier", label: "Financier" },
  { value: "productivite", label: "Productivité" },
  { value: "qualite", label: "Qualité" },
  { value: "conformite", label: "Conformité" },
  { value: "autre", label: "Autre" },
];
const UNITS = [
  { value: "EUR", label: "€ (euros)" },
  { value: "JH", label: "JH (jours-homme)" },
  { value: "%", label: "% (pourcentage)" },
  { value: "autre", label: "Autre" },
];
const CAT_COLORS = {
  financier: "bg-emerald-50 text-emerald-700 border-emerald-200",
  productivite: "bg-blue-50 text-blue-700 border-blue-200",
  qualite: "bg-violet-50 text-violet-700 border-violet-200",
  conformite: "bg-amber-50 text-amber-700 border-amber-200",
  autre: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

function fmtValue(v, unit) {
  if (unit === "EUR") return formatEuro(v);
  if (unit === "%") return `${v} %`;
  if (unit === "JH") return `${Number(v).toLocaleString("fr-FR")} JH`;
  return Number(v).toLocaleString("fr-FR");
}

function BenefitModal({ benefit, onClose, onSave }) {
  const isEdit = !!benefit;
  const [label, setLabel] = useState(benefit?.label || "");
  const [category, setCategory] = useState(benefit?.category || "financier");
  const [unit, setUnit] = useState(benefit?.unit || "EUR");
  const [expected, setExpected] = useState(benefit?.expected_value ?? "");
  const [realized, setRealized] = useState(benefit?.realized_value ?? "");
  const [horizon, setHorizon] = useState(benefit?.horizon || "");
  const [comment, setComment] = useState(benefit?.comment || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        benefit_id: benefit?.benefit_id,
        label: label.trim(),
        category,
        unit,
        expected_value: parseFloat(expected) || 0,
        realized_value: parseFloat(realized) || 0,
        horizon,
        comment,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la sauvegarde");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="benefit-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600" />
            <h2 className="font-heading text-lg font-bold text-zinc-950">
              {isEdit ? "Modifier le bénéfice" : "Nouveau bénéfice attendu"}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Libellé *</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} required data-testid="benefit-label-input"
              placeholder="Ex : Réduction des coûts de licence"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Catégorie</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="benefit-category-select"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 bg-white">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Unité</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} data-testid="benefit-unit-select"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 bg-white">
                {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Valeur attendue</label>
              <input type="number" step="any" min="0" value={expected} onChange={(e) => setExpected(e.target.value)}
                data-testid="benefit-expected-input"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 font-mono-data" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Valeur réalisée</label>
              <input type="number" step="any" min="0" value={realized} onChange={(e) => setRealized(e.target.value)}
                data-testid="benefit-realized-input"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 font-mono-data" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Horizon</label>
            <input value={horizon} onChange={(e) => setHorizon(e.target.value)} data-testid="benefit-horizon-input"
              placeholder="Ex : 2027, 12 mois après MEP…"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Commentaire</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} data-testid="benefit-comment-input"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 resize-none" />
          </div>
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">Annuler</button>
            <button type="submit" disabled={saving} data-testid="benefit-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
              {saving ? "Sauvegarde..." : isEdit ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent, testId }) {
  return (
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4" data-testid={testId}>
      <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold mb-1">{label}</div>
      <div className={`font-mono-data font-bold text-xl ${accent || "text-zinc-950"}`}>{value}</div>
    </div>
  );
}

export default function BenefitsSection({ projectId, budgetTotal, canWrite }) {
  const [benefits, setBenefits] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    projectsAPI.getBenefits(projectId)
      .then((res) => { setBenefits(res.data.benefits || []); setSummary(res.data.summary || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const persist = async (list) => {
    const res = await projectsAPI.setBenefits(projectId, { benefits: list });
    setBenefits(res.data.benefits || []);
    setSummary(res.data.summary || null);
  };

  const handleSave = async (item) => {
    const list = item.benefit_id
      ? benefits.map((b) => (b.benefit_id === item.benefit_id ? item : b))
      : [...benefits, item];
    await persist(list);
    toast.success(item.benefit_id ? "Bénéfice mis à jour" : "Bénéfice ajouté");
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await persist(benefits.filter((b) => b.benefit_id !== confirmDelete.benefit_id));
      toast.success("Bénéfice supprimé");
      setConfirmDelete(null);
    } catch { toast.error("Erreur lors de la suppression"); }
    finally { setDeleting(false); }
  };

  if (loading) return <div className="p-6 text-sm text-zinc-400">Chargement du business case…</div>;

  const expected = summary?.expected_eur || 0;
  const realized = summary?.realized_eur || 0;
  const pct = summary?.realization_pct || 0;
  const roi = budgetTotal > 0 && expected > 0 ? Math.round((expected / budgetTotal) * 100) : null;

  return (
    <div className="space-y-4" data-testid="benefits-section">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Kpi label="Bénéfices attendus (€)" value={formatEuro(expected)} testId="benefits-kpi-expected" />
        <Kpi label="Bénéfices réalisés (€)" value={formatEuro(realized)} testId="benefits-kpi-realized" />
        <Kpi label="Taux de réalisation" value={`${pct}%`}
          accent={pct >= 100 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-zinc-950"}
          testId="benefits-kpi-pct" />
        <Kpi label="Bénéfices vs budget" value={roi !== null ? `${roi}%` : "—"}
          accent={roi !== null && roi >= 100 ? "text-emerald-600" : undefined}
          testId="benefits-kpi-roi" />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
          <div className="flex items-center gap-2 font-heading text-[13px] font-bold text-[#26243a]">
            <TrendingUp size={13} className="text-emerald-600" />
            Business case — bénéfices attendus vs réalisés ({benefits.length})
          </div>
          {canWrite && (
            <button onClick={() => { setEditing(null); setModalOpen(true); }} data-testid="btn-new-benefit"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={12} /> Nouveau bénéfice
            </button>
          )}
        </div>
        {benefits.length === 0 ? (
          <div className="px-5 py-10 text-sm text-zinc-400 text-center" data-testid="benefits-empty">
            Aucun bénéfice défini — ajoutez les bénéfices attendus du projet pour suivre la création de valeur.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#fbfaff] border-b border-[#e8e6f0] text-left">
                  {["Libellé", "Catégorie", "Attendu", "Réalisé", "Réalisation", "Horizon", "Commentaire", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[10.5px] uppercase tracking-wider font-bold text-[#8a87a0] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {benefits.map((b) => {
                  const bp = b.expected_value > 0 ? Math.min(Math.round((b.realized_value / b.expected_value) * 100), 999) : 0;
                  return (
                    <tr key={b.benefit_id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                      data-testid={`benefit-row-${b.benefit_id}`}>
                      <td className="px-3 py-2.5 font-medium text-zinc-800 text-xs">{b.label}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${CAT_COLORS[b.category] || CAT_COLORS.autre}`}>
                          {CATEGORIES.find((c) => c.value === b.category)?.label || b.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono-data text-xs text-zinc-700 whitespace-nowrap">{fmtValue(b.expected_value, b.unit)}</td>
                      <td className="px-3 py-2.5 font-mono-data text-xs text-zinc-700 whitespace-nowrap">{fmtValue(b.realized_value, b.unit)}</td>
                      <td className="px-3 py-2.5 min-w-[110px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-[#ece9f4] rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${Math.min(bp, 100)}%`, background: bp >= 100 ? "#3f8a34" : bp >= 50 ? "#e0a800" : "#2e5fe8" }} />
                          </div>
                          <span className="font-mono-data text-[10px] font-semibold text-zinc-600 w-9 text-right">{bp}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-zinc-500 whitespace-nowrap">{b.horizon || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-zinc-500 max-w-[220px] truncate" title={b.comment}>{b.comment || "—"}</td>
                      <td className="px-3 py-2.5">
                        {canWrite && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditing(b); setModalOpen(true); }} data-testid={`btn-edit-benefit-${b.benefit_id}`}
                              className="p-1 text-zinc-400 hover:text-blue-600 rounded-lg transition-colors"><Pencil size={12} /></button>
                            <button onClick={() => setConfirmDelete(b)} data-testid={`btn-delete-benefit-${b.benefit_id}`}
                              className="p-1 text-zinc-400 hover:text-rose-500 rounded-lg transition-colors"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <BenefitModal benefit={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} />
      )}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Supprimer le bénéfice"
        message={`Supprimer "${confirmDelete?.label}" du business case ?`}
      />
    </div>
  );
}
