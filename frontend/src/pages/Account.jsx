import React, { useState, useEffect } from "react";
import { UserCircle, KeyRound, ShieldCheck, Building2, Mail, Calendar } from "lucide-react";
import { authAPI } from "@/api";
import { toast } from "sonner";
import { formatDate } from "@/utils/format";

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
        <div className="text-xs text-[#8a87a0] mb-0.5">Accueil / <span className="text-[#352c6e] font-semibold">Mon compte</span></div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#26243a] tracking-tight">Mon compte</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Vos informations personnelles et la gestion de votre mot de passe</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profil */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-[#352c6e] flex items-center justify-center flex-shrink-0">
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
            <KeyRound size={15} className="text-blue-600" />
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
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Nouveau mot de passe * (8 car. min)</label>
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={8}
                  autoComplete="new-password" data-testid="new-password-input"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Confirmer le nouveau mot de passe *</label>
                <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required
                  autoComplete="new-password" data-testid="confirm-password-input"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600" />
              </div>
              {error && <p className="text-sm text-rose-600 font-medium" data-testid="change-password-error">{error}</p>}
              <button type="submit" disabled={saving} data-testid="change-password-btn"
                className="w-full px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
                {saving ? "Modification…" : "Modifier mon mot de passe"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
