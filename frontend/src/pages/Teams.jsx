import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Users, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { teamsAPI, resourcesAPI } from "@/api";
import TeamModal from "@/components/TeamModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import CapacityAlertBanner from "@/components/CapacityAlertBanner";

export default function Teams() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("teams.create");
  const canEdit   = hasPermission("teams.edit");

  const [teams, setTeams] = useState([]);
  const [resources, setResources] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = () => {
    Promise.all([teamsAPI.list(), resourcesAPI.list(), teamsAPI.capacityAlerts()])
      .then(([tRes, rRes, aRes]) => {
        setTeams(tRes.data);
        setResources(rRes.data);
        setAlerts(aRes.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await teamsAPI.delete(confirmDelete.team_id);
      setConfirmDelete(null);
      fetchAll();
    } catch { /* ignore */ } finally { setDeleting(false); }
  };

  const getMemberCount = (teamId) =>
    resources.filter((r) => r.team_id === teamId).length;

  if (loading) return <div className="p-8 text-slate-400 text-sm">Chargement des équipes...</div>;

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="teams-page">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#0F172A] uppercase tracking-tight">Équipes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{teams.length} équipe{teams.length > 1 ? "s" : ""} · Gestion des groupes ressources</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setSelectedTeam(null); setModalOpen(true); }}
            data-testid="btn-new-team"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-[#0047B3] transition-colors shadow-sm"
          >
            <Plus size={15} /> Nouvelle équipe
          </button>
        )}
      </div>

      <CapacityAlertBanner alerts={alerts} />

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total équipes", value: teams.length, sub: "actives" },
          { label: "Ressources affectées", value: resources.filter((r) => r.team_id).length, sub: "sur " + resources.length },
          { label: "Non affectées", value: resources.filter((r) => !r.team_id).length, sub: "ressources sans équipe" },
        ].map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded shadow-sm p-4 border-l-4 border-l-[#0052CC]">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{card.label}</div>
            <div className="font-heading text-2xl font-bold text-[#0F172A] mt-2">{card.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Teams grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => {
          const memberCount = getMemberCount(team.team_id);
          const initials = team.name.slice(0, 2).toUpperCase();
          return (
            <div
              key={team.team_id}
              className="bg-white border border-gray-200 rounded shadow-sm hover:shadow-md hover:border-[#0052CC]/30 transition-all"
              data-testid={`team-card-${team.team_id}`}
            >
              {/* Clickable zone → team detail */}
              <Link
                to={`/teams/${team.team_id}`}
                className="block p-5 pb-3"
                data-testid={`team-link-${team.team_id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-[#0052CC]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#0052CC]">{initials}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 text-base hover:text-[#0052CC] transition-colors">{team.name}</div>
                      {team.manager_name && (
                        <div className="text-xs text-slate-500 mt-0.5">Manager : {team.manager_name}</div>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 mt-1 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Users size={13} />
                  <span className="text-xs">
                    {memberCount} membre{memberCount > 1 ? "s" : ""}
                  </span>
                </div>
              </Link>
              {/* Action buttons (stop propagation) */}
              {(canEdit || hasPermission("teams.delete")) && (
                <div className="flex items-center gap-1 px-5 py-2 border-t border-gray-50">
                  {canEdit && (
                  <button
                    onClick={() => { setSelectedTeam(team); setModalOpen(true); }}
                    data-testid={`btn-edit-team-${team.team_id}`}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:text-[#0052CC] hover:bg-blue-50 rounded transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={11} /> Modifier
                  </button>
                  )}
                  {hasPermission("teams.delete") && (
                    <button
                      onClick={() => setConfirmDelete(team)}
                      data-testid={`btn-delete-team-${team.team_id}`}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors ml-auto"
                      title="Supprimer"
                    >
                      <Trash2 size={11} /> Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {teams.length === 0 && (
          <div className="col-span-3 text-center py-16 text-slate-400">
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune équipe créée</p>
          </div>
        )}
      </div>

      <TeamModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        team={selectedTeam}
        resources={resources}
        onSaved={fetchAll}
      />
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Supprimer l'équipe"
        message={`Supprimer "${confirmDelete?.name}" ? Cette action est irréversible.`}
      />
    </div>
  );
}
