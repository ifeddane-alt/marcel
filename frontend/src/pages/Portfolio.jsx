import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, ArrowUpDown } from "lucide-react";
import { projectsAPI } from "@/api";
import RAGBadge, { MethodologyBadge } from "@/components/RAGBadge";
import { formatEuro, formatDate } from "@/utils/format";

const RAG_OPTIONS = ["", "green", "orange", "red"];
const METHOD_OPTIONS = ["", "waterfall", "agile", "safe"];

export default function Portfolio() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRag, setFilterRag] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    projectsAPI.list().then((r) => {
      setProjects(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase();
      return (
        (!search || p.name.toLowerCase().includes(q) || (p.source_id || "").toLowerCase().includes(q)) &&
        (!filterRag || p.status_rag === filterRag) &&
        (!filterMethod || p.methodology === filterMethod)
      );
    })
    .sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ k }) =>
    sortKey === k ? (
      <ArrowUpDown size={12} className="text-[#0052CC]" />
    ) : (
      <ArrowUpDown size={12} className="text-slate-300" />
    );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-slate-400 text-sm">
        Chargement du portefeuille...
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="portfolio-page">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
            Portefeuille Projets
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} projet{filtered.length > 1 ? "s" : ""} affiché
            {filtered.length > 1 ? "s" : ""} sur {projects.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap" data-testid="portfolio-filters">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un projet..."
            data-testid="portfolio-search-input"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Filter size={13} />
          <span>Statut :</span>
        </div>
        <select
          value={filterRag}
          onChange={(e) => setFilterRag(e.target.value)}
          data-testid="portfolio-filter-rag"
          className="text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:border-[#0052CC] cursor-pointer"
        >
          <option value="">Tous</option>
          <option value="green">Vert</option>
          <option value="orange">Orange</option>
          <option value="red">Rouge</option>
        </select>

        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          data-testid="portfolio-filter-methodology"
          className="text-sm border border-gray-200 rounded px-3 py-2 bg-white focus:outline-none focus:border-[#0052CC] cursor-pointer"
        >
          <option value="">Toutes méthodos</option>
          <option value="waterfall">Waterfall</option>
          <option value="agile">Agile</option>
          <option value="safe">SAFe</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto">
        <table className="w-full text-sm" data-testid="portfolio-table">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {[
                { key: "source_id", label: "Réf." },
                { key: "name", label: "Nom du projet" },
                { key: "methodology", label: "Méthodo" },
                { key: "status_rag", label: "Statut RAG" },
                { key: "budget_total", label: "Budget total" },
                { key: "budget_consumed", label: "Consommé" },
                { key: "budget_forecast", label: "Forecast" },
                { key: "end_date_forecast", label: "Fin prévue" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    {label}
                    <SortIcon k={key} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-semibold text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const overBudget = p.budget_forecast > p.budget_total * 1.05;
              return (
                <tr
                  key={p.project_id}
                  className={`border-b border-gray-100 hover:bg-gray-50/60 transition-colors ${overBudget ? "bg-rose-50/30" : ""}`}
                  data-testid={`portfolio-row-${p.project_id}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono-data text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {p.source_id || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link
                      to={`/projects/${p.project_id}`}
                      className="text-[#0052CC] hover:text-[#0047B3] font-medium text-sm leading-snug"
                      data-testid={`project-link-${p.project_id}`}
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <MethodologyBadge methodology={p.methodology} />
                  </td>
                  <td className="px-4 py-3">
                    <RAGBadge status={p.status_rag} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono-data text-xs text-slate-700">
                    {formatEuro(p.budget_total)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-data text-xs">
                    <span className={`${p.budget_consumed / p.budget_total > 0.9 ? "text-rose-600 font-semibold" : "text-slate-700"}`}>
                      {formatEuro(p.budget_consumed)}
                    </span>
                    <div className="mt-1 h-1 bg-gray-100 rounded-full w-16 ml-auto">
                      <div
                        className={`h-full rounded-full ${p.budget_consumed / p.budget_total > 0.9 ? "bg-rose-500" : "bg-[#0052CC]"}`}
                        style={{ width: `${Math.min((p.budget_consumed / p.budget_total) * 100, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-data text-xs">
                    <span className={`${overBudget ? "text-rose-600 font-semibold" : "text-slate-700"}`}>
                      {formatEuro(p.budget_forecast)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {formatDate(p.end_date_forecast)}
                    {p.end_date_forecast > p.end_date_baseline && (
                      <div className="text-[10px] text-rose-500 mt-0.5">
                        baseline: {formatDate(p.end_date_baseline)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/projects/${p.project_id}`}
                      className="text-xs text-[#0052CC] hover:text-[#0047B3] font-medium"
                      data-testid={`portfolio-detail-btn-${p.project_id}`}
                    >
                      Détail →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">
                  Aucun projet ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
