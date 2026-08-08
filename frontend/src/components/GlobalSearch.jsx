import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, FolderKanban, Flag, AlertTriangle, Gavel, History } from "lucide-react";
import { searchAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { getRecentProjects } from "@/utils/recentProjects";

const RAG_DOT = { green: "bg-emerald-500", orange: "bg-amber-500", red: "bg-rose-500" };

const GROUPS = [
  { key: "projects", label: "Projets", Icon: FolderKanban },
  { key: "milestones", label: "Jalons", Icon: Flag },
  { key: "risks", label: "Risques", Icon: AlertTriangle },
  { key: "decisions", label: "Décisions", Icon: Gavel },
];

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const timerRef = useRef(null);
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [recent, setRecent] = useState([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const runSearch = (value) => {
    clearTimeout(timerRef.current);
    if (value.trim().length < 2) { setRes(null); return; }
    timerRef.current = setTimeout(() => {
      setLoading(true);
      searchAPI.global(value.trim())
        .then(({ data }) => setRes(data))
        .catch(() => setRes(null))
        .finally(() => setLoading(false));
    }, 250);
  };

  // Liste aplatie pour la navigation clavier
  const showRecent = q.trim().length < 2;
  const flat = [];
  if (showRecent) {
    for (const item of recent) flat.push({ group: "projects", item });
  } else if (res) {
    for (const g of GROUPS) {
      for (const item of res[g.key] || []) flat.push({ group: g.key, item });
    }
  }

  const go = (entry) => {
    const pid = entry.group === "projects" ? entry.item.project_id : entry.item.project_id;
    setQ("");
    setRes(null);
    setOpen(false);
    inputRef.current?.blur();
    if (pid) navigate(`/projects/${pid}`);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && flat.length) {
      e.preventDefault();
      const ql = q.trim().toLowerCase();
      const exact = flat.find((f) => f.group === "projects" && (f.item.code || "").toLowerCase() === ql);
      go(exact || flat[hi] || flat[0]);
    }
  };

  const renderItem = (entry, idx) => {
    const { group, item } = entry;
    const active = idx === hi;
    const key = item.project_id + (item.milestone_id || item.risk_id || item.decision_id || "");
    let testId, content;
    if (group === "projects") {
      testId = `global-search-result-${item.project_id}`;
      content = (
        <>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${RAG_DOT[item.status_rag] || "bg-zinc-300"}`} />
          {item.code && (
            <span className="font-mono text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-600/20 rounded-lg px-1.5 py-0.5 flex-shrink-0">
              {item.code}
            </span>
          )}
          <span className="text-xs text-zinc-700 truncate flex-1">{item.name}</span>
        </>
      );
    } else {
      testId = `global-search-${group}-${item.milestone_id || item.risk_id || item.decision_id}`;
      const title = item.name || item.title;
      const meta = group === "risks"
        ? `Criticité ${item.criticality}`
        : group === "milestones" && item.date
          ? item.date.split("-").reverse().join("/")
          : item.status || "";
      content = (
        <>
          <span className="text-xs text-zinc-700 truncate flex-1">{title}</span>
          {meta && <span className="text-[10px] text-zinc-400 flex-shrink-0">{meta}</span>}
          {item.project_code && (
            <span className="font-mono text-[10px] text-zinc-400 flex-shrink-0">{item.project_code}</span>
          )}
        </>
      );
    }
    return (
      <button
        key={key}
        data-testid={testId}
        onMouseDown={(e) => { e.preventDefault(); go(entry); }}
        onMouseEnter={() => setHi(idx)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${active ? "bg-blue-50" : "hover:bg-zinc-50"}`}
      >
        {content}
        {active && <CornerDownLeft size={11} className="text-zinc-300 flex-shrink-0" />}
      </button>
    );
  };

  let flatIdx = -1;
  const hasResults = flat.length > 0;

  return (
    <div ref={boxRef} className="relative hidden sm:block mx-3 md:mx-6 flex-1 max-w-md">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        <input
          ref={inputRef}
          data-testid="global-search-input"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); runSearch(e.target.value); }}
          onFocus={() => { setRecent(getRecentProjects(user?.user_id)); setOpen(true); setHi(0); }}
          onKeyDown={onKeyDown}
          placeholder="Rechercher : projet, jalon, risque, décision…"
          className="w-full h-8 pl-8 pr-14 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600 transition-colors placeholder:text-zinc-400"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-zinc-400 bg-white border border-zinc-200 rounded-lg px-1 py-0.5 pointer-events-none hidden md:block">
          Ctrl K
        </kbd>
      </div>

      {open && (showRecent ? recent.length > 0 : true) && (
        <div data-testid="global-search-results"
          className="absolute top-9 left-0 right-0 bg-white border border-zinc-200 rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
          {showRecent ? (
            <div data-testid="global-search-recent">
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-50/60">
                <History size={10} /> Récemment consultés
              </div>
              {recent.map((item) => {
                flatIdx += 1;
                return renderItem({ group: "projects", item }, flatIdx);
              })}
            </div>
          ) : loading && !res ? (
            <div className="px-3 py-3 text-xs text-zinc-400">Recherche…</div>
          ) : !hasResults ? (
            <div className="px-3 py-3 text-xs text-zinc-400" data-testid="global-search-empty">
              Aucun résultat pour « {q} »
            </div>
          ) : (
            GROUPS.map(({ key, label, Icon }) => {
              const items = res?.[key] || [];
              if (!items.length) return null;
              return (
                <div key={key} data-testid={`global-search-group-${key}`}>
                  <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-50/60">
                    <Icon size={10} /> {label}
                  </div>
                  {items.map((item) => {
                    flatIdx += 1;
                    return renderItem({ group: key, item }, flatIdx);
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
