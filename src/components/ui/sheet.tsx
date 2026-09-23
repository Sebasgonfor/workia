"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Centers the title, with the close button floating over it instead of
   *  sharing the row — for sheets that read more like a dialog than a form. */
  centerTitle?: boolean;
}

// Critically damped: interruptible and inherits drag velocity, no overshoot.
const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;
const FADE = { duration: 0.15, ease: "easeOut" } as const;

// Apple's momentum projection: where a flick would come to rest.
function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export function Sheet({ open, onClose, title, children, centerTitle }: SheetProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const reduceMotion = useReducedMotion();
  const isDesktop = useIsDesktop();

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Adapt to virtual keyboard on mobile (iOS + Android). Offsets the
  // positioning wrapper, leaving transform free for the drag spring.
  useEffect(() => {
    if (!open) return;
    const vp = window.visualViewport;
    if (!vp) return;

    let rafId: number;

    const onViewportChange = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const kbHeight = Math.max(
          0,
          window.innerHeight - vp.height - vp.offsetTop
        );
        if (kbHeight > 50) {
          wrapper.style.bottom = `${kbHeight}px`;
          wrapper.style.maxHeight = `${vp.height * 0.92}px`;
        } else {
          wrapper.style.bottom = "";
          wrapper.style.maxHeight = "";
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

  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    const height = wrapperRef.current?.offsetHeight ?? 400;
    const projected = info.offset.y + project(info.velocity.y);
    // Decide with the projected resting point, not the release point
    if (projected > height * 0.5 && info.velocity.y >= 0) onClose();
  };

  const canDrag = !isDesktop && !reduceMotion;

  // Mobile slides along the same path in and out; desktop scales from 96%.
  const hidden = reduceMotion
    ? { opacity: 0 }
    : isDesktop
      ? { opacity: 0, scale: 0.96 }
      : { y: "100%" };
  const shown = reduceMotion
    ? { opacity: 1 }
    : isDesktop
      ? { opacity: 1, scale: 1 }
      : { y: 0 };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
            onClick={onClose}
          />
          {/* Sheet — bottom sheet on mobile, centered dialog on desktop */}
          <div
            ref={wrapperRef}
            className={cn(
              "absolute bottom-0 left-0 right-0 flex flex-col sheet-max-h",
              "md:inset-0 md:m-auto md:max-w-xl md:max-h-[85vh] md:w-full md:h-fit"
            )}
          >
            <motion.div
              className={cn(
                "bg-card flex flex-col min-h-0 flex-1",
                "rounded-t-2xl border-t border-border",
                "md:rounded-2xl md:border md:shadow-xl"
              )}
              initial={hidden}
              animate={shown}
              exit={hidden}
              transition={reduceMotion ? FADE : SPRING}
              drag={canDrag ? "y" : false}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.08, bottom: 1 }}
              dragTransition={{ bounceStiffness: 400, bounceDamping: 32 }}
              onDragEnd={onDragEnd}
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              {/* Handle + Header — the drag surface on mobile */}
              <div
                className="shrink-0 touch-none md:touch-auto"
                onPointerDown={(e) => canDrag && dragControls.start(e)}
              >
                <div className="flex items-center justify-center pt-2.5 pb-0.5 md:hidden">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>
                <div
                  className={cn(
                    "relative flex items-center px-4 py-2 md:px-6 md:py-4 md:border-b md:border-border",
                    centerTitle ? "justify-center" : "justify-between"
                  )}
                >
                  <h2 className="text-base font-semibold md:text-lg">{title}</h2>
                  <button
                    onClick={onClose}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label="Cerrar"
                    className={cn(
                      "w-8 h-8 rounded-full bg-secondary flex items-center justify-center active:scale-95 active:bg-secondary/80 hover:bg-secondary/80 transition-transform duration-100 touch-target",
                      centerTitle && "absolute right-4 md:right-6"
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Content — scrollable */}
              <div className="flex-1 overflow-y-auto px-4 pb-6 overscroll-contain pb-safe-sheet md:px-6 md:pb-6 no-scrollbar">
                {children}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
