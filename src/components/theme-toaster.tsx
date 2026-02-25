"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme-context";

// Renders Sonner's Toaster with the active app theme so toasts
// always match light/dark mode, even when the user toggles manually.
export function ThemeToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-center"
      offset={80}
      theme={theme}
      toastOptions={{
        style:
          theme === "dark"
            ? {
                background: "hsl(0 0% 10%)",
                border: "1px solid hsl(0 0% 18%)",
                color: "hsl(0 0% 98%)",
              }
            : {
                background: "hsl(0 0% 100%)",
                border: "1px solid hsl(0 0% 86%)",
                color: "hsl(0 0% 9%)",
              },
      }}
    />
  );
}
