import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Users, ArrowUpRight, UserRound } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { teamsAPI, resourcesAPI } from "@/api";
import { Ring } from "@/components/ProjectTile";
import TeamModal from "@/components/TeamModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import CapacityAlertBanner from "@/components/CapacityAlertBanner";
import ExcelToolbar from "@/components/ExcelToolbar";

const LOAD_STYLES = {
  red:    { head: "bg-[#fbe1de]", badge: "bg-[#cc4f45]", fill: "#cc4f45", label: "Surcharge" },
  orange: { head: "bg-[#f3edb5]", badge: "bg-[#a3891a]", fill: "#a3891a", label: "Tendu" },
  green:  { head: "bg-[#ddf0d8]", badge: "bg-[#3f8a34]", fill: "#3f8a34", label: "OK" },
};

const monthLabel = (period) =>
  new Date(period + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");

const cellCls = (pct) =>
  pct > 100 ? "bg-rose-100 text-rose-700 border-rose-200"
  : pct >= 85 ? "bg-amber-100 text-amber-700 border-amber-200"
  : "bg-emerald-50 text-emerald-700 border-emerald-200";

function KpiTile({ label, value, sub, pct, ringColor, ringLabel, ringCaption, valueClass = "text-[#26243a]", testId }) {
  return (
    <div
      className="bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] p-4 flex items-center justify-between gap-3"
      data-testid={testId}
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">{label}</div>
        <div className={`font-mono-data text-[22px] font-bold mt-1 ${valueClass}`}>{value}</div>
        {sub && <div className="text-[10.5px] text-[#8a87a0] mt-0.5 truncate">{sub}</div>}
      </div>
      {pct != null && (
        <div className="flex-shrink-0">
          <Ring pct={pct} color={ringColor} label={ringLabel} caption={ringCaption} />
        </div>
      )}
    </div>
  );
}

function TeamTile({ team, memberCount, load, canEdit, canDelete, onEdit, onDelete }) {
  const cur = load?.cur;
  const pct = Math.round(cur?.utilization_pct || 0);
  const style = pct > 100 ? LOAD_STYLES.red : pct >= 85 ? LOAD_STYLES.orange : LOAD_STYLES.green;
  const capacity = Math.round((cur?.capacity_jh || 0) * 10) / 10;
  const allocated = Math.round((cur?.allocated_jh || 0) * 10) / 10;

  return (
    <div
      className="relative bg-white border border-[#e8e6f0] rounded-xl shadow-[0_2px_8px_-3px_rgba(53,44,110,0.08)] hover:shadow-[0_10px_30px_-10px_rgba(53,44,110,0.2)] transition-shadow duration-200 mt-2.5"
      data-testid={`team-card-${team.team_id}`}
    >
      {/* Badge charge flottant */}
      <span
        className={`absolute -top-2.5 right-3 z-10 text-[10px] font-extrabold text-white px-2.5 py-[3px] rounded-md font-heading tracking-wide ${style.badge}`}
        data-testid={`team-tile-status-${team.team_id}`}
      >
        {style.label}
      </span>

      {/* En-tête teinté */}
      <div className={`${style.head} rounded-t-xl px-4 pt-3 pb-2.5`}>
        <Link
          to={`/teams/${team.team_id}`}
          className="font-heading text-[13.5px] font-bold text-[#26243a] leading-snug hover:underline block pr-10 truncate"
          data-testid={`team-link-${team.team_id}`}
          title={team.name}
        >
          {team.name}
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[#3d3564] bg-white/60 px-1.5 py-px rounded">
            <Users size={9} /> {memberCount} membre{memberCount > 1 ? "s" : ""}
          </span>
          {team.manager_name && (
            <span className="flex items-center gap-1 text-[10px] text-[#5d5a75] truncate">
              <UserRound size={9} /> {team.manager_name}
            </span>
          )}
        </div>
      </div>

      {/* Corps */}
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <Ring pct={pct} color={style.fill} label="Utilisation" caption="mois" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-[#8a87a0]">Capacité</span>
              <b className="font-mono-data text-[#26243a]">{capacity.toLocaleString("fr-FR")} JH</b>
            </div>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-[#8a87a0]">Charge allouée</span>
              <b className={`font-mono-data ${pct > 100 ? "text-[#cc4f45]" : "text-[#26243a]"}`}>{allocated.toLocaleString("fr-FR")} JH</b>
            </div>
            <div className="h-1.5 bg-[#eeecf6] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: style.fill }} />
            </div>
          </div>
        </div>

        {/* Mini-cellules 3 mois */}
        {(load?.next || []).length > 0 && (
          <div className="mt-3 pt-2 border-t border-[#f0eff6]" data-testid={`team-tile-months-${team.team_id}`}>
            <div className="text-[8.5px] font-bold uppercase tracking-widest text-[#a39fb8] mb-1">Charge à 3 mois</div>
            <div className="flex items-center gap-1.5">
              {load.next.map((p) => (
                <span
                  key={p.period}
                  className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md border tabular-nums ${cellCls(p.utilization_pct)}`}
                  title={`${p.period} : ${p.allocated_jh}/${p.capacity_jh} JH`}
                >
                  {monthLabel(p.period)} · {Math.round(p.utilization_pct)}%
                </span>
              ))}
            </div>
          </div>
        )}
        {pct > 100 && cur && (
          <p className="text-[10px] text-[#cc4f45] font-semibold mt-2">
            +{Math.round((allocated - capacity) * 10) / 10} JH au-dessus de la capacité ce mois-ci
          </p>
        )}
      </div>

      {/* Pied : actions */}
      <div className="flex items-center gap-1 px-3.5 py-2 border-t border-[#f0eff6]">
        <span className="text-[10.5px] text-[#8a87a0]">
          Utilisation <b className={`font-mono-data ${pct > 100 ? "text-[#cc4f45]" : "text-[#26243a]"}`}>{pct}%</b>
        </span>
        <div className="ml-auto flex items-center">
          {canEdit && (
            <button
              onClick={onEdit}
              data-testid={`btn-edit-team-${team.team_id}`}
              className="p-1.5 text-[#a39fb8] hover:text-[#2e5fe8] hover:bg-[#e9effe] rounded-lg transition-colors"
              title="Modifier"
            >
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              data-testid={`btn-delete-team-${team.team_id}`}
              className="p-1.5 text-[#a39fb8] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 size={13} />
            </button>
          )}
          <Link
            to={`/teams/${team.team_id}`}
            data-testid={`team-tile-open-${team.team_id}`}
            className="p-1.5 text-[#a39fb8] hover:text-[#2e5fe8] hover:bg-[#e9effe] rounded-lg transition-colors"
            title="Ouvrir la fiche"
          >
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Teams() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("teams.create");
  const canEdit   = hasPermission("teams.edit");
  const canDelete = hasPermission("teams.delete");

  const [teams, setTeams] = useState([]);
  const [resources, setResources] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = () => {
    Promise.all([teamsAPI.list(), resourcesAPI.list(), teamsAPI.capacityAlerts(), teamsAPI.capacityHeatmap(3)])
      .then(([tRes, rRes, aRes, hRes]) => {
        setTeams(tRes.data);
        setResources(rRes.data);
        setAlerts(aRes.data);
        setHeatmap(hRes.data || []);
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

  // Charge courante + 3 mois par équipe (depuis la heatmap capacité)
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const loadByTeam = {};
  heatmap.forEach((t) => {
    if (!t.team_id) return;
    let idx = (t.periods || []).findIndex((p) => p.period === currentPeriod);
    if (idx < 0) idx = 0;
    loadByTeam[t.team_id] = { cur: (t.periods || [])[idx], next: (t.periods || []).slice(idx, idx + 3) };
  });

  const assigned = resources.filter((r) => r.team_id).length;
  const assignedPct = resources.length ? Math.round((assigned / resources.length) * 100) : 0;
  const overloadedCount = teams.filter((t) => (loadByTeam[t.team_id]?.cur?.utilization_pct || 0) > 100).length;
  const totalCapacity = Math.round(teams.reduce((s, t) => s + (loadByTeam[t.team_id]?.cur?.capacity_jh || 0), 0));
  const totalAllocated = Math.round(teams.reduce((s, t) => s + (loadByTeam[t.team_id]?.cur?.allocated_jh || 0), 0));
  const globalPct = totalCapacity ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  if (loading) return <div className="p-8 text-zinc-400 text-sm">Chargement des équipes...</div>;

  return (
    <div className="p-4 md:p-6 lg:p-8" data-testid="teams-page">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[#8a87a0] mb-0.5">Accueil / <span className="text-[#352c6e] font-semibold">Équipes</span></div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#26243a] tracking-tight">Équipes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {teams.length} équipe{teams.length > 1 ? "s" : ""} · {assigned} ressource{assigned > 1 ? "s" : ""} affectée{assigned > 1 ? "s" : ""}
            {overloadedCount > 0 && <span className="text-[#cc4f45] font-semibold"> · {overloadedCount} en surcharge</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelToolbar entity="teams" onImported={fetchAll} canImport={canCreate} />
          {canCreate && (
            <button
              onClick={() => { setSelectedTeam(null); setModalOpen(true); }}
              data-testid="btn-new-team"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={15} /> Nouvelle équipe
            </button>
          )}
        </div>
      </div>

      <CapacityAlertBanner alerts={alerts} />

      {/* KPI tuiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KpiTile
          testId="teams-kpi-total"
          label="Équipes"
          value={teams.length}
          sub="actives dans le référentiel"
        />
        <KpiTile
          testId="teams-kpi-assigned"
          label="Ressources affectées"
          value={assigned}
          sub={`sur ${resources.length} ressources`}
          pct={assignedPct}
          ringColor="#2e5fe8"
          ringLabel="Affectées"
          ringCaption="taux"
        />
        <KpiTile
          testId="teams-kpi-load"
          label="Charge du mois"
          value={`${totalAllocated.toLocaleString("fr-FR")} JH`}
          sub={`capacité ${totalCapacity.toLocaleString("fr-FR")} JH`}
          pct={globalPct}
          ringColor={globalPct > 100 ? "#cc4f45" : globalPct >= 85 ? "#a3891a" : "#3f8a34"}
          ringLabel="Utilisation"
          ringCaption="mois"
        />
        <KpiTile
          testId="teams-kpi-overloaded"
          label="Surcharges"
          value={overloadedCount}
          sub={overloadedCount > 0 ? "équipes > 100% ce mois-ci" : "aucune équipe > 100%"}
          valueClass={overloadedCount > 0 ? "text-[#cc4f45]" : "text-[#26243a]"}
        />
      </div>

      {/* Tuiles équipes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="teams-tiles">
        {teams.map((team) => (
          <TeamTile
            key={team.team_id}
            team={team}
            memberCount={getMemberCount(team.team_id)}
            load={loadByTeam[team.team_id]}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => { setSelectedTeam(team); setModalOpen(true); }}
            onDelete={() => setConfirmDelete(team)}
          />
        ))}

        {teams.length === 0 && (
          <div className="col-span-full text-center py-16 text-zinc-400">
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
