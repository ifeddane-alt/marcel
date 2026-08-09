import React, { useState, useEffect, useCallback } from "react";
import { Users, Search, ChevronDown } from "lucide-react";
import { usersAPI, profilesAPI } from "@/api";
import { toast } from "sonner";

const ROLE_LABELS = {
  TENANT_ADMIN: "Admin (legacy)",
  PMO_USER: "PMO (legacy)",
  READ_ONLY: "Lecture seule (legacy)",
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterProfile, setFilterProfile] = useState("");
  const [search, setSearch] = useState("");

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
            <div className="text-xs text-[#8a87a0] mb-0.5">Accueil / Administration / <span className="text-[#352c6e] font-semibold">Utilisateurs</span></div>
            <h1 className="font-heading text-2xl font-extrabold text-[#26243a] tracking-tight flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Utilisateurs
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Gérez les profils des utilisateurs. Le profil détermine leurs permissions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input data-testid="search-users" type="text" placeholder="Rechercher…"
              className="pl-8 pr-3 py-1.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/30 w-56"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select data-testid="filter-profile"
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 bg-white"
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
              <tr className="bg-[#fbfaff] border-b border-[#e8e6f0]">
                <th className="text-left px-4 py-3 text-[10.5px] font-bold text-[#8a87a0] uppercase tracking-wider">Utilisateur</th>
                <th className="text-left px-4 py-3 text-[10.5px] font-bold text-[#8a87a0] uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-[10.5px] font-bold text-[#8a87a0] uppercase tracking-wider">Rôle système</th>
                <th className="text-left px-4 py-3 text-[10.5px] font-bold text-[#8a87a0] uppercase tracking-wider">Profil</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-400 text-sm">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-400 text-sm">Aucun utilisateur</td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.user_id} data-testid={`user-row-${u.user_id}`}
                  className={`border-b border-zinc-50 ${i % 2 === 0 ? "" : "bg-zinc-50/40"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-zinc-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-lg">
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <select
                        data-testid={`profile-select-${u.user_id}`}
                        className="appearance-none border border-zinc-200 rounded-lg px-3 py-1.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-600/30 bg-white w-full cursor-pointer"
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
