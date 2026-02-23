"use client";

import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Adapt to virtual keyboard on mobile (iOS + Android)
  useEffect(() => {
    if (!open) return;
    const vp = window.visualViewport;
    if (!vp) return;

    let rafId: number;

    const onViewportChange = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const sheet = sheetRef.current;
        if (!sheet) return;
        const kbHeight = Math.max(
          0,
          window.innerHeight - vp.height - vp.offsetTop
        );
        if (kbHeight > 50) {
          sheet.style.transform = `translateY(-${kbHeight}px)`;
          sheet.style.maxHeight = `${vp.height * 0.92}px`;
        } else {
          sheet.style.transform = "";
          sheet.style.maxHeight = "";
        }
      });
    };

    vp.addEventListener("resize", onViewportChange);
    vp.addEventListener("scroll", onViewportChange);

    return () => {
      cancelAnimationFrame(rafId);
      vp.removeEventListener("resize", onViewportChange);
      vp.removeEventListener("scroll", onViewportChange);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border",
          "sheet-max-h flex flex-col",
          "animate-in slide-in-from-bottom duration-300",
          "will-change-transform transition-transform duration-150 ease-out"
        )}
      >
        {/* Handle + Header combined for compact height */}
        <div className="shrink-0">
          <div className="flex items-center justify-center pt-2.5 pb-0.5">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center active:bg-secondary/80 touch-target"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 overscroll-contain pb-safe-sheet">
          {children}
        </div>
      </div>
    </div>
  );
}
