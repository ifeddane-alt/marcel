import React, { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Plus, Pencil, Trash2, Presentation, LayoutGrid, List, AlertTriangle, ChevronDown, ListChecks } from "lucide-react";
import { projectsAPI, programsAPI, resourcesAPI, favoritesAPI, exportsAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import RAGBadge, { MethodologyBadge, ProjectStatusBadge } from "@/components/RAGBadge";
import ProjectModal from "@/components/ProjectModal";
import { IndicatorsPanel } from "@/components/IndicatorsPanel";
import ExportCopilModal from "@/components/ExportCopilModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatEuro, formatDate } from "@/utils/format";
import ExcelToolbar from "@/components/ExcelToolbar";
import ProjectTile from "@/components/ProjectTile";
import { SavedViews } from "@/components/SavedViews";

const RAG_LABELS = { green: "Vert", orange: "Orange", red: "Rouge" };

function benefitsPct(p) {
  const eur = (p.benefits || []).filter((b) => b.unit === "EUR");
  const exp = eur.reduce((s, b) => s + (b.expected_value || 0), 0);
  if (!exp) return null;
  const real = eur.reduce((s, b) => s + (b.realized_value || 0), 0);
  return { exp, real, pct: Math.round((real / exp) * 100) };
}

export default function Portfolio() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("projects.create");
  const canEdit   = hasPermission("projects.edit");
  const canDelete = hasPermission("projects.delete");
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRag, setFilterRag] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterProgram, setFilterProgram] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [view, setView] = useState(() => localStorage.getItem("portfolio_view") || "tiles");
  const switchView = (v) => { setView(v); localStorage.setItem("portfolio_view", v); };

  // Selection state
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    favoritesAPI.list().then((r) => setFavorites(new Set(r.data.favorites || []))).catch(() => {});
  }, []);
  const [consistency, setConsistency] = useState([]);
  const [consistencyOpen, setConsistencyOpen] = useState(false);
  const [qualification, setQualification] = useState([]);
  const [qualifOpen, setQualifOpen] = useState(false);
  const [pfTab, setPfTab] = useState(() => localStorage.getItem("portfolio-view-tab") || "portfolio");
  const switchPfTab = (v) => { setPfTab(v); localStorage.setItem("portfolio-view-tab", v); };
  useEffect(() => {
    projectsAPI.consistency().then((r) => setConsistency(r.data || [])).catch(() => {});
    projectsAPI.scopeQualification().then((r) => setQualification(r.data || [])).catch(() => {});
  }, []);
  const [preGovernanceId, setPreGovernanceId] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const selectAllRef = useRef(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = () => {
    Promise.all([projectsAPI.list(), programsAPI.list(), resourcesAPI.list()])
      .then(([pRes, progRes, rRes]) => {
        setProjects(pRes.data);
        setPrograms(progRes.data);
        setResources(rRes.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  // Read URL pre-selection params (from ProgramDetail / ProjectDetail / Governance shortcuts)
  useEffect(() => {
    const sel = searchParams.get("selected");
    const govId = searchParams.get("governance_id");
    if (sel) setSelectedProjects(new Set(sel.split(",").filter(Boolean)));
    if (govId) setPreGovernanceId(govId);
    if (sel || govId) setSearchParams({}, { replace: true });
  }, []); // Run once on mount

  const openCreate = () => { setSelectedProject(null); setModalOpen(true); };
  const openEdit = (e, p) => { e.stopPropagation(); setSelectedProject(p); setModalOpen(true); };
  const openDelete = (e, p) => { e.stopPropagation(); setConfirmDelete(p); };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await projectsAPI.delete(confirmDelete.project_id);
      setConfirmDelete(null);
      fetchAll();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase();
      return (
        (!search || p.name.toLowerCase().includes(q) || (p.source_id || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q)) &&
        (!filterRag || p.status_rag === filterRag) &&
        (!filterMethod || p.methodology === filterMethod) &&
        (!filterProgram || p.program_id === filterProgram) &&
        (!filterStatus || p.status === filterStatus) &&
        (!favoritesOnly || favorites.has(p.project_id))
      );
    })
    .sort((a, b) => {
      const fa = favorites.has(a.project_id) ? 0 : 1;
      const fb = favorites.has(b.project_id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      let av = a[sortKey] ?? ""; let bv = b[sortKey] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });

  const toggleFavorite = async (pid) => {
    try {
      const r = await favoritesAPI.toggle(pid);
      setFavorites((prev) => {
        const next = new Set(prev);
        if (r.data.favorite) next.add(pid); else next.delete(pid);
        return next;
      });
    } catch { /* silencieux */ }
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Update the "select all" checkbox indeterminate state
  useEffect(() => {
    if (selectAllRef.current) {
      const indeterminate = selectedProjects.size > 0 && selectedProjects.size < filtered.length;
      selectAllRef.current.indeterminate = indeterminate;
    }
  });

  const toggleSelect = (pid) => {
    const next = new Set(selectedProjects);
    if (next.has(pid)) next.delete(pid);
    else next.add(pid);
    setSelectedProjects(next);
  };

  const toggleSelectAll = () => {
    if (selectedProjects.size === filtered.length && filtered.length > 0) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filtered.map((p) => p.project_id)));
    }
  };

  if (loading) return <div className="p-4 md:p-8 text-zinc-400 text-sm">Chargement...</div>;

  const ragCounts = { green: 0, orange: 0, red: 0 };
  projects.forEach((p) => { if (p.status_rag in ragCounts) ragCounts[p.status_rag]++; });
  const unqualified = qualification.filter((q) => q.pct_qualified < 100);

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="portfolio-page">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-m-ink tracking-tight">Portefeuille</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{projects.length} projets — {ragCounts.red} rouge · {ragCounts.orange} orange · {ragCounts.green} vert</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelToolbar entity="projects" onImported={fetchAll} canImport={canCreate} />
          <button
            onClick={async () => {
              try {
                const r = await exportsAPI.copilPptx();
                const url = URL.createObjectURL(r.data);
                const a = document.createElement("a");
                a.href = url;
                a.download = `COPIL_portefeuille_${new Date().toISOString().slice(0, 10)}.pptx`;
                a.click();
                URL.revokeObjectURL(url);
              } catch { /* toast silencieux */ }
            }}
            data-testid="btn-export-copil-pptx"
            className="flex items-center gap-2 px-4 py-2.5 bg-m-primary text-white text-sm font-semibold rounded-lg hover:bg-m-primary-deep transition-colors shadow-sm"
          >
            <Presentation size={15} /> COPIL PPTX
          </button>
          {canCreate && (
            <button
              onClick={openCreate}
              data-testid="btn-new-project"
              className="flex items-center gap-2 px-4 py-2.5 bg-m-blue text-white text-sm font-semibold rounded-lg hover:bg-m-blue-dark transition-colors shadow-sm"
            >
              <Plus size={15} /> Nouveau projet
            </button>
          )}
        </div>
      </div>

      {/* Onglets Portefeuille / Indicateurs */}
      <div className="flex gap-1 border-b border-m-border-lav mb-5" data-testid="portfolio-view-tabs">
        {[
          { id: "portfolio", label: "Portefeuille" },
          { id: "indicateurs", label: "Indicateurs" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => switchPfTab(t.id)}
            data-testid={`portfolio-view-tab-${t.id}`}
            className={`px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-[3px] -mb-px transition-colors ${
              pfTab === t.id ? "text-m-blue border-m-blue" : "text-m-muted border-transparent hover:text-m-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={pfTab === "portfolio" ? "" : "hidden"}>
      {/* Alerte cohérence chiffres déclarés vs tâches */}
      {consistency.length > 0 && (
        <div className="mb-4 border border-amber-200 bg-amber-50 rounded-xl overflow-hidden" data-testid="portfolio-consistency-alert">
          <button
            onClick={() => setConsistencyOpen((v) => !v)}
            data-testid="portfolio-consistency-toggle"
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs sm:text-sm text-amber-800 font-semibold hover:bg-amber-100/60 transition-colors"
          >
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>{consistency.length} projet{consistency.length > 1 ? "s" : ""} dont les chiffres déclarés divergent de la somme des tâches (&gt;10 %)</span>
            <ChevronDown size={14} className={`ml-auto flex-shrink-0 transition-transform ${consistencyOpen ? "rotate-180" : ""}`} />
          </button>
          {consistencyOpen && (
            <div className="px-4 pb-3 space-y-1.5">
              {consistency.map((c) => (
                <Link
                  key={c.project_id}
                  to={`/projects/${c.project_id}?tab=taches`}
                  data-testid={`consistency-item-${c.project_id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs bg-white border border-amber-100 rounded-lg px-3 py-2 hover:border-amber-300 transition-colors"
                >
                  <span className="font-semibold text-zinc-700">{c.code ? `${c.code} · ` : ""}{c.name}</span>
                  {c.gaps.map((g) => (
                    <span key={g.field} className="font-mono-data text-amber-700">
                      {g.label} : {(g.declared || 0).toLocaleString("fr-FR")} déclarés vs {(g.tasks_sum || 0).toLocaleString("fr-FR")} Σ tâches ({g.gap_pct} %)
                    </span>
                  ))}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerte qualification du scope (MVP / étendu / hors scope) */}
      {unqualified.length > 0 && (
        <div className="mb-4 border border-indigo-200 bg-indigo-50 rounded-xl overflow-hidden" data-testid="portfolio-qualification-alert">
          <button
            onClick={() => setQualifOpen((v) => !v)}
            data-testid="portfolio-qualification-toggle"
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-xs sm:text-sm text-indigo-800 font-semibold hover:bg-indigo-100/60 transition-colors"
          >
            <ListChecks size={15} className="flex-shrink-0" />
            <span>{unqualified.length} projet{unqualified.length > 1 ? "s" : ""} avec un scope non qualifié (MVP / étendu / hors scope) — exigez la qualification des tâches restantes</span>
            <ChevronDown size={14} className={`ml-auto flex-shrink-0 transition-transform ${qualifOpen ? "rotate-180" : ""}`} />
          </button>
          {qualifOpen && (
            <div className="px-4 pb-3 space-y-1.5">
              {unqualified.map((q) => {
                const color = q.pct_qualified < 50 ? "#e11d48" : q.pct_qualified < 80 ? "#d97706" : "#059669";
                return (
                  <Link
                    key={q.project_id}
                    to={`/projects/${q.project_id}?tab=taches`}
                    data-testid={`qualification-item-${q.project_id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs bg-white border border-indigo-100 rounded-lg px-3 py-2 hover:border-indigo-300 transition-colors"
                  >
                    <span className="font-semibold text-zinc-700">{q.code ? `${q.code} · ` : ""}{q.name}</span>
                    <span className="font-mono-data font-bold" style={{ color }} data-testid={`qualification-pct-${q.project_id}`}>
                      {q.pct_qualified} % qualifié
                    </span>
                    <span className="text-zinc-500">
                      {q.jh_unqualified.toLocaleString("fr-FR")} JH non qualifiés sur {q.jh_total.toLocaleString("fr-FR")} JH restants · {q.tasks_unqualified} tâche{q.tasks_unqualified > 1 ? "s" : ""} à qualifier
                    </span>
                    <span className="ml-auto w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden flex-shrink-0">
                      <span className="block h-full rounded-full" style={{ width: `${q.pct_qualified}%`, backgroundColor: color }} />
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Export COPIL action bar */}
      {selectedProjects.size > 0 && (
        <div
          className="flex items-center gap-4 px-5 py-3 mb-4 bg-m-blue rounded-lg shadow-md"
          data-testid="export-action-bar"
        >
          <span className="text-white font-semibold text-sm">
            {selectedProjects.size} projet{selectedProjects.size > 1 ? "s" : ""} sélectionné{selectedProjects.size > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setExportModalOpen(true)}
            data-testid="btn-export-copil"
            className="flex items-center gap-2 px-4 py-1.5 bg-white text-m-blue text-sm font-bold rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Presentation size={14} /> Export COPIL
          </button>
          <button
            onClick={() => { setSelectedProjects(new Set()); setPreGovernanceId(null); }}
            data-testid="btn-clear-selection"
            className="ml-auto text-sm text-blue-100 hover:text-white transition-colors"
          >
            Annuler la sélection
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..." data-testid="portfolio-search"
            className="pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:border-m-blue w-52"
          />
        </div>
        <select value={filterRag} onChange={(e) => setFilterRag(e.target.value)} data-testid="portfolio-filter-rag"
          className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-m-blue">
          <option value="">Tous RAG</option>
          {["green","orange","red"].map((r) => <option key={r} value={r}>{RAG_LABELS[r]}</option>)}
        </select>
        <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} data-testid="portfolio-filter-methodology"
          className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-m-blue">
          <option value="">Toutes méthodos</option>
          <option value="waterfall">Waterfall</option>
          <option value="agile">Agile</option>
          <option value="safe">SAFe</option>
        </select>
        {programs.length > 0 && (
          <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} data-testid="portfolio-filter-program"
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-m-blue">
            <option value="">Tous programmes</option>
            {programs.map((prog) => <option key={prog.program_id} value={prog.program_id}>{prog.name}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="portfolio-filter-status"
          className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-m-blue">
          <option value="">Tous statuts</option>
          <option value="en_preparation">En préparation</option>
          <option value="actif">Actif</option>
          <option value="en_pause">En pause</option>
          <option value="cloture">Clôturé</option>
          <option value="archive">Archivé</option>
        </select>
        <SavedViews
          page="portfolio"
          getFilters={() => ({ search, filterRag, filterMethod, filterProgram, filterStatus, sortKey, sortDir })}
          onApply={(f) => {
            setSearch(f.search || "");
            setFilterRag(f.filterRag || "");
            setFilterMethod(f.filterMethod || "");
            setFilterProgram(f.filterProgram || "");
            setFilterStatus(f.filterStatus || "");
            if (f.sortKey) setSortKey(f.sortKey);
            if (f.sortDir) setSortDir(f.sortDir);
          }}
        />
        <button
          onClick={() => setFavoritesOnly((v) => !v)}
          data-testid="portfolio-filter-favorites"
          title="Afficher uniquement mes favoris"
          className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
            favoritesOnly ? "bg-amber-50 border-amber-300 text-amber-700 font-semibold" : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
          }`}
        >
          ★ Favoris{favorites.size > 0 ? ` (${favorites.size})` : ""}
        </button>
        {/* Bascule tuiles / liste */}
        <div className="ml-auto flex border border-m-border-strong rounded-lg overflow-hidden bg-white">
          <button
            onClick={() => switchView("tiles")}
            data-testid="view-toggle-tiles"
            className={`w-9 h-9 flex items-center justify-center transition-colors ${view === "tiles" ? "bg-m-blue-soft text-m-blue" : "text-m-muted hover:bg-m-surface"}`}
            title="Vue tuiles"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => switchView("list")}
            data-testid="view-toggle-list"
            className={`w-9 h-9 flex items-center justify-center transition-colors border-l border-m-border-strong ${view === "list" ? "bg-m-blue-soft text-m-blue" : "text-m-muted hover:bg-m-surface"}`}
            title="Vue liste"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Vue tuiles */}
      {view === "tiles" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5" data-testid="portfolio-tiles">
          {filtered.map((p) => (
            <ProjectTile
              key={p.project_id}
              project={p}
              program={programs.find((pr) => pr.program_id === p.program_id)}
              selected={selectedProjects.has(p.project_id)}
              onToggleSelect={() => toggleSelect(p.project_id)}
              onEdit={openEdit}
              onDelete={openDelete}
              canEdit={canEdit}
              canDelete={canDelete}
              favorite={favorites.has(p.project_id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-zinc-400 text-sm">Aucun projet correspondant aux filtres</div>
          )}
        </div>
      )}

      {/* Table */}
      <div className={`bg-white border border-zinc-200 rounded-lg shadow-sm overflow-x-auto ${view === "tiles" ? "hidden" : ""}`}>
        <table className="w-full text-sm" data-testid="portfolio-table">
          <thead>
            <tr className="bg-m-bg border-b border-m-border text-left">
              <th className="px-4 py-3 w-8">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={selectedProjects.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                  className="w-4 h-4 rounded-lg border-zinc-300 text-m-blue focus:ring-m-blue cursor-pointer"
                />
              </th>
              {[["status_rag","RAG"],["name","Nom"],["methodology","Méthodo"],["budget_total","Budget total"],["budget_forecast","Forecast"],["end_date_forecast","Fin prévue"]].map(([key, label]) => (
                <th key={key} onClick={() => toggleSort(key)}
                  className="px-4 py-3 text-xs font-semibold text-zinc-600 cursor-pointer hover:text-m-blue select-none whitespace-nowrap">
                  {label}{sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-semibold text-zinc-600 whitespace-nowrap">Bénéfices</th>
              {(canEdit || canDelete) && <th className="px-4 py-3 text-xs font-semibold text-zinc-600 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const prog = programs.find((pr) => pr.program_id === p.program_id);
              const overBudget = p.budget_forecast > p.budget_total * 1.05;
              return (
                <tr key={p.project_id} className="border-b border-zinc-100 hover:bg-blue-50/30 transition-colors" data-testid={`project-row-${p.project_id}`}>
                  <td className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(p.project_id)}
                      onChange={() => toggleSelect(p.project_id)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-project-${p.project_id}`}
                      className="w-4 h-4 rounded-lg border-zinc-300 text-m-blue focus:ring-m-blue cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3"><RAGBadge status={p.status_rag} /></td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link to={`/projects/${p.project_id}`} className="text-m-blue hover:text-m-blue-dark font-medium text-sm leading-snug" data-testid={`project-link-${p.project_id}`}>
                      {p.code && <span className="font-mono text-[10px] font-semibold text-zinc-400 mr-1.5" data-testid={`project-code-${p.project_id}`}>{p.code}</span>}
                      {p.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      {prog && <div className="text-[10px] text-zinc-400 truncate">{prog.name}</div>}
                      {prog && p.status && <span className="text-zinc-200">·</span>}
                      {p.status && <ProjectStatusBadge status={p.status} />}
                    </div>
                  </td>
                  <td className="px-4 py-3"><MethodologyBadge methodology={p.methodology} /></td>
                  <td className="px-4 py-3 font-mono-data text-xs text-zinc-700">{formatEuro(p.budget_total)}</td>
                  <td className="px-4 py-3 font-mono-data text-xs">
                    <span className={overBudget ? "text-rose-600 font-semibold" : "text-zinc-700"}>{formatEuro(p.budget_forecast)}</span>
                  </td>
                  <td className="px-4 py-3 font-mono-data text-xs text-zinc-600">{formatDate(p.end_date_forecast)}</td>
                  <td className="px-4 py-3 text-xs" data-testid={`project-benefits-${p.project_id}`}>
                    {(() => {
                      const b = benefitsPct(p);
                      if (!b) return <span className="text-zinc-300">—</span>;
                      return (
                        <span className={`font-mono-data font-semibold ${b.pct >= 100 ? "text-emerald-600" : b.pct >= 50 ? "text-amber-600" : "text-zinc-600"}`}>
                          {b.pct}% <span className="text-zinc-400 font-normal">de {Math.round(b.exp / 1000).toLocaleString("fr-FR")} K€</span>
                        </span>
                      );
                    })()}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                        <button onClick={(e) => openEdit(e, p)} data-testid={`btn-edit-project-${p.project_id}`}
                          className="p-1.5 text-zinc-400 hover:text-m-blue hover:bg-blue-50 rounded-lg transition-colors" title="Modifier">
                          <Pencil size={13} />
                        </button>
                        )}
                        {canDelete && (
                          <button onClick={(e) => openDelete(e, p)} data-testid={`btn-delete-project-${p.project_id}`}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Supprimer">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={(canEdit || canDelete) ? 9 : 8} className="text-center py-12 text-zinc-400 text-sm">Aucun projet correspondant aux filtres</td></tr>
            )}
          </tbody>
        </table>
      </div>

      </div>

      {pfTab === "indicateurs" && (
        <div className="mt-2">
          <IndicatorsPanel scope="portfolio" title="Indicateurs du portefeuille" />
        </div>
      )}

      <ExportCopilModal
        isOpen={exportModalOpen}
        onClose={() => { setExportModalOpen(false); setPreGovernanceId(null); }}
        selectedProjectIds={[...selectedProjects]}
        selectedProjectNames={projects.filter((p) => selectedProjects.has(p.project_id)).map((p) => p.name)}
        preGovernanceId={preGovernanceId}
      />
      <ProjectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        project={selectedProject}
        resources={resources}
        programs={programs}
        onSaved={fetchAll}
      />
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Supprimer le projet"
        message={`Supprimer "${confirmDelete?.name}" ? Toutes les tâches, jalons et allocations associés seront également supprimés.`}
      />
    </div>
  );
}
