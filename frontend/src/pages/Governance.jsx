import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Calendar, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { governanceAPI, projectsAPI } from "@/api";
import { GovernanceTypeBadge, SanityBadge } from "@/components/RAGBadge";
import { formatDate } from "@/utils/format";

function SanityReport({ report, status }) {
  if (!report || Object.keys(report).length === 0) {
    return <p className="text-xs text-slate-400 italic">Rapport non disponible</p>;
  }
  const checks = report.checks || [];
  return (
    <div>
      {report.summary && (
        <p className="text-xs text-slate-600 mb-2">{report.summary}</p>
      )}
      {checks.map((c, i) => (
        <div key={i} className={`text-xs flex items-start gap-1.5 mb-1 ${c.severity === "critical" ? "text-rose-600" : c.severity === "high" ? "text-orange-600" : "text-amber-600"}`}>
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{c.rule} ({c.projects_flagged?.length || 0} projet{(c.projects_flagged?.length || 0) > 1 ? "s" : ""})</span>
        </div>
      ))}
    </div>
  );
}

export default function Governance() {
  const [instances, setInstances] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    Promise.all([governanceAPI.list(), projectsAPI.list()]).then(([gRes, pRes]) => {
      setInstances(gRes.data);
      setProjects(pRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const getProjectName = (pid) => {
    const p = projects.find((proj) => proj.project_id === pid);
    return p ? p.name : pid;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64 text-slate-400 text-sm">
        Chargement de la gouvernance...
      </div>
    );
  }

  const counts = {
    passed: instances.filter((i) => i.sanity_check_status === "passed").length,
    failed: instances.filter((i) => i.sanity_check_status === "failed").length,
    pending: instances.filter((i) => i.sanity_check_status === "pending").length,
  };

  return (
    <div className="p-8" data-testid="governance-page">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-[#0F172A] uppercase tracking-tight">
          Gouvernance
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Instances de gouvernance et sanity checks du portefeuille
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-[#0052CC]">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Total instances</div>
          <div className="font-heading text-3xl font-bold text-[#0F172A] mt-2">{instances.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-emerald-500">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Validées</div>
          <div className="font-heading text-3xl font-bold text-emerald-600 mt-2">{counts.passed}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-rose-500">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">En échec</div>
          <div className="font-heading text-3xl font-bold text-rose-600 mt-2">{counts.failed}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-slate-400">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">En attente</div>
          <div className="font-heading text-3xl font-bold text-slate-600 mt-2">{counts.pending}</div>
        </div>
      </div>

      {/* Instances list */}
      <div className="space-y-3">
        {instances.map((g) => {
          const isExpanded = expanded === g.governance_id;
          const date = new Date(g.date_scheduled);
          const isPast = date < new Date();

          return (
            <div
              key={g.governance_id}
              className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden"
              data-testid={`governance-instance-${g.governance_id}`}
            >
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : g.governance_id)}
              >
                {/* Type badge */}
                <GovernanceTypeBadge type={g.type} />

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate" data-testid={`governance-name-${g.governance_id}`}>
                    {g.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Calendar size={11} className="text-slate-400" />
                    <span className={`text-xs ${isPast ? "text-slate-400" : "text-[#0052CC] font-medium"}`}>
                      {formatDate(g.date_scheduled)}
                      {!isPast && " · À venir"}
                      {isPast && " · Passé"}
                    </span>
                  </div>
                </div>

                {/* Projects scope count */}
                <div className="text-xs text-slate-500 flex-shrink-0">
                  <span className="font-mono-data font-bold text-slate-700">{g.projects_scope?.length || 0}</span> projet{(g.projects_scope?.length || 0) > 1 ? "s" : ""}
                </div>

                {/* Sanity status */}
                <SanityBadge status={g.sanity_check_status} />

                {/* Expand indicator */}
                <span className="text-slate-400 text-sm ml-2">{isExpanded ? "▲" : "▼"}</span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Projects in scope */}
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
                        Projets en périmètre
                      </div>
                      <div className="space-y-1">
                        {(g.projects_scope || []).map((pid) => (
                          <div key={pid} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0052CC] flex-shrink-0" />
                            <Link
                              to={`/projects/${pid}`}
                              className="text-xs text-[#0052CC] hover:text-[#0047B3] truncate"
                            >
                              {getProjectName(pid)}
                            </Link>
                          </div>
                        ))}
                        {(!g.projects_scope || g.projects_scope.length === 0) && (
                          <span className="text-xs text-slate-400 italic">Aucun projet défini</span>
                        )}
                      </div>
                    </div>

                    {/* Sanity check report */}
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
                        Rapport Sanity Check
                      </div>
                      <SanityReport report={g.sanity_check_report} status={g.sanity_check_status} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {instances.length === 0 && (
          <div className="bg-white border border-gray-200 rounded p-10 text-center text-slate-400 text-sm">
            Aucune instance de gouvernance définie
          </div>
        )}
      </div>
    </div>
  );
}
