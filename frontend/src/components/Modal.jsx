import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ isOpen, onClose, title, children, size = "md" }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-2xl", xl: "max-w-3xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        data-testid="modal-backdrop"
      />
      <div
        className={`relative bg-white rounded-lg shadow-2xl w-full ${widths[size] || widths.md} flex flex-col`}
        data-testid="modal-container"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#0F172A] rounded-t-lg">
          <h2 className="font-heading font-bold text-base text-white tracking-wide">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded"
            data-testid="modal-close-btn"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {children}
        </div>
      </div>
    </div>
  );
}
