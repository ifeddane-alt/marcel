import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, AlertCircle, KeyRound, Check } from "lucide-react";
import { authAPI } from "@/api";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const DEMO_ACCOUNTS = [
  { email: "admin@altair.fr",   pwd: "Admin2026!",  name: "Sophie Martin",    profile: "Administrateur" },
  { email: "pmo@altair.fr",     pwd: "Pmo1234!",    name: "Thomas Dubois",    profile: "PMO Portefeuille" },
  { email: "cp@altair.fr",      pwd: "Altair2026!", name: "Nicolas Petit",    profile: "Chef de Projet" },
  { email: "manager@altair.fr", pwd: "Altair2026!", name: "Isabelle Bernard", profile: "Manager Portfolio" },
  { email: "viewer@altair.fr",  pwd: "View1234!",   name: "Marie Leclerc",    profile: "Direction SI" },
  { email: "user@altair.fr",    pwd: "Altair2026!", name: "Julien Girard",    profile: "Utilisateur" },
  { email: "achats@altair.fr",  pwd: "Altair2026!", name: "Marc Lefebvre",    profile: "Achats / Vendor" },
];

function BrandMark({ size = "lg" }) {
  const cls = size === "lg" ? "w-11 h-11 rounded-xl text-[22px]" : "w-8 h-8 rounded-lg text-base";
  return (
    <div className={`${cls} bg-m-primary flex items-center justify-center text-white font-heading font-extrabold flex-shrink-0`}>
      M
    </div>
  );
}

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
          navigate("/home");
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
  const [mfaTicket, setMfaTicket] = useState(null);
  const [mfaCode, setMfaCode] = useState("");

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
          if (res.data.mfa_required) {
            setMfaTicket(res.data.mfa_ticket);
            return;
          }
          login(res.data.access_token, { ...res.data.user, permissions: res.data.permissions || [] });
          navigate("/home");
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

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authAPI.mfaVerify(mfaTicket, mfaCode);
      login(res.data.access_token, { ...res.data.user, permissions: res.data.permissions || [] });
      navigate("/home");
    } catch (err) {
      setError(err.response?.data?.detail || "Code invalide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#efeaf8] flex">
      {/* ── Panneau branding gauche ─────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-center flex-1 px-14 xl:px-20 relative overflow-hidden">
        <div className="absolute -bottom-32 -left-24 w-[420px] h-[420px] rounded-full bg-white/40 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <BrandMark />
            <div>
              <div className="font-heading text-m-primary text-2xl font-extrabold tracking-tight leading-none">MARCEL</div>
              <div className="text-[11px] text-[#75708c] font-medium mt-0.5">Project Portfolio Management</div>
            </div>
          </div>
          <h1 className="font-heading text-m-primary text-4xl xl:text-5xl font-extrabold leading-[1.12] mb-5 max-w-xl">
            Le pilotage de vos projets et portefeuilles
          </h1>
          <p className="text-[#5d5877] text-base xl:text-lg leading-relaxed max-w-md mb-9">
            Plus de visibilité. De meilleures décisions. Un succès durable.
          </p>
          <div className="space-y-3.5">
            {[
              "Portefeuilles, budgets, jalons & risques unifiés",
              "Dashboards temps réel prêts pour le COMEX",
              "Agent IA PMO intégré",
            ].map((pt) => (
              <div key={pt} className="flex items-center gap-3 text-m-primary-dark text-sm font-semibold">
                <Check size={18} strokeWidth={2.5} className="text-m-primary flex-shrink-0" />
                {pt}
              </div>
            ))}
          </div>
          <div className="text-m-muted-2 text-xs mt-14">© 2026 MARCEL — Groupe Altair Industries</div>
        </div>
      </div>

      {/* ── Formulaire droite ───────────────────────────────── */}
      <div className="flex-1 lg:flex-none lg:w-[560px] flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 mb-6 lg:hidden">
            <BrandMark size="sm" />
            <span className="font-heading text-m-primary text-xl font-extrabold tracking-tight">MARCEL</span>
          </div>

          <div className="bg-white rounded-2xl shadow-[0_24px_60px_-22px_rgba(53,44,110,0.35)] p-8 sm:p-9">
            {mfaTicket ? (
              <>
                <h2 className="font-heading text-m-ink text-2xl font-bold mb-1">Vérification en deux étapes</h2>
                <p className="text-[#75708c] text-sm mb-7">Saisissez le code de votre application d'authentification (ou un code de secours).</p>
                <form onSubmit={handleMfaSubmit} className="space-y-4" data-testid="mfa-form">
                  <input
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    required
                    data-testid="mfa-code-input"
                    placeholder="123 456"
                    className="w-full h-11 bg-m-bg border-[1.5px] border-m-border-strong rounded-lg px-3.5 text-lg font-mono-data tracking-widest text-center text-m-ink focus:outline-none focus:border-m-blue focus:ring-2 focus:ring-m-blue/20"
                  />
                  {error && <p className="text-sm text-rose-600 font-medium" data-testid="mfa-error">{error}</p>}
                  <button type="submit" disabled={loading} data-testid="mfa-submit-btn"
                    className="w-full h-11 bg-m-blue text-white text-sm font-bold rounded-lg hover:bg-m-blue-dark transition-colors disabled:opacity-60">
                    {loading ? "Vérification…" : "Valider"}
                  </button>
                  <button type="button" onClick={() => { setMfaTicket(null); setMfaCode(""); setError(""); }}
                    data-testid="mfa-back-btn"
                    className="w-full text-xs text-[#75708c] hover:text-m-ink">← Retour à la connexion</button>
                </form>
              </>
            ) : (
            <>
            <h2 className="font-heading text-m-ink text-2xl font-bold mb-1">Connexion</h2>
            <p className="text-[#75708c] text-sm mb-7">Accédez à votre espace de pilotage.</p>

            <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
              <div>
                <label className="block text-[12.5px] font-bold text-m-primary-dark mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="login-email-input"
                  className="w-full h-11 bg-m-bg border-[1.5px] border-m-border-strong rounded-lg px-3.5 text-sm text-m-ink placeholder-m-muted-2 focus:outline-none focus:border-m-blue focus:ring-2 focus:ring-m-blue/20 transition-colors"
                  placeholder="prenom.nom@entreprise.fr"
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-bold text-m-primary-dark mb-1.5">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="login-password-input"
                    className="w-full h-11 bg-m-bg border-[1.5px] border-m-border-strong rounded-lg px-3.5 pr-10 text-sm text-m-ink placeholder-m-muted-2 focus:outline-none focus:border-m-blue focus:ring-2 focus:ring-m-blue/20 transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-m-muted-2 hover:text-m-ink-soft"
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  data-testid="login-error"
                  className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-rose-700 text-sm"
                >
                  <AlertCircle size={15} />
                  {error}
                </div>
              )}

              {waking && (
                <div
                  data-testid="login-waking"
                  className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-700 text-sm"
                >
                  <AlertCircle size={15} className="animate-pulse" />
                  L'environnement démarre… nouvelle tentative automatique ({waking}/8)
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-btn"
                className="w-full h-[46px] bg-m-blue hover:bg-[#2450c7] text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_20px_-8px_rgba(46,95,232,0.6)]"
              >
                {waking ? "Démarrage de l'environnement..." : loading ? "Connexion en cours..." : "Se connecter"}
              </button>
            </form>

            {/* SSO */}
            <div className="mt-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-m-border-lav" />
                <span className="text-[10px] uppercase tracking-widest text-m-muted-2 font-bold">ou continuer avec</span>
                <div className="flex-1 h-px bg-m-border-lav" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => startSSO("google")}
                  data-testid="sso-google-btn"
                  className="flex items-center justify-center gap-1.5 bg-white border-[1.5px] border-m-border-strong rounded-lg py-2 text-xs font-semibold text-m-primary-dark hover:bg-m-surface transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => startSSO("entra")}
                  data-testid="sso-entra-btn"
                  className="flex items-center justify-center gap-1.5 bg-white border-[1.5px] border-m-border-strong rounded-lg py-2 text-xs font-semibold text-m-primary-dark hover:bg-m-surface transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                  Microsoft
                </button>
                <button
                  type="button"
                  onClick={() => startSSO("saml")}
                  data-testid="sso-saml-btn"
                  className="flex items-center justify-center gap-1.5 bg-white border-[1.5px] border-m-border-strong rounded-lg py-2 text-xs font-semibold text-m-primary-dark hover:bg-m-surface transition-colors"
                >
                  <KeyRound size={13} className="text-m-muted" />
                  SAML
                </button>
              </div>
            </div>
            </>
            )}
          </div>

          {/* Comptes de démonstration */}
          <div className="mt-4 p-4 bg-white/70 rounded-2xl border border-[#e0dcf0]">
            <div className="text-[10px] uppercase tracking-widest text-m-muted font-bold mb-2.5">
              Comptes de démonstration — clic pour pré-remplir
            </div>
            <div className="space-y-0.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword(acc.pwd); }}
                  data-testid={`demo-account-${acc.email.split("@")[0]}`}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white transition-colors flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] text-m-primary-dark font-mono-data truncate">{acc.email}</div>
                    <div className="text-[10px] text-m-muted-2 truncate">{acc.name}</div>
                  </div>
                  <span className="flex-shrink-0 text-[9px] font-bold text-m-blue bg-m-blue-soft border border-[#d4e0fc] px-1.5 py-0.5 rounded-full uppercase tracking-wide">
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
