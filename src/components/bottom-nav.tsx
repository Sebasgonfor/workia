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
import { useEffect, useRef, useState } from "react";
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
  const [moreRendered, setMoreRendered] = useState(false);
  const [moreClosing, setMoreClosing] = useState(false);

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
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const activeSlotIndex = (() => {
    if (pathname === "/inicio") return 0;
    const tabIndex = mainTabs.findIndex(
      (tab) => pathname === tab.href || pathname.startsWith(tab.href + "/")
    );
    if (tabIndex !== -1) return tabIndex + 1;
    if (isMoreActive || moreOpen) return mainTabs.length + 1;
    return null;
  })();

  useEffect(() => {
    const el = activeSlotIndex !== null ? slotRefs.current[activeSlotIndex] : null;
    if (!el) {
      setIndicator(null);
      return;
    }
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeSlotIndex]);

  // Mount/unmount the "más" panel with an exit animation, same pattern the
  // Sheet component uses — instant unmount on close looks like a glitch.
  useEffect(() => {
    if (moreOpen) {
      setMoreRendered(true);
      setMoreClosing(false);
    } else if (moreRendered) {
      setMoreClosing(true);
      const timer = setTimeout(() => {
        setMoreRendered(false);
        setMoreClosing(false);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [moreOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {moreRendered && (
            <div className="fixed inset-0 z-0" onClick={() => setMoreOpen(false)} />
          )}

          {/* Floating row: glass pill (icon-only tabs) + separate FAB */}
          <div className="relative z-10 flex items-center gap-2.5">
            {/* Wrapping the pill in its own flex-1 box means the "más" panel
                (absolute inset-x-0 inside THIS box) always matches the pill's
                real rendered width via plain flexbox — no JS measuring, so
                it can't drift out of sync with the FAB or fall short of the
                grip icon. */}
            <div className="relative flex-1">
              {moreRendered && (
                <div
                  className={cn(
                    // Sits flush on the pill (-mb-px overlaps its border by
                    // a hair, same bg/opacity as the pill) so it reads as
                    // the pill unfolding upward, not a separate floating
                    // card.
                    "absolute inset-x-0 bottom-full -mb-px rounded-t-[28px] rounded-b-2xl border-x border-t border-border/60 bg-card/85 dark:bg-card/60 backdrop-blur-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.15)] p-3 pb-4",
                    moreClosing ? "wk-nav-panel-out" : "wk-nav-panel-in"
                  )}
                >
                  <div className="grid grid-cols-3 gap-2.5">
                    {moreTabs.map((tab) => {
                      const isActive =
                        pathname === tab.href || pathname.startsWith(tab.href + "/");
                      return (
                        <Link
                          key={tab.href}
                          href={tab.href}
                          onClick={() => setMoreOpen(false)}
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
              )}

            <nav
              className="relative w-full flex items-center justify-between gap-0.5 px-1.5 py-1.5 rounded-full bg-card/85 dark:bg-card/60 backdrop-blur-2xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.15)]"
            >
              {/* The sliding active-pill — behind the icons, one shared
                  element animating between slots instead of each icon
                  cutting its own background on/off. */}
              <span
                aria-hidden="true"
                className="absolute left-0 top-1.5 bottom-1.5 rounded-full bg-primary transition-[transform,width,opacity] duration-300 ease-out"
                style={{
                  width: indicator ? indicator.width : 0,
                  transform: `translateX(${indicator ? indicator.left : 0}px)`,
                  opacity: indicator ? 1 : 0,
                }}
              />

              {/* Home — pinned leftmost */}
              <Link
                href="/inicio"
                aria-label="Inicio"
                className="flex-1 flex items-center justify-center py-1.5 touch-target"
              >
                <span
                  ref={(el) => { slotRefs.current[0] = el; }}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                    pathname === "/inicio"
                      ? "text-primary-foreground"
                      : "text-muted-foreground active:text-foreground"
                  )}
                >
                  <Home className={cn("w-[18px] h-[18px]", pathname === "/inicio" && "stroke-[2.5px]")} />
                </span>
              </Link>

              {mainTabs.map((tab, i) => {
                const isActive =
                  pathname === tab.href || pathname.startsWith(tab.href + "/");
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-label={tab.label}
                    className="flex-1 flex items-center justify-center py-1.5 touch-target"
                  >
                    <span
                      ref={(el) => { slotRefs.current[i + 1] = el; }}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
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
                    "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                    isMoreActive || moreOpen
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
      >
        <div className="space-y-3">
          <div className="relative">
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
