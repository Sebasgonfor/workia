"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
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
  const [rendered, setRendered] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  // Handle mount/unmount with exit animation
  useEffect(() => {
    if (open) {
      setRendered(true);
      setIsClosing(false);
    } else if (rendered) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setRendered(false);
        setIsClosing(false);
      }, 260);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when open
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

  if (!rendered) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm",
          isClosing
            ? "animate-out fade-out duration-250 fill-mode-forwards"
            : "animate-in fade-in duration-200"
        )}
        onClick={onClose}
      />
      {/* Sheet — bottom sheet on mobile, centered dialog on desktop */}
      <div
        ref={sheetRef}
        className={cn(
          "bg-card flex flex-col will-change-transform",
          // Mobile: bottom sheet
          "absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-border sheet-max-h",
          // Desktop: centered dialog
          "md:static md:fixed md:inset-0 md:m-auto md:max-w-xl md:max-h-[85vh] md:rounded-2xl md:border md:shadow-xl md:w-full",
          isClosing
            ? "animate-out slide-out-to-bottom duration-260 fill-mode-forwards md:animate-out md:fade-out md:zoom-out-95 md:duration-200"
            : "animate-in slide-in-from-bottom duration-300 md:animate-in md:fade-in md:zoom-in-95 md:duration-200"
        )}
      >
        {/* Handle + Header combined for compact height */}
        <div className="shrink-0">
          <div className="flex items-center justify-center pt-2.5 pb-0.5 md:hidden">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex items-center justify-between px-4 py-2 md:px-6 md:py-4 md:border-b md:border-border">
            <h2 className="text-base font-semibold md:text-lg">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center active:bg-secondary/80 hover:bg-secondary/80 touch-target"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 overscroll-contain pb-safe-sheet md:px-6 md:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
