import React, { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Remplaçant des <input type="date"> : même contrat (string "yyyy-MM-dd"),
// affichage français jj/mm/aaaa via le calendrier shadcn.
export default function DateField({ value, onChange, required, disabled, testId, placeholder = "jj/mm/aaaa" }) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(`${value}T00:00:00`) : undefined;
  const valid = date && !isNaN(date.getTime());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-testid={testId}
          className="relative w-full flex items-center gap-2 border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white text-left focus:outline-none focus:border-m-blue focus:ring-2 focus:ring-m-blue/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <CalendarIcon size={13} className="text-m-muted flex-shrink-0" />
          {valid ? (
            <span className="text-m-ink font-mono-data text-[13px]">{format(date, "dd/MM/yyyy", { locale: fr })}</span>
          ) : (
            <span className="text-[#a3a0b8]">{placeholder}</span>
          )}
          {valid && !required && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="ml-auto text-[#c9c6da] hover:text-m-ink-soft"
              title="Effacer"
            >
              <X size={12} />
            </span>
          )}
          {required && (
            <input
              tabIndex={-1}
              required
              value={value || ""}
              onChange={() => {}}
              className="sr-only absolute left-3 bottom-0 w-px h-px opacity-0"
              aria-hidden="true"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={fr}
          selected={valid ? date : undefined}
          defaultMonth={valid ? date : undefined}
          onSelect={(d) => { onChange(d ? format(d, "yyyy-MM-dd") : ""); setOpen(false); }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
