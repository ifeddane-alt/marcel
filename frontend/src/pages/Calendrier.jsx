import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus, RefreshCw, Settings2, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { eventsAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";

const LEVELS = [
  { id: "strategique", label: "Stratégique", color: "#7c3aed", bg: "#f3ecfe" },
  { id: "portefeuille", label: "Portefeuille", color: "#2e5fe8", bg: "#e9effe" },
  { id: "projet", label: "Projet", color: "#0d9488", bg: "#e0f2ef" },
  { id: "safe", label: "SAFe", color: "#b7791f", bg: "#fdf6e3" },
  { id: "run", label: "Run", color: "#cc4f45", bg: "#fbe1de" },
];
const LEVEL_MAP = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
const FREQ_LABEL = { hebdomadaire: "Hebdo", bimensuel: "Bimensuel", mensuel: "Mensuel", trimestriel: "Trimestriel", semestriel: "Semestriel", annuel: "Annuel", ponctuel: "Ponctuel" };
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function Calendrier() {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("governance.edit") || hasPermission("*");
  const [year, setYear] = useState(new Date().getFullYear());
  const [levelFilter, setLevelFilter] = useState(null);
  const [events, setEvents] = useState([]);
  const [types, setTypes] = useState([]);
  const [showRef, setShowRef] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    eventsAPI.list({ year }).then((r) => setEvents(r.data || [])).catch(() => {});
    eventsAPI.listTypes().then((r) => setTypes(r.data || [])).catch(() => {});
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const seedAndGenerate = async () => {
    setBusy(true);
    try {
      await eventsAPI.seedDefaults();
      const r = await eventsAPI.generatePlan(year);
      toast.success(`Planning ${year} généré — ${r.data.created} instance(s) créée(s)`);
      load();
    } catch { toast.error("Erreur lors de la génération"); } finally { setBusy(false); }
  };

  const setStatus = async (ev, status) => {
    await eventsAPI.update(ev.event_id, { status });
    load();
  };

  const filtered = levelFilter ? events.filter((e) => e.level === levelFilter) : events;
  const byMonth = MONTHS.map((_, i) => filtered.filter((e) => parseInt(e.date.slice(5, 7), 10) === i + 1));

  return (
    <div className="p-4 md:p-6 space-y-5" data-testid="calendrier-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-extrabold text-[#26243a] flex items-center gap-2">
            <CalendarDays size={20} className="text-[#352c6e]" /> Calendrier des instances
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Tous les événements de l'année, du stratégique au projet</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} data-testid="calendar-year-select"
            className="h-9 bg-white border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm font-semibold text-[#26243a]">
            {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {canEdit && (
            <button onClick={seedAndGenerate} disabled={busy} data-testid="calendar-generate-btn"
              className="flex items-center gap-1.5 h-9 px-4 bg-[#2e5fe8] text-white text-sm font-bold rounded-[10px] hover:bg-[#2450c8] disabled:opacity-60">
              <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Générer le planning {year}
            </button>
          )}
          <button onClick={() => setShowRef(!showRef)} data-testid="calendar-referential-btn"
            className={`flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-[10px] border-[1.5px] transition-colors ${showRef ? "border-[#2e5fe8] text-[#2e5fe8] bg-[#e9effe]" : "border-[#dcd7ea] text-[#5d5a75] bg-white hover:bg-[#f0eefc]"}`}>
            <Settings2 size={14} /> Référentiel
          </button>
        </div>
      </div>

      {/* Filtres par niveau */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setLevelFilter(null)} data-testid="calendar-filter-all"
          className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${!levelFilter ? "bg-[#26243a] text-white" : "bg-white border border-[#dcd7ea] text-[#5d5a75]"}`}>
          Tous ({events.length})
        </button>
        {LEVELS.map((l) => (
          <button key={l.id} onClick={() => setLevelFilter(levelFilter === l.id ? null : l.id)}
            data-testid={`calendar-filter-${l.id}`}
            className="px-3 py-1.5 text-xs font-bold rounded-full transition-all"
            style={levelFilter === l.id
              ? { backgroundColor: l.color, color: "#fff" }
              : { backgroundColor: l.bg, color: l.color, opacity: levelFilter && levelFilter !== l.id ? 0.45 : 1 }}>
            {l.label} ({events.filter((e) => e.level === l.id).length})
          </button>
        ))}
      </div>

      {/* Référentiel */}
      {showRef && (
        <Referential types={types} canEdit={canEdit} onChanged={load} />
      )}

      {/* Grille annuelle */}
      {events.length === 0 ? (
        <div className="bg-white border border-[#e8e6f0] rounded-xl p-10 text-center" data-testid="calendar-empty">
          <CalendarDays size={36} className="mx-auto text-[#dcd7ea] mb-3" />
          <p className="text-sm font-semibold text-[#26243a]">Aucune instance planifiée pour {year}</p>
          <p className="text-xs text-[#8a87a0] mt-1">{canEdit ? "Cliquez sur « Générer le planning » pour créer le calendrier annuel depuis le référentiel." : "Le planning n'a pas encore été généré."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {MONTHS.map((m, i) => (
            <div key={m} className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-hidden" data-testid={`calendar-month-${i + 1}`}>
              <div className="px-3 py-2 bg-[#fbfaff] border-b border-[#f0eff6] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#352c6e]">{m}</span>
                <span className="text-[10px] font-bold text-[#8a87a0]">{byMonth[i].length}</span>
              </div>
              <div className="p-2 space-y-1 max-h-56 overflow-y-auto">
                {byMonth[i].length === 0 && <p className="text-[11px] text-[#a39fb8] px-1 py-2">—</p>}
                {byMonth[i].map((ev) => {
                  const lv = LEVEL_MAP[ev.level] || LEVEL_MAP.portefeuille;
                  const done = ev.status === "tenu";
                  const cancelled = ev.status === "annule";
                  return (
                    <div key={ev.event_id} className="group flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-[#f7f6fb]"
                      data-testid={`calendar-event-${ev.event_id}`}>
                      <span className="text-[10px] font-bold w-5 text-right flex-shrink-0" style={{ color: lv.color }}>
                        {parseInt(ev.date.slice(8, 10), 10)}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: lv.color }} />
                      <span className={`text-[11px] flex-1 truncate ${cancelled ? "line-through text-[#a39fb8]" : done ? "text-[#8a87a0]" : "text-[#26243a]"}`} title={ev.title}>
                        {ev.title}
                      </span>
                      {done && <Check size={11} className="text-[#3f8a34] flex-shrink-0" />}
                      {canEdit && !done && !cancelled && (
                        <span className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => setStatus(ev, "tenu")} title="Marquer tenu" data-testid={`event-done-${ev.event_id}`}
                            className="p-0.5 text-[#3f8a34] hover:bg-[#ddf0d8] rounded"><Check size={11} /></button>
                          <button onClick={() => setStatus(ev, "annule")} title="Annuler" data-testid={`event-cancel-${ev.event_id}`}
                            className="p-0.5 text-[#cc4f45] hover:bg-[#fbe1de] rounded"><X size={11} /></button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Referential = ({ types, canEdit, onChanged }) => {
  const [form, setForm] = useState({ name: "", level: "portefeuille", frequency: "mensuel" });
  const add = async () => {
    if (!form.name.trim()) return;
    await eventsAPI.createType(form);
    toast.success("Type d'instance ajouté");
    setForm({ name: "", level: "portefeuille", frequency: "mensuel" });
    onChanged();
  };
  const remove = async (t) => {
    await eventsAPI.deleteType(t.event_type_id);
    toast.success("Type supprimé");
    onChanged();
  };
  return (
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-hidden" data-testid="calendar-referential">
      <div className="px-4 py-3 border-b border-[#f0eff6] flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[#352c6e]">Référentiel des instances ({types.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[#8a87a0] border-b border-[#f0eff6]">
              <th className="px-4 py-2">Instance</th><th className="px-3 py-2">Niveau</th><th className="px-3 py-2">Fréquence</th>
              <th className="px-3 py-2 hidden lg:table-cell">Participants</th><th className="px-3 py-2 hidden xl:table-cell">Sortie attendue</th>
              {canEdit && <th className="px-3 py-2 w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const lv = LEVEL_MAP[t.level] || LEVEL_MAP.portefeuille;
              return (
                <tr key={t.event_type_id} className="border-b border-[#f7f6fb] hover:bg-[#fbfaff]">
                  <td className="px-4 py-2 font-semibold text-[#26243a]">{t.name}</td>
                  <td className="px-3 py-2"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: lv.bg, color: lv.color }}>{lv.label}</span></td>
                  <td className="px-3 py-2 text-[#5d5a75] text-xs">{FREQ_LABEL[t.frequency] || t.frequency}</td>
                  <td className="px-3 py-2 text-[#8a87a0] text-xs hidden lg:table-cell">{t.participants}</td>
                  <td className="px-3 py-2 text-[#8a87a0] text-xs hidden xl:table-cell">{t.output}</td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      {!t.builtin && (
                        <button onClick={() => remove(t)} data-testid={`type-delete-${t.event_type_id}`}
                          className="p-1 text-[#cc4f45] hover:bg-[#fbe1de] rounded"><Trash2 size={13} /></button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="px-4 py-3 bg-[#fbfaff] border-t border-[#f0eff6] flex flex-wrap items-center gap-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nouvelle instance (ex. Comité Data)" data-testid="type-name-input"
            className="h-9 flex-1 min-w-[200px] bg-white border-[1.5px] border-[#dcd7ea] rounded-[10px] px-3 text-sm" />
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} data-testid="type-level-select"
            className="h-9 bg-white border-[1.5px] border-[#dcd7ea] rounded-[10px] px-2 text-sm">
            {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} data-testid="type-frequency-select"
            className="h-9 bg-white border-[1.5px] border-[#dcd7ea] rounded-[10px] px-2 text-sm">
            {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={add} data-testid="type-add-btn"
            className="flex items-center gap-1 h-9 px-3 bg-[#352c6e] text-white text-sm font-bold rounded-[10px] hover:bg-[#2a2358]">
            <Plus size={14} /> Ajouter
          </button>
        </div>
      )}
    </div>
  );
};
