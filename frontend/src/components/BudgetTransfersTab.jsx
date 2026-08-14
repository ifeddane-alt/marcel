import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { budgetOpsAPI, projectsAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";

const eur = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);

export const BudgetTransfersTab = () => {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("budget.edit") || hasPermission("*");
  const [projects, setProjects] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [form, setForm] = useState({ from_project_id: "", to_project_id: "", amount: "", reason: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    budgetOpsAPI.listTransfers().then((r) => setTransfers(r.data || [])).catch(() => {});
    projectsAPI.list().then((r) => setProjects(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      await budgetOpsAPI.createTransfer({ ...form, amount: parseFloat(form.amount) });
      toast.success(`Transfert de ${eur(parseFloat(form.amount))} effectué`);
      setForm({ from_project_id: "", to_project_id: "", amount: "", reason: "" });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors du transfert");
    } finally { setBusy(false); }
  };

  const valid = form.from_project_id && form.to_project_id && form.from_project_id !== form.to_project_id && parseFloat(form.amount) > 0;
  const src = projects.find((p) => p.project_id === form.from_project_id);

  return (
    <div className="space-y-4" data-testid="transfers-tab">
      {canEdit && (
        <div className="bg-white border border-[#e8e6f0] rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#26243a] flex items-center gap-2 mb-4">
            <ArrowRightLeft size={15} className="text-[#2e5fe8]" /> Nouveau transfert budgétaire
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8a87a0] mb-1">Depuis le projet</label>
              <select value={form.from_project_id} onChange={(e) => setForm({ ...form, from_project_id: e.target.value })}
                data-testid="transfer-from-select"
                className="w-full h-10 bg-[#fbfaff] border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm">
                <option value="">— Sélectionner —</option>
                {projects.map((p) => <option key={p.project_id} value={p.project_id}>{p.code ? `${p.code} — ` : ""}{p.name}</option>)}
              </select>
              {src && <p className="text-[10px] text-[#8a87a0] mt-1">Budget disponible : {eur(src.budget_total)}</p>}
            </div>
            <div className="md:col-span-4">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8a87a0] mb-1">Vers le projet</label>
              <select value={form.to_project_id} onChange={(e) => setForm({ ...form, to_project_id: e.target.value })}
                data-testid="transfer-to-select"
                className="w-full h-10 bg-[#fbfaff] border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm">
                <option value="">— Sélectionner —</option>
                {projects.filter((p) => p.project_id !== form.from_project_id).map((p) => (
                  <option key={p.project_id} value={p.project_id}>{p.code ? `${p.code} — ` : ""}{p.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8a87a0] mb-1">Montant (€)</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="100000" data-testid="transfer-amount-input"
                className="w-full h-10 bg-[#fbfaff] border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm" />
            </div>
            <div className="md:col-span-2">
              <button onClick={submit} disabled={!valid || busy} data-testid="transfer-submit-btn"
                className="w-full h-10 bg-[#2e5fe8] text-white text-sm font-bold rounded-[10px] hover:bg-[#2450c8] disabled:opacity-50">
                Transférer
              </button>
            </div>
            <div className="md:col-span-12">
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Motif du transfert (ex. réallocation suite au reforecast Q3)" data-testid="transfer-reason-input"
                className="w-full h-10 bg-[#fbfaff] border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm" />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#e8e6f0] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#f0eff6]">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Journal des transferts ({transfers.length})</span>
        </div>
        {transfers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#8a87a0]" data-testid="transfers-empty">Aucun transfert enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#8a87a0] border-b border-[#f0eff6]">
                  <th className="px-4 py-2">Date</th><th className="px-3 py-2">Mouvement</th>
                  <th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2">Motif</th><th className="px-3 py-2">Par</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.transfer_id} className="border-b border-[#f7f6fb] hover:bg-[#fbfaff]" data-testid={`transfer-row-${t.transfer_id}`}>
                    <td className="px-4 py-2.5 text-xs text-[#5d5a75]">{t.created_at?.slice(0, 10)}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-[13px]">
                        <span className="font-semibold text-[#cc4f45]">{t.from_project_name}</span>
                        <ArrowRight size={13} className="text-[#8a87a0]" />
                        <span className="font-semibold text-[#3f8a34]">{t.to_project_name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#26243a]">{eur(t.amount)}</td>
                    <td className="px-3 py-2.5 text-xs text-[#5d5a75] max-w-[260px] truncate" title={t.reason}>{t.reason || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-[#8a87a0]">{t.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
