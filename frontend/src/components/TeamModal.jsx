import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { teamsAPI } from "@/api";

export default function TeamModal({ isOpen, onClose, team, resources, onSaved }) {
  const isEdit = !!team;
  const [form, setForm] = useState({ name: "", manager_resource_id: "", train_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: team?.name || "",
        manager_resource_id: team?.manager_resource_id || "",
        train_id: team?.train_id || "",
      });
      setError("");
    }
  }, [isOpen, team]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Le nom est requis"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        manager_resource_id: form.manager_resource_id || null,
        train_id: form.train_id || null,
      };
      if (isEdit) {
        await teamsAPI.update(team.team_id, payload);
      } else {
        await teamsAPI.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <h2 className="font-heading text-lg font-bold text-zinc-950 tracking-tight">
            {isEdit ? "Modifier l'équipe" : "Nouvelle équipe"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wide mb-1.5">
              Nom de l'équipe *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Dev A, Infra, QA…"
              data-testid="team-modal-name"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wide mb-1.5">
              Manager
            </label>
            <select
              value={form.manager_resource_id}
              onChange={(e) => setForm({ ...form, manager_resource_id: e.target.value })}
              data-testid="team-modal-manager"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
            >
              <option value="">— Aucun manager —</option>
              {resources.map((r) => (
                <option key={r.resource_id} value={r.resource_id}>
                  {r.name} ({r.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="team-modal-submit"
              className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
