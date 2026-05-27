import { useState, useEffect } from "react";
import { X, FileDown, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { statusReportAPI } from "../api";
import { toast } from "./ui/sonner";

const WEATHER_LEVELS = ["soleil", "nuage", "pluie", "orage", "gel"];

const WEATHER_CONFIG = {
  soleil: { emoji: "☀", label: "Sous contrôle",     bg: "bg-yellow-50",   border: "border-yellow-300", text: "text-yellow-700",  dot: "bg-yellow-400"  },
  nuage:  { emoji: "⛅", label: "Point d'attention", bg: "bg-slate-50",    border: "border-slate-300",  text: "text-slate-600",   dot: "bg-slate-400"   },
  pluie:  { emoji: "🌧", label: "Problème avéré",    bg: "bg-blue-50",     border: "border-blue-300",   text: "text-blue-700",    dot: "bg-blue-500"    },
  orage:  { emoji: "⛈", label: "Critique",           bg: "bg-red-50",      border: "border-red-300",    text: "text-red-700",     dot: "bg-red-500"     },
  gel:    { emoji: "❄", label: "Bloqué",             bg: "bg-indigo-50",   border: "border-indigo-300", text: "text-indigo-800",  dot: "bg-indigo-700"  },
};

const INDICATORS = [
  { key: "perimeter",    label: "Périmètre",           desc: "Écart scope vs snapshot figé" },
  { key: "budget",       label: "Budget",               desc: "Écart EAC vs budget initial" },
  { key: "calendar",     label: "Calendrier",           desc: "Jalons critiques en retard" },
  { key: "scope_change", label: "Changement de scope",  desc: "Changements vs scope transmis" },
];

function WeatherBadge({ level, onClick, size = "md" }) {
  const cfg = WEATHER_CONFIG[level] || WEATHER_CONFIG.gel;
  const sizeClass = size === "lg" ? "text-3xl py-3 px-4" : "text-xl py-2 px-3";
  return (
    <button
      onClick={onClick}
      title="Cliquer pour modifier"
      data-testid={`weather-badge-${level}`}
      className={`${sizeClass} rounded-lg border-2 ${cfg.bg} ${cfg.border} ${cfg.text} font-bold cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2`}
    >
      <span>{cfg.emoji}</span>
      <span className="text-sm font-semibold">{cfg.label}</span>
    </button>
  );
}

export default function StatusReportModal({ isOpen, onClose, project }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [comments, setComments] = useState({});

  useEffect(() => {
    if (isOpen && project?.project_id) {
      loadWeather();
    }
  }, [isOpen, project?.project_id]);

  async function loadWeather() {
    setLoading(true);
    try {
      const { data } = await statusReportAPI.getWeather(project.project_id);
      setWeather(data);
    } catch (e) {
      toast.error("Erreur lors du calcul de la météo");
    } finally {
      setLoading(false);
    }
  }

  function cycleWeather(key, currentLevel) {
    const idx = WEATHER_LEVELS.indexOf(currentLevel);
    const next = WEATHER_LEVELS[(idx + 1) % WEATHER_LEVELS.length];
    setOverrides(prev => ({ ...prev, [key]: next }));
  }

  function getEffectiveLevel(key) {
    return overrides[key] || weather?.[key]?.level || "gel";
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const payload = {};
      INDICATORS.forEach(({ key }) => {
        const overrideKey = `${key}_override`;
        const commentKey = `${key}_comment`;
        if (overrides[key]) payload[overrideKey] = overrides[key];
        payload[commentKey] = comments[key] || "";
      });

      const { data } = await statusReportAPI.generate(project.project_id, payload);
      const blob = new Blob([data], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `status_report_${project.name?.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Status Report généré !");
      onClose();
    } catch (e) {
      toast.error("Erreur lors de la génération du PPT");
    } finally {
      setGenerating(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Status Report</h2>
            <p className="text-sm text-slate-500 mt-0.5">{project?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
              <RefreshCw size={28} className="animate-spin" />
              <span>Calcul de la météo en cours…</span>
            </div>
          ) : (
            <>
              {/* Instruction */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>Météo calculée automatiquement. Cliquez sur un badge pour l'overrider. Ajoutez un commentaire sous chaque indicateur.</span>
              </div>

              {/* Grille météo */}
              <div className="grid grid-cols-2 gap-4">
                {INDICATORS.map(({ key, label, desc }) => {
                  const autoLevel = weather?.[key]?.level || "gel";
                  const effectiveLevel = getEffectiveLevel(key);
                  const isOverridden = overrides[key] && overrides[key] !== autoLevel;
                  const cfg = WEATHER_CONFIG[effectiveLevel] || WEATHER_CONFIG.gel;

                  return (
                    <div
                      key={key}
                      data-testid={`weather-indicator-${key}`}
                      className={`rounded-xl border-2 p-4 ${cfg.bg} ${cfg.border}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-700 text-sm">{label}</span>
                        {isOverridden && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-300">
                            Overridé
                          </span>
                        )}
                      </div>

                      <WeatherBadge
                        level={effectiveLevel}
                        size="lg"
                        onClick={() => cycleWeather(key, effectiveLevel)}
                      />

                      {weather?.[key]?.detail && (
                        <p className="text-xs text-slate-500 mt-2 italic">
                          {weather[key].detail}
                        </p>
                      )}

                      <textarea
                        data-testid={`weather-comment-${key}`}
                        placeholder="Commentaire CP (optionnel)…"
                        value={comments[key] || ""}
                        onChange={e => setComments(prev => ({ ...prev, [key]: e.target.value }))}
                        rows={2}
                        className="mt-3 w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white/80"
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-sm"
          >
            Annuler
          </button>
          <button
            data-testid="generate-status-report-btn"
            onClick={handleGenerate}
            disabled={generating || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
          >
            {generating ? <RefreshCw size={14} className="animate-spin" /> : <FileDown size={14} />}
            {generating ? "Génération…" : "Générer le PPT"}
          </button>
        </div>
      </div>
    </div>
  );
}
