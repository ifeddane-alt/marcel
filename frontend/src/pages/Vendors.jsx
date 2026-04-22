import React, { useEffect, useState } from "react";
import {
  Building2, AlertTriangle, Clock, Download,
  ChevronDown, ChevronRight, Package, Handshake
} from "lucide-react";
import { vendorsAPI } from "@/api";

function StatCard({ label, value, sub, accent, alert }) {
  return (
    <div className={`bg-white border rounded shadow-sm p-4 border-l-4 ${alert ? "border-l-rose-500" : `border-l-[${accent || "#0052CC"}]`}`}
      style={!alert ? { borderLeftColor: accent || "#0052CC" } : {}}>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
      <div className={`font-heading text-2xl font-bold mt-2 ${alert ? "text-rose-600" : "text-[#0F172A]"}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function AlertBadge({ level, message }) {
  const isC = level === "critical";
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded text-xs ${isC ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function ProgressBar({ pct, warn }) {
  const color = pct > 95 ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-violet-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold w-10 text-right ${warn ? "text-rose-600" : "text-slate-700"}`}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function VendorCard({ vendor }) {
  const [expanded, setExpanded] = useState(true);
  const hasRegie   = vendor.resources_regie.length > 0;
  const hasForfait = vendor.resources_forfait.length > 0;
  const totalAlerts = vendor.alerts.length;

  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden" data-testid={`vendor-card-${vendor.vendor.replace(/\s/g, "-").toLowerCase()}`}>
      {/* En-tête fournisseur */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/70 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0052CC]/10 flex items-center justify-center flex-shrink-0">
            <Building2 size={16} className="text-[#0052CC]" />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-sm">{vendor.vendor}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {hasRegie && (
                <span className="text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded">
                  {vendor.resources_regie.length} RÉGIE
                </span>
              )}
              {hasForfait && (
                <span className="text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded">
                  {vendor.resources_forfait.length} FORFAIT
                </span>
              )}
              {totalAlerts > 0 && (
                <span className="text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded flex items-center gap-1">
                  <AlertTriangle size={9} /> {totalAlerts} alerte{totalAlerts > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {hasRegie && (
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Enveloppe TJM</div>
              <div className="font-mono-data text-sm font-bold text-orange-700">
                {vendor.total_tjm_contractuel.toLocaleString("fr-FR")} €/j
              </div>
            </div>
          )}
          {hasForfait && (
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Forfait total</div>
              <div className="font-mono-data text-sm font-bold text-violet-700">
                {(vendor.total_forfait_envelope / 1000).toFixed(0)} K€
              </div>
            </div>
          )}
          {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Alertes */}
          {totalAlerts > 0 && (
            <div className="px-5 py-3 space-y-2 border-b border-gray-100 bg-slate-50/50">
              {vendor.alerts.map((a, i) => (
                <AlertBadge key={i} level={a.level} message={a.message} />
              ))}
            </div>
          )}

          {/* Ressources Régie */}
          {hasRegie && (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] uppercase tracking-widest font-bold text-orange-600">Régie</span>
                <span className="h-px flex-1 bg-orange-100" />
              </div>
              <table className="w-full text-sm" data-testid={`regie-table-${vendor.vendor}`}>
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400 text-left">
                    <th className="pb-2 font-semibold">Consultant</th>
                    <th className="pb-2 font-semibold text-right">TJM Contrat</th>
                    <th className="pb-2 font-semibold text-right">TJM Facturé</th>
                    <th className="pb-2 font-semibold text-right">Variance</th>
                    <th className="pb-2 font-semibold text-right">Fin contrat</th>
                  </tr>
                </thead>
                <tbody>
                  {vendor.resources_regie.map((r) => {
                    const ctjm = r.contract_tjm || 0;
                    const ftjm = r.tjm_eur || 0;
                    const variance = ctjm > 0 ? ((ftjm - ctjm) / ctjm * 100) : 0;
                    const varOver = variance > 0;
                    return (
                      <tr key={r.resource_id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2.5">
                          <div className="font-medium text-slate-800 text-sm">{r.name}</div>
                          <div className="text-xs text-slate-400">{r.role}</div>
                        </td>
                        <td className="py-2.5 text-right font-mono-data text-sm text-slate-600">
                          {ctjm > 0 ? `${ctjm.toLocaleString("fr-FR")} €` : "—"}
                        </td>
                        <td className="py-2.5 text-right font-mono-data text-sm font-bold text-slate-800">
                          {ftjm > 0 ? `${ftjm.toLocaleString("fr-FR")} €` : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          {ctjm > 0 && ftjm > 0 ? (
                            <span className={`text-xs font-bold font-mono-data ${varOver ? "text-rose-600" : "text-emerald-600"}`}>
                              {varOver ? "+" : ""}{variance.toFixed(1)}%
                            </span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="py-2.5 text-right">
                          {r.contract_end ? (
                            <span className="text-xs text-slate-500">
                              {new Date(r.contract_end).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                            </span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Ressources Forfait */}
          {hasForfait && (
            <div className={`px-5 py-4 ${hasRegie ? "border-t border-gray-100" : ""}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] uppercase tracking-widest font-bold text-violet-600">Forfait</span>
                <span className="h-px flex-1 bg-violet-100" />
              </div>
              <div className="space-y-3">
                {vendor.resources_forfait.map((f) => {
                  const warn = f.pct_consumed > 85;
                  return (
                    <div key={f.resource_id} className={`rounded-lg p-4 border ${warn ? "bg-rose-50/50 border-rose-200" : "bg-violet-50/30 border-violet-100"}`}
                      data-testid={`forfait-row-${f.resource_id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{f.name}</div>
                          <div className="text-xs text-slate-400">{f.role}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono-data text-sm font-bold text-violet-700">
                            {(f.forfait_envelope / 1000).toFixed(0)} K€
                          </div>
                          <div className="text-[11px] text-slate-400">enveloppe</div>
                        </div>
                      </div>
                      <ProgressBar pct={f.pct_consumed} warn={warn} />
                      <div className="flex justify-between text-xs text-slate-400 mt-1.5">
                        <span>Consommé : <strong className="text-slate-600">{(f.forfait_consumed / 1000).toFixed(0)} K€</strong></span>
                        <span>Reste : <strong className={warn ? "text-rose-600" : "text-emerald-600"}>
                          {((f.forfait_envelope - f.forfait_consumed) / 1000).toFixed(0)} K€
                        </strong></span>
                      </div>
                      {f.contract_end && (
                        <div className="flex items-center gap-1 mt-2 text-[11px] text-slate-400">
                          <Clock size={10} />
                          Contrat jusqu'au {new Date(f.contract_end).toLocaleDateString("fr-FR")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contrats expirant bientôt */}
          {vendor.expiring_soon.length > 0 && (
            <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-100">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-amber-700 mb-2">
                <Clock size={11} /> Contrats expirant sous 90 jours
              </div>
              {vendor.expiring_soon.map((e) => (
                <div key={e.resource_id} className="text-xs text-amber-700 flex items-center justify-between py-0.5">
                  <span>{e.name}</span>
                  <span className="font-mono font-bold">{e.days_left}j restants</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Vendors() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    vendorsAPI.summary()
      .then((r) => { setData(r.data); setLoading(false); })
      .catch((err) => {
        setError(err.response?.data?.detail || "Erreur lors du chargement");
        setLoading(false);
      });
  }, []);

  const handleExportCSV = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem("projetenne_token");
      const resp = await fetch(`${API_URL}/api/vendors/export/csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "contrats_fournisseurs.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { console.error("Export CSV error", e); }
  };

  if (loading) return <div className="p-8 text-slate-400 text-sm">Chargement des fournisseurs...</div>;
  if (error) return <div className="p-8 text-rose-600 text-sm">{error}</div>;

  const { vendors = [], summary = {} } = data || {};
  const totalForfaitPct = summary.total_forfait_envelope > 0
    ? Math.round(summary.total_forfait_consumed / summary.total_forfait_envelope * 100)
    : 0;

  return (
    <div className="p-8" data-testid="vendors-page">
      {/* En-tête */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight flex items-center gap-2">
            <Handshake size={26} className="text-[#0052CC]" />
            Suivi Fournisseurs
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {summary.total_vendors} fournisseur{summary.total_vendors !== 1 ? "s" : ""} actifs ·
            {summary.total_regie_resources} régie · {summary.total_forfait_resources} forfait
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          data-testid="export-csv-btn"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#0052CC] border border-[#0052CC]/30 rounded hover:bg-[#0052CC]/5 transition-colors"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Fournisseurs"
          value={summary.total_vendors}
          sub={`${summary.total_regie_resources} régie · ${summary.total_forfait_resources} forfait`}
          accent="#0052CC"
        />
        <StatCard
          label="Enveloppe TJM régie"
          value={`${summary.total_tjm_envelope?.toLocaleString("fr-FR") || 0} €/j`}
          sub="TJM contractuels cumulés"
          accent="#f97316"
        />
        <StatCard
          label="Forfait total engagé"
          value={`${((summary.total_forfait_envelope || 0) / 1000).toFixed(0)} K€`}
          sub={`${totalForfaitPct}% consommé`}
          accent="#7c3aed"
        />
        <StatCard
          label="Alertes actives"
          value={summary.total_alerts || 0}
          sub={`${summary.total_expiring_soon || 0} contrat${(summary.total_expiring_soon || 0) !== 1 ? "s" : ""} expirant < 90j`}
          alert={(summary.total_alerts || 0) > 0}
        />
      </div>

      {/* Alerte globale si forfait consommé */}
      {summary.total_alerts > 0 && (
        <div className="mb-5 bg-rose-50 border border-rose-200 rounded px-4 py-3 flex items-start gap-3" data-testid="vendors-global-alert">
          <AlertTriangle size={15} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-rose-700">
            <strong>{summary.total_alerts} alerte{summary.total_alerts > 1 ? "s" : ""}</strong> détectée{summary.total_alerts > 1 ? "s" : ""} :
            variances TJM, consommations forfait élevées, ou contrats expirant bientôt.
          </div>
        </div>
      )}

      {/* Liste des fournisseurs */}
      {vendors.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded shadow-sm p-12 text-center">
          <Package size={32} className="text-slate-300 mx-auto mb-3" />
          <div className="text-slate-500 text-sm font-medium">Aucune ressource externe configurée</div>
          <div className="text-slate-400 text-xs mt-1">
            Ajoutez des ressources de type "Externe Régie" ou "Externe Forfait" depuis la page Ressources.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {vendors.map((v) => (
            <VendorCard key={v.vendor} vendor={v} />
          ))}
        </div>
      )}
    </div>
  );
}
