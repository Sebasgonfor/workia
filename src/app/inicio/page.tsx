"use client";

import { useAuth } from "@/lib/auth-context";
import { useTasks, useSubjects } from "@/lib/hooks";
import { AppShell } from "@/components/app-shell";
import { CheckSquare, BookOpen, TrendingUp, ChevronRight, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

function getDiffDays(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export default function InicioPage() {
  const { user } = useAuth();
  const { tasks, loading: tasksLoading } = useTasks();
  const { subjects, loading: subjectsLoading } = useSubjects();

  const pendingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "completed")
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 3); // Show only top 3 pending tasks
  }, [tasks]);

  const overdueCount = useMemo(() => {
    return tasks.filter((t) => t.status !== "completed" && getDiffDays(t.dueDate) < 0).length;
  }, [tasks]);

  const todayCount = useMemo(() => {
    return tasks.filter((t) => t.status !== "completed" && getDiffDays(t.dueDate) === 0).length;
  }, [tasks]);

  const firstName = user?.displayName?.split(" ")[0] || "Estudiante";

  return (
    <AppShell>
      <div className="px-4 pt-safe pb-24 page-enter space-y-8">
        {/* Header */}
        <div className="mt-4">
          <h1 className="text-3xl font-bold tracking-tight">Hola, {firstName} 👋</h1>
          <p className="text-muted-foreground mt-1">
            Aquí tienes un resumen de tu día.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <Clock className="w-5 h-5" />
              <span className="font-medium text-sm">Para hoy</span>
            </div>
            <span className="text-3xl font-bold">{todayCount}</span>
            <span className="text-xs text-muted-foreground mt-1">Tareas pendientes</span>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col">
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium text-sm">Atrasadas</span>
            </div>
            <span className="text-3xl font-bold">{overdueCount}</span>
            <span className="text-xs text-muted-foreground mt-1">Requieren atención</span>
          </div>
        </div>

        {/* Pending Tasks */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              Próximas Tareas
            </h2>
            <Link href="/tareas" className="text-sm text-primary font-medium flex items-center">
              Ver todas <ChevronRight className="w-4 h-4 ml-0.5" />
            </Link>
          </div>

          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : pendingTasks.length > 0 ? (
            <div className="space-y-3">
              {pendingTasks.map((task) => {
                const diffDays = getDiffDays(task.dueDate);
                const isOverdue = diffDays < 0;
                const isToday = diffDays === 0;
                
                return (
                  <Link
                    key={task.id}
                    href="/tareas"
                    className="block bg-card border border-border rounded-xl p-4 active:scale-[0.98] transition-transform"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium line-clamp-1">{task.title}</h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${
                          isOverdue
                            ? "bg-red-500/10 text-red-500"
                            : isToday
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {isOverdue
                          ? "Atrasada"
                          : isToday
                          ? "Hoy"
                          : `En ${diffDays}d`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="truncate">{task.subjectName}</span>
                      <span>•</span>
                      <span className="capitalize">{task.type}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border border-dashed rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="w-6 h-6 text-primary" />
              </div>
              <p className="font-medium">¡Todo al día!</p>
              <p className="text-sm text-muted-foreground mt-1">
                No tienes tareas pendientes próximas.
              </p>
            </div>
          )}
        </section>

        {/* Subjects */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Tus Materias
            </h2>
            <Link href="/materias" className="text-sm text-primary font-medium flex items-center">
              Ver todas <ChevronRight className="w-4 h-4 ml-0.5" />
            </Link>
          </div>

          {subjectsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : subjects.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {subjects.slice(0, 4).map((subject) => (
                <Link
                  key={subject.id}
                  href={`/materias/${subject.id}`}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center text-center active:scale-[0.98] transition-transform"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl mb-2"
                    style={{ backgroundColor: `${subject.color}20` }}
                  >
                    {subject.emoji}
                  </div>
                  <span className="font-medium text-sm line-clamp-2">
                    {subject.name}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border border-dashed rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Aún no has agregado materias.
              </p>
              <Link
                href="/materias"
                className="inline-block mt-3 text-sm font-medium text-primary"
              >
                Agregar materia
              </Link>
            </div>
          )}
        </section>

        {/* Grades Placeholder */}
        <section>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            Rendimiento
          </h2>
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6 text-center relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
            <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Próximamente: Notas</h3>
              <p className="text-sm text-muted-foreground">
                Muy pronto podrás llevar el control de tus calificaciones y calcular promedios automáticamente.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
