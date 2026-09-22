"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const STORAGE_PREFIX = "workia-password-nudge:";
// After "Más tarde" the nudge comes back a week later, until a password exists.
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export const PASSWORD_SETUP_HREF = "/perfil?crear-contrasena=1";

/** Small floating card that invites Google-only accounts to create a
 *  password, so they can sign in with email on other devices. */
export function PasswordNudge() {
  const { user, hasGoogle, hasPassword } = useAuth();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  const eligible = !!user?.email && hasGoogle && !hasPassword && pathname !== "/perfil";
  const storageKey = user ? STORAGE_PREFIX + user.uid : "";

  useEffect(() => {
    if (!eligible) {
      setVisible(false);
      return;
    }
    let snoozedAt = 0;
    try {
      snoozedAt = Number(localStorage.getItem(storageKey)) || 0;
    } catch {}
    if (Date.now() - snoozedAt < SNOOZE_MS) return;
    // Let the screen settle before showing it.
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [eligible, storageKey]);

  if (!visible) return null;

  const snooze = () => {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, String(Date.now()));
    } catch {}
  };

  return (
    <div
      role="status"
      className="fixed z-40 left-3 right-3 mx-auto max-w-sm bottom-[calc(env(safe-area-inset-bottom)+6rem)] md:left-auto md:right-5 md:bottom-5 md:mx-0 md:w-[340px] animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="relative flex items-start gap-3 p-3.5 pr-10 rounded-2xl bg-card border border-border shadow-xl">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <KeyRound className="w-[18px] h-[18px] text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Crea tu contraseña</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Así podrás entrar desde otro dispositivo con tu correo, sin usar tu cuenta de Google.
          </p>
          <div className="flex items-center gap-3 mt-2.5">
            <Link
              href={PASSWORD_SETUP_HREF}
              onClick={() => setVisible(false)}
              className="inline-flex items-center h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              Crear ahora
            </Link>
            <button onClick={snooze} className="text-xs text-muted-foreground hover:text-foreground">
              Más tarde
            </button>
          </div>
        </div>
        <button
          onClick={snooze}
          aria-label="Cerrar"
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
