import React, { useState, useEffect, useCallback } from "react";
import { Network, GitBranch, BookOpenCheck, Radar, Hammer, ClipboardCheck, ArrowRight } from "lucide-react";
import { architectureAPI, applicationsAPI, projectsAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import CrudSection, { Badge } from "@/components/CrudSection";
import { ArchTrajectoryTab } from "@/components/ArchTrajectoryTab";

const REVIEW_ST = {
  en_attente: { label: "En attente", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  favorable: { label: "Favorable", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  favorable_reserves: { label: "Favorable avec réserves", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  defavorable: { label: "Défavorable", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};
const RING_CFG = {
  adopt: { label: "Adopt", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  trial: { label: "Trial", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  assess: { label: "Assess", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  hold: { label: "Hold", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};
const PRIO_CFG = {
  haute: "bg-rose-50 text-rose-700 border-rose-200",
  moyenne: "bg-amber-50 text-amber-700 border-amber-200",
  basse: "bg-zinc-50 text-zinc-500 border-zinc-200",
};
const DEBT_ST = {
  identifiee: { label: "Identifiée", cls: "bg-zinc-50 text-zinc-600 border-zinc-200" },
  planifiee: { label: "Planifiée", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  traitee: { label: "Traitée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
const EXEMPT_ST = {
  active: { label: "Active", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  expiree: { label: "Expirée", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  levee: { label: "Levée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

function Kpi({ label, value, sub, icon: Icon, accent, testId }) {
  return (
    <div className="bg-white border border-m-border rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4 flex items-center gap-3" data-testid={testId}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent || "bg-m-lilac text-m-primary"}`}><Icon size={16} /></div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{label}</div>
        <div className="font-mono-data font-bold text-lg text-zinc-950 truncate">{value}</div>
        {sub && <div className="text-[10px] text-zinc-400">{sub}</div>}
      </div>
    </div>
  );
}

const TABS = [
  { id: "interfaces", label: "Flux & interfaces" },
  { id: "standards", label: "Standards & dérogations" },
  { id: "radar", label: "Radar techno" },
  { id: "dette", label: "Dette technique" },
  { id: "avis", label: "Avis projets" },
  { id: "trajectoire", label: "Trajectoire SI" },
];

export default function Architecture() {
  const { hasAnyPermission } = usePermissions();
  const canWrite = hasAnyPermission("*", "portfolio.edit", "projects.create", "projects.edit");
  const [tab, setTab] = useState("interfaces");
  const [summary, setSummary] = useState(null);
  const [appOptions, setAppOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);
  const [standardOptions, setStandardOptions] = useState([]);

  const loadSummary = useCallback(() => {
    architectureAPI.summary().then((r) => setSummary(r.data)).catch(() => {});
    architectureAPI.standards.list().then((r) =>
      setStandardOptions(r.data.map((s) => ({ value: s.standard_id, label: s.title })))).catch(() => {});
  }, []);
  useEffect(() => {
    loadSummary();
    applicationsAPI.list().then((r) => setAppOptions(r.data.map((a) => ({ value: a.application_id, label: a.name })))).catch(() => {});
    projectsAPI.list().then((r) => setProjectOptions(r.data.map((p) => ({ value: p.project_id, label: p.name })))).catch(() => {});
  }, [loadSummary]);

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="architecture-page">
      <div>
        <h1 className="font-heading text-xl md:text-2xl font-extrabold text-m-ink flex items-center gap-2">
          <Network size={20} className="text-m-primary" /> Architecture
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">Cartographie des flux, standards, radar technologique, dette technique et avis d'architecture</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Flux inter-applications" value={summary?.interfaces_count ?? 0} icon={GitBranch} testId="arch-kpi-interfaces" />
        <Kpi label="Standards actifs" value={summary?.standards_active ?? 0}
          sub={summary?.exemptions_active ? `${summary.exemptions_active} dérogation(s) active(s)` : undefined}
          icon={BookOpenCheck} testId="arch-kpi-standards" />
        <Kpi label="Dette technique" value={`${summary?.debt_jh_open ?? 0} JH`}
          sub={`${summary?.debt_items_open ?? 0} item(s) ouverts`} icon={Hammer}
          accent={summary?.debt_jh_open > 0 ? "bg-amber-50 text-amber-600" : undefined} testId="arch-kpi-debt" />
        <Kpi label="Avis en attente" value={summary?.reviews_pending ?? 0} icon={ClipboardCheck} testId="arch-kpi-reviews" />
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`arch-tab-${t.id}`}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t.id ? "bg-m-blue text-white" : "text-zinc-500 border border-zinc-200 hover:bg-zinc-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "interfaces" && (
        <CrudSection
          title="Flux & interfaces entre applications" addLabel="Nouveau flux"
          api={architectureAPI.interfaces} idField="interface_id" canWrite={canWrite} testPrefix="iface"
          emptyText="Aucun flux cartographié — recensez les interfaces entre applications du SI."
          onChanged={loadSummary}
          columns={[
            { key: "name", label: "Flux", render: (i) => <span className="font-medium text-zinc-800">{i.name}</span> },
            { key: "route", label: "Source → Cible", render: (i) => (
              <span className="inline-flex items-center gap-1 text-zinc-600">
                {i.source_name || "?"} <ArrowRight size={10} className="text-zinc-400" /> {i.target_name || "?"}
              </span>
            ) },
            { key: "protocol", label: "Protocole", render: (i) => <span className="font-mono-data">{i.protocol || "—"}</span> },
            { key: "frequency", label: "Fréquence" },
            { key: "criticality", label: "Criticité", render: (i) => i.criticality
              ? <Badge cls={i.criticality === "critique" ? "bg-rose-50 text-rose-700 border-rose-200" : i.criticality === "haute" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}>{i.criticality}</Badge>
              : "—" },
            { key: "data_desc", label: "Données", render: (i) => <span className="text-zinc-500 max-w-[160px] truncate inline-block">{i.data_desc || "—"}</span> },
          ]}
          fields={[
            { key: "name", label: "Nom du flux", required: true, full: true, placeholder: "Ex : Export factures ERP → CRM" },
            { key: "source_application_id", label: "Application source", type: "select", options: appOptions },
            { key: "target_application_id", label: "Application cible", type: "select", options: appOptions },
            { key: "protocol", label: "Protocole", type: "select", default: "API",
              options: ["API", "Fichier", "MQ", "ETL", "Base partagée", "Autre"].map((p) => ({ value: p, label: p })) },
            { key: "frequency", label: "Fréquence", type: "select", default: "quotidien",
              options: [{ value: "temps_reel", label: "Temps réel" }, { value: "quotidien", label: "Quotidien" }, { value: "hebdo", label: "Hebdomadaire" }, { value: "mensuel", label: "Mensuel" }] },
            { key: "criticality", label: "Criticité", type: "select",
              options: [{ value: "basse", label: "Basse" }, { value: "moyenne", label: "Moyenne" }, { value: "haute", label: "Haute" }, { value: "critique", label: "Critique" }] },
            { key: "data_desc", label: "Données échangées", full: true },
          ]}
        />
      )}
      {tab === "standards" && (
        <div className="space-y-4">
          <CrudSection
            title="Principes & standards d'architecture" addLabel="Nouveau standard"
            api={architectureAPI.standards} idField="standard_id" canWrite={canWrite} testPrefix="std"
            emptyText="Aucun standard — formalisez les principes d'architecture de la DSI."
            onChanged={loadSummary}
            columns={[
              { key: "title", label: "Standard", render: (i) => <span className="font-medium text-zinc-800">{i.title}</span> },
              { key: "category", label: "Catégorie", render: (i) => i.category ? <Badge cls="bg-m-lilac text-m-primary border-m-border-strong">{i.category}</Badge> : "—" },
              { key: "status", label: "Statut", render: (i) => <Badge cls={i.status === "deprecie" ? "bg-zinc-50 text-zinc-400 border-zinc-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}>{i.status === "deprecie" ? "Déprécié" : "Actif"}</Badge> },
              { key: "description", label: "Description", render: (i) => <span className="text-zinc-500 max-w-[280px] truncate inline-block" title={i.description}>{i.description || "—"}</span> },
            ]}
            fields={[
              { key: "title", label: "Titre", required: true, full: true },
              { key: "category", label: "Catégorie", type: "select", default: "dev",
                options: [{ value: "securite", label: "Sécurité" }, { value: "infra", label: "Infrastructure" }, { value: "dev", label: "Développement" }, { value: "data", label: "Data" }, { value: "integration", label: "Intégration" }] },
              { key: "status", label: "Statut", type: "select", default: "actif",
                options: [{ value: "actif", label: "Actif" }, { value: "deprecie", label: "Déprécié" }] },
              { key: "description", label: "Description", type: "textarea", full: true },
            ]}
          />
          <CrudSection
            title="Dérogations aux standards" addLabel="Nouvelle dérogation"
            api={architectureAPI.exemptions} idField="exemption_id" canWrite={canWrite} testPrefix="exempt"
            emptyText="Aucune dérogation accordée."
            onChanged={loadSummary}
            columns={[
              { key: "standard_title", label: "Standard", render: (i) => <span className="font-medium text-zinc-800">{i.standard_title || "—"}</span> },
              { key: "scope_label", label: "Périmètre" },
              { key: "status", label: "Statut", render: (i) => <Badge cls={EXEMPT_ST[i.status]?.cls || EXEMPT_ST.active.cls}>{EXEMPT_ST[i.status]?.label || i.status || "Active"}</Badge> },
              { key: "expiry", label: "Expire le", render: (i) => <span className="font-mono-data">{fmtDate(i.expiry)}</span> },
              { key: "justification", label: "Justification", render: (i) => <span className="text-zinc-500 max-w-[220px] truncate inline-block" title={i.justification}>{i.justification || "—"}</span> },
            ]}
            fields={[
              { key: "standard_id", label: "Standard concerné", type: "select", required: true, options: standardOptions },
              { key: "scope_label", label: "Périmètre (app / projet)", placeholder: "Ex : Projet CRM" },
              { key: "status", label: "Statut", type: "select", default: "active",
                options: Object.entries(EXEMPT_ST).map(([v, c]) => ({ value: v, label: c.label })) },
              { key: "expiry", label: "Date d'expiration", type: "date" },
              { key: "justification", label: "Justification", type: "textarea", full: true },
            ]}
          />
        </div>
      )}
      {tab === "radar" && (
        <CrudSection
          title="Radar technologique" addLabel="Nouvelle techno"
          api={architectureAPI.radar} idField="item_id" canWrite={canWrite} testPrefix="radar"
          emptyText="Radar vide — positionnez vos technologies (Adopt / Trial / Assess / Hold)."
          onChanged={loadSummary}
          columns={[
            { key: "techno", label: "Technologie", render: (i) => <span className="font-medium text-zinc-800">{i.techno}</span> },
            { key: "ring", label: "Anneau", render: (i) => <Badge cls={RING_CFG[i.ring]?.cls || RING_CFG.assess.cls}>{RING_CFG[i.ring]?.label || i.ring || "Assess"}</Badge> },
            { key: "category", label: "Catégorie" },
            { key: "note", label: "Note", render: (i) => <span className="text-zinc-500 max-w-[280px] truncate inline-block" title={i.note}>{i.note || "—"}</span> },
          ]}
          fields={[
            { key: "techno", label: "Technologie", required: true, placeholder: "Ex : Kubernetes" },
            { key: "ring", label: "Anneau", type: "select", required: true, default: "assess",
              options: Object.entries(RING_CFG).map(([v, c]) => ({ value: v, label: c.label })) },
            { key: "category", label: "Catégorie", type: "select", default: "outils",
              options: [{ value: "langages", label: "Langages & frameworks" }, { value: "plateformes", label: "Plateformes" }, { value: "outils", label: "Outils" }, { value: "techniques", label: "Techniques" }] },
            { key: "note", label: "Note / recommandation", type: "textarea", full: true },
          ]}
        />
      )}
      {tab === "dette" && (
        <CrudSection
          title="Dette technique" addLabel="Nouvel item de dette"
          api={architectureAPI.debt} idField="debt_id" canWrite={canWrite} testPrefix="debt"
          emptyText="Aucune dette identifiée — recensez les remédiations techniques à planifier."
          onChanged={loadSummary}
          columns={[
            { key: "description", label: "Dette", render: (i) => <span className="font-medium text-zinc-800 max-w-[280px] truncate inline-block" title={i.description}>{i.description}</span> },
            { key: "application_name", label: "Application" },
            { key: "effort_jh", label: "Effort", render: (i) => <span className="font-mono-data font-bold">{i.effort_jh ?? "—"} JH</span> },
            { key: "priority", label: "Priorité", render: (i) => i.priority ? <Badge cls={PRIO_CFG[i.priority] || PRIO_CFG.basse}>{i.priority}</Badge> : "—" },
            { key: "status", label: "Statut", render: (i) => <Badge cls={DEBT_ST[i.status]?.cls || DEBT_ST.identifiee.cls}>{DEBT_ST[i.status]?.label || i.status || "Identifiée"}</Badge> },
          ]}
          fields={[
            { key: "description", label: "Description", required: true, full: true },
            { key: "application_id", label: "Application", type: "select", options: appOptions },
            { key: "effort_jh", label: "Effort estimé (JH)", type: "number" },
            { key: "priority", label: "Priorité", type: "select", default: "moyenne",
              options: [{ value: "haute", label: "Haute" }, { value: "moyenne", label: "Moyenne" }, { value: "basse", label: "Basse" }] },
            { key: "status", label: "Statut", type: "select", default: "identifiee",
              options: Object.entries(DEBT_ST).map(([v, c]) => ({ value: v, label: c.label })) },
          ]}
        />
      )}
      {tab === "avis" && (
        <CrudSection
          title="Avis d'architecture sur les projets" addLabel="Nouvel avis"
          api={architectureAPI.reviews} idField="review_id" canWrite={canWrite} testPrefix="archreview"
          emptyText="Aucun avis d'architecture — tracez les passages en comité d'architecture."
          onChanged={loadSummary}
          columns={[
            { key: "project_name", label: "Projet", render: (i) => <span className="font-medium text-zinc-800">{i.project_name || "—"}</span> },
            { key: "status", label: "Avis", render: (i) => <Badge cls={REVIEW_ST[i.status]?.cls || REVIEW_ST.en_attente.cls}>{REVIEW_ST[i.status]?.label || i.status}</Badge> },
            { key: "reviewer", label: "Émis par" },
            { key: "review_date", label: "Date", render: (i) => <span className="font-mono-data">{fmtDate(i.review_date)}</span> },
            { key: "comments", label: "Commentaires", render: (i) => <span className="text-zinc-500 max-w-[220px] truncate inline-block" title={i.comments}>{i.comments || "—"}</span> },
          ]}
          fields={[
            { key: "project_id", label: "Projet", type: "select", required: true, options: projectOptions },
            { key: "status", label: "Avis", type: "select", required: true, default: "en_attente",
              options: Object.entries(REVIEW_ST).map(([v, c]) => ({ value: v, label: c.label })) },
            { key: "reviewer", label: "Émis par (architecte…)" },
            { key: "review_date", label: "Date de revue", type: "date" },
            { key: "comments", label: "Commentaires / réserves", type: "textarea", full: true },
          ]}
        />
      )}
      {tab === "trajectoire" && <ArchTrajectoryTab canWrite={canWrite} />}
    </div>
  );
}
