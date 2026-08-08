import React, { useRef, useState } from "react";
import { Download, Upload, X, RefreshCw, CheckCircle2, AlertTriangle, PenLine, PlusCircle } from "lucide-react";
import { excelAPI } from "@/api";
import { toast } from "sonner";

const BTN = "flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 bg-white rounded hover:bg-gray-50 text-slate-600 transition-colors";

const ACTION_BADGE = {
  new: { label: "Nouveau", plural: "Nouveaux", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: PlusCircle },
  update: { label: "Mise à jour", plural: "Mises à jour", cls: "bg-blue-50 text-blue-700 border-blue-200", Icon: PenLine },
  error: { label: "Erreur", plural: "Erreurs", cls: "bg-rose-50 text-rose-700 border-rose-200", Icon: AlertTriangle },
};

export default function ExcelToolbar({ entity, label = "", onImported, canImport = true }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const suffix = label ? ` ${label}` : "";

  const doExport = async () => {
    try {
      setBusy(true);
      const res = await excelAPI.exportEntity(entity);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `MARCEL_${label || entity}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Échec de l'export Excel");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("file", f);
      const res = await excelAPI.importPreview(entity, fd);
      setPreview(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fichier illisible (.xlsx attendu)");
    } finally {
      setBusy(false);
    }
  };

  const doCommit = async () => {
    const validRows = preview.rows.filter((r) => r.action !== "error").map((r) => r.data);
    if (!validRows.length) return;
    try {
      setBusy(true);
      const res = await excelAPI.importCommit(entity, validRows);
      const { created, updated, skipped } = res.data;
      toast.success(`Import terminé : ${created} créé(s), ${updated} mis à jour${skipped ? `, ${skipped} ignoré(s)` : ""}`);
      setPreview(null);
      onImported?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'import");
    } finally {
      setBusy(false);
    }
  };

  const displayCols = preview?.columns?.slice(0, 5) || [];

  return (
    <>
      <button onClick={doExport} disabled={busy} data-testid={`excel-export-btn-${entity}`}
        className={BTN} title={`Exporter${suffix} en Excel`}>
        {busy ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
        Excel{suffix}
      </button>
      {canImport && (
        <>
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            data-testid={`excel-import-btn-${entity}`} className={BTN}
            title={`Importer${suffix} depuis Excel`}>
            <Upload size={14} /> Importer{suffix}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            data-testid={`excel-import-input-${entity}`} onChange={onFile} />
        </>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          data-testid="excel-import-modal">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-heading font-bold text-[#0F172A]">
                  Aperçu de l'import — {preview.label}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vérifiez les lignes détectées avant de confirmer. Les lignes en erreur seront ignorées.
                </p>
              </div>
              <button onClick={() => setPreview(null)} data-testid="excel-import-close-btn"
                className="p-1.5 rounded hover:bg-gray-100 text-slate-400">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-50">
              {["new", "update", "error"].map((k) => {
                const { label: bl, plural, cls, Icon } = ACTION_BADGE[k];
                return (
                  <span key={k} data-testid={`excel-preview-count-${k}`}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}>
                    <Icon size={11} /> {preview.counts[k]} {preview.counts[k] > 1 ? plural : bl}
                  </span>
                );
              })}
              <span className="ml-auto text-xs text-slate-400">{preview.total} ligne(s)</span>
            </div>

            <div className="flex-1 overflow-auto px-5 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-gray-100">
                    <th className="py-2 pr-2 font-semibold">Ligne</th>
                    <th className="py-2 pr-2 font-semibold">Action</th>
                    {displayCols.map((c) => (
                      <th key={c.field} className="py-2 pr-2 font-semibold">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const { label: bl, cls, Icon } = ACTION_BADGE[r.action];
                    return (
                      <React.Fragment key={r.row_num}>
                        <tr className="border-b border-gray-50" data-testid={`excel-preview-row-${r.row_num}`}>
                          <td className="py-1.5 pr-2 text-slate-400">{r.row_num}</td>
                          <td className="py-1.5 pr-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
                              <Icon size={10} /> {bl}
                            </span>
                          </td>
                          {displayCols.map((c) => (
                            <td key={c.field} className="py-1.5 pr-2 text-slate-700 max-w-[180px] truncate">
                              {String(r.data[c.field] ?? "—")}
                            </td>
                          ))}
                        </tr>
                        {r.errors?.length > 0 && (
                          <tr>
                            <td colSpan={2 + displayCols.length} className="pb-2 text-[11px] text-rose-600">
                              {r.errors.join(" · ")}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setPreview(null)} data-testid="excel-import-cancel-btn"
                className="px-4 py-2 text-sm border border-gray-200 rounded text-slate-600 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={doCommit}
                disabled={busy || preview.counts.new + preview.counts.update === 0}
                data-testid="excel-import-confirm-btn"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                {busy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmer l'import ({preview.counts.new + preview.counts.update})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
