"use client";

import { ReactNode, useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Animates its own height whenever its content grows or shrinks (e.g. a form
 * switching tabs), so a bottom sheet eases to the new size instead of jumping.
 */
export function AutoHeight({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let first = true;

    const ro = new ResizeObserver(() => {
      const height = inner.offsetHeight;
      if (first || reduced) {
        gsap.set(outer, { height });
        first = false;
      } else {
        gsap.to(outer, { height, duration: 0.45, ease: "power3.out", overwrite: true });
      }
    });
    ro.observe(inner);
    return () => {
      ro.disconnect();
      gsap.killTweensOf(outer);
    };
  }, []);

  return (
    // Negative margin + padding keeps focus rings from being clipped.
    <div ref={outerRef} className="-mx-1 overflow-hidden">
      <div ref={innerRef} className="px-1 pb-1">
        {children}
      </div>
    </div>
  );
}
