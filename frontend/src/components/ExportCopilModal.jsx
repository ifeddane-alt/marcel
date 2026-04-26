import React, { useState, useEffect } from "react";
import { Loader2, Presentation, Calendar, Building2 } from "lucide-react";
import Modal from "@/components/Modal";
import { exportAPI, governanceAPI } from "@/api";

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] bg-white";

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function ExportCopilModal({ isOpen, onClose, selectedProjectIds = [], selectedProjectNames = [], preGovernanceId = null }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ instanceName: "", instanceDate: today, governanceId: preGovernanceId || "", includeRoadmap: false });
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setForm({ instanceName: "", instanceDate: today, governanceId: preGovernanceId || "", includeRoadmap: false });
    setError("");
    governanceAPI.list().then((r) => setInstances(r.data)).catch(() => {});
  }, [isOpen, preGovernanceId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleExport = async () => {
    if (!form.instanceName.trim()) { setError("Le nom de l'instance est requis."); return; }
    if (!form.instanceDate) { setError("La date est requise."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await exportAPI.copil({
        project_ids: selectedProjectIds,
        instance_name: form.instanceName.trim(),
        instance_date: form.instanceDate,
        governance_id: form.governanceId || null,
        include_roadmap: form.includeRoadmap,
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Nommage identique au serveur : COPIL_[date]_[nom-slug].pptx
      const slug = form.instanceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      a.download = `COPIL_${form.instanceDate}_${slug}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError("Erreur lors de la génération du PPT. Vérifiez que des projets sont sélectionnés.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Générer un Export COPIL" size="md">
      <div className="space-y-4" data-testid="export-copil-form">
        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{error}</div>
        )}

        {/* Selected projects preview */}
        <div className="bg-[#EBF2FF] border border-[#0052CC]/20 rounded px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-widest text-[#0052CC] font-semibold mb-1.5">
            {selectedProjectIds.length} projet{selectedProjectIds.length !== 1 ? "s" : ""} sélectionné{selectedProjectIds.length !== 1 ? "s" : ""}
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedProjectNames.slice(0, 5).map((n, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-[#0052CC]/20 text-[10px] text-slate-700 font-medium">
                {n.split("—")[0].trim().slice(0, 30)}
              </span>
            ))}
            {selectedProjectNames.length > 5 && (
              <span className="text-[10px] text-slate-400">+{selectedProjectNames.length - 5} autres</span>
            )}
          </div>
        </div>

        <Field label="Nom de l'instance COPIL *" hint='Ex : "COPIL Transformation avril 2026", "Steering Committee SAP Q2"'>
          <input
            data-testid="export-copil-name"
            className={INPUT_CLS}
            value={form.instanceName}
            onChange={set("instanceName")}
            placeholder="COPIL Portefeuille — Avril 2026"
          />
        </Field>

        <Field label="Date du COPIL *">
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              data-testid="export-copil-date"
              type="date"
              className={`${INPUT_CLS} pl-8`}
              value={form.instanceDate}
              onChange={set("instanceDate")}
            />
          </div>
        </Field>

        <Field label="Rattachement à une instance de gouvernance" hint="Optionnel — filtre les décisions affichées dans le PPT">
          <div className="relative">
            <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              data-testid="export-copil-governance"
              className={`${INPUT_CLS} pl-8`}
              value={form.governanceId}
              onChange={set("governanceId")}
            >
              <option value="">Aucun rattachement (toutes les décisions)</option>
              {instances.map((g) => (
                <option key={g.governance_id} value={g.governance_id}>{g.name}</option>
              ))}
            </select>
          </div>
        </Field>

        <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="include-roadmap-toggle">
              <input
                type="checkbox"
                className="accent-[#0052CC] w-4 h-4"
                checked={form.includeRoadmap}
                onChange={(e) => setForm((f) => ({ ...f, includeRoadmap: e.target.checked }))}
                data-testid="include-roadmap-checkbox"
              />
              <span className="text-xs font-medium text-slate-600">Inclure slide Roadmap</span>
            </label>
            <p className="text-[11px] text-slate-400">
              ~{2 + (selectedProjectIds.length > 0 ? 3 : 0) + selectedProjectIds.length + (form.includeRoadmap ? 1 : 0)} slides
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button
              onClick={handleExport}
              disabled={loading}
              data-testid="export-copil-submit"
              className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Presentation size={14} />}
              {loading ? "Génération…" : "Générer le PPT"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
