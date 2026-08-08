import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { projectsAPI } from "@/api";

const RAG_DOT = { green: "bg-emerald-500", orange: "bg-amber-500", red: "bg-rose-500" };

export default function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const [q, setQ] = useState("");
  const [projects, setProjects] = useState(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);

  const loadProjects = useCallback(() => {
    if (projects !== null) return;
    projectsAPI.list().then(({ data }) => setProjects(data)).catch(() => setProjects([]));
  }, [projects]);

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

  const query = q.trim().toLowerCase();
  const results = !query || !projects ? [] : projects
    .map((p) => {
      const code = (p.code || "").toLowerCase();
      const name = (p.name || "").toLowerCase();
      let score = -1;
      if (code === query) score = 100;
      else if (code.startsWith(query)) score = 80;
      else if (code.includes(query)) score = 60;
      else if (name.startsWith(query)) score = 40;
      else if (name.includes(query)) score = 20;
      return { p, score };
    })
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((r) => r.p);

  const go = (p) => {
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/projects/${p.project_id}`);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && results.length) {
      e.preventDefault();
      const exact = results.find((p) => (p.code || "").toLowerCase() === query);
      go(exact || results[hi] || results[0]);
    }
  };

  return (
    <div ref={boxRef} className="relative hidden sm:block mx-3 md:mx-6 flex-1 max-w-md">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          data-testid="global-search-input"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => { loadProjects(); if (q) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder="Rechercher un projet (code ou nom)…"
          className="w-full h-8 pl-8 pr-14 text-xs bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052CC] focus:bg-white focus:ring-1 focus:ring-[#0052CC] transition-colors placeholder:text-slate-400"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-400 bg-white border border-gray-200 rounded px-1 py-0.5 pointer-events-none hidden md:block">
          Ctrl K
        </kbd>
      </div>

      {open && query && (
        <div data-testid="global-search-results"
          className="absolute top-9 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400" data-testid="global-search-empty">
              Aucun projet ne correspond à « {q} »
            </div>
          ) : (
            results.map((p, i) => (
              <button
                key={p.project_id}
                data-testid={`global-search-result-${p.project_id}`}
                onMouseDown={(e) => { e.preventDefault(); go(p); }}
                onMouseEnter={() => setHi(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${i === hi ? "bg-[#EBF2FF]" : "hover:bg-gray-50"}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${RAG_DOT[p.status_rag] || "bg-slate-300"}`} />
                {p.code && (
                  <span className="font-mono text-[10px] font-semibold text-[#0052CC] bg-[#EBF2FF] border border-[#0052CC]/20 rounded px-1.5 py-0.5 flex-shrink-0">
                    {p.code}
                  </span>
                )}
                <span className="text-xs text-slate-700 truncate flex-1">{p.name}</span>
                {i === hi && <CornerDownLeft size={11} className="text-slate-300 flex-shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
