"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CheckSquare, ScanLine, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/materias", label: "Materias", icon: BookOpen },
  { href: "/tareas", label: "Tareas", icon: CheckSquare },
  { href: "/escanear", label: "Escanear", icon: ScanLine },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border">
      <div className="mx-auto max-w-lg flex items-center justify-around py-2 pb-safe">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors min-w-[64px]",
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
      </div>
    </nav>
  );
}
