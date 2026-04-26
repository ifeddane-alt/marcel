import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, CheckCheck, X, Info, CheckCircle, AlertTriangle, Calendar, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const WS_URL = BACKEND_URL.replace(/^https?/, (m) => (m === "https" ? "wss" : "ws"));

const TYPE_CONFIG = {
  scope_transmitted:     { icon: Zap,            color: "text-blue-600",    bg: "bg-blue-50" },
  timesheet_validated:   { icon: CheckCircle,    color: "text-emerald-600", bg: "bg-emerald-50" },
  timesheet_rejected:    { icon: X,              color: "text-rose-600",    bg: "bg-rose-50" },
  recommendation_new:    { icon: AlertTriangle,  color: "text-amber-600",   bg: "bg-amber-50" },
  milestone_approaching: { icon: Calendar,       color: "text-purple-600",  bg: "bg-purple-50" },
  alert_triggered:       { icon: AlertTriangle,  color: "text-rose-600",    bg: "bg-rose-50" },
  decision_created:      { icon: Info,           color: "text-blue-600",    bg: "bg-blue-50" },
  demand_status_changed: { icon: Info,           color: "text-slate-600",   bg: "bg-slate-50" },
};

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

export default function NotificationBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const wsRef = useRef(null);
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      }
    } catch {}
  }, [token]);

  // WebSocket connection
  useEffect(() => {
    if (!token) return;
    const wsUrl = `${WS_URL}/api/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === "init") {
          setUnreadCount(msg.unread_count);
        } else if (msg.event === "notification") {
          setNotifications(prev => [msg.data, ...prev].slice(0, 50));
          setUnreadCount(c => c + 1);
        }
      } catch {}
    };

    ws.onerror = () => {};

    // Keepalive
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 30000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [token]);

  // Load on open
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (notifId) => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/${notifId}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.notif_id === notifId ? { ...n, read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        data-testid="notification-bell"
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-gray-100 transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-rose-500 text-white rounded-full leading-none"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-slate-600" />
              <span className="font-bold text-sm text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">
                  {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                data-testid="mark-all-read-btn"
                className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
              >
                <CheckCheck size={11} /> Tout lire
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Bell size={22} className="mb-2 opacity-30" />
                <p className="text-xs">Aucune notification</p>
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.demand_status_changed;
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.notif_id}
                    data-testid={`notif-item-${n.notif_id}`}
                    onClick={() => !n.read && markRead(n.notif_id)}
                    className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${n.read ? "bg-white" : "bg-blue-50/40 hover:bg-blue-50"}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-semibold ${n.read ? "text-slate-600" : "text-slate-800"}`}>
                          {n.label}
                        </span>
                        <span className="text-[9px] text-slate-400 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
