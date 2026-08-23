"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlarmClock,
  BookOpen,
  Brain,
  CheckSquare,
  ChevronRight,
  Clock,
  Flame,
  GraduationCap,
  HelpCircle,
  Pin,
  Plus,
  Play,
  Sparkles,
  Timer,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import {
  useTasks,
  useSubjects,
  useGrades,
  useSchedule,
} from "@/lib/hooks";
import { AppShell } from "@/components/app-shell";
import { MarkdownMath } from "@/components/ui/markdown-math";
import {
  CORTE_WEIGHTS,
  MIN_PASSING_GRADE,
  type CorteGrades,
  type SubjectGradeRecord,
  type Task,
} from "@/types";

/* ────────────────────────── helpers ────────────────────────── */

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const diffDays = (date: Date) => {
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(date).getTime();
  return Math.round((target - today) / 86_400_000);
};

const formatDue = (date: Date) => {
  const d = diffDays(date);
  if (d < 0) return `Hace ${Math.abs(d)}d`;
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  return `${DAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_ES[date.getMonth()]}`;
};

const calcCorteGrade = (c: CorteGrades) =>
  (c.formativa1 ?? 0) * 0.25 + (c.formativa2 ?? 0) * 0.25 + (c.parcial ?? 0) * 0.5;

const isCorteComplete = (c: CorteGrades) =>
  c.formativa1 !== null && c.formativa2 !== null && c.parcial !== null;

const calcCurrentAvg = (
  rec: SubjectGradeRecord | undefined,
): { avg: number | null; canPass: boolean; completedWeight: number } => {
  if (!rec) return { avg: null, canPass: true, completedWeight: 0 };
  const cortes = [rec.corte1, rec.corte2, rec.corte3];
  let accumulated = 0;
  let completedWeight = 0;
  cortes.forEach((c, i) => {
    if (isCorteComplete(c)) {
      accumulated += calcCorteGrade(c) * CORTE_WEIGHTS[i];
      completedWeight += CORTE_WEIGHTS[i];
    }
  });
  if (completedWeight === 0) return { avg: null, canPass: true, completedWeight: 0 };
  return {
    avg: accumulated / completedWeight,
    canPass: accumulated >= MIN_PASSING_GRADE * completedWeight,
    completedWeight,
  };
};

/** Derive --c / --c-soft / --c-ink from a subject hex color. */
const subjectColorVars = (hex: string): React.CSSProperties =>
  ({
    "--c": hex,
    "--c-soft": `${hex}22`,
    "--c-ink": hex,
  }) as React.CSSProperties;

/** Streak: consecutive days (going back from today) with ≥1 completed task. */
const computeStreak = (tasks: Task[]): number => {
  const completedDays = new Set(
    tasks
      .filter((t) => t.status === "completed")
      .map((t) => startOfDay(t.dueDate).getTime()),
  );
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - i);
    if (completedDays.has(d.getTime())) streak++;
    else if (i > 0) break; // first day (today) may not have completions; allow
  }
  return streak;
};

/** Per-day activity level 0-4 over the last 14 weeks, bucketed by week × weekday. */
const computeHeatmap = (tasks: Task[], weeks = 14): number[][] => {
  const totalDays = weeks * 7;
  const counts: number[] = Array(totalDays).fill(0);
  const today = startOfDay(new Date());

  for (const t of tasks) {
    if (t.status !== "completed") continue;
    const delta = Math.floor((today.getTime() - startOfDay(t.dueDate).getTime()) / 86_400_000);
    if (delta < 0 || delta >= totalDays) continue;
    counts[totalDays - 1 - delta]++;
  }

  const out: number[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: number[] = [];
    for (let d = 0; d < 7; d++) {
      const c = counts[w * 7 + d] ?? 0;
      let level = 0;
      if (c >= 1) level = 1;
      if (c >= 2) level = 2;
      if (c >= 4) level = 3;
      if (c >= 6) level = 4;
      week.push(level);
    }
    out.push(week);
  }
  return out;
};

type CoachSuggestion = {
  id: string;
  icon: typeof Brain;
  title: string;
  reason: string;
  cta: string;
  href: string;
};

