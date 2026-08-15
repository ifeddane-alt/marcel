import { useEffect, useState } from "react";
import { customFieldsAPI, projectsAPI } from "@/api";
import { toast } from "sonner";
import DateField from "@/components/ui/DateField";

export const CustomFieldsPanel = ({ project, canWrite }) => {
  const [defs, setDefs] = useState([]);
  const [values, setValues] = useState(project?.custom_fields || {});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    customFieldsAPI.defs().then((r) => setDefs(r.data || [])).catch(() => {});
  }, []);
  useEffect(() => { setValues(project?.custom_fields || {}); }, [project]);

  if (!defs.length) return null;

  const set = (key, v) => { setValues((x) => ({ ...x, [key]: v })); setDirty(true); };

  const save = async () => {
    try {
      await projectsAPI.update(project.project_id, { custom_fields: values });
      toast.success("Champs personnalisés enregistrés");
      setDirty(false);
    } catch { toast.error("Erreur d'enregistrement"); }
  };

  const inputCls = "w-full text-sm border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-m-blue";

  return (
    <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-5" data-testid="custom-fields-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="font-heading text-[13px] font-bold text-m-ink">Champs personnalisés</div>
        {canWrite && dirty && (
          <button onClick={save} data-testid="custom-fields-save-btn"
            className="px-2.5 py-1 rounded-lg bg-m-blue text-white text-[11px] font-semibold hover:bg-m-blue-dark">
            Enregistrer
          </button>
        )}
      </div>
      <div className="space-y-3">
        {defs.map((d) => (
          <div key={d.key} data-testid={`custom-field-${d.key}`}>
            <label className="block text-xs text-zinc-400 font-medium mb-1">{d.label}</label>
            {!canWrite ? (
              <div className="text-sm text-zinc-700">{values[d.key] ?? "—"}</div>
            ) : d.type === "select" ? (
              <select value={values[d.key] || ""} onChange={(e) => set(d.key, e.target.value)}
                className={`${inputCls} bg-white`} data-testid={`custom-field-input-${d.key}`}>
                <option value="">—</option>
                {(d.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : d.type === "date" ? (
              <DateField value={values[d.key] || ""} onChange={(v) => set(d.key, v)} testId={`custom-field-input-${d.key}`} />
            ) : (
              <input type={d.type === "number" ? "number" : "text"} value={values[d.key] ?? ""}
                onChange={(e) => set(d.key, d.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                className={inputCls} data-testid={`custom-field-input-${d.key}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
