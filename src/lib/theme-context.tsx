"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { flushSync } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  /** Pass the click event so the new theme grows out of the button. */
  toggleTheme: (e?: { currentTarget?: EventTarget | null }) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "workia-theme";

const applyTheme = (t: Theme) => {
  if (t === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

const getInitialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "dark";
  }
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with "dark" to match the SSR anti-FOUC default; hydrated on mount
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggleTheme = (e?: { currentTarget?: EventTarget | null }) => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const commit = () => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage errors (private browsing, etc.)
      }
      applyTheme(next);
      flushSync(() => setTheme(next));
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commit();
      return;
    }

    // The new theme grows as a circle out of the toggle (or the screen center).
    const el = e?.currentTarget instanceof Element ? e.currentTarget : null;
    const rect = el?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    if (!document.startViewTransition) {
      // No View Transitions: cross-fade colors instead of snapping.
      const root = document.documentElement;
      root.classList.add("wk-theme-fade");
      commit();
      window.setTimeout(() => root.classList.remove("wk-theme-fade"), 500);
      return;
    }

    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    document.startViewTransition(commit).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(.45,0,.2,1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useTheme = () => useContext(ThemeContext);