const buildCoachSuggestions = (
  tasks: Task[],
  upcomingExams: Task[],
  lowSubject: { name: string; avg: number } | null,
): CoachSuggestion[] => {
  const suggestions: CoachSuggestion[] = [];
  const overdue = tasks.filter((t) => t.status !== "completed" && diffDays(t.dueDate) < 0);

  if (overdue.length > 0) {
    suggestions.push({
      id: "overdue",
      icon: AlarmClock,
      title: `Ponte al día: ${overdue.length} ${overdue.length === 1 ? "tarea atrasada" : "tareas atrasadas"}`,
      reason: "Cerrar lo atrasado libera la mente para lo que viene esta semana.",
      cta: "Revisar",
      href: "/tareas",
    });
  }

  if (upcomingExams[0]) {
    const e = upcomingExams[0];
    const d = diffDays(e.dueDate);
    suggestions.push({
      id: "exam",
      icon: Brain,
      title: `Repasa para ${e.subjectName}`,
      reason: `Tu próximo parcial es en ${d <= 0 ? "muy poco" : `${d} ${d === 1 ? "día" : "días"}`}. 20 minutos hoy suman mucho.`,
      cta: "Empezar",
      href: "/flashcards",
    });
  }

  if (lowSubject) {
    suggestions.push({
      id: "low",
      icon: HelpCircle,
      title: `Refuerza ${lowSubject.name}`,
      reason: `Tu promedio va en ${lowSubject.avg.toFixed(2)} — un quiz rápido puede detectar los puntos débiles.`,
      cta: "Quiz",
      href: "/quiz",
    });
  }

  if (suggestions.length < 3) {
    suggestions.push({
      id: "pomodoro",
      icon: Timer,
      title: "Sesión de 25 minutos enfocado",
      reason: "Un pomodoro basta para romper la inercia. Elige una tarea y empieza.",
      cta: "25 min",
      href: "/tareas",
    });
  }

  return suggestions.slice(0, 3);
};

/* ────────────────────────── Primitives ────────────────────────── */

function Ring({
  value,
  size = 40,
  stroke = 3.5,
  color,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <div className="wk-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--wk-line)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .8s ease" }}
        />
      </svg>
      <div className="wk-ring-center">{children}</div>
    </div>
  );
}

