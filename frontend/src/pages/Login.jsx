import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { authAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("admin@altair.fr");
  const [password, setPassword] = useState("Admin2026!");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authAPI.login(email, password);
      login(res.data.access_token, { ...res.data.user, permissions: res.data.permissions || [] });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-[#0A1120] px-12 py-10 border-r border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#0052CC] flex items-center justify-center">
            <Building2 size={16} className="text-white" strokeWidth={2} />
          </div>
          <span className="font-heading text-white text-xl font-bold tracking-wide">PROJETENNE</span>
        </div>
        <div>
          <h1 className="font-heading text-white text-5xl font-bold leading-tight mb-4">
            Pilotage de Portefeuille Projets
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Plateforme SaaS multi-tenant pour la gestion de portefeuilles projets grands comptes.
            Suivi budgétaire, gouvernance et reporting en temps réel.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { val: "8", label: "Projets actifs" },
              { val: "17,3M€", label: "Budget portefeuille" },
              { val: "5", label: "Instances gouvernance" },
              { val: "10", label: "Ressources allouées" },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 rounded p-3 border border-white/10">
                <div className="font-mono-data text-[#0052CC] text-xl font-bold">{item.val}</div>
                <div className="text-slate-400 text-xs mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-slate-600 text-xs">
          © 2025 Projetenne — Groupe Altair Industries
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded bg-[#0052CC] flex items-center justify-center">
              <Building2 size={14} className="text-white" strokeWidth={2} />
            </div>
            <span className="font-heading text-white text-xl font-bold tracking-wide">PROJETENNE</span>
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-white text-3xl font-bold mb-1">Connexion</h2>
            <p className="text-slate-400 text-sm">Bienvenue — authentifiez-vous pour continuer</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Adresse e-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="w-full bg-white/5 border border-white/15 rounded px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] transition-colors"
                placeholder="vous@entreprise.fr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-password-input"
                  className="w-full bg-white/5 border border-white/15 rounded px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] transition-colors pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                data-testid="login-error"
                className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2 text-rose-400 text-sm"
              >
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full bg-[#0052CC] hover:bg-[#0047B3] text-white font-semibold text-sm py-2.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 p-4 bg-white/5 rounded border border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
              Comptes de démonstration
            </div>
            {[
              { email: "admin@altair.fr",   pwd: "Admin2026!",  role: "Admin" },
              { email: "cp@altair.fr",       pwd: "Altair2026!", role: "CP" },
              { email: "manager@altair.fr",  pwd: "Altair2026!", role: "Manager" },
            ].map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => { setEmail(acc.email); setPassword(acc.pwd); }}
                data-testid={`demo-account-${acc.role.toLowerCase()}`}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10 transition-colors group"
              >
                <span className="text-xs text-slate-300 font-mono">{acc.email}</span>
                <span className="text-[10px] text-slate-500 ml-2 group-hover:text-slate-400">{acc.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
