import React, { useState, useEffect, useCallback } from "react";
import { ShieldHalf, AlertTriangle, FileCheck2, ClipboardCheck, Gauge } from "lucide-react";
import { securityAPI, applicationsAPI, projectsAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import CrudSection, { Badge } from "@/components/CrudSection";

const SEV_CFG = {
  critique: "bg-rose-50 text-rose-700 border-rose-200",
  haute: "bg-orange-50 text-orange-700 border-orange-200",
  moyenne: "bg-amber-50 text-amber-700 border-amber-200",
  basse: "bg-zinc-50 text-zinc-500 border-zinc-200",
};
const VULN_ST = {
  ouverte: { label: "Ouverte", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  en_remediation: { label: "En remédiation", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  corrigee: { label: "Corrigée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  acceptee: { label: "Acceptée", cls: "bg-zinc-50 text-zinc-500 border-zinc-200" },
};
const REQ_ST = {
  conforme: { label: "Conforme", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partiel: { label: "Partiel", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  non_conforme: { label: "Non conforme", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  na: { label: "N/A", cls: "bg-zinc-50 text-zinc-400 border-zinc-200" },
};
const REVIEW_ST = {
  en_attente: { label: "En attente", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  favorable: { label: "Favorable", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  favorable_reserves: { label: "Favorable avec réserves", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  defavorable: { label: "Défavorable", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const scoreColor = (s) => (s >= 80 ? "text-emerald-600" : s >= 60 ? "text-amber-600" : "text-rose-600");
const barColor = (s) => (s >= 80 ? "#3f8a34" : s >= 60 ? "#e0a800" : "#e11d48");

function Kpi({ label, value, sub, icon: Icon, accent, testId }) {
  return (
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4 flex items-center gap-3" data-testid={testId}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent || "bg-[#f0eefc] text-[#352c6e]"}`}><Icon size={16} /></div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{label}</div>
        <div className="font-mono-data font-bold text-lg text-zinc-950 truncate">{value}</div>
        {sub && <div className="text-[10px] text-zinc-400">{sub}</div>}
      </div>
    </div>
  );
}

function PostureTab() {
  const [rows, setRows] = useState(null);
  useEffect(() => { securityAPI.posture().then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  if (!rows) return <div className="p-6 text-sm text-zinc-400">Calcul de la posture…</div>;
  return (
    <div className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)]" data-testid="posture-tab">
      <div className="px-5 py-3 border-b border-zinc-100 font-heading text-[13px] font-bold text-[#26243a]">
        Score de posture sécurité par application
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-sm text-zinc-400 text-center">Aucune application au référentiel — créez-les dans le module Applications.</div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <div key={r.application_id} className="flex items-center gap-3 px-5 py-2.5 flex-wrap" data-testid={`posture-row-${r.application_id}`}>
              <span className="text-xs font-semibold text-zinc-800 w-52 truncate">{r.name}</span>
              <div className="flex-1 min-w-[120px] h-2 bg-[#ece9f4] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: barColor(r.score) }} />
              </div>
              <span className={`font-mono-data text-sm font-bold w-10 text-right ${scoreColor(r.score)}`}>{r.score}</span>
              <span className="text-[10px] text-zinc-400 w-40">
                {r.open_vulns} vuln.{r.critical_vulns ? ` (${r.critical_vulns} crit.)` : ""} · {r.non_conforme} non conf.
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "posture", label: "Posture applications" },
  { id: "vulns", label: "Vulnérabilités" },
  { id: "conformite", label: "Conformité" },
  { id: "avis", label: "Avis projets" },
];

export default function Security() {
  const { hasAnyPermission } = usePermissions();
  const canWrite = hasAnyPermission("*", "portfolio.edit", "projects.create", "projects.edit");
  const [tab, setTab] = useState("posture");
  const [summary, setSummary] = useState(null);
  const [appOptions, setAppOptions] = useState([]);
  const [projectOptions, setProjectOptions] = useState([]);

  const loadSummary = useCallback(() => {
    securityAPI.summary().then((r) => setSummary(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    loadSummary();
    applicationsAPI.list().then((r) => setAppOptions(r.data.map((a) => ({ value: a.application_id, label: a.name })))).catch(() => {});
    projectsAPI.list().then((r) => setProjectOptions(r.data.map((p) => ({ value: p.project_id, label: p.name })))).catch(() => {});
  }, [loadSummary]);

  const fw = summary?.by_framework || {};
  const totalReqs = Object.values(fw).reduce((s, d) => s + d.total, 0);
  const conformeReqs = Object.values(fw).reduce((s, d) => s + d.conforme, 0);
  const evaluable = totalReqs - Object.values(fw).reduce((s, d) => s + d.na, 0);

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="security-page">
      <div>
        <h1 className="font-heading text-xl md:text-2xl font-extrabold text-[#26243a] flex items-center gap-2">
          <ShieldHalf size={20} className="text-[#352c6e]" /> Sécurité
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">Posture, vulnérabilités, conformité DORA / NIS2 / RGPD / ISO 27001, avis sécurité projets</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Vulnérabilités ouvertes" value={summary?.vulns_open ?? 0}
          sub={summary?.vulns_critical_open ? `dont ${summary.vulns_critical_open} critiques` : undefined}
          icon={AlertTriangle} accent={summary?.vulns_critical_open > 0 ? "bg-rose-50 text-rose-600" : undefined} testId="sec-kpi-vulns" />
        <Kpi label="Conformité globale" value={evaluable > 0 ? `${Math.round(conformeReqs / evaluable * 100)}%` : "—"}
          sub={`${totalReqs} exigence${totalReqs > 1 ? "s" : ""}`} icon={FileCheck2} testId="sec-kpi-compliance" />
        <Kpi label="Avis en attente" value={summary?.reviews_pending ?? 0} icon={ClipboardCheck} testId="sec-kpi-reviews" />
        <Kpi label="Apps à risque (< 60)" value={summary?.apps_at_risk ?? 0} icon={Gauge}
          accent={summary?.apps_at_risk > 0 ? "bg-amber-50 text-amber-600" : undefined} testId="sec-kpi-atrisk" />
      </div>

      {Object.keys(fw).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(fw).map(([name, d]) => (
            <span key={name} className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#e8e6f0] rounded-lg" data-testid={`fw-chip-${name}`}>
              {name}
              <span className={`font-mono-data font-bold ${d.pct_conforme >= 80 ? "text-emerald-600" : d.pct_conforme >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                {d.pct_conforme}%
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`sec-tab-${t.id}`}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === t.id ? "bg-blue-600 text-white" : "text-zinc-500 border border-zinc-200 hover:bg-zinc-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "posture" && <PostureTab />}
      {tab === "vulns" && (
        <CrudSection
          title="Vulnérabilités & remédiation" addLabel="Nouvelle vulnérabilité"
          api={securityAPI.vulns} idField="vuln_id" canWrite={canWrite} testPrefix="vuln"
          emptyText="Aucune vulnérabilité déclarée (pentest, audit, scan…)."
          onChanged={loadSummary}
          columns={[
            { key: "title", label: "Vulnérabilité", render: (i) => <span className="font-medium text-zinc-800">{i.title}</span> },
            { key: "application_name", label: "Application" },
            { key: "severity", label: "Sévérité", render: (i) => <Badge cls={SEV_CFG[i.severity] || SEV_CFG.basse}>{i.severity || "—"}</Badge> },
            { key: "source", label: "Source" },
            { key: "status", label: "Statut", render: (i) => <Badge cls={VULN_ST[i.status]?.cls || VULN_ST.ouverte.cls}>{VULN_ST[i.status]?.label || i.status}</Badge> },
            { key: "due_date", label: "Échéance", render: (i) => <span className="font-mono-data">{fmtDate(i.due_date)}</span> },
          ]}
          fields={[
            { key: "title", label: "Titre", required: true, full: true },
            { key: "application_id", label: "Application", type: "select", options: appOptions },
            { key: "severity", label: "Sévérité", type: "select", required: true, default: "moyenne",
              options: [{ value: "critique", label: "Critique" }, { value: "haute", label: "Haute" }, { value: "moyenne", label: "Moyenne" }, { value: "basse", label: "Basse" }] },
            { key: "source", label: "Source", type: "select", default: "scan",
              options: [{ value: "pentest", label: "Pentest" }, { value: "audit", label: "Audit" }, { value: "scan", label: "Scan" }, { value: "autre", label: "Autre" }] },
            { key: "status", label: "Statut", type: "select", required: true, default: "ouverte",
              options: Object.entries(VULN_ST).map(([v, c]) => ({ value: v, label: c.label })) },
            { key: "discovered_at", label: "Découverte le", type: "date" },
            { key: "due_date", label: "Échéance remédiation", type: "date" },
            { key: "description", label: "Description", type: "textarea", full: true },
          ]}
        />
      )}
      {tab === "conformite" && (
        <CrudSection
          title="Exigences de conformité" addLabel="Nouvelle exigence"
          api={securityAPI.requirements} idField="req_id" canWrite={canWrite} testPrefix="req"
          emptyText="Aucune exigence — déclinez DORA, NIS2, RGPD ou ISO 27001 en exigences suivies."
          onChanged={loadSummary}
          columns={[
            { key: "framework", label: "Cadre", render: (i) => <Badge cls="bg-[#f0eefc] text-[#352c6e] border-[#e0dcf5]">{i.framework}</Badge> },
            { key: "ref", label: "Réf.", render: (i) => <span className="font-mono-data">{i.ref || "—"}</span> },
            { key: "title", label: "Exigence", render: (i) => <span className="font-medium text-zinc-800">{i.title}</span> },
            { key: "application_name", label: "Application" },
            { key: "status", label: "Statut", render: (i) => <Badge cls={REQ_ST[i.status]?.cls || REQ_ST.non_conforme.cls}>{REQ_ST[i.status]?.label || i.status}</Badge> },
            { key: "owner", label: "Responsable" },
            { key: "due_date", label: "Échéance", render: (i) => <span className="font-mono-data">{fmtDate(i.due_date)}</span> },
          ]}
          fields={[
            { key: "framework", label: "Cadre réglementaire", type: "select", required: true, default: "DORA",
              options: ["DORA", "NIS2", "RGPD", "ISO27001", "Autre"].map((f) => ({ value: f, label: f })) },
            { key: "ref", label: "Référence (article…)" },
            { key: "title", label: "Exigence", required: true, full: true },
            { key: "application_id", label: "Application concernée", type: "select", options: appOptions },
            { key: "status", label: "Statut", type: "select", required: true, default: "non_conforme",
              options: Object.entries(REQ_ST).map(([v, c]) => ({ value: v, label: c.label })) },
            { key: "owner", label: "Responsable" },
            { key: "due_date", label: "Échéance", type: "date" },
            { key: "action_plan", label: "Plan d'action", type: "textarea", full: true },
          ]}
        />
      )}
      {tab === "avis" && (
        <CrudSection
          title="Avis sécurité sur les projets" addLabel="Nouvel avis"
          api={securityAPI.reviews} idField="review_id" canWrite={canWrite} testPrefix="secreview"
          emptyText="Aucun avis sécurité — tracez les passages en revue sécurité (security by design)."
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
            { key: "reviewer", label: "Émis par (RSSI…)" },
            { key: "review_date", label: "Date de revue", type: "date" },
            { key: "comments", label: "Commentaires / réserves", type: "textarea", full: true },
          ]}
        />
      )}
    </div>
  );
}
