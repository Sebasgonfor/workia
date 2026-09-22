"use client";

import { RefObject, useEffect, useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

// useLayoutEffect so elements are hidden before the first paint (no flash),
// without React's SSR warning.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * GSAP animations for the landing page. Elements opt in with data-anim:
 *  - nav, hero-title, hero-item: hero intro timeline
 *  - preview (+ .wkl-card inside), bar, pct: hero product cards
 *  - reveal: fade/slide in when scrolled into view
 *  - stagger: its direct children reveal one after another
 *  - cta: final call-to-action card
 * Everything is skipped when the user prefers reduced motion.
 */
export function useLandingAnimations(rootRef: RefObject<HTMLElement>, enabled: boolean) {
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;

    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // ── Hero intro ───────────────────────────────────────
      const title = q("[data-anim='hero-title']")[0] as HTMLElement | undefined;
      const split = title ? SplitText.create(title, { type: "words", mask: "words" }) : null;

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .from(q("[data-anim='nav']"), { yPercent: -100, opacity: 0, duration: 0.6 })
        .from(q("[data-anim='hero-item']")[0], { y: 16, opacity: 0, duration: 0.5 }, "-=0.25");
      if (split) {
        intro.from(split.words, { yPercent: 110, duration: 0.8, stagger: 0.06 }, "-=0.2");
      }
      intro.from(
        q("[data-anim='hero-item']").slice(1),
        { y: 24, opacity: 0, duration: 0.6, stagger: 0.1 },
        "-=0.5"
      );

      // ── Hero product cards ───────────────────────────────
      const cards = q("[data-anim='preview'] .wkl-card");
      intro.from(
        cards,
        { y: 60, opacity: 0, scale: 0.94, duration: 0.9, stagger: 0.14, ease: "back.out(1.4)" },
        0.35
      );

      const bar = q("[data-anim='bar']")[0] as HTMLElement | undefined;
      const pct = q("[data-anim='pct']")[0] as HTMLElement | undefined;
      if (bar && pct) {
        const target = parseFloat(bar.style.width) || 0;
        const counter = { v: 0 };
        intro
          .fromTo(bar, { width: "0%" }, { width: `${target}%`, duration: 1.2, ease: "power2.inOut" }, "-=0.3")
          .to(
            counter,
            {
              v: target,
              duration: 1.2,
              ease: "power2.inOut",
              onUpdate: () => {
                pct.textContent = `${Math.round(counter.v)}%`;
              },
            },
            "<"
          );
      }

      // Gentle idle float once the cards are in place.
      intro.add(() => {
        cards.forEach((card, i) => {
          gsap.to(card, {
            y: i % 2 === 0 ? -8 : 8,
            duration: 2.6 + i * 0.4,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        });
      });

      const preview = q("[data-anim='preview']")[0] as HTMLElement | undefined;
      if (preview) {
        // Cards drift up a bit slower than the page while scrolling past the hero.
        gsap.to(preview, {
          y: -60,
          ease: "none",
          scrollTrigger: { trigger: preview, start: "top 40%", end: "bottom top", scrub: true },
        });
      }

      // ── Scroll reveals ───────────────────────────────────
      q("[data-anim='reveal']").forEach((el) => {
        gsap.from(el, {
          y: 32,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });
      });

      q("[data-anim='stagger']").forEach((group) => {
        gsap.from(group.children, {
          y: 40,
          opacity: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          // Hand transform back to CSS so hover effects keep working.
          clearProps: "transform",
          scrollTrigger: { trigger: group, start: "top 82%", once: true },
        });
      });

      const cta = q("[data-anim='cta']")[0];
      if (cta) {
        gsap.from(cta, {
          scale: 0.92,
          y: 40,
          opacity: 0,
          duration: 0.9,
          ease: "expo.out",
          scrollTrigger: { trigger: cta, start: "top 85%", once: true },
        });
      }

      return () => split?.revert();
    });

    // Desktop only: the hero cards tilt slightly toward the pointer.
    mm.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (min-width: 768px)", () => {
      const preview = q("[data-anim='preview']")[0] as HTMLElement | undefined;
      if (!preview) return;
      gsap.set(preview, { transformPerspective: 900 });
      const rotX = gsap.quickTo(preview, "rotationX", { duration: 0.6, ease: "power3.out" });
      const rotY = gsap.quickTo(preview, "rotationY", { duration: 0.6, ease: "power3.out" });
      const onMove = (e: PointerEvent) => {
        rotY((e.clientX / window.innerWidth - 0.5) * 8);
        rotX((0.5 - e.clientY / window.innerHeight) * 6);
      };
      window.addEventListener("pointermove", onMove);
      return () => window.removeEventListener("pointermove", onMove);
    });

    return () => mm.revert();
  }, [enabled]);
}
