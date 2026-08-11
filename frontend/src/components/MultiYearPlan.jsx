import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, Pencil, X, RotateCcw, AlertTriangle } from "lucide-react";
import { budgetAPI } from "@/api";
import { toast } from "sonner";
import { formatEuro, formatDate } from "@/utils/format";

const RAG_DOT = { green: "bg-emerald-500", orange: "bg-amber-500", red: "bg-rose-500" };

function MultiYearModal({ row, years, onClose, onSaved }) {
  const [values, setValues] = useState(
    Object.fromEntries(years.map((y) => [String(y), row.by_year[String(y)] ?? 0]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (reset = false) => {
    setSaving(true);
    setError("");
    try {
      await budgetAPI.setMultiyear(row.project_id, reset ? { reset: true } : { by_year: values });
      toast.success(reset ? "Répartition remise au pro-rata" : "Plan pluriannuel enregistré");
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de la sauvegarde");
      setSaving(false);
    }
  };

  const total = years.reduce((s, y) => s + (parseFloat(values[String(y)]) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="multiyear-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="min-w-0">
            <h2 className="font-heading text-base font-bold text-zinc-950 truncate">Plan pluriannuel</h2>
            <p className="text-xs text-zinc-400 truncate">{row.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 flex-shrink-0"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {years.map((y) => (
            <div key={y} className="flex items-center gap-3">
              <label className="text-sm font-semibold text-zinc-700 w-16 font-mono-data">{y}</label>
              <input type="number" min="0" step="1000" value={values[String(y)]}
                onChange={(e) => setValues((prev) => ({ ...prev, [String(y)]: e.target.value }))}
                data-testid={`my-input-${y}`}
                className="flex-1 text-sm text-right border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 font-mono-data" />
              <span className="text-xs text-zinc-400 w-4">€</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs border-t border-zinc-100 pt-3">
            <span className="text-zinc-500">Total saisi : <b className="font-mono-data text-zinc-800">{formatEuro(total)}</b></span>
            <span className="text-zinc-400">EAC projet : <b className="font-mono-data">{formatEuro(row.eac)}</b></span>
          </div>
          {Math.round(total) !== Math.round(row.eac) && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1.5">
              <AlertTriangle size={11} /> Le total saisi diffère de l'EAC du projet ({formatEuro(row.eac)}).
            </p>
          )}
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-100">
            <button onClick={() => save(true)} disabled={saving} data-testid="my-reset"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50">
              <RotateCcw size={12} /> Revenir au pro-rata
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">Annuler</button>
              <button onClick={() => save(false)} disabled={saving} data-testid="my-save"
                className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
                {saving ? "Sauvegarde..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MultiYearPlan({ canEdit }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    budgetAPI.multiyear()
      .then((res) => { setData(res.data); setLoading(false); })
      .catch(() => { toast.error("Erreur chargement plan pluriannuel"); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-12 text-center text-sm text-zinc-400">Chargement du plan pluriannuel…</div>;
  if (!data) return null;

  const { years, projects, totals, envelopes } = data;

  return (
    <div className="space-y-4" data-testid="multiyear-plan">
      {/* Cartes par exercice */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {years.map((y, i) => {
          const total = totals[String(y)] || 0;
          const env = envelopes[String(y)];
          const gap = env ? env.total_envelope - total : null;
          return (
            <div key={y} className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4" data-testid={`my-year-card-${y}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                  Exercice {y} {i === 0 ? "(N)" : `(N+${i})`}
                </div>
                {env && (
                  gap >= 0 ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                      Marge {formatEuro(gap)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                      Dépassement {formatEuro(-gap)}
                    </span>
                  )
                )}
              </div>
              <div className="font-heading text-2xl font-bold text-zinc-950 font-mono-data">{formatEuro(total)}</div>
              {env ? (
                <>
                  <div className="mt-2 h-1.5 bg-[#ece9f4] rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{
                        width: `${Math.min(env.total_envelope ? (total / env.total_envelope) * 100 : 0, 100)}%`,
                        background: gap >= 0 ? "#3f8a34" : "#cc4f45",
                      }} />
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Enveloppe : {formatEuro(env.total_envelope)} ({env.total_envelope ? Math.round((total / env.total_envelope) * 100) : 0} %)
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-zinc-400 mt-2">
                  Aucune enveloppe définie — <Link to="/arbitrage" className="text-blue-600 hover:underline">créer dans Arbitrage</Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100">
          <CalendarRange size={13} className="text-blue-600" />
          <span className="font-heading text-[13px] font-bold text-[#26243a]">
            Schéma directeur — répartition des budgets par exercice
          </span>
          <span className="text-[11px] text-zinc-400 ml-2">Pro-rata temporis par défaut, ajustable projet par projet</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#fbfaff] border-b border-[#e8e6f0] text-[10.5px] text-[#8a87a0] uppercase tracking-wider font-bold">
                <th className="px-4 py-2.5 text-left">Projet</th>
                <th className="px-3 py-2.5 text-left whitespace-nowrap">Période</th>
                {years.map((y) => <th key={y} className="px-3 py-2.5 text-right font-mono-data">{y}</th>)}
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Total N→N+2</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Hors fenêtre</th>
                <th className="px-3 py-2.5 text-center">Source</th>
                {canEdit && <th className="px-3 py-2.5"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {projects.map((r) => (
                <tr key={r.project_id} className="hover:bg-zinc-50/60 transition-colors" data-testid={`my-row-${r.project_id}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${RAG_DOT[r.status_rag] || "bg-zinc-300"}`} />
                      <Link to={`/projects/${r.project_id}`} className="text-xs font-medium text-zinc-700 hover:text-blue-600 truncate max-w-[220px]" title={r.name}>
                        {r.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[10.5px] text-zinc-400 font-mono-data whitespace-nowrap">
                    {r.start_date ? formatDate(r.start_date) : "—"} → {r.end_date_forecast ? formatDate(r.end_date_forecast) : "—"}
                  </td>
                  {years.map((y) => (
                    <td key={y} className="px-3 py-2.5 text-right font-mono-data text-xs text-zinc-700" data-testid={`my-cell-${r.project_id}-${y}`}>
                      {r.by_year[String(y)] ? formatEuro(r.by_year[String(y)]) : <span className="text-zinc-300">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-mono-data text-xs font-semibold text-zinc-900">{formatEuro(r.total_window)}</td>
                  <td className="px-3 py-2.5 text-right font-mono-data text-xs text-zinc-400">
                    {r.out_of_window ? formatEuro(r.out_of_window) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.source === "manual" ? (
                      <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Manuel</span>
                    ) : (
                      <span className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-zinc-50 text-zinc-500 border border-zinc-200">Pro-rata</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => setEditing(r)} data-testid={`btn-edit-multiyear-${r.project_id}`}
                        className="p-1 text-zinc-400 hover:text-blue-600 rounded-lg transition-colors" title="Ajuster la répartition">
                        <Pencil size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#fbfaff] border-t-2 border-[#e8e6f0]" data-testid="my-total-row">
                <td className="px-4 py-2.5 text-xs font-bold text-zinc-700" colSpan={2}>Total portefeuille</td>
                {years.map((y) => (
                  <td key={y} className="px-3 py-2.5 text-right font-mono-data text-xs font-bold text-zinc-900">
                    {formatEuro(totals[String(y)] || 0)}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right font-mono-data text-xs font-bold text-zinc-900">
                  {formatEuro(years.reduce((s, y) => s + (totals[String(y)] || 0), 0))}
                </td>
                <td colSpan={canEdit ? 3 : 2}></td>
              </tr>
              {Object.keys(envelopes).length > 0 && (
                <tr className="bg-[#fbfaff]">
                  <td className="px-4 py-2 text-[10.5px] text-zinc-400 uppercase tracking-wider font-bold" colSpan={2}>Enveloppes / écart</td>
                  {years.map((y) => {
                    const env = envelopes[String(y)];
                    if (!env) return <td key={y} className="px-3 py-2 text-right text-[10.5px] text-zinc-300">—</td>;
                    const gap = env.total_envelope - (totals[String(y)] || 0);
                    return (
                      <td key={y} className={`px-3 py-2 text-right font-mono-data text-[10.5px] font-semibold ${gap >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {gap >= 0 ? "+" : ""}{formatEuro(gap)}
                      </td>
                    );
                  })}
                  <td colSpan={canEdit ? 4 : 3}></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>

      {editing && (
        <MultiYearModal row={editing} years={years}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
