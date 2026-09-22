"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  BookOpen,
  CheckSquare,
  Layers,
  User,
  Home,
  GraduationCap,
  Grip,
  Calendar,
  Clock,
  HelpCircle,
  FileOutput,
  Trophy,
  ClipboardList,
  Plus,
  Search,
  Camera,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";

// Home stays pinned leftmost, the grid button pinned rightmost — only these
// two middle slots are up for grabs in the pill, everything else lives one
// tap away in the "más" panel.
const mainTabs = [
  { href: "/materias", label: "Materias", icon: BookOpen },
  { href: "/perfil", label: "Perfil", icon: User },
];

const moreTabs = [
  { href: "/notas", label: "Notas", icon: GraduationCap, accent: "indigo" },
  { href: "/tareas", label: "Tareas", icon: CheckSquare, accent: "stone" },
  { href: "/flashcards", label: "Tarjetas", icon: Layers, accent: "violet" },
  { href: "/calendario", label: "Calendario", icon: Calendar, accent: "sky" },
  { href: "/horario", label: "Horario", icon: Clock, accent: "amber" },
  { href: "/digitalizar", label: "Digitalizar", icon: FileOutput, accent: "emerald" },
  { href: "/quiz", label: "Quiz", icon: HelpCircle, accent: "rose" },
  { href: "/dominio", label: "Dominio", icon: Trophy, accent: "indigo" },
  { href: "/parcial", label: "Parcial", icon: ClipboardList, accent: "stone" },
] as const;

// Quick-create launcher: tapping an item navigates AND opens that page's
// create sheet in one tap, via the `?new=1` param each page now listens for
// (see useAutoOpenCreate).
const createItems = [
  {
    href: "/tareas",
    label: "Tarea",
    description: "Un pendiente con fecha de entrega",
    icon: CheckSquare,
    accent: "violet",
  },
  {
    href: "/materias",
    label: "Materia",
    description: "Agrega una materia de este ciclo",
    icon: BookOpen,
    accent: "sky",
  },
  {
    href: "/flashcards",
    label: "Tarjeta",
    description: "Crea una flashcard para repasar",
    icon: Layers,
    accent: "rose",
  },
  {
    href: "/horario",
    label: "Clase",
    description: "Agrega un bloque a tu horario",
    icon: Clock,
    accent: "amber",
  },
  {
    href: "/digitalizar",
    label: "Escaneo",
    description: "Digitaliza apuntes o un documento",
    icon: Camera,
    accent: "emerald",
  },
] as const;

type Indicator = { left: number; width: number };

// A touch wider than the icon's own 36px box — matching it exactly
// looked too tight/cramped around the glyph.
const INDICATOR_PAD = 6;
const PILL_DURATION = 0.42;
const PILL_EASE = "back.out(1.4)";

// Each page renders its own AppShell, so the nav remounts on every route
// change — often while the pill is still sliding. Keep the slide itself in
// module scope (which survives the remount): the new nav replays it and
// seeks to the elapsed time, so the pill continues from where it visually
// was instead of jumping to the end or growing in from the far left.
let pillSlide: { from: Indicator; to: Indicator; start: number } | null = null;

const sameIndicator = (a: Indicator, b: Indicator) =>
  Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5;

/** Where the pill is on screen right now, mid-slide included. */
function pillPosition(now: number): Indicator | null {
  if (!pillSlide) return null;
  const { from, to, start } = pillSlide;
  const p = gsap.utils.clamp(0, 1, (now - start) / 1000 / PILL_DURATION);
  const e = gsap.parseEase(PILL_EASE)(p);
  return { left: from.left + (to.left - from.left) * e, width: from.width + (to.width - from.width) * e };
}

function playPill(el: HTMLElement, seek = 0) {
  if (!pillSlide) return;
  const { from, to } = pillSlide;
  gsap
    .fromTo(
      el,
      { x: from.left, width: from.width },
      { x: to.left, width: to.width, duration: PILL_DURATION, ease: PILL_EASE, overwrite: true }
    )
    .seek(Math.min(seek, PILL_DURATION));
}

