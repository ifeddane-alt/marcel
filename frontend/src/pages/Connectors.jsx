import React, { useState, useEffect, useCallback } from "react";
import {
  Settings, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Clock, ChevronDown, ChevronUp, X, Save, Loader, Eye, EyeOff,
  Database, GitBranch, LifeBuoy, ArrowRight, History, Toggle,
  Zap, Activity,
} from "lucide-react";
import { connectorsAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

/* ─── Meta connecteurs ───────────────────────────────────────────────────────── */
const CONNECTOR_META = {
  jira: {
    label: "Jira",
    description: "Synchronisation Epics / Stories ↔ features & tâches MARCEL",
    icon: GitBranch,
    color: "#0052CC",
    bg: "#E6F0FF",
  },
  sap: {
    label: "SAP",
    description: "Budgets & centres de coût SAP ↔ projets MARCEL",
    icon: Database,
    color: "#007DC6",
    bg: "#E3F3FF",
  },
  servicenow: {
    label: "ServiceNow",
    description: "Change Requests / Incidents ↔ demandes & risques MARCEL",
    icon: LifeBuoy,
    color: "#62BE24",
    bg: "#EDFADF",
  },
};

const STATUS_LABELS = {
  success: { label: "Succès",  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  partial: { label: "Partiel", color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     dot: "bg-amber-500" },
  error:   { label: "Erreur",  color: "text-red-700",     bg: "bg-red-50 border-red-200",         dot: "bg-red-500" },
  running: { label: "En cours",color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",       dot: "bg-blue-500 animate-pulse" },
};

const DIRECTION_LABELS = { import: "Import", export: "Export", bidirectional: "Bidirectionnel" };
const FREQ_LABELS      = { manual: "Manuel", hourly: "Toutes les heures", daily: "Quotidien" };

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
    </span>
  );
}

/* ─── ConnectorCard ──────────────────────────────────────────────────────────── */
function ConnectorCard({ connector, onConfigure, onSync, onLogs, syncing }) {
  const meta = CONNECTOR_META[connector.type] || {};
  const Icon = meta.icon || Settings;
  const isConfigured = !!connector.base_url;
  const isEnabled = connector.enabled;
  const isConnected = isEnabled && isConfigured;

  const connStatus = !isConfigured
    ? { label: "Non configuré", dot: "bg-slate-400", color: "text-slate-500" }
    : !isEnabled
    ? { label: "Désactivé",    dot: "bg-slate-400", color: "text-slate-500" }
    : { label: "Activé",       dot: "bg-emerald-500", color: "text-emerald-700" };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-testid={`connector-card-${connector.type}`}>
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: meta.bg }}>
              <Icon size={20} style={{ color: meta.color }} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">{meta.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5 max-w-[200px]">{meta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connStatus.dot}`} />
            <span className={`text-xs font-medium ${connStatus.color}`}>{connStatus.label}</span>
          </div>
        </div>
      </div>

      {/* Body — dernière sync */}
      <div className="px-5 py-3 space-y-1.5">
        {connector.last_sync_at ? (
          <>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Dernière sync</span>
              <span className="text-slate-700 font-medium">{formatDate(connector.last_sync_at)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Statut</span>
              <StatusBadge status={connector.last_sync_status} />
            </div>
            {connector.last_sync_error && (
              <div className="text-xs text-red-500 truncate" title={connector.last_sync_error}>
                ⚠ {connector.last_sync_error}
              </div>
            )}
            {connector.base_url && (
              <div className="text-xs text-slate-400 truncate" title={connector.base_url}>
                {connector.base_url}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-slate-400 py-2">
            {isConfigured ? "Aucune synchronisation effectuée" : "Configurez ce connecteur pour démarrer"}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
        <button
          onClick={onConfigure}
          data-testid={`btn-configure-${connector.type}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          <Settings size={12} /> Configurer
        </button>
        <button
          onClick={onSync}
          disabled={syncing || !isConfigured}
          data-testid={`btn-sync-${connector.type}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {syncing ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {syncing ? "En cours..." : "Synchroniser"}
        </button>
        <button
          onClick={onLogs}
          data-testid={`btn-logs-${connector.type}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors ml-auto"
        >
          <History size={12} /> Logs
        </button>
      </div>
    </div>
  );
}

