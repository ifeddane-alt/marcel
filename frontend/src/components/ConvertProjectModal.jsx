import React, { useState, useEffect } from "react";
import { X, Briefcase } from "lucide-react";
import { demandsAPI, programsAPI } from "@/api";
import { toast } from "sonner";

function formatDate(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : d;
}

export default function ConvertProjectModal({ demand, onClose, onConverted }) {
  const today = new Date();
  const oneYear = new Date(today);
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState({
    name: demand?.title || "",
    description: demand?.description || "",
    status_rag: "green",
    budget_total: demand?.estimated_budget || "",
    start_date: formatDate(today),
    end_date_baseline: formatDate(oneYear),
    end_date_forecast: formatDate(oneYear),
    program_id: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    programsAPI.list().then((r) => setPrograms(r.data)).catch(() => {});
  }, []);

  function change(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleConvert() {
    if (!form.name.trim()) return toast.error("Le nom du projet est obligatoire");
    if (!form.start_date || !form.end_date_baseline) return toast.error("Les dates sont obligatoires");
    setLoading(true);
    try {
      const payload = {
        ...form,
        budget_total: form.budget_total ? parseFloat(form.budget_total) : undefined,
        program_id: form.program_id || undefined,
      };
      const res = await demandsAPI.convert(demand.demand_id, payload);
      toast.success("Projet créé avec succès !");
      onConverted(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors de la conversion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        data-testid="convert-project-modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
              <Briefcase size={16} className="text-teal-700" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Convertir en projet</h2>
          </div>
          <button
            data-testid="convert-modal-close"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[65vh]">
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            Les informations ci-dessous sont pré-remplies depuis la demande. Vous pouvez les ajuster avant de créer le projet.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nom du projet <span className="text-rose-500">*</span>
            </label>
            <input
              data-testid="convert-name-input"
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
            <textarea
              data-testid="convert-description-input"
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 resize-none"
              value={form.description}
              onChange={(e) => change("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Date de début <span className="text-rose-500">*</span>
              </label>
              <input
                data-testid="convert-start-date-input"
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
                value={form.start_date}
                onChange={(e) => change("start_date", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Date de fin (baseline) <span className="text-rose-500">*</span>
              </label>
              <input
                data-testid="convert-end-date-input"
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
                value={form.end_date_baseline}
                onChange={(e) => {
                  change("end_date_baseline", e.target.value);
                  change("end_date_forecast", e.target.value);
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Budget total (€)</label>
              <input
                data-testid="convert-budget-input"
                type="number"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
                placeholder="0"
                min="0"
                value={form.budget_total}
                onChange={(e) => change("budget_total", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Statut RAG</label>
              <select
                data-testid="convert-rag-select"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 bg-white"
                value={form.status_rag}
                onChange={(e) => change("status_rag", e.target.value)}
              >
                <option value="green">Vert</option>
                <option value="amber">Amber</option>
                <option value="red">Rouge</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Programme (optionnel)</label>
            <select
              data-testid="convert-program-select"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 bg-white"
              value={form.program_id}
              onChange={(e) => change("program_id", e.target.value)}
            >
              <option value="">— Aucun programme —</option>
              {programs.map((p) => (
                <option key={p.program_id} value={p.program_id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            data-testid="convert-modal-cancel"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            data-testid="convert-modal-confirm"
            onClick={handleConvert}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            <Briefcase size={14} />
            {loading ? "Création…" : "Créer le projet"}
          </button>
        </div>
      </div>
    </div>
  );
}
