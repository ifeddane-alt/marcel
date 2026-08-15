import { useCallback, useEffect, useMemo, useState } from "react";
import { catalogAPI } from "@/api";
import { Settings2, X, ChevronDown, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";

const STATUS_CFG = {
  computed: { label: "Calculé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  manual: { label: "Saisie manuelle", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  external: { label: "Source externe", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  error: { label: "Erreur", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};
const COMP_CFG = {
  auto: { label: "Calculé auto", cls: "text-emerald-600" },
  manual: { label: "Saisie manuelle", cls: "text-amber-600" },
  external: { label: "Source externe manquante", cls: "text-zinc-400" },
};
const PRIO_CLS = { P1: "bg-m-primary text-white", P2: "bg-m-blue-soft text-m-blue", P3: "bg-zinc-100 text-zinc-500" };

export function IndicatorSelectorModal({ scope, onClose, onSaved }) {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [prio, setPrio] = useState("");
  const [method, setMethod] = useState("");
  const [openDomains, setOpenDomains] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([catalogAPI.list(scope), catalogAPI.getSelection(scope)]).then(([c, s]) => {
      setCatalog(c.data || []);
      setSelected(new Set(s.data?.indicator_ids || []));
    });
  }, [scope]);

  const filtered = useMemo(() => catalog.filter((i) =>
    (!prio || i.priority === prio) &&
    (!method || i.method === method || i.method === "Transverse") &&
    (!search || `${i.indicator_id} ${i.name}`.toLowerCase().includes(search.toLowerCase()))
  ), [catalog, prio, method, search]);

  const byDomain = useMemo(() => {
    const g = {};
    filtered.forEach((i) => { (g[i.domain] = g[i.domain] || []).push(i); });
    return g;
  }, [filtered]);

  const toggle = (id) => setSelected((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const save = async () => {
    setSaving(true);
    try {
      await catalogAPI.setSelection(scope, [...selected]);
      toast.success("Sélection d'indicateurs enregistrée");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur d'enregistrement");
      setSaving(false);
    }
  };

  const applyP1 = async () => {
    const p1 = catalog.filter((i) => i.priority === "P1" && i.computability === "auto").map((i) => i.indicator_id);
    setSelected(new Set(p1));
    toast.info(`Socle P1 calculable : ${p1.length} indicateurs pré-cochés`);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="indicator-selector-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
          <h2 className="font-heading text-base font-bold text-zinc-950">Gérer les indicateurs — {selected.size} sélectionné{selected.size > 1 ? "s" : ""}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600" data-testid="indicator-selector-close"><X size={17} /></button>
        </div>
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-zinc-50 flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…"
            data-testid="indicator-search-input"
            className="flex-1 min-w-[140px] text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-m-blue" />
          <select value={prio} onChange={(e) => setPrio(e.target.value)} data-testid="indicator-prio-filter"
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5">
            <option value="">Priorité</option><option>P1</option><option>P2</option><option>P3</option>
          </select>
          <select value={method} onChange={(e) => setMethod(e.target.value)} data-testid="indicator-method-filter"
            className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5">
            <option value="">Méthode</option><option>Waterfall</option><option>Agile</option><option>SAFe</option><option>Transverse</option>
          </select>
          <button onClick={applyP1} data-testid="indicator-preset-p1-btn"
            className="flex items-center gap-1 text-[11px] font-semibold text-m-primary border border-m-primary/25 rounded-lg px-2.5 py-1.5 hover:bg-m-lilac">
            <Sparkles size={11} /> Socle P1
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {Object.entries(byDomain).map(([domain, items]) => {
            const open = openDomains.has(domain) || search;
            const nSel = items.filter((i) => selected.has(i.indicator_id)).length;
            return (
              <div key={domain} className="border border-zinc-100 rounded-lg overflow-hidden">
                <button onClick={() => setOpenDomains((s) => { const n = new Set(s); n.has(domain) ? n.delete(domain) : n.add(domain); return n; })}
                  data-testid={`indicator-domain-${domain.slice(0, 3)}`}
                  className="w-full flex items-center justify-between px-3 py-2 bg-m-surface text-xs font-semibold text-zinc-700 hover:bg-m-lilac">
                  <span>{domain} <span className="text-zinc-400 font-normal">{nSel}/{items.length}</span></span>
                  <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="divide-y divide-zinc-50">
                    {items.map((i) => (
                      <label key={i.indicator_id} className="flex items-start gap-2.5 px-3 py-2 text-xs hover:bg-zinc-50 cursor-pointer"
                        data-testid={`indicator-check-${i.indicator_id}`}>
                        <input type="checkbox" className="mt-0.5" checked={selected.has(i.indicator_id)} onChange={() => toggle(i.indicator_id)} />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] text-zinc-400">{i.indicator_id}</span>
                            <span className="text-zinc-800 font-medium">{i.name}</span>
                            <span className={`px-1 py-px text-[9px] font-bold rounded ${PRIO_CLS[i.priority] || ""}`}>{i.priority}</span>
                          </span>
                          <span className={`block text-[10px] mt-0.5 ${COMP_CFG[i.computability]?.cls || ""}`}>{COMP_CFG[i.computability]?.label}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-zinc-100">
          <button onClick={onClose} className="px-3.5 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700">Annuler</button>
          <button onClick={save} disabled={saving} data-testid="indicator-selector-save-btn"
            className="px-4 py-2 text-xs font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark disabled:opacity-50">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export const IndicatorsPanel = ({ scope, contextId, title = "Indicateurs" }) => {
  const [data, setData] = useState(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(() => {
    catalogAPI.values(scope, contextId).then((r) => setData(r.data)).catch(() => setData({ items: [] }));
  }, [scope, contextId]);
  useEffect(() => { load(); }, [load]);

  const quickPreset = async () => {
    setApplying(true);
    try {
      const { data: res } = await catalogAPI.presetP1(scope);
      toast.success(`Socle recommandé activé${res?.indicator_ids?.length ? ` — ${res.indicator_ids.length} indicateurs` : ""}`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Erreur lors de l'activation du socle");
    }
    setApplying(false);
  };

  const byDomain = useMemo(() => {
    const g = {};
    (data?.items || []).forEach((i) => { (g[i.domain] = g[i.domain] || []).push(i); });
    return g;
  }, [data]);

  return (
    <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4 md:p-5" data-testid={`indicators-panel-${scope}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-sm font-bold text-m-ink">{title}</h3>
        <button onClick={() => setSelectorOpen(true)} data-testid={`indicators-manage-btn-${scope}`}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-m-blue hover:text-m-blue-dark">
          <Settings2 size={12} /> Gérer les indicateurs
        </button>
      </div>
      {data === null ? (
        <div className="text-xs text-zinc-300 py-4 text-center">Chargement…</div>
      ) : data.items.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-zinc-200 rounded-lg" data-testid={`indicators-empty-${scope}`}>
          <p className="text-xs text-zinc-400 mb-3">Aucun indicateur activé sur cette vue.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={quickPreset} disabled={applying} data-testid={`indicators-quick-p1-${scope}`}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark disabled:opacity-50 transition-colors">
              <Sparkles size={12} /> {applying ? "Activation…" : "Activer le socle recommandé (P1)"}
            </button>
            <button onClick={() => setSelectorOpen(true)} data-testid={`indicators-choose-${scope}`}
              className="px-3.5 py-2 text-xs font-semibold text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
              Choisir mes indicateurs
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(byDomain).map(([domain, items]) => (
            <div key={domain}>
              <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1.5">{domain}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {items.map((i) => {
                  const st = STATUS_CFG[i.status] || STATUS_CFG.manual;
                  return (
                    <button key={i.indicator_id} onClick={() => setDetail(i)}
                      data-testid={`indicator-card-${i.indicator_id}`}
                      className="text-left border border-zinc-100 rounded-lg px-3 py-2 hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[9px] text-zinc-400">{i.indicator_id}</span>
                        <span className={`px-1 py-px text-[8px] font-bold rounded border ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="text-[11px] text-zinc-600 truncate mt-0.5" title={i.name}>{i.name}</div>
                      <div className="font-mono-data text-sm font-bold text-m-ink mt-0.5" data-testid={`indicator-value-${i.indicator_id}`}>
                        {i.display ?? "—"}
                      </div>
                      {i.detail && <div className="text-[10px] text-zinc-400 truncate" title={i.detail}>{i.detail}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {selectorOpen && <IndicatorSelectorModal scope={scope} onClose={() => setSelectorOpen(false)} onSaved={load} />}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} data-testid="indicator-detail-modal">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-heading text-sm font-bold text-zinc-950">
                <span className="font-mono text-[10px] text-zinc-400 mr-1.5">{detail.indicator_id}</span>{detail.name}
              </h4>
              <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-600"><X size={15} /></button>
            </div>
            <div className="space-y-2 text-xs text-zinc-600">
              {detail.definition && <p>{detail.definition}</p>}
              {detail.formula && <p><span className="font-semibold text-zinc-800">Formule :</span> <span className="font-mono text-[11px]">{detail.formula}</span></p>}
              {detail.reading && <p><span className="font-semibold text-zinc-800">Lecture :</span> {detail.reading}</p>}
              {detail.pitfall && (
                <p className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-amber-800 flex gap-1.5">
                  <Info size={12} className="flex-shrink-0 mt-0.5" /> {detail.pitfall}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
