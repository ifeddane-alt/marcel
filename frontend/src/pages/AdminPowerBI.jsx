import React, { useEffect, useState } from "react";
import {
  Database, Key, RefreshCw, Trash2, Copy, Check,
  ExternalLink, AlertCircle, BookOpen, Zap, Code2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api";

const BASE_URL = process.env.REACT_APP_BACKEND_URL || "";

// ─── Génération des scripts M-Query ──────────────────────────────────────────

function buildMQueries(baseUrl, apiKey) {
  const url = baseUrl || "https://VOTRE_URL.preview.emergentagent.com";
  const key = apiKey || "pbi-VOTRE_CLE_API";

  const tables = [
    {
      name: "Projets",
      path: "/api/powerbi/projects",
      cols: [
        ["id","type text"], ["name","type text"], ["program","type text"],
        ["methodology","type text"], ["status","type text"], ["rag","type text"],
        ["capex_budget","Int64.Type"], ["opex_budget","Int64.Type"],
        ["capex_consumed","Int64.Type"], ["opex_consumed","Int64.Type"],
        ["eac","Int64.Type"], ["raf","Int64.Type"],
        ["start_date","type date"], ["end_date","type date"], ["owner","type text"],
      ],
    },
    {
      name: "Ressources",
      path: "/api/powerbi/resources",
      cols: [
        ["id","type text"], ["name","type text"], ["role","type text"],
        ["team","type text"], ["type","type text"], ["vendor","type text"],
        ["tjm","type number"], ["availability_rate","type number"], ["capacity_jh","type number"],
      ],
    },
    {
      name: "Timesheets",
      path: "/api/powerbi/timesheets",
      cols: [
        ["resource_name","type text"], ["project_name","type text"],
        ["date","type date"], ["jh","type number"], ["status","type text"],
      ],
    },
    {
      name: "Budget",
      path: "/api/powerbi/budget",
      cols: [
        ["project_name","type text"], ["program","type text"],
        ["capex_prev","Int64.Type"], ["capex_cons","Int64.Type"],
        ["opex_prev","Int64.Type"], ["opex_cons","Int64.Type"],
        ["eac","Int64.Type"], ["raf","Int64.Type"], ["ecart_pct","type number"],
      ],
    },
    {
      name: "Risques",
      path: "/api/powerbi/risks",
      cols: [
        ["project_name","type text"], ["name","type text"],
        ["probability","Int64.Type"], ["impact","Int64.Type"],
        ["criticality","Int64.Type"], ["category","type text"], ["status","type text"],
      ],
    },
    {
      name: "Jalons",
      path: "/api/powerbi/milestones",
      cols: [
        ["project_name","type text"], ["name","type text"],
        ["family","type text"], ["type","type text"],
        ["date","type date"], ["days_remaining","Int64.Type"],
        ["attribute","type text"], ["status","type text"],
      ],
    },
  ];

  const paramScript = `// ─── Paramètre : URL de base ───────────────────────────────────────────
// Coller dans une nouvelle requête nommée "ProjetennBaseUrl" (type: Texte)
"${url}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]

// ─── Paramètre : Clé API ────────────────────────────────────────────────
// Coller dans une nouvelle requête nommée "ProjetennApiKey" (type: Texte)
"${key}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]`;

  const tableScripts = tables.map(({ name, path, cols }) => {
    const colNames   = cols.map(([c]) => `"${c}"`).join(", ");
    const colTypings = cols.map(([c, t]) => `        {"${c}", ${t}}`).join(",\n");
    return {
      name,
      script:
`let
    Source = Json.Document(
        Web.Contents(
            ProjetennBaseUrl,
            [
                RelativePath = "${path}",
                Headers = [#"X-API-Key" = ProjetennApiKey]
            ]
        )
    ),
    ToTable = Table.FromList(Source, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    Expanded = Table.ExpandRecordColumn(ToTable, "Column1", {${colNames}}),
    Typed = Table.TransformColumnTypes(Expanded, {
${colTypings}
    })
in
    Typed`,
    };
  });

  return { paramScript, tableScripts };
}

const ENDPOINTS = [
  {
    path: "/api/powerbi/projects",
    label: "Projets",
    fields: "id, name, program, methodology, status, rag, capex_budget, opex_budget, capex_consumed, opex_consumed, eac, raf, start_date, end_date, owner",
    description: "Un projet par ligne avec toutes les données financières et RAG.",
  },
  {
    path: "/api/powerbi/resources",
    label: "Ressources",
    fields: "id, name, role, team, type, vendor, tjm, availability_rate, capacity_jh",
    description: "Toutes les ressources du portefeuille.",
  },
  {
    path: "/api/powerbi/timesheets",
    label: "Timesheets",
    fields: "resource_name, project_name, date, jh, status",
    description: "Lignes dépliées : une ligne = une saisie/jour.",
  },
  {
    path: "/api/powerbi/budget",
    label: "Budget",
    fields: "project_name, program, capex_prev, capex_cons, opex_prev, opex_cons, eac, raf, ecart_pct",
    description: "Synthèse budgétaire par projet avec écart % EAC vs prévu.",
  },
  {
    path: "/api/powerbi/risks",
    label: "Risques",
    fields: "project_name, name, probability, impact, criticality, category, status",
    description: "Tous les risques du portefeuille.",
  },
  {
    path: "/api/powerbi/milestones",
    label: "Jalons",
    fields: "project_name, name, family, type, date, days_remaining, attribute, status",
    description: "Jalons avec days_remaining calculé à la volée.",
  },
];

function CopyButton({ text, "data-testid": testId, small = false }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      data-testid={testId}
      className={`flex-shrink-0 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors ${small ? "p-1" : "p-1.5"}`}
      title="Copier"
    >
      {copied ? <Check size={small ? 12 : 14} className="text-green-600" /> : <Copy size={small ? 12 : 14} />}
    </button>
  );
}

