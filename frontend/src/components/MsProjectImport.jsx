import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, X, RefreshCw, CheckCircle2, Plus, Pencil, ArrowRight, Diamond, ListTodo } from "lucide-react";
import { msprojectAPI } from "@/api";
import { toast } from "sonner";

export default function MsProjectImport({ projects = [], onImported }) {
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("update");
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState(null);

  const reset = () => { setOpen(false); setFile(null); setProjectId(""); setDiff(null); setMode("update"); };

  const doAnalyze = async () => {
    if (!projectId || !file) return;
    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await msprojectAPI.analyze(projectId, fd);
      setDiff(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'analyse du fichier");
    } finally {
      setBusy(false);
    }
  };

  const doApply = async () => {
    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await msprojectAPI.importXml(projectId, fd);
      const d = res.data;
      toast.success(
        `Plan appliqué : ${d.tasks_created + d.milestones_created} créé(s), ${d.tasks_updated + d.milestones_updated} mis à jour, ${d.unchanged} inchangé(s)`
      );
      reset();
      onImported?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de l'import MS Project");
    } finally {
      setBusy(false);
    }
  };

  const doCreate = async () => {
    if (!file) return;
    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await msprojectAPI.importNew(fd);
      const { project, tasks_created, milestones_created } = res.data;
      toast.success(`Projet « ${project.name} » créé : ${tasks_created} tâche(s), ${milestones_created} jalon(s)`);
      reset();
      onImported?.();
      navigate(`/projects/${project.project_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec de la création du projet");
    } finally {
      setBusy(false);
    }
  };

  const TypeIcon = ({ type }) => type === "milestone"
    ? <Diamond size={11} className="text-violet-500 flex-shrink-0" />
    : <ListTodo size={11} className="text-blue-500 flex-shrink-0" />;

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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="font-heading font-bold text-zinc-950">
                {diff ? "Comparaison avant application" : "Importer un plan MS Project"}
              </h3>
              <button onClick={reset} data-testid="msproject-import-close-btn"
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400">
                <X size={16} />
              </button>
            </div>

            {!diff ? (
              <div className="px-5 py-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMode("update")} data-testid="msproject-mode-update"
                    className={`flex items-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border transition-colors ${
                      mode === "update" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    <Pencil size={13} /> Mettre à jour un projet
                  </button>
                  <button onClick={() => setMode("create")} data-testid="msproject-mode-create"
                    className={`flex items-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border transition-colors ${
                      mode === "create" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                    <Plus size={13} /> Créer un nouveau projet
                  </button>
                </div>

                {mode === "update" && (
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
                )}

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
                  {mode === "update"
                    ? "Le plan sera comparé au projet : les éléments existants sont mis à jour (pas de doublon), les nouveaux sont créés."
                    : "Un nouveau projet MARCEL sera créé avec les phases, tâches et jalons du fichier."}
                </p>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-3 overflow-y-auto" data-testid="msproject-diff">
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200" data-testid="diff-new-count">
                    {diff.new.length} nouveau(x)
                  </span>
                  <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200" data-testid="diff-updated-count">
                    {diff.updated.length} mis à jour
                  </span>
                  <span className="px-2 py-1 rounded-full bg-zinc-50 text-zinc-500 border border-zinc-200" data-testid="diff-unchanged-count">
                    {diff.unchanged_count} inchangé(s)
                  </span>
                  {diff.absent.length > 0 && (
                    <span className="px-2 py-1 rounded-full bg-zinc-50 text-zinc-400 border border-zinc-200" title="Éléments importés précédemment, absents de ce fichier — ils ne seront pas modifiés">
                      {diff.absent.length} absent(s) du fichier
                    </span>
                  )}
                </div>

                {diff.updated.length > 0 && (
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-amber-600 mb-1">Mises à jour</div>
                    <div className="space-y-1 max-h-44 overflow-y-auto border border-zinc-100 rounded-lg p-2">
                      {diff.updated.map((u, i) => (
                        <div key={i} className="text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-zinc-700">
                            <TypeIcon type={u.type} /> {u.name}
                          </div>
                          {u.changes.map((c, j) => (
                            <div key={j} className="flex items-center gap-1 pl-5 text-[11px] text-zinc-500">
                              {c.field} : <span className="font-mono">{c.old}</span>
                              <ArrowRight size={9} className="text-zinc-300" />
                              <span className="font-mono font-semibold text-zinc-700">{c.new}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {diff.new.length > 0 && (
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Créations</div>
                    <div className="space-y-0.5 max-h-36 overflow-y-auto border border-zinc-100 rounded-lg p-2">
                      {diff.new.map((n, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-600">
                          <TypeIcon type={n.type} /> {n.name}
                          <span className="text-[10.5px] text-zinc-400 font-mono ml-auto">
                            {n.type === "milestone" ? (n.start || n.finish || "") : `${n.start || "?"} → ${n.finish || "?"}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {diff.new.length === 0 && diff.updated.length === 0 && (
                  <p className="text-sm text-zinc-500" data-testid="diff-no-changes">
                    Aucun changement : le projet est déjà à jour avec ce fichier.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-100">
              {diff ? (
                <>
                  <button onClick={() => setDiff(null)} data-testid="msproject-back-btn"
                    className="px-4 py-2 text-sm border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50">
                    Retour
                  </button>
                  <button onClick={doApply} disabled={busy || (diff.new.length === 0 && diff.updated.length === 0)}
                    data-testid="msproject-apply-btn"
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {busy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Appliquer
                  </button>
                </>
              ) : (
                <>
                  <button onClick={reset}
                    className="px-4 py-2 text-sm border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50">
                    Annuler
                  </button>
                  {mode === "update" ? (
                    <button onClick={doAnalyze} disabled={busy || !projectId || !file}
                      data-testid="msproject-import-confirm-btn"
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {busy ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                      Analyser
                    </button>
                  ) : (
                    <button onClick={doCreate} disabled={busy || !file}
                      data-testid="msproject-create-btn"
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {busy ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                      Créer le projet
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
