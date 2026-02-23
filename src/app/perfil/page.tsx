"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { useSubjects, useTasks } from "@/lib/hooks";
import { LogOut, User, Mail, BookOpen, CheckSquare, Clock, TrendingUp } from "lucide-react";

export default function PerfilPage() {
  const { user, signOut } = useAuth();
  const { subjects } = useSubjects();
  const { tasks } = useTasks();

  const stats = useMemo(() => {
    const completed = tasks.filter((t) => t.status === "completed").length;
    const pending = tasks.filter((t) => t.status !== "completed").length;
    return { subjects: subjects.length, completed, pending, total: tasks.length };
  }, [subjects, tasks]);

  const memberSince = useMemo(() => {
    if (!user?.metadata?.creationTime) return null;
    return new Date(user.metadata.creationTime).toLocaleDateString("es-CO", {
      month: "long",
      year: "numeric",
    });
  }, [user]);

  return (
    <AppShell>
      <div className="px-4 pt-safe page-enter">
        <h1 className="text-2xl font-bold mb-5">Perfil</h1>

        {/* User info */}
        <div className="p-4 rounded-xl bg-card border border-border mb-4">
          <div className="flex items-center gap-3.5">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-12 h-12 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[15px] truncate">
                {user?.displayName || "Usuario"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              {memberSince && (
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Miembro desde {memberSince}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Academic stats */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="p-3.5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Materias</span>
            </div>
            <p className="text-2xl font-bold">{stats.subjects}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <span className="text-xs text-muted-foreground">Completadas</span>
            </div>
            <p className="text-2xl font-bold">{stats.completed}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <span className="text-xs text-muted-foreground">Pendientes</span>
            </div>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
              </div>
              <span className="text-xs text-muted-foreground">Total tareas</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </div>

        {/* Completion rate */}
        {stats.total > 0 && (
          <div className="p-4 rounded-xl bg-card border border-border mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Tasa de completado</span>
              <span className="text-sm font-bold">
                {Math.round((stats.completed / stats.total) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(stats.completed / stats.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border text-destructive active:scale-[0.98] transition-transform"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Cerrar sesion</span>
        </button>

        <p className="text-center text-[10px] text-muted-foreground/40 mt-6 mb-4">
          Workia v1.0
        </p>
      </div>
    </AppShell>
  );
}
