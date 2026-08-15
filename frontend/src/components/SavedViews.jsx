import { useEffect, useState, useCallback } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { viewsAPI } from "@/api";
import { toast } from "sonner";

export const SavedViews = ({ page, getFilters, onApply }) => {
  const [views, setViews] = useState([]);
  const [selected, setSelected] = useState("");

  const load = useCallback(() => {
    viewsAPI.list(page).then((r) => setViews(r.data || [])).catch(() => {});
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const apply = (id) => {
    setSelected(id);
    const v = views.find((x) => x.view_id === id);
    if (v) onApply(v.filters || {});
  };

  const save = async () => {
    const name = window.prompt("Nom de la vue sauvegardée :");
    if (!name || !name.trim()) return;
    try {
      const r = await viewsAPI.save({ page, name: name.trim(), filters: getFilters() });
      toast.success(`Vue « ${name.trim()} » sauvegardée`);
      setViews((v) => [...v, r.data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(r.data.view_id);
    } catch { toast.error("Erreur de sauvegarde"); }
  };

  const remove = async () => {
    if (!selected) return;
    await viewsAPI.remove(selected).catch(() => {});
    setViews((v) => v.filter((x) => x.view_id !== selected));
    setSelected("");
  };

  return (
    <div className="flex items-center gap-1.5" data-testid="saved-views">
      <select
        value={selected}
        onChange={(e) => apply(e.target.value)}
        data-testid="saved-views-select"
        className="text-sm border border-zinc-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-m-blue max-w-[160px]"
      >
        <option value="">Mes vues…</option>
        {views.map((v) => <option key={v.view_id} value={v.view_id}>{v.name}</option>)}
      </select>
      <button onClick={save} title="Sauvegarder les filtres actuels" data-testid="saved-views-save-btn"
        className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg text-m-blue hover:bg-m-blue-soft bg-white">
        <Bookmark size={14} />
      </button>
      {selected && (
        <button onClick={remove} title="Supprimer cette vue" data-testid="saved-views-delete-btn"
          className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg text-zinc-400 hover:text-rose-500 bg-white">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};
