import React, { useRef, useState } from "react";
import { FileUp, X, RefreshCw, CheckCircle2 } from "lucide-react";
import { msprojectAPI } from "@/api";
import { toast } from "sonner";

export default function MsProjectImport({ projects = [], onImported }) {
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const doImport = async () => {
    if (!projectId || !file) return;
    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await msprojectAPI.importXml(projectId, fd);
      const { tasks_created, milestones_created } = res.data;
      toast.success(`Plan importé : ${tasks_created} tâche(s), ${milestones_created} jalon(s) créé(s)`);
      setOpen(false);
      setFile(null);
      setProjectId("");
      onImported?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'import MS Project");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} data-testid="msproject-import-btn"
        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-zinc-200 bg-white rounded-lg hover:bg-zinc-50 text-zinc-600 transition-colors"
        title="Importer un plan Microsoft Project (.mpp ou .xml)">
        <FileUp size={14} /> MS Project
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          data-testid="msproject-import-modal">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="font-heading font-bold text-zinc-950">Importer un plan MS Project</h3>
              <button onClick={() => setOpen(false)} data-testid="msproject-import-close-btn"
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  Projet MARCEL cible
                </label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                  data-testid="msproject-import-project-select"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-600">
                  <option value="">— Choisir un projet —</option>
                  {projects.map((p) => (
                    <option key={p.project_id} value={p.project_id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                  Fichier Microsoft Project (.mpp ou .xml)
                </label>
                <button onClick={() => fileRef.current?.click()}
                  data-testid="msproject-import-file-btn"
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm border border-dashed border-zinc-300 rounded-lg text-zinc-500 hover:border-blue-600 hover:text-blue-600 transition-colors">
                  <FileUp size={14} />
                  {file ? file.name : "Choisir un fichier…"}
                </button>
                <input ref={fileRef} type="file" accept=".mpp,.xml" className="hidden"
                  data-testid="msproject-import-file-input"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              <p className="text-[11px] text-zinc-400">
                Les phases, tâches et jalons du plan seront créés dans le projet sélectionné.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-100">
              <button onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50">
                Annuler
              </button>
              <button onClick={doImport} disabled={busy || !projectId || !file}
                data-testid="msproject-import-confirm-btn"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {busy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Importer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