export default function AdminPowerBI() {
  const { user } = useAuth();
  const [keyInfo, setKeyInfo] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchKeyInfo();
  }, []);

  const fetchKeyInfo = async () => {
    try {
      const res = await api.get("/admin/powerbi/key");
      setKeyInfo(res.data);
    } catch (e) {
      setError("Impossible de charger les infos de clé API.");
    } finally {
      setLoading(false);
    }
  };

  const generateKey = async () => {
    if (!window.confirm("Générer une nouvelle clé ? L'ancienne clé sera révoquée immédiatement.")) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post("/admin/powerbi/generate-key");
      setNewKey(res.data.api_key);
      await fetchKeyInfo();
    } catch (e) {
      setError("Erreur lors de la génération de la clé.");
    } finally {
      setGenerating(false);
    }
  };

  const revokeKey = async () => {
    if (!window.confirm("Révoquer la clé API ? Toutes les connexions Power BI seront interrompues.")) return;
    setRevoking(true);
    try {
      await api.delete("/admin/powerbi/revoke-key");
      setNewKey(null);
      await fetchKeyInfo();
    } catch (e) {
      setError("Erreur lors de la révocation.");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto" data-testid="admin-powerbi-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Database size={20} className="text-[#F2C811]" />
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
            Connecteur Power BI
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Connectez Power BI Desktop à vos données Projetenne via le <strong>Web Connector</strong>.
          Authentification par JWT ou clé API dédiée.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Clé API */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6" data-testid="api-key-section">
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} className="text-[#0052CC]" />
          <h2 className="font-semibold text-slate-800">Clé API Power BI</h2>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Chargement...</div>
        ) : (
          <>
            {/* Clé fraîchement générée — affichage unique */}
            {newKey && (
              <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg p-4">
                <div className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">
                  Clé générée — Copiez-la maintenant, elle ne sera plus affichée
                </div>
                <div className="flex items-center gap-2 bg-white border border-amber-200 rounded px-3 py-2 font-mono text-xs break-all">
                  <span className="flex-1 text-slate-800" data-testid="new-api-key">{newKey}</span>
                  <CopyButton text={newKey} data-testid="copy-new-key-btn" />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-600">
                  {keyInfo?.has_key
                    ? <>Clé active : <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{keyInfo.masked_key}</code></>
                    : <span className="text-slate-400">Aucune clé API configurée</span>
                  }
                </span>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={generateKey}
                  disabled={generating}
                  data-testid="generate-key-btn"
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] disabled:opacity-60 transition-colors"
                >
                  <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
                  {keyInfo?.has_key ? "Régénérer" : "Générer une clé"}
                </button>
                {keyInfo?.has_key && (
                  <button
                    onClick={revokeKey}
                    disabled={revoking}
                    data-testid="revoke-key-btn"
                    className="flex items-center gap-1.5 px-3 py-2 border border-rose-200 text-rose-600 text-sm font-semibold rounded hover:bg-rose-50 disabled:opacity-60 transition-colors"
                  >
                    <Trash2 size={14} />
                    Révoquer
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Envoyez la clé dans le header <code>X-API-Key</code> ou utilisez le header
              <code> Authorization: Bearer &lt;JWT&gt;</code>.
            </p>
          </>
        )}
      </div>

      {/* Endpoints */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6" data-testid="endpoints-section">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-[#0052CC]" />
          <h2 className="font-semibold text-slate-800">Endpoints disponibles</h2>
        </div>

        <div className="space-y-3">
          {ENDPOINTS.map((ep) => {
            const fullUrl = `${BASE_URL}${ep.path}`;
            return (
              <div key={ep.path} className="border border-slate-200 rounded-lg p-3" data-testid={`endpoint-${ep.label.toLowerCase()}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">GET</span>
                    <span className="font-semibold text-slate-800 text-sm">{ep.label}</span>
                  </div>
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#0052CC] hover:underline flex items-center gap-1"
                  >
                    Tester <ExternalLink size={11} />
                  </a>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 mb-2">
                  <code className="text-xs text-slate-700 flex-1 break-all">{fullUrl}</code>
                  <CopyButton text={fullUrl} data-testid={`copy-${ep.label.toLowerCase()}-url`} />
                </div>
                <p className="text-xs text-slate-500 mb-1">{ep.description}</p>
                <p className="text-xs text-slate-400 font-mono">{ep.fields}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tuto connexion Power BI Desktop */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-6" data-testid="tutorial-section">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-[#0052CC]" />
          <h2 className="font-semibold text-slate-800">Connexion depuis Power BI Desktop</h2>
        </div>

        <div className="space-y-4">
          {[
            {
              step: 1,
              title: 'Ouvrir le connecteur Web',
              detail: 'Dans Power BI Desktop : Obtenir des données → Web → Basic',
            },
            {
              step: 2,
              title: "Coller l'URL de l'endpoint",
              detail: `Exemple : ${BASE_URL}/api/powerbi/projects`,
            },
            {
              step: 3,
              title: "Configurer l'authentification",
              detail: 'Dans "HTTP request header parameters", ajouter : Nom = X-API-Key  |  Valeur = votre clé API',
            },
            {
              step: 4,
              title: 'Transformer et modéliser',
              detail: 'Les données arrivent sous forme de tableau plat. Créer des relations entre les tables (project_name, resource_name) pour construire vos visuels.',
            },
            {
              step: 5,
              title: 'Actualisation automatique',
              detail: "Publiez sur Power BI Service puis configurez l'actualisation planifiée (On-Premises Gateway si réseau privé, sinon direct cloud).",
            },
          ].map(({ step, title, detail }) => (
            <div key={step} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0052CC] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {step}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">{title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-blue-700 mb-1">
            Astuce — Authentification JWT (sans clé API)
          </div>
          <div className="text-xs text-blue-600">
            Récupérez votre token JWT via <code>POST /api/auth/login</code>, puis utilisez-le dans
            le header <code>Authorization: Bearer &lt;token&gt;</code>. Le token expire dans 24h —
            préférez la clé API pour les actualisations planifiées.
          </div>
        </div>
      </div>

      {/* Permission requise */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 mb-6">
        <span className="font-semibold text-slate-700">Permission requise :</span> <code>export.powerbi</code> — 
        accordée aux profils <strong>Administrateur</strong>, <strong>Direction SI (CIO)</strong>, 
        <strong> PMO Portefeuille</strong> et <strong>Finance / Contrôle de gestion</strong>.
      </div>

      {/* ─── Scripts M-Query ─────────────────────────────────────────── */}
      <MQuerySection baseUrl={BASE_URL} apiKey={newKey || ""} />
    </div>
  );
}

// ─── Section M-Query (séparée pour clarté) ───────────────────────────────────

function MQuerySection({ baseUrl, apiKey }) {
  const { paramScript, tableScripts } = buildMQueries(baseUrl, apiKey);
  const [activeTab, setActiveTab] = useState(0); // 0 = params, 1..6 = tables

  const allTabs = [
    { label: "Paramètres", script: paramScript, isParam: true },
    ...tableScripts.map(t => ({ label: t.name, script: t.script, isParam: false })),
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5" data-testid="mquery-section">
      <div className="flex items-center gap-2 mb-1">
        <Code2 size={16} className="text-[#F2C811]" />
        <h2 className="font-semibold text-slate-800">Scripts M-Query (Power Query)</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Collez chaque script dans <strong>Power BI Desktop → Éditeur Power Query → Nouvelle requête → Requête vide → Éditeur avancé</strong>.
        Commencez par les deux paramètres, puis créez une requête par table.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {allTabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            data-testid={`mquery-tab-${tab.label.toLowerCase()}`}
            className={`flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-t border-b-2 transition-colors ${
              activeTab === i
                ? "border-[#0052CC] text-[#0052CC] bg-blue-50"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.isParam ? "Paramètres" : tab.label}
          </button>
        ))}
      </div>

      {/* Script actif */}
      {allTabs.map((tab, i) => (
        activeTab === i && (
          <div key={i}>
            {tab.isParam && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <strong>Étape 1 :</strong> Créez deux requêtes séparées nommées exactement{" "}
                <code>ProjetennBaseUrl</code> et <code>ProjetennApiKey</code>.
                Dans chaque requête → clic droit → <em>Convertir en paramètre</em> (type : Texte).
              </div>
            )}
            <div className="relative">
              <pre
                className="bg-slate-900 text-slate-100 text-xs p-4 rounded-lg overflow-x-auto leading-relaxed whitespace-pre"
                data-testid={`mquery-script-${tab.label.toLowerCase()}`}
                style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", maxHeight: 380 }}
              >
                {tab.script}
              </pre>
              <div className="absolute top-2 right-2">
                <CopyButton
                  text={tab.script}
                  data-testid={`mquery-copy-${tab.label.toLowerCase()}`}
                  small={false}
                />
              </div>
            </div>
            {!tab.isParam && (
              <p className="text-xs text-slate-400 mt-2">
                Nommez la requête <strong>{tab.label}</strong> dans le panneau de gauche de l'Éditeur Power Query.
              </p>
            )}
          </div>
        )
      ))}

      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
        <strong className="text-slate-700">Relations recommandées dans Power BI :</strong>
        <ul className="mt-1 space-y-0.5 list-disc list-inside">
          <li><code>Budget[project_name]</code> → <code>Projets[name]</code> (Many-to-One)</li>
          <li><code>Risques[project_name]</code> → <code>Projets[name]</code> (Many-to-One)</li>
          <li><code>Jalons[project_name]</code> → <code>Projets[name]</code> (Many-to-One)</li>
          <li><code>Timesheets[project_name]</code> → <code>Projets[name]</code> (Many-to-One)</li>
          <li><code>Timesheets[resource_name]</code> → <code>Ressources[name]</code> (Many-to-One)</li>
        </ul>
      </div>
    </div>
  );
}
