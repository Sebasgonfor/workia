"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  CheckSquare,
  MoreVertical,
  Pencil,
  Trash2,
  Calendar,
  CalendarCheck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { Confirm } from "@/components/ui/confirm";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { useSubjects, useTasks } from "@/lib/hooks";
import { TASK_TYPES, TASK_PRIORITIES } from "@/types";
import type { Task } from "@/types";
import { toast } from "sonner";

function isOverdue(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function formatRelativeDueDate(date: Date): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86400000);
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

export default function TareasPage() {
  const { subjects } = useSubjects();
  const { tasks, loading, addTask, updateTask, deleteTask } = useTasks();

  const [filter, setFilter] = useState<FilterType>("all");
  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
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

  const pendingCount = useMemo(() => tasks.filter((t) => t.status !== "completed").length, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filter === "pending") return tasks.filter((t) => t.status !== "completed");
    if (filter === "completed") return tasks.filter((t) => t.status === "completed");
    return tasks;
  }, [tasks, filter]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Pendientes" },
    { key: "completed", label: "Completadas" },
  ];

  const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
    setMenuOpen(null);
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

  return (
    <AppShell>
      <div className="page-enter">
        {/* Header */}
        <div className="px-4 pt-safe pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tareas</h1>
              <p className="text-sm text-muted-foreground">
                {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={openCreate} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target">
              <Plus className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks list */}
        <div className="px-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-[68px] rounded-xl bg-card animate-pulse" />)}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
                <CheckSquare className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">
                {filter === "completed" ? "Sin completadas" : filter === "pending" ? "Sin pendientes" : "Sin tareas aun"}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {filter === "all" ? "Crea tu primera tarea" : "Apareceran aqui"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const isComplete = task.status === "completed";
                const overdue = !isComplete && isOverdue(task.dueDate);
                const priorityData = TASK_PRIORITIES.find((p) => p.value === task.priority);
                const typeData = TASK_TYPES.find((t) => t.value === task.type);

                return (
                  <div key={task.id} className="relative">
                    <button
                      onClick={() => setDetailTask(task)}
                      className="w-full text-left p-3.5 rounded-xl bg-card border border-border overflow-hidden active:scale-[0.99] transition-transform"
                      style={{ borderLeftWidth: "4px", borderLeftColor: priorityData?.color || "#666" }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }}
                          className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors touch-target cursor-pointer ${
                            isComplete ? "bg-primary border-primary" : "border-muted-foreground/40"
                          }`}
                        >
                          {isComplete && (
                            <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pr-7">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{typeData?.emoji || "📌"}</span>
                            <p className={`font-medium text-[15px] truncate ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {task.subjectName && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-secondary text-muted-foreground">{task.subjectName}</span>
                            )}
                            <span className={`text-[11px] ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                              {formatRelativeDueDate(task.dueDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setMenuOpen(menuOpen === task.id ? null : task.id)}
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-secondary/50 flex items-center justify-center touch-target"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>

                    {menuOpen === task.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                        <div className="absolute top-10 right-2.5 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                          <button onClick={() => openEdit(task)} className="w-full flex items-center gap-3 px-4 py-3 text-sm active:bg-secondary/50">
                            <Pencil className="w-4 h-4" /> Editar
                          </button>
                          <button onClick={() => { setMenuOpen(null); setDeleteId(task.id); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive active:bg-secondary/50">
                            <Trash2 className="w-4 h-4" /> Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
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

          return (
            <div className="space-y-4">
              {/* Title + status */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{typeData?.emoji}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: priorityData?.color }}
                  >
                    {priorityData?.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground">
                    {typeData?.label}
                  </span>
                </div>
                <h2 className={`text-lg font-bold ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                  {detailTask.title}
                </h2>
                {detailTask.subjectName && (
                  <p className="text-xs text-muted-foreground mt-0.5">{detailTask.subjectName}</p>
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Asignada</label>
              <input
                type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark] text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrega</label>
              <input
                type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark] text-sm"
              />
            </div>
          </div>

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
                placeholder="Detalles... Usa $ecuacion$ para math" rows={2}
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
