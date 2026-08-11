import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { History, Search, ChevronDown, ChevronRight } from "lucide-react";
import { auditAPI } from "@/api";
import { toast } from "sonner";

const PAGE_SIZE = 50;

const ACTION_CONFIG = {
  created: { label: "Création", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  updated: { label: "Modification", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  deleted: { label: "Suppression", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  budget_revised: { label: "Révision budget", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  benefits_updated: { label: "Bénéfices", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  "user.created": { label: "Utilisateur créé", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  "user.updated": { label: "Utilisateur modifié", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  "user.password_reset": { label: "Mot de passe réinitialisé", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

const ENTITY_LABELS = { project: "Projet", decision: "Décision", user: "Utilisateur", governance: "Instance" };

function fmtVal(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("fr-FR");
  if (v === true) return "oui";
  if (v === false) return "non";
  return String(v);
}

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(new Set());

  const load = useCallback(async (skip = 0, append = false) => {
    setLoading(true);
    try {
      const res = await auditAPI.list({
        entity_type: filterEntity || undefined,
        action: filterAction || undefined,
        q: q || undefined,
        limit: PAGE_SIZE,
        skip,
      });
      setTotal(res.data.total);
      setLogs((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
    } catch { toast.error("Erreur chargement du journal d'audit"); }
    finally { setLoading(false); }
  }, [filterEntity, filterAction, q]);

  useEffect(() => { load(0, false); }, [load]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full" data-testid="audit-page">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex-shrink-0">
        <div className="mb-4">
          <div className="text-xs text-[#8a87a0] mb-0.5">Accueil / Administration / <span className="text-[#352c6e] font-semibold">Journal d'audit</span></div>
          <h1 className="font-heading text-2xl font-extrabold text-[#26243a] tracking-tight flex items-center gap-2">
            <History size={20} className="text-blue-600" />
            Journal d'audit
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Traçabilité des modifications : projets, budgets, décisions et utilisateurs — {total} événement{total > 1 ? "s" : ""}.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input data-testid="audit-search" type="text" placeholder="Entité ou utilisateur…"
              className="pl-8 pr-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/30 w-56"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select data-testid="audit-filter-entity"
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 bg-white"
            value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="project">Projet</option>
            <option value="decision">Décision</option>
            <option value="user">Utilisateur</option>
            <option value="governance">Instance</option>
          </select>
          <select data-testid="audit-filter-action"
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 bg-white"
            value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="">Toutes les actions</option>
            {Object.entries(ACTION_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#fbfaff] border-b border-[#e8e6f0]">
                {["", "Date", "Utilisateur", "Action", "Type", "Entité", "Détails"].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-[10.5px] font-bold text-[#8a87a0] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400 text-sm">Chargement…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400 text-sm" data-testid="audit-empty">
                  Aucun événement d'audit — les modifications apparaîtront ici.
                </td></tr>
              ) : logs.map((l) => {
                const cfg = ACTION_CONFIG[l.action] || { label: l.action, cls: "bg-zinc-50 text-zinc-600 border-zinc-200" };
                const hasChanges = (l.changes || []).length > 0;
                const isOpen = expanded.has(l.audit_id);
                return (
                  <React.Fragment key={l.audit_id}>
                    <tr data-testid={`audit-row-${l.audit_id}`}
                      onClick={() => hasChanges && toggleExpand(l.audit_id)}
                      className={`border-b border-zinc-50 transition-colors ${hasChanges ? "cursor-pointer hover:bg-blue-50/30" : ""}`}>
                      <td className="pl-4 py-3 w-6 text-zinc-300">
                        {hasChanges && (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                      </td>
                      <td className="px-4 py-3 font-mono-data text-xs text-zinc-600 whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-800 text-xs">{l.user_name}</div>
                        <div className="text-[10px] text-zinc-400">{l.user_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-[9.5px] font-bold uppercase rounded-full border ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{ENTITY_LABELS[l.entity_type] || l.entity_type}</td>
                      <td className="px-4 py-3 text-xs max-w-[240px] truncate">
                        {l.entity_type === "project" && l.action !== "deleted" ? (
                          <Link to={`/projects/${l.entity_id}`} onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline font-medium">{l.entity_name || l.entity_id}</Link>
                        ) : (
                          <span className="text-zinc-700 font-medium">{l.entity_name || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {hasChanges ? `${l.changes.length} champ${l.changes.length > 1 ? "s" : ""} modifié${l.changes.length > 1 ? "s" : ""}` : "—"}
                      </td>
                    </tr>
                    {isOpen && hasChanges && (
                      <tr className="bg-[#fbfaff] border-b border-zinc-100" data-testid={`audit-changes-${l.audit_id}`}>
                        <td colSpan={7} className="px-12 py-3">
                          <div className="space-y-1">
                            {l.changes.map((c, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-zinc-600 min-w-[140px]">{c.field}</span>
                                <span className="font-mono-data text-zinc-400 line-through">{fmtVal(c.old)}</span>
                                <span className="text-zinc-300">→</span>
                                <span className="font-mono-data text-zinc-800 font-semibold">{fmtVal(c.new)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {logs.length < total && (
            <div className="px-4 py-3 border-t border-zinc-100 text-center">
              <button onClick={() => load(logs.length, true)} disabled={loading} data-testid="audit-load-more"
                className="px-4 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50">
                {loading ? "Chargement…" : `Charger plus (${logs.length}/${total})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
