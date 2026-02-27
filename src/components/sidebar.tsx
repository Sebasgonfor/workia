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
  Calendar,
  Clock,
  ScanLine,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/materias", label: "Materias", icon: BookOpen },
  { href: "/tareas", label: "Tareas", icon: CheckSquare },
  { href: "/notas", label: "Notas", icon: GraduationCap },
  { href: "/flashcards", label: "Tarjetas", icon: Layers },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/horario", label: "Horario", icon: Clock },
  { href: "/escanear", label: "Escanear", icon: ScanLine },
  { href: "/quiz", label: "Quiz", icon: HelpCircle },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-56 md:flex-col md:border-r md:border-border md:bg-card md:z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-sm font-bold">W</span>
        </div>
        <span className="text-base font-bold tracking-tight">Workia</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon
                className={cn("w-[18px] h-[18px] shrink-0", isActive && "stroke-[2.5px]")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
