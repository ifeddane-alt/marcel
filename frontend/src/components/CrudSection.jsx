import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";

const inputCls = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue";
const labelCls = "block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5";

function FieldInput({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <select value={value} onChange={onChange} data-testid={`crud-field-${field.key}`} className={`${inputCls} bg-white`}>
        {!field.required && <option value="">—</option>}
        {(field.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (field.type === "textarea") {
    return <textarea value={value} onChange={onChange} rows={2} data-testid={`crud-field-${field.key}`} className={`${inputCls} resize-none`} />;
  }
  return (
    <input type={field.type || "text"} value={value} onChange={onChange} required={field.required}
      placeholder={field.placeholder} data-testid={`crud-field-${field.key}`}
      step={field.type === "number" ? "any" : undefined}
      className={`${inputCls} ${field.type === "number" ? "font-mono-data" : ""}`} />
  );
}

function CrudModal({ item, fields, title, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const f = {};
    fields.forEach((fl) => { f[fl.key] = item?.[fl.key] ?? fl.default ?? ""; });
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {};
    fields.forEach((fl) => {
      let v = form[fl.key];
      if (fl.type === "number") v = v === "" ? null : parseFloat(v);
      else if (v === "") v = null;
      payload[fl.key] = v;
    });
    try {
      await onSave(payload);
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la sauvegarde");
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="crud-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-heading text-lg font-bold text-zinc-950">{item ? `Modifier — ${title}` : title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((fl) => (
              <div key={fl.key} className={fl.full ? "sm:col-span-2" : ""}>
                <label className={labelCls}>{fl.label}{fl.required ? " *" : ""}</label>
                <FieldInput field={fl} value={form[fl.key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [fl.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">Annuler</button>
            <button type="submit" disabled={saving} data-testid="crud-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark disabled:opacity-60">
              {saving ? "..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Section CRUD générique : table + modal add/edit + delete.
 * columns: [{key, label, render?(item)}] — fields: [{key, label, type, options, required, full, default}]
 */
export default function CrudSection({ title, addLabel, api, idField, columns, fields, canWrite, emptyText, testPrefix, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    api.list().then((r) => { setItems(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const save = async (data) => {
    if (modal?.item) {
      await api.update(modal.item[idField], data);
      toast.success("Enregistré");
    } else {
      await api.create(data);
      toast.success("Créé");
    }
    setModal(null);
    load();
    onChanged?.();
  };
  const del = async () => {
    await api.remove(confirmDelete[idField]);
    toast.success("Supprimé");
    setConfirmDelete(null);
    load();
    onChanged?.();
  };

  return (
    <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]" data-testid={`${testPrefix}-section`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
        <div className="font-heading text-[13px] font-bold text-m-ink">{title} ({items.length})</div>
        {canWrite && (
          <button onClick={() => setModal({})} data-testid={`${testPrefix}-add-btn`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-m-blue text-white text-xs font-semibold rounded-lg hover:bg-m-blue-dark">
            <Plus size={12} /> {addLabel || "Ajouter"}
          </button>
        )}
      </div>
      {loading ? (
        <div className="px-5 py-8 text-sm text-zinc-400">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="px-5 py-10 text-sm text-zinc-400 text-center" data-testid={`${testPrefix}-empty`}>{emptyText || "Aucun élément."}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-m-bg border-b border-m-border text-left">
                {columns.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-[10.5px] uppercase tracking-wider font-bold text-m-muted whitespace-nowrap">{c.label}</th>
                ))}
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it[idField]} className="border-b border-zinc-100 hover:bg-zinc-50/50" data-testid={`${testPrefix}-row-${it[idField]}`}>
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-xs text-zinc-700">
                      {c.render ? c.render(it) : (it[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    {canWrite && (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModal({ item: it })} data-testid={`${testPrefix}-edit-${it[idField]}`}
                          className="p-1 text-zinc-400 hover:text-m-blue"><Pencil size={12} /></button>
                        <button onClick={() => setConfirmDelete(it)} className="p-1 text-zinc-400 hover:text-rose-500"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <CrudModal item={modal.item} fields={fields} title={addLabel || title} onClose={() => setModal(null)} onSave={save} />}
      <ConfirmDialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={del}
        title="Supprimer" message="Supprimer cet élément ?" />
    </div>
  );
}

export const Badge = ({ cls, children }) => (
  <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${cls}`}>{children}</span>
);
