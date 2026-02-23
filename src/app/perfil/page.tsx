"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { LogOut, User, Mail } from "lucide-react";

export default function PerfilPage() {
  const { user, signOut } = useAuth();

  return (
    <AppShell>
      <div className="px-5 pt-safe page-enter">
        <h1 className="text-2xl font-bold mb-6">Perfil</h1>

        {/* User info */}
        <div className="p-5 rounded-xl bg-card border border-border mb-6">
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-14 h-14 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-7 h-7 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-lg truncate">
                {user?.displayName || "Usuario"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-border text-destructive active:scale-[0.98] transition-transform"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Cerrar sesión</span>
        </button>
      </div>
    </AppShell>
  );
}