function accentStyle(accent: string) {
  return {
    background: `var(--wk-${accent}-soft)`,
    color: `var(--wk-${accent}-ink)`,
  };
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [moreOpen, setMoreOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSearch, setCreateSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isMoreActive = moreTabs.some(
    (tab) => pathname === tab.href || pathname.startsWith(tab.href + "/")
  );

  // Active-pill indicator: a single element that slides between icons
  // instead of each icon toggling its own background — that's the micro
  // interaction that makes switching tabs feel alive instead of a hard cut.
  // Slot order matches render order: 0 = home, 1..n = mainTabs, last = grip.
  const slotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pillRef = useRef<HTMLSpanElement>(null);
  // Slot tapped but whose page hasn't loaded yet — it owns the pill meanwhile.
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);

  const measure = (i: number): Indicator | null => {
    const el = slotRefs.current[i];
    return el ? { left: el.offsetLeft - INDICATOR_PAD, width: el.offsetWidth + INDICATOR_PAD * 2 } : null;
  };

  const routeSlotIndex = (() => {
    if (pathname === "/inicio") return 0;
    const tabIndex = mainTabs.findIndex(
      (tab) => pathname === tab.href || pathname.startsWith(tab.href + "/")
    );
    if (tabIndex !== -1) return tabIndex + 1;
    if (isMoreActive) return mainTabs.length + 1;
    return null;
  })();
  // While the panel is open the grip is what's "selected" regardless of the
  // route — otherwise opening it from /inicio left the pill on Home.
  const activeSlotIndex = moreOpen ? mainTabs.length + 1 : pendingSlot ?? routeSlotIndex;
  // Only the slot under the pill gets the light icon color; the others stay
  // muted (a white icon off the pill is invisible on the light nav).
  const isSlotActive = (i: number) => activeSlotIndex === i;

  // The tapped tab's page has loaded: the route is the source of truth again.
  useEffect(() => setPendingSlot(null), [pathname]);

  // Start moving the pill the moment a tab is tapped, not when the new page
  // finishes loading.
  const selectSlot = (i: number) => {
    setMoreOpen(false);
    setPendingSlot(i);
  };

  // Fresh nav (new page): pick the running slide back up where it is now.
  useLayoutEffect(() => {
    const el = pillRef.current;
    if (el && pillSlide) playPill(el, (performance.now() - pillSlide.start) / 1000);
    return () => {
      if (el) gsap.killTweensOf(el);
    };
  }, []);

  useLayoutEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const target = activeSlotIndex !== null ? measure(activeSlotIndex) : null;
    gsap.set(el, { opacity: target ? 1 : 0 });
    if (!target) return;
    // Already heading there (e.g. the slide started on the previous page).
    if (pillSlide && sameIndicator(pillSlide.to, target)) return;

    const now = performance.now();
    const from = pillPosition(now);
    if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Very first placement (or reduced motion): no slide.
      pillSlide = { from: target, to: target, start: 0 };
      gsap.set(el, { x: target.left, width: target.width });
      return;
    }
    pillSlide = { from, to: target, start: now };
    playPill(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlotIndex]);

  const filteredCreateItems = createItems.filter((item) =>
    item.label.toLowerCase().includes(createSearch.trim().toLowerCase())
  );

  const goCreate = (href: string) => {
    setCreateOpen(false);
    setCreateSearch("");
    router.push(`${href}?new=1`);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
        <div className="relative mx-auto max-w-sm px-3 pb-3">
          {/* Backdrop to close the panel by tapping outside it */}
          {moreOpen && (
            <div className="fixed inset-0 z-0" onClick={() => setMoreOpen(false)} />
          )}

          {/* Floating row: glass pill (icon-only tabs) + separate FAB */}
          <div className="relative z-10 flex items-end gap-2.5">
            {/* ONE surface (bg/border/shadow/radius all live here) that
                grows taller when opening — the pill itself extending
                upward, not a separate card popping in above it. The icon
                row stays pinned at the bottom; the grid area animates from
                0 to its natural height via the CSS grid-template-rows
                trick (no JS measuring needed to animate to "auto").
                Radius is a FIXED 30px (not "rounded-full" toggled with
                "rounded-2xl") on purpose: animating border-radius from
                9999px down means it stays huge for most of the transition
                (browsers interpolate the raw px value, and it only visibly
                shrinks once it drops below half the box's height/width) —
                that's the black "blob" that flashed before settling. A
                constant 30px already reads as a full pill at the closed
                ~60px height and as a nicely rounded rectangle once tall,
                with nothing to animate or overshoot. */}
            <div className="flex-1 flex flex-col overflow-hidden rounded-[30px] bg-card/85 dark:bg-card/60 backdrop-blur-2xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.15)]">
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: moreOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div
                    className={cn(
                      "grid grid-cols-3 gap-2.5 px-3 pt-3 pb-1 transition-[opacity,transform] duration-200",
                      moreOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                    )}
                  >
                    {moreTabs.map((tab) => {
                      const isActive =
                        pathname === tab.href || pathname.startsWith(tab.href + "/");
                      return (
                        <Link
                          key={tab.href}
                          href={tab.href}
                          onClick={() => selectSlot(mainTabs.length + 1)}
                          tabIndex={moreOpen ? 0 : -1}
                          className={cn(
                            "flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-colors touch-target",
                            isActive ? "bg-secondary/60" : "active:bg-secondary/40"
                          )}
                        >
                          <span
                            className="w-11 h-11 rounded-2xl flex items-center justify-center"
                            style={accentStyle(tab.accent)}
                          >
                            <tab.icon className="w-5 h-5" />
                          </span>
                          <span className="text-[11px] font-medium text-foreground truncate max-w-full px-1">
                            {tab.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>

            <nav
              className="relative w-full flex items-center justify-between gap-0.5 px-1.5 py-1.5"
            >
              {/* The sliding active-pill — behind the icons, one shared
                  element animating between slots instead of each icon
                  cutting its own background on/off. */}
              <span
                ref={pillRef}
                aria-hidden="true"
                className="absolute left-0 top-1.5 bottom-1.5 w-0 rounded-full bg-primary opacity-0"
              />

              {/* Home — pinned leftmost */}
              <Link
                href="/inicio"
                aria-label="Inicio"
                onClick={() => selectSlot(0)}
                className="flex-1 flex items-center justify-center py-1.5 touch-target"
              >
                <span
                  ref={(el) => { slotRefs.current[0] = el; }}
                  className={cn(
                    "relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                    isSlotActive(0)
                      ? "text-primary-foreground"
                      : "text-muted-foreground active:text-foreground"
                  )}
                >
                  <Home className={cn("w-[18px] h-[18px]", isSlotActive(0) && "stroke-[2.5px]")} />
                </span>
              </Link>

              {mainTabs.map((tab, i) => {
                const isActive = isSlotActive(i + 1);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-label={tab.label}
                    onClick={() => selectSlot(i + 1)}
                    className="flex-1 flex items-center justify-center py-1.5 touch-target"
                  >
                    <span
                      ref={(el) => { slotRefs.current[i + 1] = el; }}
                      className={cn(
                        "relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                        isActive
                          ? "text-primary-foreground"
                          : "text-muted-foreground active:text-foreground"
                      )}
                    >
                      <tab.icon className={cn("w-[18px] h-[18px]", isActive && "stroke-[2.5px]")} />
                    </span>
                  </Link>
                );
              })}

              <button
                onClick={() => setMoreOpen((v) => !v)}
                aria-label="Más opciones"
                aria-pressed={moreOpen}
                className="flex-1 flex items-center justify-center py-1.5 touch-target"
              >
                <span
                  ref={(el) => { slotRefs.current[mainTabs.length + 1] = el; }}
                  className={cn(
                    "relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                    isSlotActive(mainTabs.length + 1)
                      ? "text-primary-foreground"
                      : "text-muted-foreground active:text-foreground"
                  )}
                >
                  <Grip className="w-[18px] h-[18px]" />
                </span>
              </button>
            </nav>
            </div>

            {/* Quick-create FAB */}
            <button
              onClick={() => setCreateOpen(true)}
              aria-label="Crear"
              className="w-14 h-14 shrink-0 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Crear sheet */}
      <Sheet
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateSearch(""); }}
        title="Crear"
        centerTitle
      >
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={createSearch}
                onChange={(e) => setCreateSearch(e.target.value)}
                placeholder="Busca que quieres crear..."
                className="w-full pl-10 pr-9 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {createSearch && (
                <button
                  onClick={() => setCreateSearch("")}
                  aria-label="Limpiar busqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-secondary/80 flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <button
              onClick={() => { setCreateOpen(false); setCreateSearch(""); }}
              className="shrink-0 text-sm font-medium text-primary active:opacity-60"
            >
              Cancelar
            </button>
          </div>

          <div className="space-y-1">
            {filteredCreateItems.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 text-center py-6">
                Nada coincide con &quot;{createSearch}&quot;
              </p>
            ) : (
              filteredCreateItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => goCreate(item.href)}
                  className="w-full flex items-center gap-3.5 p-3 rounded-xl text-left active:bg-secondary/60 transition-colors"
                >
                  <span
                    className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center"
                    style={accentStyle(item.accent)}
                  >
                    <item.icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[15px]">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
