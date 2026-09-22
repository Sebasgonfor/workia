"use client";

import { ReactNode } from "react";
import { gsap } from "gsap";
import { Bell, Check, Plus, Sparkles, X } from "lucide-react";

/**
 * Mini animated "videos" for the landing feature carousel. Each scene is a
 * small piece of Workia UI in HTML plus a GSAP timeline that plays it. The
 * carousel restarts the timeline when the card becomes the centered one and
 * shows its final frame otherwise.
 */
export interface FeatureScene {
  render: () => ReactNode;
  build: (el: HTMLElement) => gsap.core.Timeline;
  /** Timeline progress (0–1) shown while the card is not centered. */
  poster?: number;
}

const q = (el: HTMLElement) => gsap.utils.selector(el);

// ── 1. Escanear y digitalizar ─────────────────────────────
const scan: FeatureScene = {
  render: () => (
    <div className="wks-center">
      <div className="wks-paper">
        {[88, 72, 94, 60, 80, 68].map((w, i) => (
          <div key={i} className="wks-ink" style={{ width: `${w}%` }} />
        ))}
        {["tl", "tr", "bl", "br"].map((c) => (
          <span key={c} className={`wks-corner wks-corner-${c}`} />
        ))}
        <div className="wks-scanbar" />
      </div>
      <div className="wks-chip wks-chip-ok wks-float-chip">
        <Check className="w-3 h-3" /> Texto extraído
      </div>
    </div>
  ),
  build: (el) => {
    const $ = q(el);
    return gsap
      .timeline()
      .set($(".wks-paper"), { rotation: -6, scale: 0.92 })
      .set($(".wks-ink"), { backgroundColor: "var(--paper-ink)" })
      .fromTo($(".wks-corner"), { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, stagger: 0.08, ease: "back.out(2)" })
      .to($(".wks-paper"), { rotation: 0, scale: 1, duration: 0.6, ease: "power2.inOut" }, "+=0.1")
      .fromTo($(".wks-scanbar"), { top: "0%", opacity: 1 }, { top: "100%", duration: 1.3, ease: "sine.inOut" })
      .to($(".wks-ink"), { backgroundColor: "var(--wk-brand)", duration: 0.25, stagger: 0.12 }, "<0.15")
      .to($(".wks-scanbar"), { opacity: 0, duration: 0.2 })
      .fromTo($(".wks-float-chip"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.8)" });
  },
};

// ── 2. Tablero dinámico ───────────────────────────────────
const board: FeatureScene = {
  render: () => (
    <div className="wks-pad">
      <div className="flex items-center justify-between">
        <p className="wks-title">Derivadas</p>
        <span className="wks-chip wks-chip-brand wks-ai"><Sparkles className="w-3 h-3" /> IA</span>
      </div>
      <div className="wks-ink wks-line" style={{ width: "90%" }} />
      <div className="wks-ink wks-line" style={{ width: "70%" }} />
      <div className="wks-formula">f′(x) = lim<sub>h→0</sub> (f(x+h) − f(x)) / h</div>
      <div className="wks-def">
        <b>Definición:</b> tasa de cambio instantánea de una función.
      </div>
      <div className="flex gap-1.5 mt-2">
        {["Límites", "Pendiente", "Regla cadena"].map((t) => (
          <span key={t} className="wks-chip wks-link">{t}</span>
        ))}
      </div>
    </div>
  ),
  build: (el) => {
    const $ = q(el);
    return gsap
      .timeline()
      .from($(".wks-line"), { width: 0, duration: 0.5, stagger: 0.15, ease: "power2.out" })
      .from($(".wks-ai"), { scale: 0, rotation: -30, duration: 0.45, ease: "back.out(2.5)" })
      .from($(".wks-formula"), { y: 14, opacity: 0, filter: "blur(4px)", duration: 0.55, ease: "power3.out" })
      .from($(".wks-def"), { x: -24, opacity: 0, duration: 0.5, ease: "power3.out" }, "-=0.15")
      .from($(".wks-link"), { y: 10, opacity: 0, scale: 0.8, duration: 0.35, stagger: 0.1, ease: "back.out(2)" });
  },
};

// ── 3. Flashcards ─────────────────────────────────────────
const flashcards: FeatureScene = {
  render: () => (
    <div className="wks-center flex-col gap-3">
      <div className="wks-flip-wrap">
        <div className="wks-flip-card wks-flip-back-card" />
        <div className="wks-flip">
          <div className="wks-flip-face">
            <span className="wks-kick">Pregunta</span>
            <p>¿Qué es la mitocondria?</p>
          </div>
          <div className="wks-flip-face wks-flip-answer">
            <span className="wks-kick">Respuesta</span>
            <p>El orgánulo que produce la energía (ATP) de la célula.</p>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {["Otra vez", "Difícil", "Bien", "Fácil"].map((l) => (
          <span key={l} className={`wks-rate ${l === "Bien" ? "wks-rate-good" : ""}`}>{l}</span>
        ))}
      </div>
    </div>
  ),
  build: (el) => {
    const $ = q(el);
    return gsap
      .timeline()
      .set($(".wks-flip"), { rotationY: 0, x: 0, opacity: 1 })
      .from($(".wks-flip"), { y: 30, opacity: 0, duration: 0.5, ease: "back.out(1.6)" })
      .to($(".wks-flip"), { rotationY: 180, duration: 0.8, ease: "power3.inOut" }, "+=0.6")
      .from($(".wks-rate"), { y: 10, opacity: 0, duration: 0.3, stagger: 0.07 }, "-=0.2")
      .to($(".wks-rate-good"), { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1 }, "+=0.35")
      .to($(".wks-rate-good"), { backgroundColor: "var(--wk-emerald)", color: "white", duration: 0.2 }, "<")
      .to($(".wks-flip"), { x: 220, rotation: 12, opacity: 0, duration: 0.55, ease: "power2.in" }, "+=0.3")
      // Next card comes up from the deck, question side.
      .set($(".wks-flip"), { x: 0, rotation: 0, rotationY: 0 })
      .set($(".wks-rate-good"), { clearProps: "backgroundColor,color" })
      .fromTo($(".wks-flip"), { y: 14, scale: 0.94, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: "power3.out" });
  },
  // Answer side up, before the card is swiped away.
  poster: 0.62,
};

// ── 4. Quizzes y simulacros ───────────────────────────────
const quiz: FeatureScene = {
  render: () => (
    <div className="wks-pad">
      <div className="flex items-center justify-between mb-2">
        <span className="wks-kick">Pregunta 8 de 10</span>
        <span className="wks-score"><span className="wks-score-n">7</span>/10</span>
      </div>
      <div className="wks-bar"><div className="wks-bar-fill" /></div>
      <p className="wks-q">¿Cuál es la derivada de x²?</p>
      <div className="grid grid-cols-2 gap-1.5">
        {["x", "2x", "x³/3", "2"].map((o, i) => (
          <div key={o} className={`wks-opt ${i === 1 ? "wks-opt-ok" : ""}`}>{o}</div>
        ))}
      </div>
      <span className="wks-cursor" />
    </div>
  ),
  build: (el) => {
    const $ = q(el);
    const n = $(".wks-score-n")[0];
    const score = { v: 7 };
    return gsap
      .timeline({ onStart: () => { n.textContent = "7"; } })
      .fromTo($(".wks-bar-fill"), { width: "60%" }, { width: "70%", duration: 0.5 })
      .from($(".wks-q"), { y: 12, opacity: 0, duration: 0.4 }, "<")
      .from($(".wks-opt"), { y: 12, opacity: 0, duration: 0.3, stagger: 0.08 })
      .fromTo($(".wks-cursor"), { left: "85%", top: "95%", opacity: 0 }, { opacity: 1, duration: 0.2 })
      .to($(".wks-cursor"), { left: "72%", top: "66%", duration: 0.8, ease: "power2.inOut" })
      .to($(".wks-cursor"), { scale: 0.7, duration: 0.1, yoyo: true, repeat: 1 })
      .to($(".wks-opt-ok"), { backgroundColor: "var(--wk-emerald-soft)", borderColor: "var(--wk-emerald)", color: "var(--wk-emerald-ink)", duration: 0.25 })
      .to($(".wks-opt-ok"), { scale: 1.06, duration: 0.15, yoyo: true, repeat: 1 }, "<")
      .to(score, { v: 8, duration: 0.4, onUpdate: () => { n.textContent = String(Math.round(score.v)); } })
      .to($(".wks-bar-fill"), { width: "80%", duration: 0.5, ease: "power2.out" }, "<")
      .to($(".wks-cursor"), { opacity: 0, duration: 0.3 });
  },
};

// ── 5. Modo Feynman y tutor socrático ─────────────────────
const feynman: FeatureScene = {
  render: () => (
    <div className="wks-pad">
      <span className="wks-kick">Explícalo con tus palabras</span>
      <div className="wks-typed">
        <span className="wks-typed-text">La fotosíntesis convierte luz solar en energía química para la planta…</span>
      </div>
      <div className="flex flex-col gap-1.5 mt-2.5">
        <span className="wks-fb wks-fb-ok"><Check className="w-3 h-3" /> Idea principal correcta</span>
        <span className="wks-fb wks-fb-miss"><Plus className="w-3 h-3" /> Faltó: papel del CO₂ y el agua</span>
        <span className="wks-fb wks-fb-bad"><X className="w-3 h-3" /> “Energía química” ≠ oxígeno</span>
      </div>
    </div>
  ),
  build: (el) => {
    const $ = q(el);
    return gsap
      .timeline()
      .from($(".wks-typed"), { opacity: 0, y: 10, duration: 0.3 })
      .fromTo($(".wks-typed-text"), { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.8, ease: "steps(40)" })
      .from($(".wks-fb"), { x: -30, opacity: 0, duration: 0.45, stagger: 0.35, ease: "back.out(1.7)" }, "+=0.3");
  },
};

// ── 6. Chat con tus apuntes ───────────────────────────────
const chat: FeatureScene = {
  render: () => (
    <div className="wks-pad flex flex-col gap-2">
      <div className="wks-bubble wks-bubble-me">¿Qué entra en el parcial de Física?</div>
      <div className="wks-bubble wks-bubble-ai wks-dots"><i /><i /><i /></div>
      <div className="wks-bubble wks-bubble-ai wks-answer">
        Según tus apuntes: <b>cinemática</b>, <b>leyes de Newton</b> y <b>trabajo y energía</b>. Te armé 12 flashcards para repasar.
      </div>
    </div>
  ),
  build: (el) => {
    const $ = q(el);
    const tl = gsap
      .timeline()
      .set($(".wks-answer"), { display: "none" })
      .set($(".wks-dots"), { display: "flex" })
      .from($(".wks-bubble-me"), { x: 40, opacity: 0, duration: 0.45, ease: "back.out(1.6)" })
      .from($(".wks-dots"), { scale: 0, transformOrigin: "left center", duration: 0.3 }, "+=0.2")
      .to($(".wks-dots i"), { y: -4, duration: 0.25, stagger: { each: 0.12, repeat: 3, yoyo: true } })
      .set($(".wks-dots"), { display: "none" })
      .set($(".wks-answer"), { display: "block" })
      .fromTo($(".wks-answer"), { opacity: 0, y: 12, clipPath: "inset(0 0 100% 0)" }, { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)", duration: 1, ease: "power2.out" });
    return tl;
  },
};

// ── 7. Tareas, horario y recordatorios ────────────────────
const tasks: FeatureScene = {
  render: () => (
    <div className="wks-pad">
      <div className="wks-toast"><Bell className="w-3.5 h-3.5 wks-bell" /> Entrega mañana: <b>Taller de Cálculo</b></div>
      <div className="grid grid-cols-5 gap-1.5 mt-9">
        {["L", "M", "X", "J", "V"].map((d, i) => (
          <div key={d} className="wks-day">
            <span className="wks-day-l">{d}</span>
            {i === 1 && <span className="wks-task wk-c-violet">Cálculo</span>}
            {i === 2 && <span className="wks-task wk-c-emerald">Lab Bio</span>}
            {i === 3 && <span className="wks-task wk-c-amber">Ensayo</span>}
            {i === 4 && <span className="wks-task wk-c-sky">Quiz</span>}
          </div>
        ))}
      </div>
    </div>
  ),
  build: (el) => {
    const $ = q(el);
    return gsap
      .timeline()
      .from($(".wks-day"), { y: 14, opacity: 0, duration: 0.35, stagger: 0.06 })
      .from($(".wks-task"), { y: -40, opacity: 0, duration: 0.55, stagger: 0.2, ease: "bounce.out" })
      .fromTo($(".wks-toast"), { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.6)" }, "+=0.3")
      .fromTo($(".wks-bell"), { rotation: 0 }, { rotation: 18, duration: 0.08, yoyo: true, repeat: 7, ease: "sine.inOut", transformOrigin: "50% 0%" })
      .set($(".wks-bell"), { rotation: 0 });
  },
};

// ── 8. Métricas de dominio ────────────────────────────────
const RING = 2 * Math.PI * 30;
const metrics: FeatureScene = {
  render: () => (
    <div className="wks-pad flex items-center gap-4">
      <div className="wks-ring">
        <svg viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="30" className="wks-ring-bg" />
          <circle cx="36" cy="36" r="30" className="wks-ring-fg" strokeDasharray={RING} strokeDashoffset={RING * 0.22} />
        </svg>
        <span className="wks-ring-n">78%</span>
      </div>
      <div className="flex-1 flex items-end gap-1.5 h-[88px]">
        {[
          ["Cálculo", 78, "wk-c-violet"],
          ["Física", 62, "wk-c-sky"],
          ["Bio", 90, "wk-c-emerald"],
          ["Historia", 45, "wk-c-amber"],
        ].map(([l, h, c]) => (
          <div key={l as string} className={`wks-col ${c}`}>
            <div className="wks-col-bar" style={{ height: `${h}%` }} />
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  ),
  build: (el) => {
    const $ = q(el);
    const n = $(".wks-ring-n")[0];
    const v = { p: 0 };
    return gsap
      .timeline()
      .fromTo($(".wks-ring-fg"), { strokeDashoffset: RING }, { strokeDashoffset: RING * 0.22, duration: 1.4, ease: "power2.inOut" })
      .fromTo(v, { p: 0 }, { p: 78, duration: 1.4, ease: "power2.inOut", onUpdate: () => { n.textContent = `${Math.round(v.p)}%`; } }, "<")
      .from($(".wks-col-bar"), { height: "0%", duration: 0.8, stagger: 0.12, ease: "elastic.out(1, 0.6)" }, "<0.2")
      .from($(".wks-col span"), { opacity: 0, y: 6, duration: 0.3, stagger: 0.08 }, "-=0.5");
  },
};

export const FEATURE_SCENES = [scan, board, flashcards, quiz, feynman, chat, tasks, metrics];
