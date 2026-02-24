"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({
  open,
  title,
  message,
  confirmLabel = "Eliminar",
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const [rendered, setRendered] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setIsClosing(false);
    } else if (rendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setRendered(false);
        setIsClosing(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rendered && !isClosing) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [rendered, isClosing]);

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-8">
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm",
          isClosing ? "animate-out fade-out duration-200 fill-mode-forwards" : "animate-in fade-in duration-200"
        )}
        onClick={onCancel}
      />
      <div
        className={cn(
          "relative bg-card border border-border rounded-2xl p-5 w-full max-w-[320px]",
          isClosing
            ? "animate-out zoom-out-95 duration-200 fill-mode-forwards"
            : "animate-in zoom-in-95 duration-200"
        )}
      >
        <h3 className="text-base font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-medium active:scale-[0.97] transition-transform"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium active:scale-[0.97] transition-transform"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
