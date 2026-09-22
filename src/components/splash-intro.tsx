"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { WorkiaMark } from "@/components/workia-mark";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const SPLASH_STORAGE_KEY = "workia-splash";
export const SPLASH_DONE_EVENT = "wk:splash-done";

/** True while the intro is on screen (other intros wait for it). */
export function isSplashPlaying() {
  return typeof document !== "undefined" && document.documentElement.dataset.wkSplash === "playing";
}

/**
 * Intro shown once per browser session when the app loads: the Workia square
 * dashes in from the side, overshoots the center while it brakes (squash,
 * lean back, wobble), settles, and then the "W" draws itself inside.
 *
 * The inline script in layout.tsx marks <html> with data-wk-splash="skip"
 * before first paint when it was already shown (or motion is reduced), so the
 * overlay never flashes on reloads.
 */
export function SplashIntro() {
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const html = document.documentElement;
    const root = rootRef.current;
    if (html.dataset.wkSplash === "skip" || !root) {
      setDone(true);
      return;
    }
    html.dataset.wkSplash = "playing";
    document.body.style.overflow = "hidden";

    const q = gsap.utils.selector(root);
    const mark = q(".wk-splash-mark")[0];
    const w = q(".wk-mark-w")[0] as unknown as SVGPathElement;
    const len = w.getTotalLength();
    const startX = -(window.innerWidth / 2 + 160);

    const finish = () => {
      try {
        sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
      } catch {}
      delete html.dataset.wkSplash;
      document.body.style.overflow = "";
      window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
      setDone(true);
    };

    const ctx = gsap.context(() => {
      gsap.set(mark, { x: startX, skewX: -18, scaleX: 1.3, scaleY: 0.82, transformOrigin: "50% 100%" });
      // Hidden too: a round cap still paints a dot on a zero-length dash.
      gsap.set(w, { strokeDasharray: len, strokeDashoffset: len, opacity: 0 });
      gsap.set(q(".wk-splash-trail i"), { scaleX: 0, opacity: 0 });

      gsap
        .timeline({ delay: 0.15, onComplete: finish })
        // Sprint in, leaning forward and stretched by the speed.
        .to(mark, { x: 70, duration: 0.42, ease: "power1.in" })
        .to(q(".wk-splash-trail i"), { scaleX: 1, opacity: 1, duration: 0.2, stagger: 0.04 }, 0.15)
        // Hit the brakes: overshoot, lean back, squash.
        .to(mark, { x: 18, skewX: 16, scaleX: 0.86, scaleY: 1.1, duration: 0.22, ease: "power2.out" })
        .to(q(".wk-splash-trail i"), { scaleX: 0, opacity: 0, duration: 0.3, stagger: 0.04 }, "<")
        // Wobble back to the center until it stops.
        .to(mark, { x: 0, skewX: 0, scaleX: 1, scaleY: 1, duration: 0.9, ease: "elastic.out(1.1, 0.35)" })
        .fromTo(q(".wk-splash-shadow"), { scaleX: 1.6, opacity: 0.5 }, { scaleX: 1, opacity: 0.35, duration: 0.6, immediateRender: false }, "<")
        // Draw the W.
        .set(w, { opacity: 1 }, "-=0.45")
        .to(w, { strokeDashoffset: 0, duration: 0.75, ease: "power2.inOut" }, "<")
        .from(q(".wk-splash-name"), { y: 10, opacity: 0, duration: 0.45, ease: "power3.out" }, "-=0.25")
        // Leave.
        .to(root, { opacity: 0, duration: 0.45, ease: "power2.inOut" }, "+=0.35")
        .to(mark, { scale: 1.12, duration: 0.45, ease: "power2.in" }, "<");
    }, root);

    return () => {
      ctx.revert();
      delete html.dataset.wkSplash;
      document.body.style.overflow = "";
    };
  }, []);

  if (done) return null;

  return (
    <div ref={rootRef} className="wk-splash" aria-hidden>
      <div className="wk-splash-stage">
        <div className="wk-splash-mark">
          <div className="wk-splash-trail">
            <i /><i /><i />
          </div>
          <WorkiaMark className="wk-splash-logo" />
        </div>
        <div className="wk-splash-shadow" />
        <p className="wk-splash-name">Workia</p>
      </div>
    </div>
  );
}
