import React, { useState } from "react";
import { Sparkles, X, RefreshCw, Download, Mail, TrendingUp, TrendingDown, Minus, History } from "lucide-react";
import { aiReportAPI } from "@/api";
import { toast } from "sonner";

const TREND = {
  amelioration: { icon: TrendingUp, label: "En amélioration", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  stable: { icon: Minus, label: "Stable", cls: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  degradation: { icon: TrendingDown, label: "En dégradation", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function AiStatusReport({ projectId, projectName }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [generating, setGenerating] = useState(false);

  const openModal = async () => {
    setOpen(true);
    try {
      const r = await aiReportAPI.list(projectId);
      setHistory(r.data);
      if (r.data.length > 0 && !report) setReport(r.data[0]);
    } catch { setHistory([]); }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await aiReportAPI.generate(projectId);
      setReport(r.data);
      setHistory((h) => [r.data, ...h]);
      toast.success("Rapport de statut généré");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la génération du rapport");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const res = await aiReportAPI.pdf(projectId, report.report_id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `MARCEL_rapport_statut_${(projectName || "projet").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("Échec du téléchargement PDF"); }
  };

  const sendEmail = () => {
    const c = report.content;
    const body = [
      `Rapport de statut — ${report.project_name} (${report.week_label})`, "",
      "SYNTHÈSE", c.synthese, "",
      c.faits_marquants?.length ? "FAITS MARQUANTS\n" + c.faits_marquants.map((f) => `• ${f}`).join("\n") : "",
      c.alertes?.length ? "\nALERTES\n" + c.alertes.map((a) => `• ${a}`).join("\n") : "",
      c.prochaines_etapes?.length ? "\nPROCHAINES ÉTAPES\n" + c.prochaines_etapes.map((p) => `• ${p}`).join("\n") : "",
      "", "— Généré par MARCEL (pensez à joindre le PDF téléchargé)",
    ].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(`[MARCEL] Rapport de statut — ${report.project_name}`)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
  };

  const trend = report ? (TREND[report.content?.tendance] || TREND.stable) : TREND.stable;
  const TrendIcon = trend.icon;

  return (
    <>
      <button onClick={openModal} data-testid="btn-ai-report"
        className="flex items-center gap-1.5 px-3 py-2 border border-violet-300 bg-violet-50 text-violet-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-violet-100 transition-colors">
        <Sparkles size={13} /> <span className="hidden sm:inline">Rapport IA</span><span className="sm:hidden">IA</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="ai-report-modal">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-600" />
                <h3 className="font-heading font-bold text-zinc-950">Rapport de statut rédigé par IA</h3>
              </div>
              <button onClick={() => setOpen(false)} data-testid="ai-report-close"
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!report ? (
                <div className="text-center py-10">
                  <Sparkles size={32} className="mx-auto mb-3 text-violet-300" />
                  <p className="text-sm text-zinc-500 mb-1">Aucun rapport généré pour ce projet.</p>
                  <p className="text-xs text-zinc-400">L'IA rédige une synthèse exécutive à partir des données réelles : budget, jalons, risques, tâches.</p>
                </div>
              ) : (
                <div className="space-y-4" data-testid="ai-report-content">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-500">{report.week_label}</span>
                    <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${trend.cls}`} data-testid="ai-report-trend">
                      <TrendIcon size={11} /> {trend.label}
                    </span>
                    <span className="text-[11px] text-zinc-400 ml-auto">généré le {(report.created_at || "").slice(0, 10)} par {report.generated_by}</span>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-violet-700 mb-1.5">Synthèse exécutive</h4>
                    <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{report.content.synthese}</p>
                  </div>
                  {report.content.faits_marquants?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Faits marquants</h4>
                      <ul className="space-y-1">{report.content.faits_marquants.map((f, i) => (
                        <li key={i} className="text-sm text-zinc-600 flex gap-2"><span className="text-zinc-300">•</span>{f}</li>))}
                      </ul>
                    </div>
                  )}
                  {report.content.alertes?.length > 0 && (
                    <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-1.5">Alertes</h4>
                      <ul className="space-y-1">{report.content.alertes.map((a, i) => (
                        <li key={i} className="text-sm text-amber-900 flex gap-2"><span>•</span>{a}</li>))}
                      </ul>
                    </div>
                  )}
                  {report.content.prochaines_etapes?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Prochaines étapes</h4>
                      <ul className="space-y-1">{report.content.prochaines_etapes.map((p, i) => (
                        <li key={i} className="text-sm text-zinc-600 flex gap-2"><span className="text-zinc-300">→</span>{p}</li>))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {history.length > 1 && (
                <div className="mt-5 pt-4 border-t border-zinc-100">
                  <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                    <History size={11} /> Rapports précédents
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {history.map((h) => (
                      <button key={h.report_id} onClick={() => setReport(h)}
                        className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                          report?.report_id === h.report_id
                            ? "border-violet-400 bg-violet-50 text-violet-700 font-semibold"
                            : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                        {h.week_label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-zinc-100">
              {report && (
                <>
                  <button onClick={downloadPdf} data-testid="ai-report-pdf-btn"
                    className="flex items-center gap-1.5 px-3.5 py-2 text-sm border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50">
                    <Download size={13} /> PDF
                  </button>
                  <button onClick={sendEmail} data-testid="ai-report-email-btn"
                    className="flex items-center gap-1.5 px-3.5 py-2 text-sm border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50">
                    <Mail size={13} /> Envoyer par email
                  </button>
                </>
              )}
              <button onClick={generate} disabled={generating} data-testid="ai-report-generate-btn"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-60">
                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? "Rédaction en cours…" : report ? "Régénérer" : "Générer le rapport"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
