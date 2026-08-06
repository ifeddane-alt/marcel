import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Eye, EyeOff, AlertCircle, KeyRound } from "lucide-react";
import { authAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export default function Login() {
  const [email, setEmail] = useState("admin@altair.fr");
  const [password, setPassword] = useState("Admin2026!");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Retour SSO : échange du code one-shot / affichage erreur ──
  useEffect(() => {
    const ssoCode = searchParams.get("sso");
    const ssoError = searchParams.get("sso_error");
    if (ssoError) {
      setError(ssoError);
      setSearchParams({}, { replace: true });
      return;
    }
    if (ssoCode) {
      setLoading(true);
      authAPI.ssoExchange(ssoCode)
        .then((res) => {
          login(res.data.access_token, { ...res.data.user, permissions: res.data.permissions || [] });
          navigate("/dashboard");
        })
        .catch((err) => {
          setError(err.response?.data?.detail || "Échec de la connexion SSO");
          setSearchParams({}, { replace: true });
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSSO = (provider) => {
    setError("");
    if (!email) {
      setError("Saisissez d'abord votre adresse e-mail pour la connexion SSO.");
      return;
    }
    window.location.assign(`${BACKEND}/api/auth/sso/login/${provider}?email=${encodeURIComponent(email)}`);
  };

  const [waking, setWaking] = useState(null);

  const isWakingError = (err) =>
    !err.response || [502, 503, 504].includes(err.response.status);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const MAX_TRIES = 8;
    try {
      for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        try {
          const res = await authAPI.login(email, password);
          login(res.data.access_token, { ...res.data.user, permissions: res.data.permissions || [] });
          navigate("/dashboard");
          return;
        } catch (err) {
          if (isWakingError(err) && attempt < MAX_TRIES) {
            setWaking(attempt);
            await new Promise((r) => setTimeout(r, 6000));
            continue;
          }
          if (isWakingError(err)) {
            setError("Le serveur ne répond pas. Réessayez dans quelques instants.");
          } else {
            setError(err.response?.data?.detail || "Erreur de connexion");
          }
          return;
        }
      }
    } finally {
      setWaking(null);
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
          <span className="font-heading text-white text-xl font-bold tracking-wide">MARCEL</span>
        </div>
        <div>
          <h1 className="font-heading text-white text-5xl font-bold leading-tight mb-4">
            Pilotage de Portefeuille Projets + Agent IA PMO
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
          © 2025 MARCEL — Groupe Altair Industries
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
            <span className="font-heading text-white text-xl font-bold tracking-wide">MARCEL</span>
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

            {waking && (
              <div
                data-testid="login-waking"
                className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 text-amber-400 text-sm"
              >
                <AlertCircle size={15} className="animate-pulse" />
                L'environnement démarre… nouvelle tentative automatique ({waking}/8)
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit-btn"
              className="w-full bg-[#0052CC] hover:bg-[#0047B3] text-white font-semibold text-sm py-2.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {waking ? "Démarrage de l'environnement..." : loading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>

          {/* SSO */}
          <div className="mt-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">ou connexion SSO</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => startSSO("google")}
                data-testid="sso-google-btn"
                className="flex items-center justify-center gap-1.5 bg-white/5 border border-white/15 rounded py-2 text-xs text-slate-200 hover:bg-white/10 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => startSSO("entra")}
                data-testid="sso-entra-btn"
                className="flex items-center justify-center gap-1.5 bg-white/5 border border-white/15 rounded py-2 text-xs text-slate-200 hover:bg-white/10 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                Microsoft
              </button>
              <button
                type="button"
                onClick={() => startSSO("saml")}
                data-testid="sso-saml-btn"
                className="flex items-center justify-center gap-1.5 bg-white/5 border border-white/15 rounded py-2 text-xs text-slate-200 hover:bg-white/10 transition-colors"
              >
                <KeyRound size={13} className="text-slate-400" />
                SAML
              </button>
            </div>
          </div>

          {/* Demo accounts — 7 comptes */}
          <div className="mt-6 p-4 bg-white/5 rounded border border-white/10">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">
              Comptes de démonstration — clic pour pré-remplir
            </div>
            <div className="space-y-1">
              {[
                { email: "admin@altair.fr",   pwd: "Admin2026!",  name: "Sophie Martin",    profile: "Administrateur" },
                { email: "pmo@altair.fr",      pwd: "Pmo1234!",    name: "Thomas Dubois",    profile: "PMO Portefeuille" },
                { email: "cp@altair.fr",       pwd: "Altair2026!", name: "Nicolas Petit",    profile: "Chef de Projet" },
                { email: "manager@altair.fr",  pwd: "Altair2026!", name: "Isabelle Bernard", profile: "Manager Portfolio" },
                { email: "viewer@altair.fr",   pwd: "View1234!",   name: "Marie Leclerc",    profile: "Direction SI" },
                { email: "user@altair.fr",     pwd: "Altair2026!", name: "Julien Girard",    profile: "Utilisateur" },
                { email: "achats@altair.fr",   pwd: "Altair2026!", name: "Marc Lefebvre",    profile: "Achats / Vendor" },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword(acc.pwd); }}
                  data-testid={`demo-account-${acc.email.split("@")[0]}`}
                  className="w-full text-left px-2.5 py-2 rounded hover:bg-white/10 transition-colors group flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-200 font-mono truncate">{acc.email}</div>
                    <div className="text-[10px] text-slate-500 truncate">{acc.name}</div>
                  </div>
                  <span className="flex-shrink-0 text-[9px] font-semibold text-[#0052CC] bg-blue-900/30 border border-blue-800/40 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    {acc.profile}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
