"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Select personalizado (no nativo) con el mismo look & feel del resto de la UI.
 * Teclado: flechas para navegar, Enter/Espacio para elegir, Esc para cerrar.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "— elige una opción —",
  ariaLabel,
  className,
  disabled,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  useEffect(() => {
    if (open && highlight >= 0) {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [open, highlight]);

  const moveHighlight = (dir: 1 | -1) => {
    setHighlight((prev) => {
      let next = prev;
      for (let i = 0; i < options.length; i++) {
        next = (next + dir + options.length) % options.length;
        if (!options[next].disabled) return next;
      }
      return prev;
    });
  };

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        moveHighlight(e.key === "ArrowDown" ? 1 : -1);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) commit(highlight);
      else setOpen(true);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-sm rounded-lg bg-secondary/60 border border-border px-3 py-2.5 text-left",
          "outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn("w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="select-scrollbar absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg bg-card border border-border shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100"
        >
          {options.map((opt, idx) => (
            <li
              key={opt.value}
              data-index={idx}
              role="option"
              aria-selected={opt.value === value}
              aria-disabled={opt.disabled}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => commit(idx)}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer",
                opt.disabled && "opacity-40 cursor-not-allowed",
                !opt.disabled && highlight === idx && "bg-secondary/70",
                !opt.disabled && opt.value === value && "text-primary"
              )}
            >
              <span className="truncate">
                {opt.label}
                {opt.description && (
                  <span className="text-muted-foreground"> — {opt.description}</span>
                )}
              </span>
              {opt.value === value && <Check className="w-3.5 h-3.5 shrink-0" />}
            </li>
          ))}
        </ul>
      )}

      <style jsx>{`
        .select-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: hsl(var(--border)) transparent;
        }
        .select-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .select-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .select-scrollbar::-webkit-scrollbar-thumb {
          background-color: hsl(var(--border));
          border-radius: 9999px;
        }
        .select-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: hsl(var(--muted-foreground) / 0.5);
        }
        .select-scrollbar::-webkit-scrollbar-button {
          display: none;
          height: 0;
          width: 0;
        }
      `}</style>
    </div>
  );
}
