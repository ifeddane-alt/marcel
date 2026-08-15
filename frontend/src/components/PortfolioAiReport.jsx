import React, { useState, useEffect, useCallback } from "react";
import { X, Sparkles, FileDown, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { portfolioAiAPI } from "@/api";
import { toast } from "sonner";

const TREND = {
  amelioration: { label: "En amélioration", icon: TrendingUp, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  stable: { label: "Stable", icon: Minus, cls: "bg-blue-50 text-blue-700 border-blue-200" },
  degradation: { label: "En dégradation", icon: TrendingDown, cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function PortfolioAiReport({ onClose }) {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    portfolioAiAPI.list().then((r) => {
      setReports(r.data);
      if (r.data.length > 0) {
        portfolioAiAPI.get(r.data[0].report_id).then((d) => setSelected(d.data)).catch(() => {});
      }
    }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await portfolioAiAPI.generate();
      toast.success("Rapport IA portefeuille généré");
      setSelected(r.data);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Échec de la génération");
    } finally {
      setGenerating(false);
    }
  };
  const downloadPdf = async (r) => {
    const res = await portfolioAiAPI.pdf(r.report_id);
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport_portefeuille_${r.week_label || ""}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const t = selected ? (TREND[selected.content?.tendance] || TREND.stable) : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="portfolio-ai-report-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-600" />
            <h2 className="font-heading text-lg font-bold text-zinc-950">Rapport IA — Portefeuille</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={generate} disabled={generating} data-testid="ptf-report-generate-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60">
              {generating ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? "Génération…" : "Générer"}
            </button>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" data-testid="ptf-report-close-btn"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {!selected ? (
            <div className="text-sm text-zinc-400 text-center py-10" data-testid="ptf-report-empty">
              Aucun rapport — cliquez sur « Générer » pour produire la synthèse IA consolidée du portefeuille.
              <br /><span className="text-[11px]">Un rapport est aussi généré automatiquement chaque lundi à 07h00.</span>
            </div>
          ) : (
            <div className="space-y-4" data-testid="ptf-report-content">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading text-sm font-bold text-m-ink">{selected.week_label}</span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${t.cls}`}>
                  <t.icon size={10} /> {t.label}
                </span>
                <button onClick={() => downloadPdf(selected)} data-testid="ptf-report-pdf-btn"
                  className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">
                  <FileDown size={11} /> PDF
                </button>
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed">{selected.content?.synthese}</p>
              {[["Points clés", "points_cles", "text-blue-700"], ["Alertes", "alertes", "text-rose-700"], ["Recommandations", "recommandations", "text-emerald-700"]].map(([title, key, cls]) =>
                (selected.content?.[key] || []).length > 0 && (
                  <div key={key}>
                    <div className={`text-[10px] uppercase tracking-widest font-bold mb-1.5 ${cls}`}>{title}</div>
                    <ul className="space-y-1">
                      {selected.content[key].map((it, i) => (
                        <li key={i} className="text-xs text-zinc-600 flex gap-1.5"><span className="text-zinc-300">•</span>{it}</li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
          )}
          {reports.length > 1 && (
            <div className="mt-5 pt-4 border-t border-zinc-100">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Historique</div>
              <div className="flex flex-wrap gap-1.5">
                {reports.map((r) => (
                  <button key={r.report_id}
                    onClick={() => portfolioAiAPI.get(r.report_id).then((d) => setSelected(d.data))}
                    className={`px-2 py-1 text-[11px] rounded-lg border transition-colors ${selected?.report_id === r.report_id ? "bg-violet-50 border-violet-300 text-violet-700 font-semibold" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    {r.week_label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
