import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import Modal from "@/components/Modal";

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, loading = false }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || "Confirmer la suppression"} size="sm">
      <div className="space-y-4" data-testid="confirm-dialog">
        <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded">
          <AlertTriangle size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700">{message || "Cette action est irréversible."}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-slate-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            data-testid="confirm-delete-btn"
            className="flex items-center gap-2 px-5 py-2 bg-rose-600 text-white text-sm font-semibold rounded hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Supprimer
          </button>
        </div>
      </div>
    </Modal>
  );
}
