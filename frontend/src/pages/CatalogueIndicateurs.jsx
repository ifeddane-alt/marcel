import { useEffect, useMemo, useState } from "react";
import { catalogAPI } from "@/api";
import { BookOpenCheck, Search } from "lucide-react";

const PRIO_CLS = { P1: "bg-m-primary text-white", P2: "bg-m-blue-soft text-m-blue", P3: "bg-zinc-100 text-zinc-500" };
const COMP_CFG = {
  auto: { label: "Calculé auto", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  manual: { label: "Saisie manuelle", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  external: { label: "Source externe", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

export default function CatalogueIndicateurs() {
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [method, setMethod] = useState("");
  const [prio, setPrio] = useState("");
  const [comp, setComp] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { catalogAPI.list().then((r) => setCatalog(r.data || [])); }, []);

  const domains = useMemo(() => [...new Set(catalog.map((i) => i.domain))], [catalog]);
  const filtered = useMemo(() => catalog.filter((i) =>
    (!domain || i.domain === domain) && (!method || i.method === method) &&
    (!prio || i.priority === prio) && (!comp || i.computability === comp) &&
    (!search || `${i.indicator_id} ${i.name} ${i.definition}`.toLowerCase().includes(search.toLowerCase()))
  ), [catalog, domain, method, prio, comp, search]);

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="catalogue-indicateurs-page">
      <div className="flex items-center gap-3 mb-1">
        <BookOpenCheck size={22} className="text-m-primary" />
        <h1 className="font-heading text-xl md:text-2xl font-bold text-m-ink">Catalogue d'indicateurs PPM</h1>
      </div>
      <p className="text-xs text-zinc-400 mb-5">
        {catalog.length} indicateurs de référence — sélectionnables depuis la fiche projet, la vue programme, le portefeuille et le tableau de bord.
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un indicateur…"
            data-testid="catalogue-search"
            className="w-full text-xs border border-zinc-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-m-blue" />
        </div>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} data-testid="catalogue-domain-filter"
          className="text-xs border border-zinc-200 rounded-lg px-2 py-2">
          <option value="">Thématique</option>
          {domains.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} data-testid="catalogue-method-filter"
          className="text-xs border border-zinc-200 rounded-lg px-2 py-2">
          <option value="">Méthode</option><option>Waterfall</option><option>Agile</option><option>SAFe</option><option>Transverse</option>
        </select>
        <select value={prio} onChange={(e) => setPrio(e.target.value)} data-testid="catalogue-prio-filter"
          className="text-xs border border-zinc-200 rounded-lg px-2 py-2">
          <option value="">Priorité</option><option>P1</option><option>P2</option><option>P3</option>
        </select>
        <select value={comp} onChange={(e) => setComp(e.target.value)} data-testid="catalogue-comp-filter"
          className="text-xs border border-zinc-200 rounded-lg px-2 py-2">
          <option value="">Calculabilité</option>
          <option value="auto">Calculé auto</option>
          <option value="manual">Saisie manuelle</option>
          <option value="external">Source externe</option>
        </select>
        <span className="text-[11px] text-zinc-400 font-mono-data" data-testid="catalogue-count">{filtered.length} / {catalog.length}</span>
      </div>

      <div className="space-y-1.5">
        {filtered.map((i) => {
          const c = COMP_CFG[i.computability] || COMP_CFG.manual;
          const open = expanded === i.indicator_id;
          return (
            <div key={i.indicator_id} className="bg-white border border-m-border rounded-lg overflow-hidden">
              <button onClick={() => setExpanded(open ? null : i.indicator_id)}
                data-testid={`catalogue-row-${i.indicator_id}`}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50/60">
                <span className="font-mono text-[10px] text-zinc-400 w-14 flex-shrink-0">{i.indicator_id}</span>
                <span className="text-xs font-medium text-zinc-800 flex-1 min-w-0 truncate">{i.name}</span>
                <span className="hidden md:block text-[10px] text-zinc-400 w-40 truncate">{i.domain} · {i.subdomain}</span>
                <span className="hidden sm:block text-[10px] text-zinc-400 w-20">{i.method}</span>
                <span className={`px-1.5 py-px text-[9px] font-bold rounded ${PRIO_CLS[i.priority] || ""}`}>{i.priority}</span>
                <span className={`px-1.5 py-px text-[9px] font-bold rounded border ${c.cls}`}>{c.label}</span>
              </button>
              {open && (
                <div className="px-4 pb-3 pt-1 border-t border-zinc-50 space-y-1.5 text-xs text-zinc-600" data-testid={`catalogue-detail-${i.indicator_id}`}>
                  <p>{i.definition}</p>
                  {i.formula && <p><span className="font-semibold text-zinc-800">Formule :</span> <span className="font-mono text-[11px]">{i.formula}</span></p>}
                  {i.sources && <p><span className="font-semibold text-zinc-800">Données requises :</span> {i.sources}</p>}
                  {i.frequency && <p><span className="font-semibold text-zinc-800">Fréquence :</span> {i.frequency}</p>}
                  {i.reading && <p><span className="font-semibold text-zinc-800">Lecture :</span> {i.reading}</p>}
                  {i.pitfall && <p className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-amber-800">⚠ {i.pitfall}</p>}
                  <p className="text-[10px] text-zinc-400">Niveau : {i.level}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