function Sparkline({
  data,
  color,
  width = 80,
  height = 28,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height * 0.9 - height * 0.05;
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const fill = `${d} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} className="wk-sparkline">
      <path d={fill} fill={color} opacity="0.08" />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CoursePill({ name, hex }: { name: string; hex: string }) {
  return (
    <span className="wk-cpill" style={subjectColorVars(hex)}>
      <span className="wk-cpill-dot" />
      {name}
    </span>
  );
}

/* ────────────────────────── Page ────────────────────────── */

type TaskFilter = "todas" | "semana" | "hoy";

export default function InicioPage() {
  const { user } = useAuth();
  const { tasks, loading: tasksLoading } = useTasks();
  const { subjects, loading: subjectsLoading } = useSubjects();
  const { grades, loading: gradesLoading } = useGrades();
  useSchedule(); // kept for parity with prior page; schedule not used in V1 layout

  const [filter, setFilter] = useState<TaskFilter>("todas");

  const firstName = user?.displayName?.split(" ")[0] || "Estudiante";
  const now = new Date();
  const todayDow = now.getDay();
  const todayLabel = `${DAYS_ES[todayDow]}, ${now.getDate()} de ${MONTHS_ES[now.getMonth()]}`;

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s.id, s])),
    [subjects],
  );
  const gradeMap = useMemo(
    () => Object.fromEntries(grades.map((g) => [g.subjectId, g])),
    [grades],
  );

  const pendingTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "completed")
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    [tasks],
  );

  const urgent = pendingTasks[0];
  const urgentSubject = urgent ? subjectMap[urgent.subjectId] : undefined;
  const urgentHex = urgentSubject?.color || "#6366f1";

  const filteredTasks = useMemo(() => {
    const base = pendingTasks.slice(urgent ? 1 : 0);
    if (filter === "hoy") return base.filter((t) => diffDays(t.dueDate) <= 0).slice(0, 5);
    if (filter === "semana") return base.filter((t) => diffDays(t.dueDate) <= 7).slice(0, 5);
    return base.slice(0, 5);
  }, [pendingTasks, filter, urgent]);

  /* Streak + heatmap from completed tasks */
  const streak = useMemo(() => computeStreak(tasks), [tasks]);
  const heatmap = useMemo(() => computeHeatmap(tasks), [tasks]);
  const completedTotal = useMemo(
    () => tasks.filter((t) => t.status === "completed").length,
    [tasks],
  );

  /* KPI: Promedio actual across subjects, weighted by completed weight */
  const promedio = useMemo(() => {
    let weighted = 0;
    let totalW = 0;
    for (const s of subjects) {
      const { avg, completedWeight } = calcCurrentAvg(gradeMap[s.id] as SubjectGradeRecord | undefined);
      if (avg !== null) {
        weighted += avg * completedWeight;
        totalW += completedWeight;
      }
    }
    return totalW > 0 ? weighted / totalW : null;
  }, [subjects, gradeMap]);

  /* KPI: tareas esta semana */
  const weekTaskCount = useMemo(
    () => pendingTasks.filter((t) => diffDays(t.dueDate) <= 7).length,
    [pendingTasks],
  );
  const todayTaskCount = useMemo(
    () => pendingTasks.filter((t) => diffDays(t.dueDate) === 0).length,
    [pendingTasks],
  );
  const highPrioWeek = useMemo(
    () => pendingTasks.filter((t) => diffDays(t.dueDate) <= 7 && t.priority === "high").length,
    [pendingTasks],
  );

  /* Próximos parciales (task.type === "parcial") */
  const upcomingExams = useMemo(
    () =>
      pendingTasks
        .filter((t) => t.type === "parcial")
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .slice(0, 4),
    [pendingTasks],
  );

  /* Lowest-grade subject (for coach suggestion) */
  const lowSubject = useMemo(() => {
    let worst: { name: string; avg: number } | null = null;
    for (const s of subjects) {
      const { avg } = calcCurrentAvg(gradeMap[s.id] as SubjectGradeRecord | undefined);
      if (avg !== null && (worst === null || avg < worst.avg)) {
        worst = { name: s.name, avg };
      }
    }
    return worst && worst.avg < 3.5 ? worst : null;
  }, [subjects, gradeMap]);

  const suggestions = useMemo(
    () => buildCoachSuggestions(tasks, upcomingExams, lowSubject),
    [tasks, upcomingExams, lowSubject],
  );

  /* Urgent progress heuristic */
  const urgentProgress = urgent?.status === "in_progress" ? 0.5 : 0;

  return (
    <AppShell>
      <div className="wk-page">
        {/* Topbar */}
        <div className="wk-topbar hidden md:flex">
          <span className="wk-topbar-title">Inicio</span>
          <span className="wk-topbar-crumb">· Panel</span>
          <span className="wk-topbar-spacer" />
          <Link href="/tareas" className="wk-topbar-btn is-primary">
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Nueva tarea</span>
          </Link>
        </div>

        <div className="v1 page-enter">
          {/* HERO */}
          <section className="v1-hero">
            <div className="v1-hero-left">
              <div className="v1-greet">
                <h1>Hola, {firstName}.</h1>
                <p className="v1-greet-sub">{todayLabel}</p>
              </div>

              {urgent && urgentSubject ? (
                <div className="v1-urgent" style={subjectColorVars(urgentHex)}>
                  <div className="v1-urgent-flag">
                    <span className="v1-urgent-pulse" />
                    Tarea más urgente
                  </div>
                  <div className="v1-urgent-title">
                    <MarkdownMath content={urgent.title} inline />
                  </div>
                  <div className="v1-urgent-meta">
                    <CoursePill name={urgentSubject.name} hex={urgentHex} />
                    <span className="v1-sep">·</span>
                    <span className="v1-urgent-due">
                      <Clock className="w-[13px] h-[13px]" strokeWidth={1.5} />
                      {formatDue(urgent.dueDate)}
                    </span>
                    <span className="v1-sep">·</span>
                    <span style={{ textTransform: "capitalize" }}>{urgent.type}</span>
                  </div>
                  <div className="v1-urgent-progress">
                    <div className="v1-urgent-bar">
                      <div
                        className="v1-urgent-fill"
                        style={{ width: `${Math.round(urgentProgress * 100)}%` }}
                      />
                    </div>
                    <span>
                      {urgentProgress > 0 ? `${Math.round(urgentProgress * 100)}% en curso` : "Aún sin empezar"}
                    </span>
                  </div>
                  <div className="v1-urgent-actions">
                    <Link href="/tareas" className="v1-btn-primary">
                      <Play className="w-3 h-3" strokeWidth={1.5} />
                      <span>Continuar ahora</span>
                    </Link>
                    <Link href="/tareas" className="v1-btn-ghost">
                      Ver detalle
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="v1-urgent" style={subjectColorVars("#10b981")}>
                  <div className="v1-urgent-flag">
                    <span className="v1-urgent-pulse" />
                    Nada urgente ahora
                  </div>
                  <div className="v1-urgent-title">Todo al día. Aprovecha para repasar.</div>
                  <div className="v1-urgent-meta">
                    Buen momento para flashcards o un resumen corto.
                  </div>
                  <div className="v1-urgent-actions">
                    <Link href="/flashcards" className="v1-btn-primary">
                      <Play className="w-3 h-3" strokeWidth={1.5} />
                      <span>Estudiar tarjetas</span>
                    </Link>
                    <Link href="/quiz" className="v1-btn-ghost">
                      Hacer un quiz
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Streak */}
            <div className="v1-hero-side">
              <div className="v1-streak">
                <div className="v1-streak-top">
                  <span className="v1-streak-icon">
                    <Flame className="w-[22px] h-[22px]" strokeWidth={1.5} />
                  </span>
                  <div>
                    <div className="v1-streak-num">{streak}</div>
                    <div className="v1-streak-lbl">
                      {streak === 1 ? "día de racha" : "días de racha"}
                    </div>
                  </div>
                </div>
                <div className="v1-streak-days">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => {
                    // Map Mon-Sun → dayOfWeek (1..6,0). Today index:
                    const dow = (i + 1) % 7;
                    const isToday = dow === todayDow;
                    const passed = isToday ? false : (() => {
                      const todayIdx = todayDow === 0 ? 6 : todayDow - 1;
                      return i < todayIdx;
                    })();
                    return (
                      <div
                        key={i}
                        className={`v1-streak-day ${isToday ? "is-today" : passed ? "is-done" : ""}`}
                      >
                        <span>{d}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* KPIs */}
          <section className="v1-kpis">
            <div className="v1-kpi">
              <div className="v1-kpi-head">
                <span className="v1-kpi-ic">
                  <GraduationCap className="w-[14px] h-[14px]" strokeWidth={1.5} />
                </span>
                <span>Promedio actual</span>
              </div>
              <div className="v1-kpi-body">
                <div className="v1-kpi-val">{promedio !== null ? promedio.toFixed(2) : "—"}</div>
                {promedio !== null && (
                  <Sparkline
                    data={[promedio - 0.3, promedio - 0.2, promedio - 0.15, promedio - 0.05, promedio]}
                    color="var(--wk-brand)"
                  />
                )}
              </div>
              <div className="v1-kpi-foot">
                <span className="v1-kpi-sub">
                  {promedio === null
                    ? "Aún sin notas registradas"
                    : promedio >= MIN_PASSING_GRADE
                      ? "Por encima del mínimo"
                      : "Por debajo del mínimo — atención"}
                </span>
              </div>
            </div>

            <div className="v1-kpi">
              <div className="v1-kpi-head">
                <span className="v1-kpi-ic">
                  <CheckSquare className="w-[14px] h-[14px]" strokeWidth={1.5} />
                </span>
                <span>Tareas esta semana</span>
                {todayTaskCount > 0 && (
                  <span className="v1-kpi-badge" style={subjectColorVars("#f59e0b")}>
                    {todayTaskCount} {todayTaskCount === 1 ? "hoy" : "hoy"}
                  </span>
                )}
              </div>
              <div className="v1-kpi-body">
                <div className="v1-kpi-val">{weekTaskCount}</div>
              </div>
              <div className="v1-kpi-foot">
                <span className="v1-kpi-sub">
                  {highPrioWeek > 0 ? `${highPrioWeek} de alta prioridad` : "Sin tareas críticas"}
                </span>
              </div>
            </div>
          </section>

          {/* GRID */}
          <div className="v1-grid">
            {/* Próximas tareas */}
            <section className="wk-card v1-tasks">
              <div className="wk-card-head">
                <span className="wk-card-title-ic">
                  <CheckSquare />
                </span>
                <span className="wk-card-title">Próximas tareas</span>
                <div className="v1-tab-bar">
                  {(["todas", "semana", "hoy"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={filter === f ? "is-active" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f === "todas" ? "Todas" : f === "semana" ? "Esta semana" : "Hoy"}
                    </button>
                  ))}
                </div>
                <Link href="/tareas" className="wk-card-link">
                  Ver todas <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                </Link>
              </div>
              <div className="v1-task-list">
                {tasksLoading ? (
                  <div className="v1-empty">Cargando…</div>
                ) : filteredTasks.length === 0 ? (
                  <div className="v1-empty">No hay tareas en esta vista.</div>
                ) : (
                  filteredTasks.map((t) => {
                    const subj = subjectMap[t.subjectId];
                    const hex = subj?.color || "#6366f1";
                    const soon = diffDays(t.dueDate) <= 1;
                    return (
                      <Link
                        key={t.id}
                        href="/tareas"
                        className="v1-task"
                        style={subjectColorVars(hex)}
                      >
                        <button
                          type="button"
                          className="v1-task-check"
                          aria-label="Marcar como hecha"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        />
                        <div className="v1-task-main">
                          <div className="v1-task-title">
                            <MarkdownMath content={t.title} inline />
                          </div>
                          <div className="v1-task-meta">
                            <CoursePill name={subj?.name || t.subjectName} hex={hex} />
                            <span className="v1-task-type">{t.type}</span>
                          </div>
                        </div>
                        <div className="v1-task-side">
                          <div className={`v1-task-due ${soon ? "is-soon" : ""}`}>
                            {formatDue(t.dueDate)}
                          </div>
                          <div className={`v1-task-prio prio-${t.priority}`}>
                            {t.priority === "high" ? "Alta" : t.priority === "medium" ? "Media" : "Baja"}
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </section>

            {/* Coach */}
            <section className="wk-card v1-coach">
              <div className="wk-card-head">
                <span className="wk-card-title-ic" style={{ color: "var(--wk-brand)" }}>
                  <Sparkles />
                </span>
                <span className="wk-card-title">Para ti, hoy</span>
                <span className="v1-coach-badge">
                  {suggestions.length} {suggestions.length === 1 ? "sugerencia" : "sugerencias"}
                </span>
              </div>
              <div className="v1-coach-list">
                {suggestions.map((s) => (
                  <Link key={s.id} href={s.href} className="v1-coach-card">
                    <span className="v1-coach-ic">
                      <s.icon className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                    <div className="v1-coach-body">
                      <div className="v1-coach-title">{s.title}</div>
                      <div className="v1-coach-reason">{s.reason}</div>
                    </div>
                    <span className="v1-coach-cta">
                      {s.cta}
                      <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Mis materias */}
            <section className="wk-card v1-courses">
              <div className="wk-card-head">
                <span className="wk-card-title-ic">
                  <BookOpen />
                </span>
                <span className="wk-card-title">Mis materias</span>
                <Link href="/materias" className="wk-card-link">
                  Ver todas <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                </Link>
              </div>
              <div className="v1-course-list">
                {subjectsLoading ? (
                  <div className="v1-empty">Cargando…</div>
                ) : subjects.length === 0 ? (
                  <div className="v1-empty">Aún no has agregado materias.</div>
                ) : (
                  subjects.slice(0, 6).map((s) => {
                    const { avg, canPass } = calcCurrentAvg(
                      gradeMap[s.id] as SubjectGradeRecord | undefined,
                    );
                    const status =
                      avg === null ? "is-pending" : canPass ? "is-pass" : "is-fail";
                    return (
                      <Link
                        key={s.id}
                        href="/materias"
                        className="v1-course-row"
                        style={subjectColorVars(s.color)}
                      >
                        <div className="v1-course-icon">{s.emoji}</div>
                        <div className="v1-course-main">
                          <div className="v1-course-name">{s.name}</div>
                          <div className="v1-course-meta">
                            {avg === null ? "Sin notas aún" : `Promedio ${avg.toFixed(2)}`}
                          </div>
                        </div>
                        <div className="v1-course-grade">
                          <div className={`v1-course-num ${status}`}>
                            {avg !== null ? avg.toFixed(2) : "—"}
                          </div>
                          <div className="v1-course-sub">/ 5.0</div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </section>

            {/* Próximos parciales */}
            <section className="wk-card v1-exams">
              <div className="wk-card-head">
                <span className="wk-card-title-ic">
                  <Pin />
                </span>
                <span className="wk-card-title">Próximos parciales</span>
                <Link href="/parcial" className="wk-card-link">
                  Plan de estudio <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                </Link>
              </div>
              <div className="v1-exam-list">
                {upcomingExams.length === 0 ? (
                  <div className="v1-empty">Sin parciales en el horizonte.</div>
                ) : (
                  upcomingExams.map((e) => {
                    const subj = subjectMap[e.subjectId];
                    const hex = subj?.color || "#6366f1";
                    const days = Math.max(0, diffDays(e.dueDate));
                    const { avg } = calcCurrentAvg(
                      gradeMap[e.subjectId] as SubjectGradeRecord | undefined,
                    );
                    const readiness = avg !== null ? Math.min(1, avg / 5) : 0.3;
                    return (
                      <Link
                        key={e.id}
                        href="/parcial"
                        className="v1-exam"
                        style={subjectColorVars(hex)}
                      >
                        <div className="v1-exam-date">
                          <div className="v1-exam-days">{days}</div>
                          <div className="v1-exam-lbl">{days === 1 ? "día" : "días"}</div>
                        </div>
                        <div className="v1-exam-main">
                          <div className="v1-exam-course">{subj?.name || e.subjectName}</div>
                          <div className="v1-exam-meta">
                            {formatDue(e.dueDate)} · parcial
                          </div>
                        </div>
                        <div className="v1-exam-ready">
                          <Ring value={readiness} size={40} stroke={3.5} color={hex}>
                            {Math.round(readiness * 100)}
                          </Ring>
                          <span className="v1-exam-ready-lbl">listo</span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </section>

            {/* Activity heatmap */}
            <section className="wk-card v1-activity">
              <div className="wk-card-head">
                <span className="wk-card-title-ic">
                  <TrendingUp />
                </span>
                <span className="wk-card-title">Tu actividad · últimas 14 semanas</span>
                <span className="v1-activity-sub">
                  {completedTotal} {completedTotal === 1 ? "tarea completada" : "tareas completadas"}
                </span>
              </div>
              <div className="v1-activity-body">
                <div className="v1-activity-labels">
                  <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
                </div>
                <div className="v1-activity-grid">
                  {heatmap.map((week, w) => (
                    <div key={w} className="v1-activity-week">
                      {week.map((v, d) => (
                        <div
                          key={d}
                          className={`v1-activity-cell l-${v}`}
                          title={`Semana ${w + 1} · ${v} tareas`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="v1-activity-legend" style={{ padding: "0 16px 14px" }}>
                <span>Menos</span>
                {[0, 1, 2, 3, 4].map((l) => (
                  <div key={l} className={`v1-activity-cell l-${l}`} />
                ))}
                <span>Más</span>
              </div>
            </section>
          </div>

          {/* Hide the loading state marker — grades-specific loading handled above */}
          {gradesLoading && null}
        </div>
      </div>
    </AppShell>
  );
}
