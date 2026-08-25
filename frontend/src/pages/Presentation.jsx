import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { projectsAPI, dashboardAPI, catalogAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatEuro } from "@/utils/format";

const RAG_COLORS = { green: "#4ade80", orange: "#fbbf24", red: "#f87171" };

const Big = ({ value, label, color }) => (
  <div className="text-center">
    <div className="font-mono-data font-extrabold text-6xl md:text-7xl" style={{ color: color || "#fff" }}>{value}</div>
    <div className="text-sm uppercase tracking-[0.25em] text-white/50 mt-3 font-semibold">{label}</div>
  </div>
);

export default function Presentation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [extras, setExtras] = useState(null);
  const [indicators, setIndicators] = useState([]);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    projectsAPI.list().then((r) => setProjects(r.data || [])).catch(() => {});
    dashboardAPI.extras().then((r) => setExtras(r.data)).catch(() => setExtras({}));
    catalogAPI.values("dashboard").then((r) => setIndicators(r.data?.items || [])).catch(() => {});
  }, []);

  const active = projects.filter((p) => !["cloture", "archive", "annule"].includes(p.status));
  const rag = { green: 0, orange: 0, red: 0 };
  active.forEach((p) => { if (rag[p.status_rag] !== undefined) rag[p.status_rag] += 1; });
  const budgetTotal = active.reduce((s, p) => s + (p.budget_total || 0), 0);
  const budgetConsumed = active.reduce((s, p) => s + (p.budget_consumed || 0), 0);
  const eacTotal = active.reduce((s, p) => s + (p.eac || p.budget_forecast || p.budget_total || 0), 0);
  const topProjects = [...active].sort((a, b) => (b.budget_total || 0) - (a.budget_total || 0)).slice(0, 5);
  const milestones = (extras?.upcoming_milestones || []).slice(0, 6);

  const slides = [
    {
      key: "titre",
      render: () => (
        <div className="text-center space-y-6">
          <div className="text-[11px] uppercase tracking-[0.4em] text-white/40 font-bold">Revue de portefeuille</div>
          <h1 className="font-heading text-5xl md:text-6xl font-extrabold text-white">Portefeuille projets DSI</h1>
          <p className="text-white/50 text-lg">{new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · {user?.name}</p>
          <div className="flex justify-center gap-16 pt-8">
            <Big value={active.length} label="Projets actifs" />
            <Big value={formatEuro(budgetTotal)} label="Budget total" />
          </div>
        </div>
      ),
    },
    {
      key: "sante",
      render: () => (
        <div className="space-y-12">
          <h2 className="font-heading text-3xl font-bold text-white text-center">Santé du portefeuille</h2>
          <div className="flex justify-center gap-20">
            <Big value={rag.green} label="Verts" color={RAG_COLORS.green} />
            <Big value={rag.orange} label="Orange" color={RAG_COLORS.orange} />
            <Big value={rag.red} label="Rouges" color={RAG_COLORS.red} />
          </div>
          <div className="max-w-2xl mx-auto h-4 rounded-full overflow-hidden flex bg-white/10">
            {["green", "orange", "red"].map((k) => (
              <div key={k} style={{ width: `${active.length ? (rag[k] / active.length) * 100 : 0}%`, background: RAG_COLORS[k] }} />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "budget",
      render: () => (
        <div className="space-y-12">
          <h2 className="font-heading text-3xl font-bold text-white text-center">Budget consolidé</h2>
          <div className="flex justify-center gap-16 flex-wrap">
            <Big value={formatEuro(budgetTotal)} label="Budget" />
            <Big value={formatEuro(budgetConsumed)} label="Consommé" color="#93c5fd" />
            <Big value={formatEuro(eacTotal)} label="EAC" color={eacTotal > budgetTotal ? "#f87171" : "#4ade80"} />
          </div>
          <p className="text-center text-white/50 text-lg">
            {budgetTotal > 0 ? Math.round((budgetConsumed / budgetTotal) * 100) : 0}% consommé
            {eacTotal > budgetTotal && <span className="text-rose-300"> · atterrissage en dépassement de {formatEuro(eacTotal - budgetTotal)}</span>}
          </p>
        </div>
      ),
    },
    ...(indicators.length > 0 ? [{
      key: "indicateurs",
      render: () => (
        <div className="space-y-8 w-full max-w-5xl">
          <h2 className="font-heading text-3xl font-bold text-white text-center">Mes indicateurs</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {indicators.slice(0, 9).map((it) => (
              <div key={it.indicator_id} className="bg-white/5 border border-white/10 rounded-xl p-5 text-center" data-testid={`presentation-indicator-${it.indicator_id}`}>
                <div className="text-[10px] font-mono-data uppercase tracking-widest text-white/40">{it.indicator_id}</div>
                <div className="font-mono-data text-3xl font-extrabold text-white mt-1">{it.display ?? "—"}</div>
                <div className="text-xs text-white/50 mt-1.5 leading-snug">{it.name}</div>
              </div>
            ))}
          </div>
          {indicators.length > 9 && (
            <p className="text-center text-white/30 text-xs">+ {indicators.length - 9} autres indicateurs dans MARCEL</p>
          )}
        </div>
      ),
    }] : []),
    {
      key: "top",
      render: () => (
        <div className="space-y-8 w-full max-w-4xl">
          <h2 className="font-heading text-3xl font-bold text-white text-center">Top 5 projets (budget)</h2>
          <div className="space-y-3">
            {topProjects.map((p) => (
              <div key={p.project_id} className="flex items-center gap-4 bg-white/5 rounded-xl px-6 py-4 border border-white/10">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: RAG_COLORS[p.status_rag] || "#71717a" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold truncate">{p.name}</div>
                  <div className="text-white/40 text-xs font-mono-data">{p.code}</div>
                </div>
                <div className="font-mono-data text-white/80 font-bold">{formatEuro(p.budget_total)}</div>
                <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden hidden md:block">
                  <div className="h-full bg-blue-400" style={{ width: `${p.budget_total ? Math.min(100, Math.round((p.budget_consumed / p.budget_total) * 100)) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "jalons",
      render: () => (
        <div className="space-y-8 w-full max-w-3xl">
          <h2 className="font-heading text-3xl font-bold text-white text-center">Prochains jalons</h2>
          {milestones.length === 0 ? (
            <p className="text-center text-white/40">Aucun jalon à venir sous 30 jours.</p>
          ) : (
            <div className="space-y-2.5">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 rounded-xl px-6 py-3.5 border border-white/10">
                  <span className={`w-[11px] h-[11px] rotate-45 rounded-[2px] flex-shrink-0 ${m.late ? "bg-rose-400" : "bg-blue-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold truncate">{m.name}</div>
                    <div className="text-white/40 text-xs truncate">{m.project_name}</div>
                  </div>
                  <div className={`font-mono-data text-sm ${m.late ? "text-rose-300" : "text-white/70"}`}>
                    {m.date_forecast ? new Date(m.date_forecast).toLocaleDateString("fr-FR") : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  const next = useCallback(() => setSlide((s) => Math.min(s + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setSlide((s) => Math.max(s - 1, 0)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") navigate("/dashboard");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, navigate]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#1d1839] flex flex-col" data-testid="presentation-mode">
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-heading text-white/60 font-bold text-sm tracking-wide">MARCEL · Mode présentation</span>
        <button onClick={() => navigate("/dashboard")} data-testid="presentation-exit-btn"
          className="w-9 h-9 rounded-full bg-white/10 text-white/70 hover:bg-white/20 flex items-center justify-center">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-8 md:px-16">
        {slides[slide].render()}
      </div>
      <div className="flex items-center justify-center gap-6 pb-8">
        <button onClick={prev} disabled={slide === 0} data-testid="presentation-prev-btn"
          className="w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 flex items-center justify-center">
          <ChevronLeft size={18} />
        </button>
        <div className="flex gap-2">
          {slides.map((s, i) => (
            <button key={s.key} onClick={() => setSlide(i)} data-testid={`presentation-dot-${i}`}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${i === slide ? "bg-white" : "bg-white/25 hover:bg-white/50"}`} />
          ))}
        </div>
        <button onClick={next} disabled={slide === slides.length - 1} data-testid="presentation-next-btn"
          className="w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 flex items-center justify-center">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
