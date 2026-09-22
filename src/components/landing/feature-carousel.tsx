"use client";

import { ComponentType, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_SCENES } from "./feature-scenes";

export interface CarouselFeature {
  icon: ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  desc: string;
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
// Pause on the finished scene before moving on.
const HOLD_AFTER_SCENE = 1.6;

/**
 * Coverflow-style carousel for the landing features. The centered card is
 * big and plays its mini animation (see feature-scenes); neighbours sit
 * behind it, smaller and dimmed, showing a still frame. Advances on its own
 * when the scene ends, and supports arrows, dots, swipe/drag and keyboard.
 */
export function FeatureCarousel({ features }: { features: CarouselFeature[] }) {
  const n = features.length;
  const [active, setActive] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timelines = useRef<gsap.core.Timeline[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);
  const autoplay = useRef<gsap.core.Tween | null>(null);
  const inView = useRef(false);
  const hovering = useRef(false);
  const reducedMotion = useRef(false);
  const first = useRef(true);

  const go = useCallback((i: number) => setActive(((i % n) + n) % n), [n]);

  // Build one paused timeline per scene.
  useIsoLayoutEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      timelines.current = sceneRefs.current.map((el, i) => {
        const tl = FEATURE_SCENES[i % FEATURE_SCENES.length].build(el!);
        tl.pause();
        return tl;
      });
    });
    return () => ctx.revert();
  }, []);

  const startAutoplay = useCallback(() => {
    autoplay.current?.kill();
    const bar = progressRef.current;
    const tl = timelines.current[active];
    if (!bar || !tl || reducedMotion.current) return;
    // Progress bar spans the scene plus the hold; it drives the auto-advance.
    const remaining = Math.max(0, tl.duration() - tl.time()) + HOLD_AFTER_SCENE;
    const done = remaining / (tl.duration() + HOLD_AFTER_SCENE);
    autoplay.current = gsap.fromTo(
      bar,
      { scaleX: 1 - done },
      { scaleX: 1, duration: remaining, ease: "none", onComplete: () => go(active + 1) }
    );
    if (!inView.current || hovering.current) autoplay.current.pause();
  }, [active, go]);

  // Position the cards and play the centered scene whenever `active` changes.
  useIsoLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const width = cardRefs.current[0]?.offsetWidth ?? 320;
    const spread = Math.min(width * 0.62, stage.offsetWidth * 0.36);

    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      // Shortest signed distance around the loop.
      let d = i - active;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      const abs = Math.abs(d);
      const props = {
        x: d * spread,
        scale: 1 - Math.min(abs, 3) * 0.12,
        rotationY: gsap.utils.clamp(-40, 40, -d * 18),
        opacity: abs > 2 ? 0 : 1 - abs * 0.28,
        zIndex: 10 - abs,
        filter: abs === 0 ? "blur(0px)" : `blur(${Math.min(abs, 2)}px)`,
        pointerEvents: abs > 2 ? "none" : "auto",
      };
      if (first.current || reducedMotion.current) gsap.set(card, props);
      else gsap.to(card, { ...props, duration: 0.75, ease: "power3.out", overwrite: "auto" });
      card.setAttribute("aria-hidden", abs === 0 ? "false" : "true");
    });
    first.current = false;

    timelines.current.forEach((tl, i) => {
      const scene = FEATURE_SCENES[i % FEATURE_SCENES.length];
      if (i === active && !reducedMotion.current) tl.restart();
      else tl.pause().progress(i === active ? 1 : scene.poster ?? 1);
    });
    if (!inView.current) timelines.current[active]?.pause(0);
    startAutoplay();
  }, [active, n, startAutoplay]);

  // Only animate while the carousel is on screen.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const wasInView = inView.current;
        inView.current = entry.isIntersecting;
        if (entry.isIntersecting && !wasInView && !reducedMotion.current) {
          timelines.current[active]?.restart();
          startAutoplay();
        } else if (!entry.isIntersecting) {
          timelines.current[active]?.pause();
          autoplay.current?.pause();
        }
      },
      { threshold: 0.45 }
    );
    io.observe(stage);
    return () => io.disconnect();
  }, [active, startAutoplay]);

  useEffect(() => () => void autoplay.current?.kill(), []);

  // Swipe / drag.
  const drag = useRef<{ x: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, id: e.pointerId };
    // Keep receiving the pointer even if it leaves the card mid-swipe.
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    drag.current = null;
    if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
  };

  const pause = (on: boolean) => {
    hovering.current = on;
    if (on) autoplay.current?.pause();
    else if (inView.current) autoplay.current?.resume();
  };

  return (
    <div
      className="wkc"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Funciones de Workia"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(active + 1);
        if (e.key === "ArrowLeft") go(active - 1);
      }}
    >
      <div
        ref={stageRef}
        className="wkc-stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onMouseEnter={() => pause(true)}
        onMouseLeave={() => pause(false)}
      >
        {features.map((f, i) => {
          const scene = FEATURE_SCENES[i % FEATURE_SCENES.length];
          return (
            <div
              key={f.title}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={cn("wkc-card", f.tone, i === active && "is-active")}
              onClick={() => i !== active && go(i)}
              aria-label={`${i + 1} de ${n}: ${f.title}`}
            >
              <div className="wkc-frame">
                <div className="wkc-frame-bar">
                  <i /><i /><i />
                  <span>workia.app</span>
                </div>
                <div
                  ref={(el) => {
                    sceneRefs.current[i] = el;
                  }}
                  className="wkc-scene"
                  aria-hidden
                >
                  {scene.render()}
                </div>
              </div>
              <div className="wkc-body">
                <span className="wkl-feature-icon">
                  <f.icon className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[15px] mb-1">{f.title}</h3>
                  <p className="text-[13.5px] leading-relaxed wkl-muted">{f.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="wkc-controls">
        <button className="wkc-arrow" onClick={() => go(active - 1)} aria-label="Función anterior">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="wkc-dots">
          {features.map((f, i) => (
            <button
              key={f.title}
              onClick={() => go(i)}
              aria-label={`Ver ${f.title}`}
              aria-current={i === active}
              className={cn("wkc-dot", i === active && "is-active")}
            >
              {i === active && <span ref={progressRef} className="wkc-dot-fill" />}
            </button>
          ))}
        </div>
        <button className="wkc-arrow" onClick={() => go(active + 1)} aria-label="Siguiente función">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
