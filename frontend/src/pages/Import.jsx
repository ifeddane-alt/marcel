import React, { useState, useRef } from "react";
import {
  Upload, FileText, CheckCircle2, AlertTriangle, Download,
  ChevronRight, RefreshCw, X, ArrowLeft,
} from "lucide-react";
import api from "@/api";

const ENTITIES = [
  {
    key: "projects",
    label: "Projets",
    desc: "Importer une liste de projets avec budget, dates, méthodo et statut RAG.",
    required: ["name", "methodology", "status_rag", "budget_total", "budget_forecast", "jh_planned", "start_date", "end_date_baseline", "end_date_forecast"],
  },
  {
    key: "tasks",
    label: "Tâches",
    desc: "Importer des tâches rattachées à des projets existants.",
    required: ["project_name", "name", "type"],
  },
  {
    key: "resources",
    label: "Ressources",
    desc: "Importer des ressources (collaborateurs) avec rôle et capacité.",
    required: ["name", "role"],
  },
];

const STEP_LABELS = ["Fichier", "Mapping", "Validation", "Résultat"];

export default function Import() {
  const [step, setStep] = useState(0);
  const [entity, setEntity] = useState("projects");
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [validationResult, setValidationResult] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef();

  const reset = () => {
    setStep(0); setFile(null); setPreview(null);
    setMapping({}); setValidationResult(null); setCommitResult(null); setError("");
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setError(""); }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(""); }
  };

  const downloadTemplate = async () => {
    const resp = await fetch(
      `${process.env.REACT_APP_BACKEND_URL}/api/import/template/${entity}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem("projetenne_token")}` } }
    );
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `template_${entity}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    if (!file) { setError("Veuillez sélectionner un fichier CSV."); return; }
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity", entity);
      const { data } = await api.post("/import/preview", fd);
      setPreview(data);
      setMapping(data.suggested_mapping || {});
      setStep(1);
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de l'analyse du fichier.");
    } finally { setLoading(false); }
  };

  const handleValidate = () => {
    if (!preview) return;
    const entityDef = ENTITIES.find((e) => e.key === entity);
    const errors = [];
    preview.preview_rows.forEach(({ row_num, data }) => {
      const mapped = {};
      Object.entries(mapping).forEach(([col, field]) => { if (field) mapped[field] = data[col] || ""; });
      entityDef.required.forEach((req) => {
        if (!mapped[req]) errors.push({ row: row_num, field: req, message: `Champ requis manquant : ${req}` });
      });
    });
    setValidationResult({ errors, preview_count: preview.preview_rows.length });
    setStep(2);
  };

  const handleCommit = async () => {
    if (!file || !preview) return;
    setLoading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity", entity);
      fd.append("mapping", JSON.stringify(mapping));
      const { data } = await api.post("/import/commit", fd);
      setCommitResult(data);
      setStep(3);
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de l'import.");
    } finally { setLoading(false); }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto" data-testid="import-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
          Import CSV
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Importez vos projets, tâches ou ressources depuis un fichier CSV.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8" data-testid="import-stepper">
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? "bg-emerald-500 text-white" :
                i === step ? "bg-[#0052CC] text-white" :
                "bg-gray-200 text-gray-500"
              }`}>
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`text-sm font-medium ${i === step ? "text-[#0052CC]" : i < step ? "text-emerald-600" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${i < step ? "bg-emerald-400" : "bg-gray-200"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded px-4 py-3 text-rose-700 text-sm" data-testid="import-error">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* STEP 0 — Upload */}
      {step === 0 && (
        <div className="space-y-5" data-testid="import-step-upload">
          {/* Entity selector */}
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
              Type de données à importer
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ENTITIES.map((ent) => (
                <button
                  key={ent.key}
                  onClick={() => setEntity(ent.key)}
                  data-testid={`entity-btn-${ent.key}`}
                  className={`text-left p-4 rounded border-2 transition-all ${
                    entity === ent.key
                      ? "border-[#0052CC] bg-blue-50"
                      : "border-gray-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className={`text-sm font-bold mb-1 ${entity === ent.key ? "text-[#0052CC]" : "text-slate-800"}`}>
                    {ent.label}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">{ent.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Template download */}
          <div className="flex items-center gap-3 bg-slate-50 border border-gray-200 rounded px-4 py-3">
            <FileText size={16} className="text-slate-500" />
            <span className="text-sm text-slate-600 flex-1">
              Téléchargez le template CSV avec les colonnes requises et un exemple de ligne.
            </span>
            <button
              onClick={downloadTemplate}
              data-testid="download-template-btn"
              className="flex items-center gap-1.5 text-sm text-[#0052CC] font-semibold hover:underline"
            >
              <Download size={14} /> Template {entity}.csv
            </button>
          </div>

          {/* Drag & Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInput.current.click()}
            data-testid="import-dropzone"
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
              dragOver ? "border-[#0052CC] bg-blue-50" :
              file ? "border-emerald-400 bg-emerald-50" :
              "border-gray-300 hover:border-slate-400 bg-white"
            }`}
          >
            <input ref={fileInput} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            {file ? (
              <div className="space-y-2">
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                <div className="text-sm font-semibold text-emerald-700">{file.name}</div>
                <div className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="text-xs text-rose-500 hover:underline flex items-center gap-1 mx-auto"
                >
                  <X size={12} /> Supprimer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload size={32} className="text-slate-400 mx-auto" />
                <div className="text-sm text-slate-500">
                  Glissez-déposez votre fichier CSV ici, ou <span className="text-[#0052CC] font-semibold">cliquez pour parcourir</span>
                </div>
                <div className="text-xs text-slate-400">Format attendu : .csv (séparateur , ou ;)</div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePreview}
              disabled={!file || loading}
              data-testid="btn-analyse"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <ChevronRight size={15} />}
              Analyser le fichier
            </button>
          </div>
        </div>
      )}

      {/* STEP 1 — Mapping */}
      {step === 1 && preview && (
        <div className="space-y-5" data-testid="import-step-mapping">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                Mapping des colonnes ({preview.total_rows} lignes détectées)
              </div>
              <span className="text-[11px] text-slate-400">{preview.columns.length} colonnes CSV</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {preview.columns.map((col) => (
                <div key={col} className="flex items-center gap-3 bg-gray-50 rounded px-3 py-2.5 border border-gray-100">
                  <span className="text-xs font-mono text-slate-600 flex-1 truncate" title={col}>{col}</span>
                  <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
                  <select
                    value={mapping[col] || ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value }))}
                    data-testid={`mapping-select-${col}`}
                    className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-[#0052CC] w-48"
                  >
                    <option value="">-- ignorer --</option>
                    {preview.entity_fields.map((f) => (
                      <option key={f} value={f}>
                        {f}{preview.required_fields.includes(f) ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">* Champs obligatoires</p>
          </div>

          {/* Preview table */}
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                Aperçu des 5 premières lignes
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="preview-table">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {preview.columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview_rows.map(({ row_num, data }) => (
                    <tr key={row_num} className="border-b border-gray-50 hover:bg-gray-50/50">
                      {preview.columns.map((col) => (
                        <td key={col} className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[150px] truncate" title={data[col]}>
                          {data[col] || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(0)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft size={14} /> Retour
            </button>
            <button
              onClick={handleValidate}
              data-testid="btn-valider"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] transition-colors"
            >
              <ChevronRight size={15} /> Valider le mapping
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — Validation */}
      {step === 2 && validationResult && (
        <div className="space-y-5" data-testid="import-step-validation">
          <div className="bg-white border border-gray-200 rounded shadow-sm p-5">
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4">
              Résultats de validation (aperçu 5 lignes)
            </div>
            {validationResult.errors.length === 0 ? (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded p-4">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <div>
                  <div className="text-sm font-semibold text-emerald-700">Aucune erreur détectée sur l'aperçu</div>
                  <div className="text-xs text-emerald-600 mt-0.5">
                    La validation complète sera effectuée lors de l'import ({preview?.total_rows} lignes au total).
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2" data-testid="validation-errors">
                {validationResult.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 bg-rose-50 border border-rose-100 rounded px-3 py-2.5">
                    <AlertTriangle size={14} className="text-rose-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <span className="font-semibold text-rose-700">Ligne {e.row}</span>
                      <span className="text-rose-500 mx-1">·</span>
                      <span className="font-mono text-rose-600">{e.field}</span>
                      <span className="text-slate-500 ml-1">: {e.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-gray-200 rounded p-4 flex items-center gap-3">
            <div className="text-sm text-slate-600 flex-1">
              <span className="font-semibold text-[#0F172A]">{preview?.total_rows} lignes</span> seront traitées.
              Les lignes en erreur seront ignorées, les lignes valides seront importées.
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft size={14} /> Retour
            </button>
            <button
              onClick={handleCommit}
              disabled={loading}
              data-testid="btn-importer"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-50 transition-colors"
            >
              {loading ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
              Lancer l'import
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Result */}
      {step === 3 && commitResult && (
        <div className="space-y-5" data-testid="import-step-result">
          <div className={`border rounded-lg p-6 ${commitResult.skipped === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-center gap-3 mb-4">
              {commitResult.skipped === 0
                ? <CheckCircle2 size={28} className="text-emerald-600" />
                : <AlertTriangle size={28} className="text-amber-600" />
              }
              <div>
                <div className={`text-lg font-bold ${commitResult.skipped === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                  Import terminé
                </div>
                <div className="text-sm text-slate-600">
                  {ENTITIES.find((e) => e.key === commitResult.entity)?.label} importés
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total traité", value: commitResult.total_rows, color: "text-slate-800" },
                { label: "Créés", value: commitResult.created, color: "text-emerald-700" },
                { label: "Ignorés", value: commitResult.skipped, color: commitResult.skipped > 0 ? "text-rose-600" : "text-slate-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-gray-200 rounded p-4 text-center">
                  <div className={`font-mono-data text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {commitResult.errors.length > 0 && (
            <div className="bg-white border border-gray-200 rounded shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100">
                <div className="text-xs uppercase tracking-widest text-rose-500 font-semibold">
                  Erreurs ({commitResult.errors.length})
                </div>
              </div>
              <div className="p-4 space-y-2 max-h-64 overflow-y-auto" data-testid="commit-errors">
                {commitResult.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-3 bg-rose-50 border border-rose-100 rounded px-3 py-2">
                    <AlertTriangle size={13} className="text-rose-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <span className="font-semibold text-rose-700">Ligne {e.row}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="font-mono text-slate-600">{e.field}</span>
                      <span className="text-slate-500 ml-1">: {e.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={reset}
              data-testid="btn-nouvel-import"
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-white text-sm font-semibold rounded hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={14} /> Nouvel import
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
