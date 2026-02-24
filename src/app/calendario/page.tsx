"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useSchedule, useSubjects, useTasks } from "@/lib/hooks";
import { SCHEDULE_HOURS } from "@/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { format, startOfWeek, addDays, addWeeks, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";

const HOUR_HEIGHT = 56;
const TIME_COL_W = 40;
const DAY_COL_W = 76;
const GRID_START = 6;
const GRID_END = 22;
const VISIBLE_HOURS = GRID_END - GRID_START;

const timeToTop = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return ((h - GRID_START) + m / 60) * HOUR_HEIGHT;
};

const slotHeight = (start: string, end: string): number => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * HOUR_HEIGHT, 22);
};

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CalendarioPage() {
  const router = useRouter();
  const { slots } = useSchedule();
  const { subjects } = useSubjects();
  const { tasks } = useTasks();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return addWeeks(base, weekOffset);
  }, [weekOffset]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const getSubject = (id: string) => subjects.find((s) => s.id === id);

  const upcomingParciales = useMemo(() => {
    const now = new Date();
    const limit = addDays(now, 30);
    return tasks
      .filter(
        (t) =>
          t.type === "parcial" &&
          t.status !== "completed" &&
          t.dueDate >= now &&
          t.dueDate <= limit
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [tasks]);

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "Esta semana";
    if (weekOffset === 1) return "Proxima semana";
    if (weekOffset === -1) return "Semana pasada";
    return `${format(weekStart, "d MMM", { locale: es })} – ${format(
      addDays(weekStart, 6),
      "d MMM",
      { locale: es }
    )}`;
  }, [weekOffset, weekStart]);

  const gridHeight = VISIBLE_HOURS * HOUR_HEIGHT;

  return (
    <AppShell>
      <div className="page-enter flex flex-col" style={{ height: "calc(100dvh - 64px)" }}>
        {/* Header */}
        <div className="px-4 pt-safe pb-2 flex-shrink-0">
          <h1 className="text-2xl font-bold mb-2">Calendario</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              aria-label="Semana anterior"
              className="w-9 h-9 flex items-center justify-center rounded-xl active:bg-secondary touch-target"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="flex-1 text-center text-sm font-semibold">{weekLabel}</span>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              aria-label="Semana siguiente"
              className="w-9 h-9 flex items-center justify-center rounded-xl active:bg-secondary touch-target"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/horario")}
              aria-label="Configurar horario"
              className="w-9 h-9 flex items-center justify-center rounded-xl active:bg-secondary touch-target ml-1"
            >
              <Settings2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Parciales banner */}
        {upcomingParciales.length > 0 && weekOffset >= 0 && (
          <div className="mx-4 mb-2 flex-shrink-0">
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                <span className="text-xs font-semibold text-destructive">Parciales proximos</span>
              </div>
              <div className="space-y-1">
                {upcomingParciales.slice(0, 3).map((p) => {
                  const subject = getSubject(p.subjectId);
                  const daysLeft = Math.ceil(
                    (p.dueDate.getTime() - Date.now()) / 86400000
                  );
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: subject?.color ?? "#ef4444" }}
                        />
                        <span className="text-xs text-foreground truncate">{p.title}</span>
                      </div>
                      <span className="text-xs font-bold text-destructive flex-shrink-0">
                        {daysLeft === 0 ? "Hoy" : daysLeft === 1 ? "Manana" : `en ${daysLeft}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Weekly grid */}
        <div className="flex-1 overflow-hidden mx-0">
          <div className="overflow-auto h-full w-full">
            {/* Day headers (sticky) */}
            <div
              className="flex sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border"
              style={{ paddingLeft: TIME_COL_W }}
            >
              {weekDays.map((day, i) => {
                const hasTasks =
                  tasks.filter((t) => isSameDay(t.dueDate, day) && t.status !== "completed")
                    .length > 0;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col items-center justify-center py-1.5 flex-shrink-0 border-l border-border",
                      isToday(day) && "bg-primary/5"
                    )}
                    style={{ width: DAY_COL_W }}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        isToday(day) ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {format(day, "EEE", { locale: es })}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold leading-tight",
                        isToday(day) ? "text-primary" : "text-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {hasTasks && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grid body */}
            <div
              className="flex relative"
              style={{
                width: TIME_COL_W + 7 * DAY_COL_W,
                height: gridHeight,
              }}
            >
              {/* Time column */}
              <div className="flex-shrink-0 relative" style={{ width: TIME_COL_W }}>
                {SCHEDULE_HOURS.slice(0, VISIBLE_HOURS).map((hour) => (
                  <div
                    key={hour}
                    className="absolute flex items-start justify-end pr-1.5 w-full"
                    style={{ top: (hour - GRID_START) * HOUR_HEIGHT - 8 }}
                  >
                    <span className="text-[10px] text-muted-foreground leading-none">
                      {hour < 12
                        ? `${hour}am`
                        : hour === 12
                        ? "12pm"
                        : `${hour - 12}pm`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, di) => {
                const dayScheduleSlots = slots.filter(
                  (s) => s.dayOfWeek === day.getDay()
                );
                const dayTasks = tasks.filter(
                  (t) => isSameDay(t.dueDate, day) && t.status !== "completed"
                );

                return (
                  <div
                    key={toDateStr(day)}
                    className={cn(
                      "flex-shrink-0 relative border-l border-border",
                      isToday(day) && "bg-primary/5"
                    )}
                    style={{ width: DAY_COL_W, height: gridHeight }}
                  >
                    {/* Hour grid lines */}
                    {Array.from({ length: VISIBLE_HOURS }).map((_, hi) => (
                      <div
                        key={hi}
                        className="absolute inset-x-0 border-t border-border/30"
                        style={{ top: hi * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Half-hour lines */}
                    {Array.from({ length: VISIBLE_HOURS }).map((_, hi) => (
                      <div
                        key={`h-${hi}`}
                        className="absolute inset-x-0 border-t border-border/15"
                        style={{ top: hi * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                      />
                    ))}

                    {/* Now indicator */}
                    {isToday(day) && (() => {
                      const now = new Date();
                      const top =
                        ((now.getHours() - GRID_START) + now.getMinutes() / 60) *
                        HOUR_HEIGHT;
                      if (top < 0 || top > gridHeight) return null;
                      return (
                        <div
                          className="absolute left-0 right-0 flex items-center z-30 pointer-events-none"
                          style={{ top }}
                        >
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 -ml-1" />
                          <div className="flex-1 h-px bg-primary" />
                        </div>
                      );
                    })()}

                    {/* Schedule slots */}
                    {dayScheduleSlots.map((slot) => {
                      const subject = getSubject(slot.subjectId);
                      return (
                        <div
                          key={slot.id}
                          className="absolute inset-x-0.5 rounded-lg px-1.5 pt-1 pb-0.5 overflow-hidden z-10"
                          style={{
                            top: timeToTop(slot.startTime),
                            height: slotHeight(slot.startTime, slot.endTime),
                            backgroundColor: subject?.color
                              ? `${subject.color}d9`
                              : "#6366f1d9",
                          }}
                        >
                          <p className="text-[9px] font-bold text-white leading-tight truncate">
                            {subject?.emoji} {subject?.name}
                          </p>
                          <p className="text-[8px] text-white/75 leading-tight">
                            {slot.startTime}
                          </p>
                        </div>
                      );
                    })}

                    {/* Task chips (stacked from 8am) */}
                    {dayTasks.map((task, ti) => {
                      const subject = getSubject(task.subjectId);
                      const chipTop = timeToTop("08:00") + ti * 24;
                      const isParcial = task.type === "parcial";
                      return (
                        <button
                          key={task.id}
                          onClick={() => router.push("/tareas")}
                          aria-label={`Ir a tarea: ${task.title}`}
                          className="absolute inset-x-0.5 h-5 rounded-md px-1 overflow-hidden z-20 text-left active:opacity-70 touch-target"
                          style={{
                            top: chipTop,
                            backgroundColor: isParcial
                              ? "#ef444433"
                              : subject?.color
                              ? `${subject.color}33`
                              : "#6366f133",
                            borderLeft: `2px solid ${
                              isParcial ? "#ef4444" : subject?.color ?? "#6366f1"
                            }`,
                          }}
                        >
                          <span
                            className="text-[8px] font-semibold truncate block leading-5"
                            style={{
                              color: isParcial ? "#ef4444" : subject?.color ?? "#6366f1",
                            }}
                          >
                            {isParcial ? "📝 " : ""}
                            {task.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
