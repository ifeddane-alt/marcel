import React, { useEffect, useState, useCallback } from "react";
import {
  Activity, Database, Clock, AlertTriangle, CheckCircle,
  RefreshCw, Server, Shield, TrendingUp, FileText
} from "lucide-react";
import api from "@/api";

const REFRESH_INTERVAL = 30; // secondes

export default function AdminMonitoring() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/monitoring");
      setData(res.data);
      setLastUpdated(new Date());
      setError(null);
      setCountdown(REFRESH_INTERVAL);
    } catch (err) {
      setError(err.response?.data?.detail || "Impossible de récupérer les statistiques.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          fetchStats();
          return REFRESH_INTERVAL;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const statusColor = (s) =>
    s === "ok" ? "text-emerald-600" : s === "degraded" ? "text-amber-500" : "text-red-500";

  const statusBg = (s) =>
    s === "ok" ? "bg-emerald-50 border-emerald-200" : s === "degraded" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Monitoring Production</h1>
            <p className="text-sm text-slate-500">
              Statut des services MARCEL
              {lastUpdated && (
                <span className="ml-2 text-slate-400">
                  · Mis à jour {lastUpdated.toLocaleTimeString("fr-FR")}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Actualisation dans {countdown}s</span>
          <button
            data-testid="monitoring-refresh-btn"
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div data-testid="monitoring-error" className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Statut global */}
          <div
            data-testid="monitoring-status-banner"
            className={`flex items-center gap-4 p-4 border rounded-xl ${statusBg(data.status)}`}
          >
            {data.status === "ok" ? (
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            )}
            <div>
              <p className={`font-semibold ${statusColor(data.status)}`}>
                {data.status === "ok" ? "Tous les services opérationnels" : "Service dégradé"}
              </p>
              <p className="text-xs text-slate-500">MARCEL v{data.version}</p>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Server className="w-5 h-5" />}
              label="Statut API"
              value={data.status === "ok" ? "Opérationnel" : "Dégradé"}
              valueClass={statusColor(data.status)}
              testid="kpi-api-status"
            />
            <KpiCard
              icon={<Database className="w-5 h-5" />}
              label="Base de données"
              value={data.database.status === "ok" ? "Connectée" : "Erreur"}
              valueClass={statusColor(data.database.status)}
              sub={data.database.message}
              testid="kpi-db-status"
            />
            <KpiCard
              icon={<Clock className="w-5 h-5" />}
              label="Uptime"
              value={data.uptime_human}
              testid="kpi-uptime"
            />
            <KpiCard
              icon={<Shield className="w-5 h-5" />}
              label="Erreurs 5xx"
              value={data.error_counts["5xx"] || 0}
              valueClass={(data.error_counts["5xx"] || 0) > 0 ? "text-red-600" : "text-emerald-600"}
              sub={`429 bloqués : ${data.error_counts["429"] || 0}`}
              testid="kpi-errors"
            />
          </div>

          {/* Collections MongoDB */}
          {data.collections && Object.keys(data.collections).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-slate-700 text-sm">Collections MongoDB</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0">
                {Object.entries(data.collections).map(([col, count], i) => (
                  <div
                    key={col}
                    data-testid={`mongo-col-${col}`}
                    className={`px-4 py-3 ${i < Object.keys(data.collections).length - 1 ? "border-r border-slate-100" : ""}`}
                  >
                    <p className="text-xl font-bold text-slate-800">{count.toLocaleString("fr-FR")}</p>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">{col}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Erreurs détail */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-700 text-sm">Compteurs d'erreurs (depuis dernier redémarrage)</h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <ErrorRow
                label="Erreurs serveur (5xx)"
                count={data.error_counts["5xx"] || 0}
                color="red"
                testid="error-5xx"
              />
              <ErrorRow
                label="Requêtes bloquées (429)"
                count={data.error_counts["429"] || 0}
                color="amber"
                testid="error-429"
              />
            </div>
            <p className="px-5 pb-4 text-xs text-slate-400">
              * Les compteurs sont remis à zéro lors du redémarrage de l'API. Déployez un outil APM (Sentry, Datadog) pour la persistance.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, valueClass = "text-slate-800", testid }) {
  return (
    <div data-testid={testid} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-xs">{label}</span></div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function ErrorRow({ label, count, color, testid }) {
  const colors = {
    red: { bar: "bg-red-500", text: "text-red-600", bg: "bg-red-50" },
    amber: { bar: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50" },
  };
  const c = colors[color];
  return (
    <div data-testid={testid} className={`${c.bg} rounded-lg p-4`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c.text}`}>{count}</p>
      <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${c.bar} rounded-full transition-all`}
          style={{ width: count > 0 ? "100%" : "0%" }}
        />
      </div>
    </div>
  );
}
