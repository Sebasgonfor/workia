"use client";

import { useAuth } from "@/lib/auth-context";
import { useTasks, useSubjects, useGrades } from "@/lib/hooks";
import { AppShell } from "@/components/app-shell";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { CheckSquare, BookOpen, ChevronRight, Clock, AlertTriangle, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { CorteGrades, SubjectGradeRecord } from "@/types";
import { CORTE_WEIGHTS, MIN_PASSING_GRADE } from "@/types";

// ── Grade helpers (mirror from notas/page) ──
const calcCorteGrade = (c: CorteGrades): number =>
  (c.formativa1 ?? 0) * 0.25 + (c.formativa2 ?? 0) * 0.25 + (c.parcial ?? 0) * 0.5;

const isCorteComplete = (c: CorteGrades) =>
  c.formativa1 !== null && c.formativa2 !== null && c.parcial !== null;

const calcCurrentAvg = (c1: CorteGrades, c2: CorteGrades, c3: CorteGrades): { avg: number | null; canStillPass: boolean } => {
  const cortes = [c1, c2, c3];
  let accumulated = 0;
  let completedWeight = 0;
  cortes.forEach((c, i) => {
    if (isCorteComplete(c)) {
      accumulated += calcCorteGrade(c) * CORTE_WEIGHTS[i];
      completedWeight += CORTE_WEIGHTS[i];
    }
  });
  if (completedWeight === 0) return { avg: null, canStillPass: true };
  const remainingWeight = 1 - completedWeight;
  const minNeeded = remainingWeight > 0 ? (MIN_PASSING_GRADE - accumulated) / remainingWeight : null;
  const canStillPass = minNeeded === null ? accumulated >= MIN_PASSING_GRADE : minNeeded <= 5.0;
  return { avg: accumulated / completedWeight, canStillPass };
};

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
  const { grades, loading: gradesLoading } = useGrades();

  const gradeMap = useMemo(
    () => Object.fromEntries(grades.map((g) => [g.subjectId, g])),
    [grades]
  );

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
                      <h3 className="font-medium line-clamp-1"><MarkdownMath content={task.title} inline /></h3>
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

        {/* Notes Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Notas
            </h2>
            <Link href="/notas" className="text-sm text-primary font-medium flex items-center">
              Ver todas <ChevronRight className="w-4 h-4 ml-0.5" />
            </Link>
          </div>

          {gradesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <div className="bg-card border border-border border-dashed rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Agrega materias para registrar tus notas.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {subjects.slice(0, 4).map((subject) => {
                const rec = gradeMap[subject.id] as SubjectGradeRecord | undefined;
                const { avg, canStillPass } = rec
                  ? calcCurrentAvg(rec.corte1, rec.corte2, rec.corte3)
                  : { avg: null, canStillPass: true };
                return (
                  <Link
                    key={subject.id}
                    href="/notas"
                    className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl shrink-0">{subject.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{subject.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {avg !== null ? `Promedio: ${avg.toFixed(2)}` : "Sin notas"}
                        </p>
                      </div>
                    </div>
                    {avg !== null && (
                      <span
                        className={`text-xs font-semibold shrink-0 ml-2 ${
                          canStillPass ? "text-emerald-500" : "text-red-500"
                        }`}
                      >
                        {avg.toFixed(2)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
