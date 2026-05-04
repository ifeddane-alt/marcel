import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Plus, Send, ChevronDown, AlertTriangle, CheckCircle, Loader2, BotMessageSquare, Zap } from "lucide-react";
import { agentAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";

// Formate le texte markdown basique (gras, listes)
function FormattedMessage({ text }) {
  const parts = text.split("\n").map((line, i) => {
    // Ligne vide
    if (!line.trim()) return <div key={i} className="h-2" />;
    // Titre (ligne commençant par ### ou **)
    if (line.startsWith("### ")) return <p key={i} className="font-bold text-sm mt-2 mb-1">{line.replace("### ", "")}</p>;
    if (line.startsWith("## "))  return <p key={i} className="font-bold text-sm mt-2 mb-1">{line.replace("## ", "")}</p>;
    // Liste puce
    if (line.startsWith("• ") || line.startsWith("- "))
      return <li key={i} className="ml-3 text-xs leading-relaxed list-none flex gap-1"><span className="text-blue-400 flex-shrink-0">•</span><span>{formatInline(line.slice(2))}</span></li>;
    if (line.match(/^\d+\.\s/))
      return <li key={i} className="ml-3 text-xs leading-relaxed list-none flex gap-1"><span className="text-blue-400 flex-shrink-0">{line.match(/^\d+/)[0]}.</span><span>{formatInline(line.replace(/^\d+\.\s/, ""))}</span></li>;
    // Simulation
    if (line.includes("SIMULATION"))
      return <p key={i} className="text-amber-600 text-xs font-semibold mt-2 p-1.5 bg-amber-50 rounded border border-amber-200">{line}</p>;
    // Ligne normale
    return <p key={i} className="text-xs leading-relaxed">{formatInline(line)}</p>;
  });
  return <>{parts}</>;
}

function formatInline(text) {
  const parts = [];
  let remaining = text;
  let key = 0;
  const boldRegex = /\*\*(.*?)\*\*/;
  while (remaining) {
    const match = boldRegex.exec(remaining);
    if (!match) { parts.push(<span key={key++}>{remaining}</span>); break; }
    if (match.index > 0) parts.push(<span key={key++}>{remaining.slice(0, match.index)}</span>);
    parts.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
    remaining = remaining.slice(match.index + match[0].length);
  }
  return parts;
}

const TYPE_LABELS = {
  eac_overrun: "Dépassement EAC",
  unmitigated_risk: "Risque critique",
  delayed_milestone: "Jalon retard",
  envelope_breach: "Enveloppe dépassée",
  red_project: "Projet rouge",
  team_overload: "Surcharge équipe",
};

export default function AgentDrawer() {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const canChat = hasPermission("agent.chat") || hasPermission("*");

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { if (isOpen) scrollToBottom(); }, [messages, isOpen]);

  useEffect(() => {
    const handler = (e) => {
      const question = e.detail?.question || "";
      if (!canChat) return;
      setIsOpen(true);
      setCurrentSessionId(null);
      setMessages([]);
      if (question) setInputText(question);
    };
    window.addEventListener("agent:open-with-question", handler);
    return () => window.removeEventListener("agent:open-with-question", handler);
  }, [canChat]);

  useEffect(() => {
    if (isOpen && sessions.length === 0) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    try {
      const res = await agentAPI.listSessions();
      setSessions(res.data || []);
    } catch {}
  };

  const loadSessionHistory = async (sessionId) => {
    if (!sessionId) return;
    setLoadingHistory(true);
    try {
      const res = await agentAPI.getSessionHistory(sessionId);
      const logs = res.data || [];
      const msgs = [];
      for (const log of logs) {
        msgs.push({ role: "user", content: log.question, ts: log.created_at });
        msgs.push({
          role: "assistant",
          content: log.response,
          verified: log.verified,
          warnings: log.warnings,
          is_simulation: log.is_simulation,
          duration_ms: log.duration_ms,
          ts: log.created_at,
        });
      }
      setMessages(msgs);
    } catch {}
    setLoadingHistory(false);
  };

  const openDrawer = () => {
    setIsOpen(true);
    if (sessions.length === 0) loadSessions();
  };

  const startNewSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setShowSessions(false);
    inputRef.current?.focus();
  };

  const selectSession = async (sessionId) => {
    setCurrentSessionId(sessionId);
    setShowSessions(false);
    await loadSessionHistory(sessionId);
  };

  const sendMessage = async () => {
    const question = inputText.trim();
    if (!question || isLoading) return;

    const userMsg = { role: "user", content: question, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const res = await agentAPI.chat({ question, session_id: currentSessionId });
      const data = res.data;

      if (!currentSessionId) {
        setCurrentSessionId(data.session_id);
        await loadSessions();
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        verified: data.verified,
        warnings: data.warnings,
        is_simulation: data.is_simulation,
        duration_ms: data.duration_ms,
        ts: new Date().toISOString(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Désolé, une erreur est survenue lors de la communication avec l'IA. Veuillez réessayer.",
        verified: false,
        warnings: ["Erreur technique"],
        ts: new Date().toISOString(),
      }]);
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const QUICK_QUESTIONS = [
    "Quel est l'état global du portefeuille ?",
    "Quels sont les projets en dépassement EAC ?",
    "Résume les risques critiques du portefeuille",
    "Quels jalons sont en retard ?",
  ];

  return (
    <>
      {/* Bouton flottant — uniquement si l'utilisateur a la permission */}
      {canChat && <button
        data-testid="agent-drawer-toggle"
        onClick={() => isOpen ? setIsOpen(false) : openDrawer()}
        className="fixed bottom-20 right-4 sm:right-6 z-50 flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full shadow-xl text-white font-semibold text-sm transition-all hover:scale-105"
        style={{ background: "linear-gradient(135deg, #0052CC 0%, #0747A6 100%)" }}
      >
        <BotMessageSquare size={18} strokeWidth={2} />
        <span className="hidden sm:inline">Agent IA PMO</span>
      </button>}

      {/* Drawer */}
      {canChat && isOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ pointerEvents: "none" }}
        >
          <div
            data-testid="agent-drawer-panel"
            className="absolute right-0 top-0 h-full w-full sm:w-[380px] xl:w-[420px] bg-white border-l border-gray-200 shadow-2xl flex flex-col"
            style={{ pointerEvents: "all" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <BotMessageSquare size={15} className="text-white" />
                </div>
                <div>
                  <div className="text-white font-bold text-sm leading-none">Agent IA PMO</div>
                  <div className="text-slate-400 text-[10px] mt-0.5">MARCEL — Groupe Altair</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  data-testid="agent-new-session"
                  onClick={startNewSession}
                  title="Nouvelle conversation"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-white/10 hover:border-white/30 transition-colors"
                >
                  <Plus size={12} /> Nouveau
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  data-testid="agent-drawer-close"
                  className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Session selector */}
            {sessions.length > 0 && (
              <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setShowSessions(!showSessions)}
                  className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-800 px-2 py-1.5 rounded border border-gray-200 hover:border-gray-300 bg-white transition-colors"
                  data-testid="agent-session-selector"
                >
                  <span className="truncate">
                    {currentSessionId
                      ? sessions.find(s => s.session_id === currentSessionId)?.first_message || "Session courante"
                      : "Nouvelle conversation"}
                  </span>
                  <ChevronDown size={12} className={`flex-shrink-0 ml-1 transition-transform ${showSessions ? "rotate-180" : ""}`} />
                </button>
                {showSessions && (
                  <div className="absolute left-0 right-0 mx-3 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    <button
                      onClick={startNewSession}
                      className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100"
                    >
                      <Plus size={11} /> Nouvelle conversation
                    </button>
                    {sessions.map(s => (
                      <button
                        key={s.session_id}
                        onClick={() => selectSession(s.session_id)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${s.session_id === currentSessionId ? "bg-blue-50" : ""}`}
                      >
                        <div className="text-xs text-slate-700 font-medium truncate">{s.first_message}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(s.last_activity).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} — {s.message_count} msg
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" onClick={() => setShowSessions(false)}>
              {loadingHistory && (
                <div className="flex items-center justify-center py-8 text-slate-400 text-xs gap-2">
                  <Loader2 size={14} className="animate-spin" /> Chargement de l'historique...
                </div>
              )}

              {!loadingHistory && messages.length === 0 && (
                <div className="py-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <BotMessageSquare size={22} className="text-blue-600" />
                  </div>
                  <p className="text-slate-700 font-semibold text-sm mb-1">Bonjour, je suis votre Agent IA PMO</p>
                  <p className="text-slate-400 text-xs mb-4 px-4">Posez-moi une question sur votre portefeuille, ou essayez une suggestion :</p>
                  <div className="space-y-1.5 px-2">
                    {QUICK_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => { setInputText(q); inputRef.current?.focus(); }}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition-all"
                      >
                        <Zap size={10} className="inline mr-1.5 text-blue-500" />{q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "user" ? (
                    <div
                      data-testid={`agent-user-msg-${idx}`}
                      className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm text-white text-xs leading-relaxed shadow-sm"
                      style={{ background: "linear-gradient(135deg, #0052CC 0%, #0747A6 100%)" }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[90%] flex flex-col gap-1">
                      <div
                        data-testid={`agent-assistant-msg-${idx}`}
                        className="px-3 py-2.5 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-200 text-slate-700 shadow-sm"
                      >
                        <FormattedMessage text={msg.content} />
                      </div>
                      {/* Badges vérification + simulation */}
                      <div className="flex items-center gap-2 px-1">
                        {msg.is_simulation && (
                          <span className="flex items-center gap-1 text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle size={9} /> Simulation
                          </span>
                        )}
                        {msg.verified === true && (
                          <span className="flex items-center gap-1 text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full" data-testid={`agent-verified-badge-${idx}`}>
                            <CheckCircle size={9} /> Vérifié
                          </span>
                        )}
                        {msg.verified === false && (
                          <span className="flex items-center gap-1 text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full" data-testid={`agent-unverified-badge-${idx}`}>
                            <AlertTriangle size={9} /> À vérifier
                          </span>
                        )}
                        {msg.duration_ms && (
                          <span className="text-[9px] text-slate-300">{(msg.duration_ms / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                      {/* Avertissements guardrail */}
                      {msg.warnings && msg.warnings.length > 0 && (
                        <div className="px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
                          {msg.warnings.map((w, wi) => <div key={wi}>⚠ {w}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400">L'agent analyse...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-gray-200 flex-shrink-0 bg-white">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  data-testid="agent-input"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Posez votre question PMO..."
                  rows={1}
                  className="flex-1 resize-none text-xs border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400 text-slate-700 placeholder-slate-400 max-h-24 overflow-y-auto"
                  style={{ minHeight: "38px" }}
                />
                <button
                  data-testid="agent-send-btn"
                  onClick={sendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
                  style={{ background: inputText.trim() && !isLoading ? "linear-gradient(135deg, #0052CC 0%, #0747A6 100%)" : "#E2E8F0" }}
                >
                  {isLoading
                    ? <Loader2 size={15} className="text-blue-600 animate-spin" />
                    : <Send size={14} className={inputText.trim() ? "text-white" : "text-slate-400"} />
                  }
                </button>
              </div>
              <p className="text-[9px] text-slate-300 mt-1.5 text-center">
                Les réponses sont générées à partir de vos données MARCEL uniquement.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
