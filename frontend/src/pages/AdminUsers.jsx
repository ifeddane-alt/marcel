import React, { useState, useEffect, useCallback } from "react";
import { Users, Search, ChevronDown, Plus, KeyRound, UserX, UserCheck, X } from "lucide-react";
import { usersAPI, profilesAPI } from "@/api";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";

const ROLE_LABELS = {
  TENANT_ADMIN: "Admin (legacy)",
  PMO_USER: "PMO (legacy)",
  READ_ONLY: "Lecture seule (legacy)",
};

function UserCreateModal({ profiles, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profileId, setProfileId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères"); return; }
    setSaving(true);
    setError("");
    try {
      await usersAPI.create({ name, email, password, profile_id: profileId || null });
      toast.success("Utilisateur créé");
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de la création");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="user-create-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-heading text-lg font-bold text-zinc-950">Nouvel utilisateur</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Nom complet *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required data-testid="user-name-input"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="user-email-input"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Mot de passe * (8 car. min)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              data-testid="user-password-input"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Profil</label>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)} data-testid="user-profile-select"
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue bg-white">
              <option value="">— Aucun profil —</option>
              {profiles.map((p) => (
                <option key={p.profile_id} value={p.profile_id}>{p.name} {p.is_system ? "(système)" : "(custom)"}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-rose-600 font-medium" data-testid="user-create-error">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">Annuler</button>
            <button type="submit" disabled={saving} data-testid="user-save-btn"
              className="px-4 py-2 text-sm font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark transition-colors disabled:opacity-60">
              {saving ? "Création..." : "Créer l'utilisateur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onSaved }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères"); return; }
    setSaving(true);
    setError("");
    try {
      await usersAPI.resetPassword(user.user_id, { password });
      toast.success(`Mot de passe réinitialisé pour ${user.name}`);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="reset-password-modal">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-m-blue" />
            <h2 className="font-heading text-lg font-bold text-zinc-950">Réinitialiser le mot de passe</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <p className="text-sm text-zinc-500">
            Définissez un nouveau mot de passe pour <b className="text-zinc-800">{user.name}</b> ({user.email}).
          </p>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Nouveau mot de passe * (8 car. min)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              data-testid="reset-password-input" autoFocus
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-m-blue" />
          </div>
          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">Annuler</button>
            <button type="submit" disabled={saving} data-testid="reset-password-save"
              className="px-4 py-2 text-sm font-semibold bg-m-blue text-white rounded-lg hover:bg-m-blue-dark transition-colors disabled:opacity-60">
              {saving ? "Enregistrement..." : "Réinitialiser"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProfile, setFilterProfile] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, profRes] = await Promise.all([
        usersAPI.list(filterProfile ? { profile_id: filterProfile } : {}),
        profilesAPI.list(),
      ]);
      setUsers(usersRes.data);
      setProfiles(profRes.data);
    } catch { toast.error("Erreur chargement utilisateurs"); }
    finally { setLoading(false); }
  }, [filterProfile]);

  useEffect(() => { load(); }, [load]);

  async function handleProfileChange(userId, profileId) {
    try {
      await usersAPI.updateProfile(userId, { profile_id: profileId || null });
      toast.success("Profil mis à jour");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  }

  async function handleToggleActive() {
    if (!toggleTarget) return;
    setToggling(true);
    const goingActive = toggleTarget.is_active === false;
    try {
      await usersAPI.updateProfile(toggleTarget.user_id, { is_active: goingActive });
      toast.success(goingActive ? "Compte réactivé" : "Compte désactivé");
      setToggleTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally { setToggling(false); }
  }

  const filtered = users.filter(u =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-m-muted mb-0.5">Accueil / Administration / <span className="text-m-primary font-semibold">Utilisateurs</span></div>
            <h1 className="font-heading text-2xl font-extrabold text-m-ink tracking-tight flex items-center gap-2">
              <Users size={20} className="text-m-blue" />
              Utilisateurs
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Créez, désactivez et gérez les profils des utilisateurs. Le profil détermine leurs permissions.
            </p>
          </div>
          <button onClick={() => setCreateOpen(true)} data-testid="btn-new-user"
            className="flex items-center gap-2 px-4 py-2.5 bg-m-blue text-white text-sm font-semibold rounded-lg hover:bg-m-blue-dark transition-colors shadow-sm">
            <Plus size={15} /> Nouvel utilisateur
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input data-testid="search-users" type="text" placeholder="Rechercher…"
              className="pl-8 pr-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-m-blue/30 w-56"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select data-testid="filter-profile"
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-m-blue/30 bg-white"
            value={filterProfile} onChange={(e) => setFilterProfile(e.target.value)}>
            <option value="">Tous les profils</option>
            {profiles.map(p => (
              <option key={p.profile_id} value={p.profile_id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-m-bg border-b border-m-border">
                {["Utilisateur", "Email", "Statut", "Rôle système", "Profil", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold text-m-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-sm">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-sm">Aucun utilisateur</td></tr>
              ) : filtered.map((u, i) => {
                const inactive = u.is_active === false;
                return (
                <tr key={u.user_id} data-testid={`user-row-${u.user_id}`}
                  className={`border-b border-zinc-50 ${i % 2 === 0 ? "" : "bg-zinc-50/40"} ${inactive ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${inactive ? "bg-zinc-200 text-zinc-500" : "bg-m-blue/10 text-m-blue"}`}>
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-zinc-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                  <td className="px-4 py-3">
                    {inactive ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200" data-testid={`user-status-${u.user_id}`}>Désactivé</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200" data-testid={`user-status-${u.user_id}`}>Actif</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-lg">
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <select
                        data-testid={`profile-select-${u.user_id}`}
                        className="appearance-none border border-zinc-200 rounded-lg px-3 py-1.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-m-blue/30 bg-white w-full cursor-pointer"
                        value={u.profile_id || ""}
                        onChange={(e) => handleProfileChange(u.user_id, e.target.value)}
                      >
                        <option value="">— Aucun profil —</option>
                        {profiles.map(p => (
                          <option key={p.profile_id} value={p.profile_id}>
                            {p.name} {p.is_system ? "(système)" : "(custom)"}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setResetUser(u)} data-testid={`btn-reset-password-${u.user_id}`}
                        title="Réinitialiser le mot de passe"
                        className="p-1.5 text-zinc-400 hover:text-m-blue hover:bg-blue-50 rounded-lg transition-colors">
                        <KeyRound size={14} />
                      </button>
                      <button onClick={() => setToggleTarget(u)} data-testid={`btn-toggle-active-${u.user_id}`}
                        title={inactive ? "Réactiver le compte" : "Désactiver le compte"}
                        className={`p-1.5 rounded-lg transition-colors ${inactive ? "text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50" : "text-zinc-400 hover:text-rose-600 hover:bg-rose-50"}`}>
                        {inactive ? <UserCheck size={14} /> : <UserX size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <UserCreateModal profiles={profiles} onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); load(); }} />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)}
          onSaved={() => setResetUser(null)} />
      )}
      <ConfirmDialog
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleActive}
        loading={toggling}
        title={toggleTarget?.is_active === false ? "Réactiver le compte" : "Désactiver le compte"}
        message={toggleTarget?.is_active === false
          ? `Réactiver le compte de "${toggleTarget?.name}" ? L'utilisateur pourra à nouveau se connecter.`
          : `Désactiver le compte de "${toggleTarget?.name}" ? L'utilisateur ne pourra plus se connecter.`}
      />
    </div>
  );
}
