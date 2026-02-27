"use client";

import { useAuth } from "@/lib/auth-context";
import { useTasks, useSubjects, useGrades, useSchedule } from "@/lib/hooks";
import { AppShell } from "@/components/app-shell";
import { MarkdownMath } from "@/components/ui/markdown-math";
import {
  CheckSquare, BookOpen, ChevronRight, Clock, AlertTriangle,
  GraduationCap, ScanLine, HelpCircle, Layers, CalendarDays, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { CorteGrades, SubjectGradeRecord } from "@/types";
import { CORTE_WEIGHTS, MIN_PASSING_GRADE } from "@/types";

// ── Grade helpers ──
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

const getDiffDays = (date: Date): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
};

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const QUICK_ACTIONS = [
  { href: "/escanear", icon: ScanLine, label: "Escanear", color: "text-violet-500", bg: "bg-violet-500/10" },
  { href: "/quiz", icon: HelpCircle, label: "Quiz", color: "text-blue-500", bg: "bg-blue-500/10" },
  { href: "/flashcards", icon: Layers, label: "Tarjetas", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { href: "/horario", icon: CalendarDays, label: "Horario", color: "text-amber-500", bg: "bg-amber-500/10" },
] as const;

export default function InicioPage() {
  const { user } = useAuth();
  const { tasks, loading: tasksLoading } = useTasks();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { grades, loading: gradesLoading } = useGrades();
  const { slots } = useSchedule();

  const now = new Date();
  const todayDow = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const todayLabel = `${DAYS_ES[todayDow]}, ${now.getDate()} de ${MONTHS_ES[now.getMonth()]}`;

  const gradeMap = useMemo(
    () => Object.fromEntries(grades.map((g) => [g.subjectId, g])),
    [grades]
  );

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const pendingTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "completed")
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 5),
    [tasks]
  );

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.status !== "completed" && getDiffDays(t.dueDate) < 0).length,
    [tasks]
  );

  const todayCount = useMemo(
    () => tasks.filter((t) => t.status !== "completed" && getDiffDays(t.dueDate) === 0).length,
    [tasks]
  );

  // Weekly task progress: completed tasks in the last 7 days vs total non-future tasks
  const weeklyProgress = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekTasks = tasks.filter((t) => t.dueDate >= weekAgo && t.dueDate <= now);
    const completed = weekTasks.filter((t) => t.status === "completed").length;
    return { completed, total: weekTasks.length };
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayClasses = useMemo(
    () =>
      slots
        .filter((s) => s.dayOfWeek === todayDow)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, todayDow]
  );

  const firstName = user?.displayName?.split(" ")[0] || "Estudiante";

  return (
    <AppShell>
      <div className="px-4 pt-safe pb-24 page-enter md:px-8 md:pt-8 md:ml-64">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ── Header ── */}
          <div className="mt-4 md:mt-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Hola, {firstName} 👋</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{todayLabel}</p>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-amber-500">
                <Clock className="w-4 h-4 shrink-0" />
                <span className="font-medium text-xs truncate">Para hoy</span>
              </div>
              <span className="text-3xl font-bold leading-none">{todayCount}</span>
              <span className="text-xs text-muted-foreground">tareas</span>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-red-500">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="font-medium text-xs truncate">Atrasadas</span>
              </div>
              <span className="text-3xl font-bold leading-none">{overdueCount}</span>
              <span className="text-xs text-muted-foreground">sin entregar</span>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-primary">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="font-medium text-xs truncate">Materias</span>
              </div>
              <span className="text-3xl font-bold leading-none">{subjects.length}</span>
              <span className="text-xs text-muted-foreground">inscritas</span>
            </div>
          </div>

          {/* ── Quick actions ── */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {QUICK_ACTIONS.map(({ href, icon: Icon, label, color, bg }) => (
              <Link
                key={href}
                href={href}
                className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-2 active:scale-[0.96] transition-transform hover:border-primary/40"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${bg}`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <span className="text-xs font-medium text-center leading-tight">{label}</span>
              </Link>
            ))}
          </div>

          {/* ── Main 2-col grid (desktop) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

            {/* LEFT column */}
            <div className="space-y-6">

              {/* Upcoming Tasks */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-primary" />
                    Próximas Tareas
                  </h2>
                  <Link href="/tareas" className="text-xs text-primary font-medium flex items-center gap-0.5">
                    Ver todas <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {tasksLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : pendingTasks.length > 0 ? (
                  <div className="space-y-2 stagger-children">
                    {pendingTasks.map((task) => {
                      const diffDays = getDiffDays(task.dueDate);
                      const isOverdue = diffDays < 0;
                      const isToday = diffDays === 0;
                      return (
                        <Link
                          key={task.id}
                          href="/tareas"
                          className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 active:scale-[0.98] transition-transform hover:border-primary/30"
                        >
                          <div
                            className={`w-1.5 self-stretch rounded-full shrink-0 ${
                              isOverdue ? "bg-red-500" : isToday ? "bg-amber-500" : "bg-primary/60"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1">
                              <MarkdownMath content={task.title} inline />
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {task.subjectName} · <span className="capitalize">{task.type}</span>
                            </p>
                          </div>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                              isOverdue
                                ? "bg-red-500/10 text-red-500"
                                : isToday
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {isOverdue ? "Atrasada" : isToday ? "Hoy" : `En ${diffDays}d`}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-card border border-border border-dashed rounded-xl p-6 text-center">
                    <CheckSquare className="w-8 h-8 text-primary mx-auto mb-2 opacity-60" />
                    <p className="font-medium text-sm">¡Todo al día!</p>
                    <p className="text-xs text-muted-foreground mt-1">No tienes tareas pendientes.</p>
                  </div>
                )}
              </section>

              {/* Weekly Progress */}
              <section>
                <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Progreso semanal
                </h2>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Tareas completadas</span>
                    <span className="text-sm font-semibold">
                      {weeklyProgress.completed}/{weeklyProgress.total}
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: weeklyProgress.total > 0
                          ? `${(weeklyProgress.completed / weeklyProgress.total) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {weeklyProgress.total === 0
                      ? "No tienes tareas esta semana."
                      : weeklyProgress.completed === weeklyProgress.total
                      ? "¡Completaste todas las tareas de la semana! 🎉"
                      : `Te faltan ${weeklyProgress.total - weeklyProgress.completed} tareas por completar.`}
                  </p>
                </div>
              </section>

            </div>

            {/* RIGHT column */}
            <div className="space-y-6">

              {/* Today's Classes */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    Clases de hoy
                  </h2>
                  <Link href="/horario" className="text-xs text-primary font-medium flex items-center gap-0.5">
                    Ver horario <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {todayClasses.length > 0 ? (
                  <div className="space-y-2 stagger-children">
                    {todayClasses.map((slot) => {
                      const subject = subjectMap[slot.subjectId];
                      if (!subject) return null;
                      return (
                        <div
                          key={slot.id}
                          className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3"
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                            style={{ backgroundColor: `${subject.color}20` }}
                          >
                            {subject.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{subject.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {slot.startTime} – {slot.endTime}
                              {slot.room ? ` · ${slot.room}` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-card border border-border border-dashed rounded-xl p-5 text-center">
                    <p className="text-sm text-muted-foreground">Sin clases programadas para hoy.</p>
                  </div>
                )}
              </section>

              {/* Subjects with grades */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    Notas
                  </h2>
                  <Link href="/notas" className="text-xs text-primary font-medium flex items-center gap-0.5">
                    Ver todas <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {gradesLoading || subjectsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : subjects.length === 0 ? (
                  <div className="bg-card border border-border border-dashed rounded-xl p-5 text-center">
                    <p className="text-sm text-muted-foreground">Agrega materias para ver tus notas.</p>
                  </div>
                ) : (
                  <div className="space-y-2 stagger-children">
                    {subjects.slice(0, 5).map((subject) => {
                      const rec = gradeMap[subject.id] as SubjectGradeRecord | undefined;
                      const { avg, canStillPass } = rec
                        ? calcCurrentAvg(rec.corte1, rec.corte2, rec.corte3)
                        : { avg: null, canStillPass: true };
                      const pct = avg !== null ? (avg / 5) * 100 : 0;
                      return (
                        <Link
                          key={subject.id}
                          href="/notas"
                          className="block bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 active:scale-[0.99] transition-all"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{subject.emoji}</span>
                              <p className="font-medium text-sm truncate">{subject.name}</p>
                            </div>
                            <span
                              className={`text-sm font-bold shrink-0 ml-2 ${
                                avg === null
                                  ? "text-muted-foreground"
                                  : canStillPass
                                  ? "text-emerald-500"
                                  : "text-red-500"
                              }`}
                            >
                              {avg !== null ? avg.toFixed(2) : "—"}
                            </span>
                          </div>
                          {avg !== null && (
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${canStillPass ? "bg-emerald-500" : "bg-red-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
