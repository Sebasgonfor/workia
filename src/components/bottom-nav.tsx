"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CheckSquare,
  Layers,
  User,
  Home,
  GraduationCap,
  MoreHorizontal,
  Calendar,
  Clock,
  ScanLine,
  HelpCircle,
  FileOutput,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";

const mainTabs = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/materias", label: "Materias", icon: BookOpen },
  { href: "/tareas", label: "Tareas", icon: CheckSquare },
  { href: "/notas", label: "Notas", icon: GraduationCap },
  { href: "/perfil", label: "Perfil", icon: User },
];

const moreTabs = [
  { href: "/flashcards", label: "Tarjetas", icon: Layers },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/horario", label: "Horario", icon: Clock },
  { href: "/escanear", label: "Escanear", icon: ScanLine },
  { href: "/digitalizar", label: "Digitalizar", icon: FileOutput },
  { href: "/quiz", label: "Quiz", icon: HelpCircle },
];

export function BottomNav() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isMoreActive = moreTabs.some(
    (tab) => pathname === tab.href || pathname.startsWith(tab.href + "/")
  );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border md:hidden">
        <div className="mx-auto max-w-lg flex items-center justify-around py-2 pb-safe">
          {mainTabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors touch-target",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <tab.icon
                  className={cn("w-5 h-5", isActive && "stroke-[2.5px]")}
                />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setSheetOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors touch-target",
              isMoreActive
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            )}
            aria-label="Más opciones"
          >
            <MoreHorizontal
              className={cn("w-5 h-5", isMoreActive && "stroke-[2.5px]")}
            />
            <span className="text-[10px] font-medium">Más</span>
          </button>
        </div>
      </nav>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Más opciones"
      >
        <div className="grid grid-cols-3 gap-3 py-2">
          {moreTabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setSheetOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors",
                  isActive
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-foreground active:bg-secondary"
                )}
                aria-label={tab.label}
              >
                <tab.icon className={cn("w-6 h-6", isActive && "stroke-[2.5px]")} />
                <span className="text-xs font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
