import React, { useState, useEffect, useCallback } from "react";
import {
  Shield, Plus, Pencil, Trash2, Copy, Check, X,
  ChevronDown, ChevronRight, Search, Users,
} from "lucide-react";
import { profilesAPI } from "@/api";
import { toast } from "sonner";

const MODULE_ORDER = [
  "Dashboard", "Portefeuille", "Projets", "Export", "Tâches", "Jalons",
  "Roadmap", "Dépendances", "Ressources", "Équipes", "Allocations",
  "Budget", "RAF", "Timesheets", "Congés", "Risques", "Décisions",
  "Gouvernance", "Conformité", "Demandes", "SAFe", "Scope",
  "Fournisseurs", "Administration", "Import",
];

// ─── Modal : Créer / Dupliquer profil ────────────────────────────────────────
function ProfileFormModal({ onClose, onSaved, duplicateFrom }) {
  const [form, setForm] = useState({
    name: duplicateFrom ? `${duplicateFrom.name} (copie)` : "",
    code: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) return toast.error("Nom et code obligatoires");
    setLoading(true);
    try {
      if (duplicateFrom) {
        await profilesAPI.duplicate(duplicateFrom.profile_id, {
          new_name: form.name,
          new_code: form.code.toUpperCase(),
          description: form.description,
        });
        toast.success("Profil dupliqué");
      } else {
        await profilesAPI.create({ ...form, code: form.code.toUpperCase(), permissions: [] });
        toast.success("Profil créé");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">
            {duplicateFrom ? `Dupliquer "${duplicateFrom.name}"` : "Nouveau profil"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nom *</label>
            <input data-testid="profile-name-input" type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
              value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Code technique * (ex: CHEF_PROJET)</label>
            <input data-testid="profile-code-input" type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 uppercase"
              value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
              rows={2} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
          <button data-testid="profile-form-save" onClick={handleSave} disabled={loading}
            className="px-4 py-2 bg-[#0052CC] text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
            {loading ? "…" : duplicateFrom ? "Dupliquer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Matrice de permissions ───────────────────────────────────────────────────
function PermissionsMatrix({ profile, allPermissions, onSave, onClose }) {
  const isAdmin = profile.code === "ADMIN";
  const [perms, setPerms] = useState(new Set(profile.permissions || []));
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [saving, setSaving] = useState(false);

  const hasAll = perms.has("*");

  function toggle(key) {
    if (isAdmin) return;
    setPerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleModule(moduleName, keys) {
    if (isAdmin) return;
    const allOn = keys.every(k => perms.has(k) || hasAll);
    setPerms(prev => {
      const next = new Set(prev);
      if (allOn) keys.forEach(k => next.delete(k));
      else keys.forEach(k => next.add(k));
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await profilesAPI.update(profile.profile_id, { permissions: [...perms] });
      toast.success("Permissions sauvegardées");
      onSave();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  }

  // Group by module
  const grouped = {};
  for (const perm of allPermissions) {
    if (!grouped[perm.module]) grouped[perm.module] = [];
    grouped[perm.module].push(perm);
  }

  const filteredGrouped = {};
  for (const [mod, permsArr] of Object.entries(grouped)) {
    const filtered = permsArr.filter(p =>
      !search || p.label.toLowerCase().includes(search.toLowerCase()) || p.key.toLowerCase().includes(search.toLowerCase())
    );
    if (filtered.length > 0) filteredGrouped[mod] = filtered;
  }

  const orderedModules = MODULE_ORDER.filter(m => filteredGrouped[m]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800">Permissions — {profile.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin ? "Profil ADMIN : tous les droits (non modifiable)" : `${perms.size} permission(s) sélectionnée(s)`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Search */}
        {!isAdmin && (
          <div className="px-6 py-3 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Rechercher une permission…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        )}

        {/* Matrix */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {isAdmin ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Shield size={32} className="mx-auto mb-3 text-[#0052CC]" />
              <p className="font-semibold">Le profil ADMIN dispose de tous les droits.</p>
              <p className="text-xs text-slate-400 mt-1">Ces permissions ne peuvent pas être modifiées.</p>
            </div>
          ) : (
            orderedModules.map((moduleName) => {
              const items = filteredGrouped[moduleName] || [];
              const moduleKeys = items.map(i => i.key);
              const allOn = moduleKeys.every(k => perms.has(k) || hasAll);
              const isOpen = !collapsed[moduleName];
              return (
                <div key={moduleName} className="border border-slate-100 rounded-xl overflow-hidden">
                  <button
                    data-testid={`module-toggle-${moduleName}`}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                    onClick={() => setCollapsed(c => ({ ...c, [moduleName]: !c[moduleName] }))}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">{moduleName}</span>
                      <span className="text-[10px] text-slate-400">({items.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleModule(moduleName, moduleKeys); }}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${allOn ? "bg-[#0052CC] border-[#0052CC]" : "border-slate-300"}`}>
                          {allOn && <Check size={10} className="text-white" />}
                        </div>
                        <span className="text-[10px] text-slate-500">Tout</span>
                      </label>
                      {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-slate-50">
                      {items.map((perm) => {
                        const checked = perms.has(perm.key) || hasAll;
                        return (
                          <label
                            key={perm.key}
                            data-testid={`perm-${perm.key}`}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => toggle(perm.key)}
                          >
                            <div className={`w-4 h-4 flex-shrink-0 rounded flex items-center justify-center border transition-colors ${checked ? "bg-[#0052CC] border-[#0052CC]" : "border-slate-300"}`}>
                              {checked && <Check size={10} className="text-white" />}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm text-slate-700">{perm.label}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{perm.key}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {!isAdmin && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Fermer</button>
            <button data-testid="save-permissions-btn" onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-[#0052CC] text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page Admin Profils ───────────────────────────────────────────────────────
export default function AdminProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [duplicateFrom, setDuplicateFrom] = useState(null);
  const [editPermissions, setEditPermissions] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profRes, permRes] = await Promise.all([
        profilesAPI.list(),
        profilesAPI.getPermissions(),
      ]);
      setProfiles(profRes.data);
      setAllPermissions(permRes.data);
    } catch { toast.error("Erreur chargement profils"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = profiles.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(profile) {
    if (!window.confirm(`Supprimer le profil "${profile.name}" ?`)) return;
    try {
      await profilesAPI.delete(profile.profile_id);
      toast.success("Profil supprimé");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Shield size={20} className="text-[#0052CC]" />
              Administration — Profils
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Gérez les profils et leurs permissions. Les droits viennent uniquement de <code className="bg-slate-100 px-1 rounded text-xs">permissions[]</code>.
            </p>
          </div>
          <button data-testid="new-profile-btn" onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0052CC] text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
            <Plus size={15} /> Nouveau profil
          </button>
        </div>
        <div className="relative w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Rechercher un profil…"
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052CC]/30 w-full"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center text-slate-400 py-12 text-sm">Chargement…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((profile) => (
              <div key={profile.profile_id} data-testid={`profile-card-${profile.code}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold
                      ${profile.is_system ? "bg-[#0052CC]" : "bg-violet-500"}`}>
                      {profile.code?.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{profile.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{profile.code}</div>
                    </div>
                  </div>
                  {profile.is_system && (
                    <span className="text-[10px] bg-[#0052CC]/10 text-[#0052CC] px-2 py-0.5 rounded-full font-semibold">
                      Système
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{profile.description}</p>

                <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Shield size={11} />
                    {profile.permissions?.[0] === "*" ? "Tous les droits" : `${profile.permissions?.length || 0} permissions`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={11} />
                    {profile.user_count || 0} user(s)
                  </span>
                </div>

                <div className="flex gap-2">
                  <button data-testid={`edit-perms-${profile.code}`}
                    onClick={() => setEditPermissions(profile)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 hover:bg-[#0052CC] hover:text-white border border-slate-200 hover:border-transparent text-xs font-medium transition-all">
                    <Pencil size={11} /> Permissions
                  </button>
                  <button onClick={() => setDuplicateFrom(profile)}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-violet-50 border border-slate-200 text-slate-500 hover:text-violet-700 transition-all"
                    title="Dupliquer">
                    <Copy size={13} />
                  </button>
                  {!profile.is_system && (
                    <button onClick={() => handleDelete(profile)}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-500 hover:text-rose-600 transition-all"
                      title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {(showCreate || duplicateFrom) && (
        <ProfileFormModal
          duplicateFrom={duplicateFrom}
          onClose={() => { setShowCreate(false); setDuplicateFrom(null); }}
          onSaved={() => { setShowCreate(false); setDuplicateFrom(null); load(); }}
        />
      )}

      {editPermissions && (
        <PermissionsMatrix
          profile={editPermissions}
          allPermissions={allPermissions}
          onSave={() => { setEditPermissions(null); load(); }}
          onClose={() => setEditPermissions(null)}
        />
      )}
    </div>
  );
}
