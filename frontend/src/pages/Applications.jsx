import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppWindow, Plus, Search, AlertTriangle, Grid3X3, ClipboardList, Euro, ShieldAlert } from "lucide-react";
import { applicationsAPI } from "@/api";
import { toast } from "sonner";
import { formatEuro } from "@/utils/format";
import { usePermissions } from "@/hooks/usePermissions";
import ApplicationModal, { APP_STATUSES, APP_STATUS_CFG, TIME_RATINGS, TIME_CFG, CRITICALITIES, CRIT_CFG } from "@/components/ApplicationModal";

function Kpi({ label, value, icon: Icon, accent, testId }) {
  return (
    <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4 flex items-center gap-3" data-testid={testId}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent || "bg-m-lilac text-m-primary"}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{label}</div>
        <div className="font-mono-data font-bold text-lg text-zinc-950 truncate">{value}</div>
      </div>
    </div>
  );
}

const label = (list, v) => list.find((x) => x.value === v)?.label || v || "—";

export default function Applications() {
  const navigate = useNavigate();
  const { hasAnyPermission } = usePermissions();
  const canWrite = hasAnyPermission("*", "portfolio.edit", "projects.create", "projects.edit");
  const [apps, setApps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("liste");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([applicationsAPI.list(), applicationsAPI.summary()])
      .then(([a, s]) => { setApps(a.data); setSummary(s.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    const res = await applicationsAPI.create(data);
    toast.success("Application créée");
    setModalOpen(false);
    load();
    navigate(`/applications/${res.data.application_id}`);
  };

  const filtered = apps.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (search && !`${a.name} ${a.code || ""} ${a.editor || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="p-8 text-sm text-zinc-400">Chargement du portefeuille applicatif…</div>;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="applications-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl font-extrabold text-m-ink flex items-center gap-2">
            <AppWindow size={20} className="text-m-primary" /> Portefeuille Applicatif
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Référentiel des applications de la DSI — cycle de vie, TCO, rationalisation TIME</p>
        </div>
        {canWrite && (
          <button onClick={() => setModalOpen(true)} data-testid="btn-new-application"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-m-blue text-white text-xs font-semibold rounded-lg hover:bg-m-blue-dark transition-colors">
            <Plus size={13} /> Nouvelle application
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Applications" value={summary?.total ?? 0} icon={AppWindow} testId="apm-kpi-total" />
        <Kpi label="TCO annuel (run)" value={formatEuro(summary?.tco_total || 0)} icon={Euro} testId="apm-kpi-tco" />
        <Kpi label="Apps critiques" value={summary?.critical_apps ?? 0} icon={ShieldAlert}
          accent={summary?.critical_apps > 0 ? "bg-rose-50 text-rose-600" : undefined} testId="apm-kpi-critical" />
        <Kpi label="Alertes obsolescence" value={(summary?.obsolete_components || 0) + (summary?.obsolescence_warnings || 0)} icon={AlertTriangle}
          accent={(summary?.obsolete_components || 0) > 0 ? "bg-amber-50 text-amber-600" : undefined} testId="apm-kpi-obsolescence" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={() => setView("liste")} data-testid="apm-view-liste-btn"
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${view === "liste" ? "bg-m-blue text-white" : "text-zinc-500 border border-zinc-200 hover:bg-zinc-50"}`}>
            <ClipboardList size={11} /> Liste
          </button>
          <button onClick={() => setView("time")} data-testid="apm-view-time-btn"
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${view === "time" ? "bg-m-blue text-white" : "text-zinc-500 border border-zinc-200 hover:bg-zinc-50"}`}>
            <Grid3X3 size={11} /> Matrice TIME
          </button>
          <button onClick={() => setView("capacites")} data-testid="apm-view-capacites-btn"
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${view === "capacites" ? "bg-m-blue text-white" : "text-zinc-500 border border-zinc-200 hover:bg-zinc-50"}`}>
            <AppWindow size={11} /> Capacités métiers
          </button>
        </div>
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" data-testid="apm-search-input"
            className="pl-8 pr-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-m-blue w-44" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="apm-status-filter"
          className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-m-blue">
          <option value="">Tous statuts</option>
          {APP_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {view === "capacites" ? <CapacitiesView apps={apps} navigate={navigate} /> : view === "liste" ? (
        <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-sm text-zinc-400 text-center" data-testid="apm-empty">
              Aucune application — créez la première fiche du référentiel applicatif.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-m-bg border-b border-m-border text-left">
                  {["Application", "Cycle de vie", "Criticité", "TIME", "Éditeur / Techno", "TCO annuel", "Projets", "Obsolescence"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[10.5px] uppercase tracking-wider font-bold text-m-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.application_id} onClick={() => navigate(`/applications/${a.application_id}`)}
                    className="border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors cursor-pointer"
                    data-testid={`app-row-${a.application_id}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-zinc-800 text-xs">{a.name}</div>
                      {a.code && <div className="font-mono-data text-[10px] text-zinc-400">{a.code}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${APP_STATUS_CFG[a.status] || APP_STATUS_CFG.production}`}>
                        {label(APP_STATUSES, a.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${CRIT_CFG[a.criticality] || CRIT_CFG.basse}`}>
                        {label(CRITICALITIES, a.criticality)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {a.time_rating ? (
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-lg border ${TIME_CFG[a.time_rating]}`}>
                          {label(TIME_RATINGS, a.time_rating)}
                        </span>
                      ) : <span className="text-zinc-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">
                      {a.editor || "—"}{a.technology ? ` · ${a.technology}` : ""}
                    </td>
                    <td className="px-3 py-2.5 font-mono-data text-xs text-zinc-700 whitespace-nowrap">
                      {a.tco_annual ? formatEuro(a.tco_annual) : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono-data text-xs text-zinc-600">{a.project_count || 0}</td>
                    <td className="px-3 py-2.5">
                      {a.obsolete_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded-lg border bg-rose-50 text-rose-700 border-rose-200">
                          <AlertTriangle size={9} /> {a.obsolete_count} obsolète{a.obsolete_count > 1 ? "s" : ""}
                        </span>
                      ) : a.obsolescence_warning_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded-lg border bg-amber-50 text-amber-700 border-amber-200">
                          <AlertTriangle size={9} /> {a.obsolescence_warning_count} fin proche
                        </span>
                      ) : <span className="text-emerald-500 text-[10px] font-semibold">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="apm-time-matrix">
          {TIME_RATINGS.map((t) => {
            const items = filtered.filter((a) => a.time_rating === t.value);
            return (
              <div key={t.value} className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4" data-testid={`time-quadrant-${t.value}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-lg border ${TIME_CFG[t.value]}`}>{t.label}</span>
                  <span className="font-mono-data text-xs font-bold text-zinc-500">{items.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                  {items.length === 0 && <span className="text-[11px] text-zinc-300">Aucune application</span>}
                  {items.map((a) => (
                    <button key={a.application_id} onClick={() => navigate(`/applications/${a.application_id}`)}
                      data-testid={`time-chip-${a.application_id}`}
                      className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-zinc-700 bg-m-bg border border-m-border rounded-lg hover:border-blue-400 transition-colors">
                      <span className={`w-1.5 h-1.5 rounded-full ${a.criticality === "critique" ? "bg-rose-500" : a.criticality === "haute" ? "bg-amber-500" : "bg-zinc-300"}`} />
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.some((a) => !a.time_rating) && (
            <div className="md:col-span-2 bg-white border border-dashed border-m-border rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-2">Non classées</div>
              <div className="flex flex-wrap gap-1.5">
                {filtered.filter((a) => !a.time_rating).map((a) => (
                  <button key={a.application_id} onClick={() => navigate(`/applications/${a.application_id}`)}
                    className="px-2 py-1 text-[11px] font-medium text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg hover:border-blue-400 transition-colors">
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {modalOpen && <ApplicationModal onClose={() => setModalOpen(false)} onSave={handleCreate} />}
    </div>
  );
}

function CapacitiesView({ apps, navigate }) {
  const agg = {};
  apps.forEach((a) => {
    (a.business_capabilities || []).forEach((c) => {
      const name = (c || "").trim();
      if (!name) return;
      const k = name.toLowerCase();
      if (!agg[k]) agg[k] = { name, apps: [], tco: 0 };
      agg[k].apps.push(a);
      agg[k].tco += a.tco_annual || 0;
    });
  });
  const caps = Object.values(agg).sort((a, b) => b.apps.length - a.apps.length);
  if (caps.length === 0)
    return (
      <div className="bg-white border border-m-border rounded-xl p-10 text-center text-sm text-zinc-400" data-testid="capacities-empty">
        Aucune capacité métier renseignée — ajoutez-les sur les fiches applications (champ « Capacités métiers »).
      </div>
    );
  return (
    <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] overflow-x-auto" data-testid="capacities-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-m-bg border-b border-m-border text-left">
            {["Capacité métier", "Applications", "TCO annuel cumulé", "Redondance"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-[10.5px] uppercase tracking-wider font-bold text-m-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {caps.map((c) => (
            <tr key={c.name} className="border-b border-zinc-100" data-testid={`capacity-row-${c.name}`}>
              <td className="px-4 py-2.5 font-semibold text-zinc-800">{c.name}</td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {c.apps.map((a) => (
                    <button key={a.application_id} onClick={() => navigate(`/applications/${a.application_id}`)}
                      data-testid={`capacity-app-${a.application_id}`}
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-m-blue-soft text-m-blue hover:bg-[#d5e2fc]">
                      {a.name}
                    </button>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 font-mono-data text-xs font-bold">{formatEuro(c.tco)}</td>
              <td className="px-4 py-2.5">
                {c.apps.length > 1 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    {c.apps.length} apps — rationalisation possible
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
