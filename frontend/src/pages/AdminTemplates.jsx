import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Copy, Layers, ChevronDown, ChevronUp, Save, X, RefreshCw } from "lucide-react";
import { projectTemplatesAPI } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/components/ui/sonner";

const METHODOLOGY_LABELS = {
  waterfall: "Waterfall",
  agile: "Agile",
  safe: "SAFe",
};

const INPUT_CLS = "w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] bg-white";

function PhaseEditor({ phase, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
      >
        <span className="font-semibold text-slate-700 flex-1">{phase.name || "Phase sans nom"}</span>
        <span className="text-xs text-slate-400">{phase.milestones?.length || 0} jalons · {phase.tasks?.length || 0} tâches</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="text-rose-400 hover:text-rose-600 ml-2"
        >
          <Trash2 size={13} />
        </button>
      </button>
      {open && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Nom de la phase</label>
              <input
                className={INPUT_CLS}
                value={phase.name}
                onChange={e => onChange({ ...phase, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Durée par défaut (jours)</label>
              <input
                type="number"
                className={INPUT_CLS}
                value={phase.duration_days_default || 30}
                onChange={e => onChange({ ...phase, duration_days_default: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              Jalons <span className="font-normal text-slate-400">(un par ligne)</span>
            </label>
            <textarea
              className={`${INPUT_CLS} resize-none h-16`}
              value={(phase.milestones || []).map(m => m.name).join("\n")}
              onChange={e => onChange({
                ...phase,
                milestones: e.target.value.split("\n").filter(Boolean).map(name => ({ name, family: "delivery" }))
              })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              Tâches <span className="font-normal text-slate-400">(une par ligne)</span>
            </label>
            <textarea
              className={`${INPUT_CLS} resize-none h-16`}
              value={(phase.tasks || []).map(t => t.name).join("\n")}
              onChange={e => onChange({
                ...phase,
                tasks: e.target.value.split("\n").filter(Boolean).map(name => ({ name, scope_status: "SEC" }))
              })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({ tpl, onEdit, onDelete, onDuplicate }) {
  const [expanded, setExpanded] = useState(false);
  const totalMilestones = (tpl.phases || []).reduce((s, p) => s + (p.milestones?.length || 0), 0);
  const totalTasks = (tpl.phases || []).reduce((s, p) => s + (p.tasks?.length || 0), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" data-testid={`template-card-${tpl.template_id}`}>
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Layers size={18} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">{tpl.name}</span>
            {tpl.is_default && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Par défaut</span>
            )}
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {METHODOLOGY_LABELS[tpl.methodology] || tpl.methodology}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {tpl.phases?.length || 0} phases · {totalMilestones} jalons · {totalTasks} tâches
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
            title="Aperçu"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button onClick={() => onDuplicate(tpl)} title="Dupliquer" className="p-1.5 text-slate-400 hover:text-blue-600 rounded">
            <Copy size={15} />
          </button>
          <button onClick={() => onEdit(tpl)} title="Modifier" className="p-1.5 text-slate-400 hover:text-[#0052CC] rounded">
            <Pencil size={15} />
          </button>
          {!tpl.is_default && (
            <button onClick={() => onDelete(tpl)} title="Supprimer" className="p-1.5 text-slate-400 hover:text-rose-600 rounded">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 space-y-2">
          {(tpl.phases || []).map(phase => (
            <div key={phase.name} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <div>
                <span className="text-sm font-semibold text-slate-700">{phase.name}</span>
                <span className="text-xs text-slate-400 ml-2">{phase.duration_days_default}j</span>
                {phase.milestones?.length > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">Jalons : {phase.milestones.map(m => m.name).join(", ")}</p>
                )}
                {phase.tasks?.length > 0 && (
                  <p className="text-xs text-slate-400">Tâches : {phase.tasks.map(t => t.name).join(", ")}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateModal({ isOpen, onClose, template, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (template) {
      setForm(JSON.parse(JSON.stringify(template)));
    } else {
      setForm({ name: "", methodology: "waterfall", phases: [] });
    }
  }, [isOpen, template]);

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    setSaving(true);
    try {
      if (template) {
        await projectTemplatesAPI.update(template.template_id, form);
      } else {
        await projectTemplatesAPI.create(form);
      }
      toast.success(template ? "Template mis à jour" : "Template créé");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  }

  function addPhase() {
    setForm(f => ({
      ...f,
      phases: [...(f.phases || []), { name: "", order: (f.phases?.length || 0) + 1, duration_days_default: 30, milestones: [], tasks: [] }]
    }));
  }

  if (!isOpen || !form) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">{template ? "Modifier le template" : "Nouveau template"}</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Nom du template</label>
              <input className={INPUT_CLS} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex : Waterfall Réglementaire" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Méthodologie</label>
              <select className={INPUT_CLS} value={form.methodology} onChange={e => setForm(f => ({ ...f, methodology: e.target.value }))}>
                <option value="waterfall">Waterfall</option>
                <option value="agile">Agile</option>
                <option value="safe">SAFe</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500">Phases</label>
              <button type="button" onClick={addPhase} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Plus size={12} /> Ajouter une phase
              </button>
            </div>
            {(form.phases || []).map((phase, i) => (
              <PhaseEditor
                key={i}
                phase={phase}
                onChange={updated => setForm(f => ({ ...f, phases: f.phases.map((p, j) => j === i ? updated : p) }))}
                onDelete={() => setForm(f => ({ ...f, phases: f.phases.filter((_, j) => j !== i) }))}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-[#0052CC] text-white text-sm font-semibold rounded-lg hover:bg-[#0047B3] disabled:opacity-50">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminTemplates() {
  const { hasPermission } = usePermissions();
  const canAdmin = hasPermission("admin.templates");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState({ open: false, template: null });

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const { data } = await projectTemplatesAPI.list();
      setTemplates(data);
    } catch {
      toast.error("Erreur chargement templates");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(tpl) {
    if (!window.confirm(`Supprimer le template "${tpl.name}" ?`)) return;
    try {
      await projectTemplatesAPI.delete(tpl.template_id);
      toast.success("Template supprimé");
      loadTemplates();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  }

  async function handleDuplicate(tpl) {
    try {
      await projectTemplatesAPI.duplicate(tpl.template_id);
      toast.success("Template dupliqué");
      loadTemplates();
    } catch {
      toast.error("Erreur duplication");
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Templates Projets</h1>
          <p className="text-sm text-slate-500 mt-1">Gérez les templates utilisés à la création de projets</p>
        </div>
        {canAdmin && (
          <button
            data-testid="btn-create-template"
            onClick={() => setEditModal({ open: true, template: null })}
            className="flex items-center gap-2 px-4 py-2 bg-[#0052CC] text-white rounded-lg text-sm font-semibold hover:bg-[#0047B3] transition-colors"
          >
            <Plus size={15} /> Nouveau template
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <TemplateCard
              key={tpl.template_id}
              tpl={tpl}
              onEdit={t => setEditModal({ open: true, template: t })}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      <TemplateModal
        isOpen={editModal.open}
        onClose={() => setEditModal({ open: false, template: null })}
        template={editModal.template}
        onSaved={loadTemplates}
      />
    </div>
  );
}
