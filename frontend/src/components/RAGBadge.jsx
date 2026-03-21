import React from "react";

const RAG_CONFIG = {
  green: { label: "Vert", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  orange: { label: "Orange", classes: "bg-amber-100 text-amber-800 border-amber-200" },
  red: { label: "Rouge", classes: "bg-rose-100 text-rose-800 border-rose-200" },
};

export default function RAGBadge({ status, showDot = true }) {
  const config = RAG_CONFIG[status] || { label: status, classes: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${config.classes}`}
      data-testid={`rag-badge-${status}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status === "green" ? "bg-emerald-500" : status === "orange" ? "bg-amber-500" : "bg-rose-500"
          }`}
        />
      )}
      {config.label}
    </span>
  );
}

const METHODOLOGY_CONFIG = {
  waterfall: { label: "Waterfall", classes: "bg-blue-100 text-blue-800 border-blue-200" },
  agile: { label: "Agile", classes: "bg-violet-100 text-violet-800 border-violet-200" },
  safe: { label: "SAFe", classes: "bg-indigo-100 text-indigo-800 border-indigo-200" },
};

export function MethodologyBadge({ methodology }) {
  const config = METHODOLOGY_CONFIG[methodology] || { label: methodology, classes: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.classes}`}>
      {config.label}
    </span>
  );
}

const MILESTONE_STATUS_CONFIG = {
  planned: { label: "Prévu", classes: "bg-slate-100 text-slate-700 border-slate-200" },
  at_risk: { label: "À risque", classes: "bg-amber-100 text-amber-800 border-amber-200" },
  delayed: { label: "En retard", classes: "bg-rose-100 text-rose-800 border-rose-200" },
  achieved: { label: "Atteint", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

export function MilestoneBadge({ status }) {
  const config = MILESTONE_STATUS_CONFIG[status] || { label: status, classes: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.classes}`}>
      {config.label}
    </span>
  );
}

const SANITY_CONFIG = {
  pending: { label: "En attente", classes: "bg-slate-100 text-slate-700 border-slate-200" },
  passed: { label: "Validé", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  failed: { label: "Échec", classes: "bg-rose-100 text-rose-800 border-rose-200" },
  overridden: { label: "Overridé", classes: "bg-orange-100 text-orange-800 border-orange-200" },
};

export function SanityBadge({ status }) {
  const config = SANITY_CONFIG[status] || { label: status, classes: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.classes}`}>
      {config.label}
    </span>
  );
}

const GOVERNANCE_TYPE_CONFIG = {
  copil: { label: "COPIL", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  comex: { label: "COMEX", classes: "bg-purple-50 text-purple-700 border-purple-200" },
  steering: { label: "Steering", classes: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  review: { label: "Review", classes: "bg-teal-50 text-teal-700 border-teal-200" },
};

export function GovernanceTypeBadge({ type }) {
  const config = GOVERNANCE_TYPE_CONFIG[type] || { label: type, classes: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border ${config.classes}`}>
      {config.label}
    </span>
  );
}
