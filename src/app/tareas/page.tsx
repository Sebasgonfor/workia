"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  CheckSquare,
  Pencil,
  Trash2,
  Calendar,
  CalendarCheck,
  AlertTriangle,
  Clock,
  ChevronRight,
  Flame,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { Confirm } from "@/components/ui/confirm";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { useSubjects, useTasks, useSchedule } from "@/lib/hooks";
import { TASK_TYPES, TASK_PRIORITIES, nextClassDate } from "@/types";
import type { Task } from "@/types";
import { toast } from "sonner";

function isOverdue(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function getDiffDays(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function formatRelativeDueDate(date: Date): string {
  const diffDays = getDiffDays(date);
  if (diffDays < -1) return `Hace ${Math.abs(diffDays)}d`;
  if (diffDays === -1) return "Ayer";
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Manana";
  if (diffDays <= 7) return `En ${diffDays}d`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

type FilterType = "all" | "pending" | "completed";

interface TaskGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  tasks: Task[];
}

export default function TareasPage() {
  const { subjects } = useSubjects();
  const { tasks, loading, addTask, updateTask, deleteTask } = useTasks();
  const { slots } = useSchedule();

  const [filter, setFilter] = useState<FilterType>("all");
  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Detail view
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [description, setDescription] = useState("");
  const [showDesc, setShowDesc] = useState(false);
  const [assignedDate, setAssignedDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [taskType, setTaskType] = useState<Task["type"]>("otro");

  // Stats
  const stats = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== "completed");
    const completed = tasks.filter((t) => t.status === "completed");
    const overdue = pending.filter((t) => isOverdue(t.dueDate));
    const today = pending.filter((t) => getDiffDays(t.dueDate) === 0);
    return { pending: pending.length, completed: completed.length, overdue: overdue.length, today: today.length, total: tasks.length };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filter === "pending") return tasks.filter((t) => t.status !== "completed");
    if (filter === "completed") return tasks.filter((t) => t.status === "completed");
    return tasks;
  }, [tasks, filter]);

  // Group tasks by urgency
  const taskGroups = useMemo((): TaskGroup[] => {
    const pending = filteredTasks.filter((t) => t.status !== "completed");
    const completed = filteredTasks.filter((t) => t.status === "completed");

    const overdue = pending.filter((t) => isOverdue(t.dueDate));
    const today = pending.filter((t) => getDiffDays(t.dueDate) === 0);
    const thisWeek = pending.filter((t) => { const d = getDiffDays(t.dueDate); return d >= 1 && d <= 7; });
    const later = pending.filter((t) => getDiffDays(t.dueDate) > 7);

    const groups: TaskGroup[] = [];

    if (overdue.length > 0) groups.push({
      key: "overdue", label: "Vencidas", icon: <AlertTriangle className="w-3.5 h-3.5" />,
      color: "#ef4444", tasks: overdue.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    });
    if (today.length > 0) groups.push({
      key: "today", label: "Hoy", icon: <Flame className="w-3.5 h-3.5" />,
      color: "#f59e0b", tasks: today,
    });
    if (thisWeek.length > 0) groups.push({
      key: "week", label: "Esta semana", icon: <Clock className="w-3.5 h-3.5" />,
      color: "#3b82f6", tasks: thisWeek.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    });
    if (later.length > 0) groups.push({
      key: "later", label: "Proximas", icon: <Calendar className="w-3.5 h-3.5" />,
      color: "#10b981", tasks: later.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    });
    if (completed.length > 0 && filter !== "pending") groups.push({
      key: "completed", label: "Completadas", icon: <CheckSquare className="w-3.5 h-3.5" />,
      color: "#6b7280", tasks: completed,
    });

    return groups;
  }, [filteredTasks, filter]);

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: stats.total },
    { key: "pending", label: "Pendientes", count: stats.pending },
    { key: "completed", label: "Completadas", count: stats.completed },
  ];

  const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const getSubjectData = (sId: string) => subjects.find((s) => s.id === sId);

  const resetForm = () => {
    setTitle(""); setSubjectId(""); setDescription(""); setShowDesc(false);
    setAssignedDate(toDateStr(new Date())); setDueDate(""); setPriority("medium"); setTaskType("otro"); setEditingId(null);
  };

  const openCreate = () => { resetForm(); setShowSheet(true); };

  const openEdit = (task: Task) => {
    setTitle(task.title);
    setSubjectId(task.subjectId);
    setDescription(task.description || "");
    setShowDesc(!!task.description);
    setAssignedDate(toDateStr(task.assignedDate));
    setDueDate(toDateStr(task.dueDate));
    setPriority(task.priority);
    setTaskType(task.type);
    setEditingId(task.id);
    setDetailTask(null);
    setShowSheet(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("El titulo es obligatorio"); return; }
    if (!subjectId) { toast.error("Selecciona una materia"); return; }
    if (!dueDate) { toast.error("La fecha de entrega es obligatoria"); return; }

    const selectedSubject = subjects.find((s) => s.id === subjectId);
    const dueDateObj = new Date(dueDate + "T23:59:59");
    const assignedDateObj = assignedDate ? new Date(assignedDate + "T00:00:00") : new Date();

    setSaving(true);
    try {
      if (editingId) {
        await updateTask(editingId, {
          title: title.trim(), subjectId, subjectName: selectedSubject?.name || "",
          description: description.trim(), assignedDate: assignedDateObj, dueDate: dueDateObj, priority, type: taskType,
        });
        toast.success("Tarea actualizada");
      } else {
        await addTask({
          title: title.trim(), subjectId, subjectName: selectedSubject?.name || "",
          description: description.trim(), assignedDate: assignedDateObj, dueDate: dueDateObj, status: "pending",
          priority, type: taskType, sourceImageUrl: null, classSessionId: null,
        });
        toast.success("Tarea creada");
      }
      setShowSheet(false);
      resetForm();
    } catch { toast.error("Error al guardar"); } finally { setSaving(false); }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      await updateTask(task.id, { status: task.status === "completed" ? "pending" : "completed" });
    } catch { toast.error("Error al actualizar"); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    setDetailTask(null);
    try { await deleteTask(id); toast.success("Tarea eliminada"); }
    catch { toast.error("Error al eliminar"); }
  };

  // Progress percentage
  const progressPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <AppShell>
      <div className="page-enter">
        {/* Header */}
        <div className="px-4 pt-safe pb-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold">Tareas</h1>
              <p className="text-sm text-muted-foreground">
                {stats.pending} pendiente{stats.pending !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={openCreate} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target">
              <Plus className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>

          {/* Progress bar */}
          {stats.total > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground">Progreso</span>
                <span className="text-[11px] font-semibold text-primary">{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Quick stats */}
          {stats.pending > 0 && (
            <div className="flex gap-2 mb-3">
              {stats.overdue > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-3 h-3 text-destructive" />
                  <span className="text-[11px] font-semibold text-destructive">{stats.overdue} vencida{stats.overdue !== 1 ? "s" : ""}</span>
                </div>
              )}
              {stats.today > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Flame className="w-3 h-3 text-amber-500" />
                  <span className="text-[11px] font-semibold text-amber-500">{stats.today} para hoy</span>
                </div>
              )}
            </div>
          )}

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                  filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 text-[11px] ${filter === f.key ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tasks list */}
        <div className="px-4 pt-2 pb-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-[72px] rounded-2xl bg-card animate-pulse" />)}
            </div>
          ) : taskGroups.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mx-auto mb-4">
                <CheckSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">
                {filter === "completed" ? "Sin completadas" : filter === "pending" ? "Todo al dia!" : "Sin tareas aun"}
              </p>
              <p className="text-xs text-muted-foreground/60 mb-5">
                {filter === "all" ? "Crea tu primera tarea o escanea un tablero" : "Apareceran aqui"}
              </p>
              {filter === "all" && (
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  <Plus className="w-4 h-4" /> Nueva tarea
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {taskGroups.map((group) => (
                <div key={group.key}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: group.color + "20", color: group.color }}
                    >
                      {group.icon}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">({group.tasks.length})</span>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-2">
                    {group.tasks.map((task) => {
                      const isComplete = task.status === "completed";
                      const overdue = !isComplete && isOverdue(task.dueDate);
                      const priorityData = TASK_PRIORITIES.find((p) => p.value === task.priority);
                      const typeData = TASK_TYPES.find((t) => t.value === task.type);
                      const subjectData = getSubjectData(task.subjectId);
                      const subjectColor = subjectData?.color || "#6366f1";

                      return (
                        <button
                          key={task.id}
                          onClick={() => setDetailTask(task)}
                          className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.98] ${
                            isComplete
                              ? "bg-card/50 border-border/50 opacity-60"
                              : "bg-card border-border"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <div
                              onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }}
                              className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all cursor-pointer touch-target ${
                                isComplete
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/30 hover:border-primary/50"
                              }`}
                            >
                              {isComplete && (
                                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Title row */}
                              <div className="flex items-center gap-1.5">
                                <span className={`font-semibold text-[15px] leading-tight ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                                  <MarkdownMath content={task.title} inline />
                                </span>
                              </div>

                              {/* Meta row */}
                              <div className="flex items-center gap-2 mt-1.5">
                                {/* Subject pill */}
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                                  style={{ backgroundColor: subjectColor + "18", color: subjectColor }}
                                >
                                  {subjectData?.emoji && <span className="text-[9px]">{subjectData.emoji}</span>}
                                  {task.subjectName}
                                </span>

                                {/* Type */}
                                <span className="text-[10px] text-muted-foreground">
                                  {typeData?.emoji} {typeData?.label}
                                </span>
                              </div>

                              {/* Due date row */}
                              {!isComplete && (
                                <div className="flex items-center gap-1.5 mt-1.5">
                                  <Clock className={`w-3 h-3 ${overdue ? "text-destructive" : "text-muted-foreground/60"}`} />
                                  <span className={`text-[11px] font-medium ${overdue ? "text-destructive" : "text-muted-foreground/70"}`}>
                                    {formatRelativeDueDate(task.dueDate)}
                                  </span>
                                  {/* Priority dot */}
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priorityData?.color }} />
                                </div>
                              )}
                            </div>

                            {/* Arrow */}
                            <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-1" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Sheet */}
      <Sheet
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        title="Detalle de tarea"
      >
        {detailTask && (() => {
          const priorityData = TASK_PRIORITIES.find((p) => p.value === detailTask.priority);
          const typeData = TASK_TYPES.find((t) => t.value === detailTask.type);
          const isComplete = detailTask.status === "completed";
          const overdue = !isComplete && isOverdue(detailTask.dueDate);
          const subjectData = getSubjectData(detailTask.subjectId);
          const subjectColor = subjectData?.color || "#6366f1";

          return (
            <div className="space-y-4">
              {/* Badges row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl">{typeData?.emoji}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: priorityData?.color }}
                >
                  {priorityData?.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground">
                  {typeData?.label}
                </span>
                {isComplete && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/20 text-primary">
                    Completada
                  </span>
                )}
              </div>

              {/* Title */}
              <div>
                <h2 className={`text-xl font-bold leading-tight ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                  <MarkdownMath content={detailTask.title} inline />
                </h2>
                {detailTask.subjectName && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: subjectColor }} />
                    <span className="text-sm text-muted-foreground">{subjectData?.emoji} {detailTask.subjectName}</span>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">Asignada</span>
                  </div>
                  <p className="text-sm font-medium">{formatDate(detailTask.assignedDate)}</p>
                </div>
                <div className={`p-3 rounded-xl border ${overdue ? "bg-destructive/10 border-destructive/30" : "bg-secondary/50 border-border"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <CalendarCheck className={`w-3.5 h-3.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`} />
                    <span className={`text-[10px] font-medium uppercase ${overdue ? "text-destructive" : "text-muted-foreground"}`}>Entrega</span>
                  </div>
                  <p className={`text-sm font-medium ${overdue ? "text-destructive" : ""}`}>
                    {formatDate(detailTask.dueDate)}
                    <span className={`text-[10px] ml-1.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                      ({formatRelativeDueDate(detailTask.dueDate)})
                    </span>
                  </p>
                </div>
              </div>

              {/* Description */}
              {detailTask.description && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 rounded-full bg-primary" />
                    <span className="text-sm font-semibold">Descripcion</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/40 border border-border">
                    <MarkdownMath content={detailTask.description} />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { handleToggleComplete(detailTask); setDetailTask(null); }}
                  className={`flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform ${
                    isComplete
                      ? "bg-secondary text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isComplete ? "Marcar pendiente" : "Completar"}
                </button>
                <button
                  onClick={() => openEdit(detailTask)}
                  className="px-4 py-3 rounded-xl bg-secondary text-foreground font-medium active:scale-[0.98] transition-transform"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setDetailTask(null); setDeleteId(detailTask.id); }}
                  className="px-4 py-3 rounded-xl bg-destructive/10 text-destructive font-medium active:scale-[0.98] transition-transform"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}
      </Sheet>

      {/* Create/Edit Sheet */}
      <Sheet open={showSheet} onClose={() => { setShowSheet(false); resetForm(); }} title={editingId ? "Editar tarea" : "Nueva tarea"}>
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Titulo</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Entregar taller de grafos"
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Materia</label>
            <select
              value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm"
            >
              <option value="">Seleccionar...</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          </div>

          {/* Two dates side by side */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label className="text-xs font-medium text-muted-foreground mb-1 block truncate">Asignada</label>
              <input
                type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full min-w-0 px-2 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark] text-sm"
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs font-medium text-muted-foreground mb-1 block truncate">Entrega</label>
              <input
                type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-w-0 px-2 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark] text-sm"
              />
            </div>
          </div>

          {/* Next class shortcut */}
          {(() => {
            if (!subjectId) return null;
            const next = nextClassDate(slots, subjectId);
            if (!next) return null;
            const dayName = next.date.toLocaleDateString("es-CO", { weekday: "long" });
            const dateLabel = next.date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
            const timeLabel = next.slot.startTime;
            const handleUseNextClass = () => {
              const d = next.date;
              setDueDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
            };
            return (
              <button
                type="button"
                onClick={handleUseNextClass}
                aria-label="Usar fecha de proxima clase como entrega"
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-left active:opacity-70 touch-target transition-opacity"
              >
                <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary leading-tight">Proxima clase</p>
                  <p className="text-[11px] text-primary/70 capitalize truncate">
                    {dayName} {dateLabel} · {timeLabel}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-primary/50 flex-shrink-0" />
              </button>
            );
          })()}

          {/* Description — collapsible */}
          {!showDesc ? (
            <button onClick={() => setShowDesc(true)} className="text-xs text-primary font-medium">
              + Agregar descripcion (soporta $LaTeX$)
            </button>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Descripcion <span className="text-muted-foreground/50">— soporta $LaTeX$</span>
              </label>
              <textarea
                value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles... Usa $ecuacion$ para math" rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridad</label>
            <div className="grid grid-cols-3 gap-1.5">
              {TASK_PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value as Task["priority"])}
                  className={`py-2 rounded-xl text-sm font-medium transition-all ${
                    priority === p.value ? "text-white" : "bg-secondary text-muted-foreground"
                  }`}
                  style={priority === p.value ? { backgroundColor: p.color } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTaskType(t.value as Task["type"])}
                  className={`flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    taskType === t.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <span className="text-xs">{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear tarea"}
          </button>
        </div>
      </Sheet>

      <Confirm open={!!deleteId} title="Eliminar tarea" message="Se eliminara esta tarea permanentemente." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </AppShell>
  );
}
