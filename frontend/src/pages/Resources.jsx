import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, BarChart3, User, Building2, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { resourcesAPI, allocationsAPI, teamsAPI } from "@/api";
import ResourceModal from "@/components/ResourceModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import CapacityHeatmap from "@/components/CapacityHeatmap";

const TYPE_CONFIG = {
  interne:         { label: "INTERNE",  Icon: User,      bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  externe_regie:   { label: "RÉGIE",    Icon: Building2, bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  externe_forfait: { label: "FORFAIT",  Icon: FileText,  bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
};

export default function Resources() {
  const { user } = useAuth();
  const canWrite = user?.role === "TENANT_ADMIN" || user?.role === "PMO_USER";
  const isAdmin = user?.role === "TENANT_ADMIN";

  const [resources, setResources] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);
  const [heatmapMonths, setHeatmapMonths] = useState(6);
  const [activeTab, setActiveTab] = useState("resources"); // "resources" | "heatmap"

  const fetchAll = () => {
    Promise.all([resourcesAPI.list(), allocationsAPI.list()])
      .then(([rRes, aRes]) => { setResources(rRes.data); setAllocations(aRes.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const fetchHeatmap = (months) => {
    teamsAPI.capacityHeatmap(months)
      .then((r) => setHeatmapData(r.data))
      .catch(() => {});
  };

  useEffect(() => { fetchAll(); fetchHeatmap(heatmapMonths); }, []);

  const handleMonthsChange = (m) => {
    setHeatmapMonths(m);
    fetchHeatmap(m);
  };

  const getChargeTotal = (id) => allocations.filter((a) => a.resource_id === id).reduce((s, a) => s + (a.jh_allocated || 0), 0);
  const filtered = resources.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !search || r.name.toLowerCase().includes(q) || r.role.toLowerCase().includes(q) || (r.team || "").toLowerCase().includes(q);
    const matchType = typeFilter === "all" || r.resource_type === typeFilter || (!r.resource_type && typeFilter === "interne");
    return matchSearch && matchType;
  });

  const openCreate = () => { setSelectedResource(null); setModalOpen(true); };
  const openEdit = (e, r) => { e.stopPropagation(); setSelectedResource(r); setModalOpen(true); };
  const handleDelete = async () => {
    setDeleting(true);
    try { await resourcesAPI.delete(confirmDelete.resource_id); setConfirmDelete(null); fetchAll(); }
    catch { /* ignore */ } finally { setDeleting(false); }
  };

  if (loading) return <div className="p-8 text-slate-400 text-sm">Chargement des ressources...</div>;

  return (
    <div className="p-8" data-testid="resources-page">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">Ressources</h1>
          <p className="text-sm text-slate-500 mt-0.5">{resources.length} ressources · Capacités et allocations</p>
        </div>
        {canWrite && (
          <button onClick={openCreate} data-testid="btn-new-resource"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] transition-colors shadow-sm">
            <Plus size={15} /> Nouvelle ressource
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {[
          { id: "resources", label: "Annuaire ressources" },
          { id: "heatmap", label: "Heatmap capacités", icon: BarChart3 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            data-testid={`tab-${id}`}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? "border-[#0052CC] text-[#0052CC]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {Icon && <Icon size={14} />}
            {label}
          </button>
        ))}
      </div>

      {activeTab === "resources" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total ressources", value: resources.length, sub: "actives" },
              { label: "Capacité mensuelle", value: `${resources.reduce((s, r) => s + (r.capacity_jh_month || 0), 0).toLocaleString("fr-FR")} JH`, sub: "total équipes" },
              { label: "Équipes", value: new Set(resources.map((r) => r.team).filter(Boolean)).size, sub: "distinctes" },
              { label: "Allocations actives", value: allocations.length, sub: "entrées" },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-[#0052CC]">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{card.label}</div>
                <div className="font-heading text-2xl font-bold text-[#0F172A] mt-2">{card.value}</div>
                <div className="text-xs text-slate-400 mt-0.5">{card.sub}</div>
              </div>
            ))}
          </div>

          <div className="relative mb-4 max-w-xs">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une ressource..." data-testid="resources-search-input"
              className="w-full pl-4 pr-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#0052CC]" />
          </div>

          {/* Filtres par type */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { id: "all", label: "Tous" },
              { id: "interne", label: "Interne", Icon: User, ...TYPE_CONFIG.interne },
              { id: "externe_regie", label: "Régie", Icon: Building2, ...TYPE_CONFIG.externe_regie },
              { id: "externe_forfait", label: "Forfait", Icon: FileText, ...TYPE_CONFIG.externe_forfait },
            ].map(({ id, label, Icon, bg, text, border }) => (
              <button
                key={id}
                onClick={() => setTypeFilter(id)}
                data-testid={`filter-type-${id}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border transition-all ${
                  typeFilter === id
                    ? `${bg || "bg-slate-100"} ${text || "text-slate-700"} ${border || "border-slate-300"}`
                    : "bg-white border-gray-200 text-slate-500 hover:border-gray-300"
                }`}
              >
                {Icon && <Icon size={11} />}
                {label}
                <span className={`text-[10px] font-mono ml-0.5 ${typeFilter === id ? "" : "text-slate-400"}`}>
                  {id === "all" ? resources.length : resources.filter(r => r.resource_type === id || (!r.resource_type && id === "interne")).length}
                </span>
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto">
            <table className="w-full text-sm" data-testid="resources-table">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  {["Ressource","Type","Rôle","Équipe","TJM","Dispo","Capa effective","JH alloués","Charge"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600">{h}</th>
                  ))}
                  {canWrite && <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const totalAllocated = getChargeTotal(r.resource_id);
                  const availRate = r.availability_rate != null ? r.availability_rate : 100;
                  const capaEffective = Math.round((r.capacity_jh_month || 0) * availRate / 100);
                  const chargeRate = capaEffective ? Math.round((totalAllocated / capaEffective) * 100) : 0;
                  const overloaded = chargeRate > 90;
                  const initials = r.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                  const teamLabel = r.team || "—";
                  return (
                    <tr key={r.resource_id} className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors" data-testid={`resource-row-${r.resource_id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-[#0052CC]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-[#0052CC]">{initials}</span>
                          </div>
                          <span className="font-medium text-slate-800">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const cfg = TYPE_CONFIG[r.resource_type || "interne"];
                          const { Icon } = cfg;
                          return (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                              data-testid={`resource-type-badge-${r.resource_id}`}>
                              <Icon size={10} />
                              {cfg.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.role}</td>
                      <td className="px-4 py-3">
                        {teamLabel !== "—" ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">{teamLabel}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {r.tjm_eur ? `${r.tjm_eur.toLocaleString("fr-FR")} €` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {availRate < 100 ? <span className="text-amber-600 font-semibold">{availRate}%</span> : <span className="text-slate-400">100%</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-bold text-slate-700">{capaEffective} JH</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-700">
                        {totalAllocated > 0 ? `${totalAllocated} JH` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {totalAllocated > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${overloaded ? "bg-rose-500" : "bg-[#0052CC]"}`} style={{ width: `${Math.min(chargeRate, 100)}%` }} />
                            </div>
                            <span className={`font-mono text-xs font-semibold ${overloaded ? "text-rose-600" : "text-slate-600"}`}>{chargeRate}%</span>
                          </div>
                        ) : <span className="text-slate-300 text-xs">Non allouée</span>}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={(e) => openEdit(e, r)} data-testid={`btn-edit-resource-${r.resource_id}`}
                              className="p-1.5 text-slate-400 hover:text-[#0052CC] hover:bg-blue-50 rounded transition-colors" title="Modifier">
                              <Pencil size={13} />
                            </button>
                            {isAdmin && (
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(r); }} data-testid={`btn-delete-resource-${r.resource_id}`}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Supprimer">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "heatmap" && (
        <div className="bg-white border border-gray-200 rounded shadow-sm p-5" data-testid="heatmap-section">
          <div className="mb-4">
            <h2 className="font-heading text-base font-bold text-[#0F172A] uppercase tracking-tight">Heatmap capacité × période</h2>
            <p className="text-xs text-slate-500 mt-0.5">Taux d'utilisation par équipe (allocations mensuelle / capacité effective)</p>
          </div>
          <CapacityHeatmap
            data={heatmapData}
            months={heatmapMonths}
            onMonthsChange={handleMonthsChange}
          />
        </div>
      )}

      <ResourceModal isOpen={modalOpen} onClose={() => setModalOpen(false)} resource={selectedResource} onSaved={fetchAll} />
      <ConfirmDialog
        isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete} loading={deleting}
        title="Supprimer la ressource"
        message={`Supprimer "${confirmDelete?.name}" ? Cette action est irréversible.`}
      />
    </div>
  );
}
