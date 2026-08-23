"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckSquare,
  Layers,
  Home,
  GraduationCap,
  Calendar,
  Clock,
  HelpCircle,
  FileOutput,
  Trophy,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTasks, useSubjects } from "@/lib/hooks";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

const STORAGE_KEY = "workia-sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { tasks } = useTasks();
  const { subjects } = useSubjects();

  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore persisted state after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "true") setCollapsed(true);
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  // Mirror collapsed state onto <html> so the layout's main pane can
  // read --wk-sidebar-w and shift accordingly.
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (collapsed) {
      root.setAttribute("data-wk-sidebar", "collapsed");
    } else {
      root.removeAttribute("data-wk-sidebar");
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed, mounted]);

  const pendingTaskCount = tasks.filter((t) => t.status !== "completed").length;

  const studyItems: NavItem[] = [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/materias", label: "Materias", icon: BookOpen, badge: subjects.length || undefined },
    { href: "/tareas", label: "Tareas", icon: CheckSquare, badge: pendingTaskCount || undefined },
    { href: "/notas", label: "Notas", icon: GraduationCap },
    { href: "/flashcards", label: "Tarjetas", icon: Layers },
    { href: "/calendario", label: "Calendario", icon: Calendar },
    { href: "/horario", label: "Horario", icon: Clock },
  ];

  const toolItems: NavItem[] = [
    { href: "/digitalizar", label: "Digitalizar", icon: FileOutput },
    { href: "/quiz", label: "Quiz", icon: HelpCircle },
    { href: "/dominio", label: "Dominio", icon: Trophy },
    { href: "/parcial", label: "Parcial", icon: ClipboardList },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const firstName = user?.displayName?.split(" ")[0] || "Estudiante";
  const initials = (user?.displayName || firstName)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className={`wk-sidebar hidden md:flex ${collapsed ? "is-collapsed" : ""}`}
    >
      {/* Head: brand + collapse toggle */}
      <div className="wk-sb-head">
        <button
          type="button"
          className="wk-sb-brand"
          onClick={collapsed ? () => setCollapsed(false) : undefined}
          aria-label={collapsed ? "Expandir sidebar" : "Workia"}
          data-wk-tip="Expandir sidebar"
        >
          <div className="wk-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 5h4l2 11 3-9 3 9 2-11h4l-4 16h-4l-1-4-1 4h-4L3 5Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <span className="wk-sb-brand-name">Workia</span>
        </button>
        {!collapsed && (
          <button
            type="button"
            className="wk-sb-collapse"
            onClick={() => setCollapsed(true)}
            aria-label="Colapsar sidebar"
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Search */}
      {!collapsed ? (
        <div className="wk-sb-search">
          <Search className="w-4 h-4" strokeWidth={1.5} />
          <input placeholder="Buscar…" readOnly />
          <kbd>⌘K</kbd>
        </div>
      ) : (
        <button
          type="button"
          className="wk-sb-item"
          aria-label="Buscar"
          data-wk-tip="Buscar ⌘K"
          style={{ marginBottom: 6 }}
        >
          <span className="wk-sb-ic">
            <Search className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </span>
        </button>
      )}

      {/* Nav */}
      <nav className="wk-sb-nav">
        <div className="wk-sb-section">Estudio</div>
        {studyItems.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`wk-sb-item ${isActive(it.href) ? "is-active" : ""}`}
            data-wk-tip={it.label}
          >
            <span className="wk-sb-ic">
              <it.icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </span>
            <span className="wk-sb-lbl">{it.label}</span>
            {it.badge != null && <span className="wk-sb-badge">{it.badge}</span>}
          </Link>
        ))}

        <div className="wk-sb-divider" />

        <div className="wk-sb-section">Herramientas</div>
        {toolItems.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`wk-sb-item ${isActive(it.href) ? "is-active" : ""}`}
            data-wk-tip={it.label}
          >
            <span className="wk-sb-ic">
              <it.icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </span>
            <span className="wk-sb-lbl">{it.label}</span>
          </Link>
        ))}
      </nav>

      {/* Foot: profile */}
      <div className="wk-sb-foot">
        <Link
          href="/perfil"
          className={`wk-sb-profile ${isActive("/perfil") ? "is-active" : ""}`}
          data-wk-tip={firstName}
        >
          <span className="wk-sb-avatar">{initials || "W"}</span>
          <span className="wk-sb-profile-body">
            <span className="wk-sb-profile-name">{firstName}</span>
            <span className="wk-sb-profile-sub">Estudiante</span>
          </span>
          {!collapsed && (
            <ChevronRight
              className="w-4 h-4 shrink-0"
              strokeWidth={1.5}
              style={{ color: "var(--wk-ink-4)" }}
            />
          )}
        </Link>
      </div>
    </aside>
  );
}
