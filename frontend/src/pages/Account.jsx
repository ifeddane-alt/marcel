import React, { useState, useEffect } from "react";
import { UserCircle, KeyRound, ShieldCheck, Building2, Mail, Calendar } from "lucide-react";
import { authAPI } from "@/api";
import { toast } from "sonner";import { formatDate } from "@/utils/format";

const ROLE_LABELS = {
  TENANT_ADMIN: "Administrateur",
  PMO_USER: "PMO",
  READ_ONLY: "Lecture seule",
};

function InfoRow({ icon: Icon, label, value, testId }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-50 last:border-0">
      <Icon size={14} className="text-zinc-400 flex-shrink-0" />
      <span className="text-xs text-zinc-500 w-36 flex-shrink-0">{label}</span>
      <span className="text-sm text-zinc-800 font-medium truncate" data-testid={testId}>{value || "—"}</span>
    </div>
  );
}

export default function Account() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    authAPI.account()
      .then((res) => { setAccount(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPwd.length < 8) { setError("Le nouveau mot de passe doit contenir au moins 8 caractères"); return; }
    if (newPwd !== confirmPwd) { setError("La confirmation ne correspond pas au nouveau mot de passe"); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ current_password: currentPwd, new_password: newPwd });
      toast.success("Mot de passe modifié avec succès");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors du changement de mot de passe");
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-64 text-zinc-400 text-sm">Chargement du compte…</div>;
  }
  if (!account) {
    return <div className="p-8 text-sm text-rose-600">Impossible de charger votre compte.</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl" data-testid="account-page">
      <div className="mb-6">
        <div className="text-xs text-m-muted mb-0.5">Accueil / <span className="text-m-primary font-semibold">Mon compte</span></div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-m-ink tracking-tight">Mon compte</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Vos informations personnelles et la gestion de votre mot de passe</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profil */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-m-primary flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-white">{account.name?.slice(0, 2).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <div className="font-heading text-lg font-bold text-zinc-950 truncate" data-testid="account-name">{account.name}</div>
              <div className="text-xs text-zinc-400 truncate">{account.email}</div>
            </div>
          </div>
          <InfoRow icon={Mail} label="Email" value={account.email} testId="account-email" />
          <InfoRow icon={ShieldCheck} label="Profil de permissions" value={account.profile_name || ROLE_LABELS[account.role] || account.role} testId="account-profile" />
          <InfoRow icon={UserCircle} label="Rôle système" value={ROLE_LABELS[account.role] || account.role} testId="account-role" />
          <InfoRow icon={Building2} label="Organisation" value={account.tenant_name} testId="account-tenant" />
          <InfoRow icon={Calendar} label="Compte créé le" value={account.created_at ? formatDate(account.created_at) : "—"} testId="account-created" />
          {account.password_changed_at && (
            <InfoRow icon={KeyRound} label="Mot de passe modifié" value={formatDate(account.password_changed_at)} testId="account-pwd-changed" />
          )}
        </div>

        {/* Changement de mot de passe */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={15} className="text-m-blue" />
            <h2 className="font-heading text-base font-bold text-zinc-950">Changer mon mot de passe</h2>
          </div>
          {!account.has_password ? (
            <p className="text-sm text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-lg p-4" data-testid="sso-account-notice">
              Votre compte utilise la connexion SSO : le mot de passe est géré par le fournisseur d'identité de votre organisation.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Mot de passe actuel *</label>
                <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required
                  autoComplete="current-password" data-testid="current-password-input"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Nouveau mot de passe * (8 car. min)</label>
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={8}
                  autoComplete="new-password" data-testid="new-password-input"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Confirmer le nouveau mot de passe *</label>
                <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required
                  autoComplete="new-password" data-testid="confirm-password-input"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue" />
              </div>
              {error && <p className="text-sm text-rose-600 font-medium" data-testid="change-password-error">{error}</p>}
              <button type="submit" disabled={saving} data-testid="change-password-btn"
                className="w-full px-4 py-2.5 text-sm font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark transition-colors disabled:opacity-60">
                {saving ? "Modification…" : "Modifier mon mot de passe"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-5">
        <MfaSection />
      </div>
    </div>
  );
}

function MfaSection() {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState(null);
  const [disableMode, setDisableMode] = useState(false);
  const [err, setErr] = useState("");

  const loadStatus = () => authAPI.mfaStatus().then((r) => setStatus(r.data)).catch(() => setStatus({ enabled: false, available: false }));
  useEffect(() => { loadStatus(); }, []);

  if (!status) return null;

  const startSetup = async () => {
    setErr("");
    try { const r = await authAPI.mfaSetup(); setSetup(r.data); }
    catch (e) { setErr(e.response?.data?.detail || "Erreur"); }
  };
  const confirmEnable = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const r = await authAPI.mfaEnable(code);
      setBackupCodes(r.data.backup_codes);
      setSetup(null); setCode("");
      toast.success("Double authentification activée");
      loadStatus();
    } catch (e2) { setErr(e2.response?.data?.detail || "Code invalide"); }
  };
  const disable = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await authAPI.mfaDisable(code);
      setDisableMode(false); setCode(""); setBackupCodes(null);
      toast.success("Double authentification désactivée");
      loadStatus();
    } catch (e2) { setErr(e2.response?.data?.detail || "Code invalide"); }
  };

  const inputCls = "w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 font-mono-data tracking-widest focus:outline-none focus:border-m-blue";

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 max-w-2xl" data-testid="mfa-section">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={15} className="text-m-blue" />
        <h2 className="font-heading text-base font-bold text-zinc-950">Double authentification (MFA)</h2>
        {status.enabled ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" data-testid="mfa-status-badge">ACTIVÉE</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200" data-testid="mfa-status-badge">DÉSACTIVÉE</span>
        )}
      </div>
      <p className="text-xs text-zinc-400 mb-4">Un code à 6 chiffres (Google Authenticator, Authy…) sera demandé à chaque connexion.</p>

      {!status.available && <p className="text-sm text-zinc-500 bg-zinc-50 rounded-lg p-3">Non disponible pour les comptes SSO.</p>}

      {status.available && !status.enabled && !setup && (
        <button onClick={startSetup} data-testid="mfa-enable-btn"
          className="px-4 py-2 text-sm font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark">Activer le MFA</button>
      )}

      {setup && (
        <form onSubmit={confirmEnable} className="space-y-3" data-testid="mfa-setup-form">
          <p className="text-sm text-zinc-600">1. Scannez ce QR code avec votre application d'authentification :</p>
          <img src={setup.qr} alt="QR code MFA" className="w-40 h-40 border border-zinc-100 rounded-lg" data-testid="mfa-qr" />
          <p className="text-[11px] text-zinc-400 font-mono-data break-all">Clé manuelle : <span data-testid="mfa-secret">{setup.secret}</span></p>
          <p className="text-sm text-zinc-600">2. Saisissez le code affiché pour confirmer :</p>
          <div className="flex gap-2 max-w-xs">
            <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="123456"
              data-testid="mfa-confirm-code-input" className={inputCls} />
            <button type="submit" data-testid="mfa-confirm-btn"
              className="px-4 py-2 text-sm font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark">Confirmer</button>
            <button type="button" onClick={() => { setSetup(null); setCode(""); setErr(""); }} data-testid="mfa-cancel-btn"
              className="px-3 py-2 text-sm font-semibold text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50">Annuler</button>
          </div>
          {err && <p className="text-sm text-rose-600">{err}</p>}
        </form>
      )}

      {backupCodes && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="mfa-backup-codes">
          <p className="text-xs font-bold text-amber-800 mb-2">⚠️ Codes de secours — conservez-les précieusement, ils ne seront plus affichés :</p>
          <div className="grid grid-cols-4 gap-1.5">
            {backupCodes.map((c) => <span key={c} className="font-mono-data text-xs bg-white rounded px-2 py-1 text-center border border-amber-100">{c}</span>)}
          </div>
        </div>
      )}

      {status.enabled && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">Codes de secours restants : <b className="font-mono-data">{status.backup_codes_left}</b></p>
          {!disableMode ? (
            <button onClick={() => setDisableMode(true)} data-testid="mfa-disable-btn"
              className="px-4 py-2 text-sm font-semibold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50">Désactiver le MFA</button>
          ) : (
            <form onSubmit={disable} className="flex gap-2 max-w-xs" data-testid="mfa-disable-form">
              <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="Code TOTP ou secours"
                data-testid="mfa-disable-code-input" className={inputCls} />
              <button type="submit" data-testid="mfa-disable-confirm-btn"
                className="px-3 py-2 text-sm font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700">Désactiver</button>
            </form>
          )}
          {err && <p className="text-sm text-rose-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