/* ─── Modal principal ────────────────────────────────────────────────────────── */
function ConnectorModal({ connector, onClose, onSave, onSync }) {
  const meta = CONNECTOR_META[connector.type] || {};
  const Icon = meta.icon || Settings;
  const [activeTab, setActiveTab] = useState("config");
  const [config, setConfig] = useState({
    enabled:      connector.enabled || false,
    base_url:     connector.base_url || "",
    auth_type:    connector.auth_type || "api_token",
    sync_direction: connector.sync_direction || "bidirectional",
    sync_frequency: connector.sync_frequency || "manual",
    ...((connector.auth_credentials) || {}),
  });
  const [creds, setCreds] = useState(connector.auth_credentials || {});
  const [mapping, setMapping] = useState(
    (connector.field_mapping?.fields || []).map(f => ({ ...f }))
  );
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const r = await connectorsAPI.getLogs(connector.type);
      setLogs(r.data);
    } catch { setLogs([]); }
    finally { setLogsLoading(false); }
  }, [connector.type]);

  useEffect(() => {
    if (activeTab === "logs") loadLogs();
  }, [activeTab, loadLogs]);

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      // Save config first so test uses latest URL/creds
      await handleSave(true);
      const r = await connectorsAPI.testConnection(connector.type);
      setTestResult(r.data);
    } catch { setTestResult({ success: false, message: "Erreur lors du test" }); }
    finally { setTesting(false); }
  };

  const handleSave = async (silent = false) => {
    setSaving(true);
    try {
      const credFields = {};
      Object.entries(creds).forEach(([k, v]) => {
        if (v && v !== "••••••••") credFields[k] = v;
      });
      await connectorsAPI.updateConfig(connector.type, {
        enabled:          config.enabled,
        base_url:         config.base_url,
        auth_type:        config.auth_type,
        auth_credentials: credFields,
        sync_direction:   config.sync_direction,
        sync_frequency:   config.sync_frequency,
        field_mapping:    {
          ...(connector.field_mapping || {}),
          fields: mapping,
        },
      });
      if (!silent) {
        toast.success("Configuration sauvegardée");
        onSave();
      }
    } catch {
      if (!silent) toast.error("Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const r = await connectorsAPI.triggerSync(connector.type);
      const d = r.data;
      toast.success(`Sync terminée : ${d.items_created} créés · ${d.items_updated} mis à jour · ${d.items_failed} échecs`);
      onSave();
      loadLogs();
    } catch { toast.error("Erreur lors de la synchronisation"); }
    finally { setSyncing(false); }
  };

  const authFields = {
    jira: {
      api_token: [{ key: "email", label: "Email Jira", type: "email" }, { key: "api_token", label: "API Token", type: "password" }],
      basic:     [{ key: "email", label: "Email", type: "email" }, { key: "password", label: "Mot de passe", type: "password" }],
    },
    sap: {
      basic:  [{ key: "username", label: "Utilisateur SAP", type: "text" }, { key: "password", label: "Mot de passe", type: "password" }],
      oauth2: [{ key: "client_id", label: "Client ID", type: "text" }, { key: "client_secret", label: "Client Secret", type: "password" }, { key: "token_url", label: "Token URL", type: "url" }],
    },
    servicenow: {
      basic:  [{ key: "username", label: "Utilisateur SNOW", type: "text" }, { key: "password", label: "Mot de passe", type: "password" }],
      oauth2: [{ key: "client_id", label: "Client ID", type: "text" }, { key: "client_secret", label: "Client Secret", type: "password" }, { key: "token_url", label: "Token URL", type: "url" }],
    },
  };
  const currentAuthFields = authFields[connector.type]?.[config.auth_type] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" data-testid={`modal-${connector.type}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: meta.bg }}>
              <Icon size={18} style={{ color: meta.color }} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{meta.label}</h3>
              <p className="text-xs text-slate-500">Configuration du connecteur</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-100 px-6">
          {[
            { key: "config",  label: "Configuration" },
            { key: "mapping", label: "Mapping champs" },
            { key: "logs",    label: "Historique" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              data-testid={`connector-tab-${t.key}`}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${activeTab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Config Tab ── */}
          {activeTab === "config" && (
            <div className="space-y-5">
              {/* Enabled toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="font-medium text-slate-700 text-sm">Connecteur activé</div>
                  <div className="text-xs text-slate-400">Active la synchronisation automatique selon la fréquence configurée</div>
                </div>
                <button
                  onClick={() => setConfig(p => ({ ...p, enabled: !p.enabled }))}
                  data-testid={`toggle-enabled-${connector.type}`}
                  className={`relative w-11 h-6 rounded-full transition-colors ${config.enabled ? "bg-blue-600" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* URL */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">URL de l'instance</label>
                <input
                  type="url"
                  value={config.base_url}
                  onChange={e => setConfig(p => ({ ...p, base_url: e.target.value }))}
                  placeholder={connector.type === "jira" ? "https://monentreprise.atlassian.net" : connector.type === "sap" ? "https://sap.monentreprise.fr/odata" : "https://monentreprise.service-now.com"}
                  className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  data-testid={`input-url-${connector.type}`}
                />
              </div>

              {/* Auth type */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Type d'authentification</label>
                <select
                  value={config.auth_type}
                  onChange={e => setConfig(p => ({ ...p, auth_type: e.target.value }))}
                  className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  data-testid={`select-auth-type-${connector.type}`}
                >
                  {(connector.type === "jira"
                    ? [["api_token", "API Token (Cloud)"], ["basic", "Basic Auth (Server)"]]
                    : [["basic", "Basic Auth"], ["oauth2", "OAuth2"]]
                  ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Credential fields */}
              {currentAuthFields.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Credentials</div>
                  {currentAuthFields.map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-slate-600 font-medium">{f.label}</label>
                      <div className="relative mt-1">
                        <input
                          type={f.type === "password" && !showPasswords[f.key] ? "password" : "text"}
                          value={creds[f.key] || ""}
                          onChange={e => setCreds(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.type === "password" ? "••••••••" : ""}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
                          data-testid={`input-cred-${f.key}`}
                        />
                        {f.type === "password" && (
                          <button
                            type="button"
                            onClick={() => setShowPasswords(p => ({ ...p, [f.key]: !p[f.key] }))}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                          >
                            {showPasswords[f.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Direction + Fréquence */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Direction de sync</label>
                  <select
                    value={config.sync_direction}
                    onChange={e => setConfig(p => ({ ...p, sync_direction: e.target.value }))}
                    className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    data-testid={`select-direction-${connector.type}`}
                  >
                    <option value="import">Import seul</option>
                    <option value="export">Export seul</option>
                    <option value="bidirectional">Bidirectionnel</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fréquence</label>
                  <select
                    value={config.sync_frequency}
                    onChange={e => setConfig(p => ({ ...p, sync_frequency: e.target.value }))}
                    className="mt-1.5 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    data-testid={`select-frequency-${connector.type}`}
                  >
                    <option value="manual">Manuel</option>
                    <option value="hourly">Toutes les heures</option>
                    <option value="daily">Quotidien</option>
                  </select>
                </div>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${testResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`} data-testid="test-connection-result">
                  {testResult.success ? <CheckCircle size={16} className="mt-0.5 flex-shrink-0" /> : <XCircle size={16} className="mt-0.5 flex-shrink-0" />}
                  <div>
                    <div className="font-medium">{testResult.success ? "Connexion réussie" : "Connexion échouée"}</div>
                    <div className="text-xs mt-0.5 opacity-80">{testResult.message}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Mapping Tab ── */}
          {activeTab === "mapping" && (
            <div>
              <div className="text-xs text-slate-500 mb-4">
                Configurez la correspondance entre les champs source et les champs MARCEL.
                Les champs désactivés sont ignorés lors de la synchronisation.
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm" data-testid="mapping-table">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-2.5 text-left">Champ source</th>
                      <th className="px-4 py-2.5 text-left">Champ MARCEL</th>
                      <th className="px-4 py-2.5 text-left hidden md:table-cell">Description</th>
                      <th className="px-4 py-2.5 text-center">Actif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mapping.map((row, i) => (
                      <tr key={i} className={`hover:bg-slate-50 transition-colors ${!row.enabled ? "opacity-50" : ""}`}>
                        <td className="px-4 py-2.5">
                          <input
                            value={row.source}
                            onChange={e => {
                              const m = [...mapping]; m[i] = { ...m[i], source: e.target.value }; setMapping(m);
                            }}
                            className="text-xs font-mono border border-slate-200 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                            data-testid={`mapping-source-${i}`}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            value={row.target}
                            onChange={e => {
                              const m = [...mapping]; m[i] = { ...m[i], target: e.target.value }; setMapping(m);
                            }}
                            className="text-xs font-mono border border-slate-200 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                            data-testid={`mapping-target-${i}`}
                          />
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          <span className="text-xs text-slate-500">{row.label}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => {
                              const m = [...mapping]; m[i] = { ...m[i], enabled: !m[i].enabled }; setMapping(m);
                            }}
                            className={`w-9 h-5 rounded-full transition-colors ${row.enabled ? "bg-blue-600" : "bg-slate-200"}`}
                            data-testid={`mapping-toggle-${i}`}
                          >
                            <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${row.enabled ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Logs Tab ── */}
          {activeTab === "logs" && (
            <div>
              {logsLoading ? (
                <div className="text-center py-8 text-slate-400 text-sm">Chargement...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">Aucun log de synchronisation</div>
              ) : (
                <div className="space-y-2">
                  {logs.map(log => (
                    <LogRow key={log.log_id} log={log} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            {activeTab !== "logs" && (
              <button
                onClick={handleTest}
                disabled={testing || !config.base_url}
                data-testid={`btn-test-${connector.type}`}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {testing ? <Loader size={13} className="animate-spin" /> : <Zap size={13} />}
                Tester la connexion
              </button>
            )}
            {activeTab !== "logs" && (
              <button
                onClick={handleSyncNow}
                disabled={syncing || !config.base_url}
                data-testid={`btn-sync-modal-${connector.type}`}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-blue-200 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {syncing ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Synchroniser
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
              Fermer
            </button>
            {activeTab !== "logs" && (
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                data-testid={`btn-save-config-${connector.type}`}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader size={13} className="animate-spin" /> : <Save size={13} />}
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── LogRow ──────────────────────────────────────────────────────────────────── */
function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const duration = log.started_at && log.finished_at
    ? Math.round((new Date(log.finished_at) - new Date(log.started_at)) / 1000)
    : null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden" data-testid={`log-row-${log.log_id}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <StatusBadge status={log.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="font-medium">{formatDate(log.started_at)}</span>
            <span className="text-slate-400">→</span>
            <span className={`font-semibold ${log.direction === "import" ? "text-blue-600" : "text-purple-600"}`}>
              {DIRECTION_LABELS[log.direction] || log.direction}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="text-slate-600">{log.items_processed} traités</span>
          {log.items_created > 0  && <span className="text-emerald-600">+{log.items_created} créés</span>}
          {log.items_updated > 0  && <span className="text-blue-600">↻{log.items_updated} màj</span>}
          {log.items_failed  > 0  && <span className="text-red-600">✗{log.items_failed} échecs</span>}
          {duration !== null       && <span className="text-slate-400">{duration}s</span>}
          {expanded ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
        </div>
      </div>
      {expanded && log.errors?.length > 0 && (
        <div className="px-4 pb-3 bg-red-50 border-t border-red-100">
          <div className="text-xs font-semibold text-red-700 mb-1.5">Erreurs</div>
          {log.errors.map((e, i) => (
            <div key={i} className="text-xs text-red-600 flex items-start gap-1.5">
              <span className="mt-0.5">•</span>{e}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────────────────────────── */
export default function Connectors() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("admin.config") || hasPermission("*");

  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null); // connector object
  const [syncing, setSyncing]       = useState({}); // {type: bool}

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await connectorsAPI.listAll();
      setConnectors(r.data);
    } catch {
      toast.error("Erreur lors du chargement des connecteurs");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async (connectorType) => {
    setSyncing(p => ({ ...p, [connectorType]: true }));
    try {
      const r = await connectorsAPI.triggerSync(connectorType);
      const d = r.data;
      toast.success(`Sync ${connectorType} : ${d.items_created} créés · ${d.items_updated} mis à jour`);
      await load();
    } catch { toast.error(`Erreur sync ${connectorType}`); }
    finally { setSyncing(p => ({ ...p, [connectorType]: false })); }
  };

  const openLogsModal = (connector) => {
    setModal({ ...connector, _openTab: "logs" });
  };

  const openConfigModal = (connector) => {
    setModal(connector);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-heading">Connecteurs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Synchronisation MARCEL avec vos outils DSI · Jira · SAP · ServiceNow
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          data-testid="btn-refresh-connectors"
        >
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {/* Info banner for non-admin */}
      {!canManage && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          Vous avez accès en lecture seule. La configuration des connecteurs nécessite la permission <code className="bg-amber-100 px-1 rounded">admin.config</code>.
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="connectors-grid">
        {connectors.map(connector => (
          <ConnectorCard
            key={connector.type}
            connector={connector}
            onConfigure={() => openConfigModal(connector)}
            onSync={() => handleSync(connector.type)}
            onLogs={() => openLogsModal(connector)}
            syncing={!!syncing[connector.type]}
          />
        ))}
      </div>

      {/* Architecture info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Architecture des connecteurs</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div>
            <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <GitBranch size={12} style={{ color: "#0052CC" }} /> Jira
            </div>
            <ul className="space-y-0.5 text-slate-500">
              <li>• Epics → Capabilities / Features</li>
              <li>• Stories → User Stories MARCEL</li>
              <li>• Statuts : mapping configurable</li>
              <li>• Story Points → JH (facteur ×2)</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Database size={12} style={{ color: "#007DC6" }} /> SAP
            </div>
            <ul className="space-y-0.5 text-slate-500">
              <li>• Centres de coût → Projets</li>
              <li>• Budgets → CAPEX / OPEX</li>
              <li>• Engagements → Consommé</li>
              <li>• V1 : CSV + OData · V2 : RFC</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <LifeBuoy size={12} style={{ color: "#62BE24" }} /> ServiceNow
            </div>
            <ul className="space-y-0.5 text-slate-500">
              <li>• Change Requests → Demandes</li>
              <li>• Incidents critiques → Risques</li>
              <li>• Priorités : mapping 1-4</li>
              <li>• REST Table API</li>
            </ul>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle size={11} className="text-emerald-500" />
          Credentials chiffrés AES en base de données — jamais transmis en clair
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <ConnectorModal
          connector={modal}
          onClose={() => setModal(null)}
          onSave={async () => { await load(); setModal(null); }}
          onSync={() => handleSync(modal.type)}
        />
      )}
    </div>
  );
}
