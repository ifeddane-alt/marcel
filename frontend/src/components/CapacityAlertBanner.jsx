import React from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const LEVEL_CONFIG = {
  critique: { bg: "bg-red-50",     border: "border-red-300",   text: "text-red-700",   badge: "bg-red-600",   dot: "bg-red-500"   },
  rouge:    { bg: "bg-rose-50",    border: "border-rose-300",  text: "text-rose-700",  badge: "bg-rose-500",  dot: "bg-rose-500"  },
  orange:   { bg: "bg-amber-50",   border: "border-amber-300", text: "text-amber-700", badge: "bg-amber-500", dot: "bg-amber-500" },
};

export default function CapacityAlertBanner({ alerts, compact = false }) {
  if (!alerts || alerts.length === 0) return null;

  const critiques = alerts.filter((a) => a.level === "critique" || a.level === "rouge");
  const oranges   = alerts.filter((a) => a.level === "orange");

  if (compact) {
    // Version dashboard widget compacte
    return (
      <div className="bg-white border border-gray-200 rounded shadow-sm" data-testid="capacity-alerts-widget">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
            <AlertTriangle size={13} className="text-rose-400" />
            Alertes capacité équipes
          </div>
          <Link to="/teams" className="text-[10px] text-[#0052CC] hover:underline">
            Voir heatmap →
          </Link>
        </div>
        <div className="p-4 space-y-2">
          {alerts.slice(0, 5).map((a, i) => {
            const cfg = LEVEL_CONFIG[a.level] || LEVEL_CONFIG.orange;
            return (
              <div key={i} className={`flex items-center justify-between rounded-md px-3 py-2 border ${cfg.bg} ${cfg.border}`} data-testid={`alert-item-${a.team_name}-${a.period}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div>
                    <span className={`text-xs font-semibold ${cfg.text}`}>{a.team_name}</span>
                    <span className="text-[10px] text-slate-400 ml-2">{a.period}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-bold ${cfg.text}`}>{a.utilization_pct}%</span>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full text-white ${cfg.badge}`}>
                    {a.level}
                  </span>
                </div>
              </div>
            );
          })}
          {alerts.length > 5 && (
            <p className="text-[10px] text-slate-400 text-center pt-1">
              +{alerts.length - 5} autre(s) alerte(s)
            </p>
          )}
        </div>
      </div>
    );
  }

  // Version full bannière (Teams page)
  return (
    <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50" data-testid="capacity-alerts-banner">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-rose-200">
        <AlertTriangle size={15} className="text-rose-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-rose-700">
          {critiques.length} équipe{critiques.length > 1 ? "s" : ""} en surcharge
          {oranges.length > 0 && `, ${oranges.length} en alerte orange`}
        </span>
        <Link to="/resources?tab=heatmap" className="ml-auto text-xs text-[#0052CC] hover:underline font-medium">
          Voir heatmap →
        </Link>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {alerts.map((a, i) => {
          const cfg = LEVEL_CONFIG[a.level] || LEVEL_CONFIG.orange;
          return (
            <div key={i} className={`rounded border ${cfg.bg} ${cfg.border} px-3 py-2.5`} data-testid={`alert-banner-item-${a.team_name}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${cfg.text}`}>{a.team_name}</span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full text-white ${cfg.badge}`}>
                  {a.level}
                </span>
              </div>
              <div className={`text-lg font-mono font-bold ${cfg.text}`}>{a.utilization_pct}%</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {a.allocated_jh} / {a.capacity_jh} JH · {a.period}
              </div>
              {a.overloaded_resources?.slice(0, 2).map((r) => (
                <div key={r.resource_id} className="text-[10px] text-slate-400 mt-0.5 truncate">
                  ↳ {r.name} : {r.utilization_pct}%
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
