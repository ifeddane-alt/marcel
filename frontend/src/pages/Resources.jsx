import React, { useEffect, useState } from "react";
import { Users, Search } from "lucide-react";
import { resourcesAPI, allocationsAPI } from "@/api";

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([resourcesAPI.list(), allocationsAPI.list()]).then(([rRes, aRes]) => {
      setResources(rRes.data);
      setAllocations(aRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const getResourceAllocations = (resourceId) =>
    allocations.filter((a) => a.resource_id === resourceId);

  const getChargeTotal = (resourceId) => {
    const allocs = getResourceAllocations(resourceId);
    return allocs.reduce((sum, a) => sum + (a.jh_allocated || 0), 0);
  };

  const filtered = resources.filter((r) => {
    const q = search.toLowerCase();
    return (
      !search ||
      r.name.toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q) ||
      r.team.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-slate-400 text-sm">
        Chargement des ressources...
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="resources-page">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
            Ressources
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {resources.length} ressources · Capacités et allocations
          </p>
        </div>
      </div>

      {/* Capacity summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total ressources", value: resources.length, sub: "actives" },
          { label: "Capacité mensuelle", value: `${resources.reduce((s, r) => s + r.capacity_jh_month, 0).toLocaleString("fr-FR")} JH`, sub: "total équipes" },
          { label: "Équipes", value: new Set(resources.map((r) => r.team)).size, sub: "distinctes" },
          { label: "Allocations actives", value: allocations.length, sub: "entrées" },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-[#0052CC]">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{card.label}</div>
            <div className="font-heading text-2xl font-bold text-[#0F172A] mt-2">{card.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une ressource..."
          data-testid="resources-search-input"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto">
        <table className="w-full text-sm" data-testid="resources-table">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {["Ressource", "Rôle", "Équipe", "Capacité / mois", "JH alloués (total)", "Taux de charge"].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const totalAllocated = getChargeTotal(r.resource_id);
              const chargeRate = r.capacity_jh_month
                ? Math.round((totalAllocated / r.capacity_jh_month) * 100)
                : 0;
              const overloaded = chargeRate > 90;

              return (
                <tr
                  key={r.resource_id}
                  className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors"
                  data-testid={`resource-row-${r.resource_id}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded bg-[#0052CC]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-[#0052CC]">
                          {r.name.split("_")[1] || "?"}
                        </span>
                      </div>
                      <span className="font-medium text-slate-800">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.role}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                      {r.team}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono-data text-sm font-bold text-slate-700">
                    {r.capacity_jh_month} JH
                  </td>
                  <td className="px-4 py-3 font-mono-data text-sm text-slate-700">
                    {totalAllocated > 0 ? `${totalAllocated} JH` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {totalAllocated > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${overloaded ? "bg-rose-500" : "bg-[#0052CC]"}`}
                            style={{ width: `${Math.min(chargeRate, 100)}%` }}
                          />
                        </div>
                        <span className={`font-mono-data text-xs font-semibold ${overloaded ? "text-rose-600" : "text-slate-600"}`}>
                          {chargeRate}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">Non allouée</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
