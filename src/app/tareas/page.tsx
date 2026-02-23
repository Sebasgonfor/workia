"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  CheckSquare,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
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
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < -1) return `Vencida hace ${Math.abs(diffDays)} dias`;
  if (diffDays === -1) return "Vencida ayer";
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Manana";
  if (diffDays <= 7) return `En ${diffDays} dias`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
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

  // Form state
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [taskType, setTaskType] = useState<Task["type"]>("otro");

  const filteredTasks = useMemo(() => {
    if (filter === "pending")
      return tasks.filter((t) => t.status !== "completed");
    if (filter === "completed")
      return tasks.filter((t) => t.status === "completed");
    return tasks;
  }, [tasks, filter]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Pendientes" },
    { key: "completed", label: "Completadas" },
  ];

  const resetForm = () => {
    setTitle("");
    setSubjectId("");
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setTaskType("otro");
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowSheet(true);
  };

  const openEdit = (task: Task) => {
    setTitle(task.title);
    setSubjectId(task.subjectId);
    setDescription(task.description || "");
    setDueDate(
      task.dueDate
        ? `${task.dueDate.getFullYear()}-${String(task.dueDate.getMonth() + 1).padStart(2, "0")}-${String(task.dueDate.getDate()).padStart(2, "0")}`
        : ""
    );
    setPriority(task.priority);
    setTaskType(task.type);
    setEditingId(task.id);
    setMenuOpen(null);
    setShowSheet(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("El titulo es obligatorio");
      return;
    }
    if (!subjectId) {
      toast.error("Selecciona una materia");
      return;
    }
    if (!dueDate) {
      toast.error("La fecha es obligatoria");
      return;
    }

    const selectedSubject = subjects.find((s) => s.id === subjectId);
    const dueDateObj = new Date(dueDate + "T23:59:59");

    setSaving(true);
    try {
      if (editingId) {
        await updateTask(editingId, {
          title: title.trim(),
          subjectId,
          subjectName: selectedSubject?.name || "",
          description: description.trim(),
          dueDate: dueDateObj,
          priority,
          type: taskType,
        });
        toast.success("Tarea actualizada");
      } else {
        await addTask({
          title: title.trim(),
          subjectId,
          subjectName: selectedSubject?.name || "",
          description: description.trim(),
          dueDate: dueDateObj,
          status: "pending",
          priority,
          type: taskType,
          sourceImageUrl: null,
          classSessionId: null,
        });
        toast.success("Tarea creada");
      }
      setShowSheet(false);
      resetForm();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const newStatus = task.status === "completed" ? "pending" : "completed";
      await updateTask(task.id, { status: newStatus });
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (id: string) => {
    setMenuOpen(null);
    try {
      await deleteTask(id);
      toast.success("Tarea eliminada");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <AppShell>
      <div className="page-enter">
        {/* Header */}
        <div className="px-5 pt-safe pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tareas</h1>
              <p className="text-sm text-muted-foreground">
                {tasks.filter((t) => t.status !== "completed").length} pendiente
                {tasks.filter((t) => t.status !== "completed").length !== 1
                  ? "s"
                  : ""}
              </p>
            </div>
            <button
              onClick={openCreate}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target"
            >
              <Plus className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="px-5 pb-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors touch-target ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks list */}
        <div className="px-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mx-auto mb-4">
                <CheckSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-1">
                {filter === "completed"
                  ? "Sin tareas completadas"
                  : filter === "pending"
                    ? "Sin tareas pendientes"
                    : "Sin tareas aun"}
              </p>
              <p className="text-sm text-muted-foreground/60">
                {filter === "all"
                  ? "Crea tu primera tarea para comenzar"
                  : "Las tareas apareceran aqui"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const isComplete = task.status === "completed";
                const overdue = !isComplete && isOverdue(task.dueDate);
                const priorityData = TASK_PRIORITIES.find(
                  (p) => p.value === task.priority
                );
                const typeData = TASK_TYPES.find((t) => t.value === task.type);

                return (
                  <div key={task.id} className="relative">
                    <div
                      className="p-4 rounded-xl bg-card border border-border overflow-hidden"
                      style={{
                        borderLeftWidth: "4px",
                        borderLeftColor: priorityData?.color || "#666",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => handleToggleComplete(task)}
                          className={`w-6 h-6 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors touch-target ${
                            isComplete
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isComplete && (
                            <svg
                              className="w-3.5 h-3.5 text-primary-foreground"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </button>

                        <div className="flex-1 min-w-0 pr-8">
                          {/* Title row */}
                          <div className="flex items-center gap-2">
                            <span className="text-base">
                              {typeData?.emoji || "📌"}
                            </span>
                            <p
                              className={`font-medium truncate ${
                                isComplete
                                  ? "line-through text-muted-foreground"
                                  : ""
                              }`}
                            >
                              {task.title}
                            </p>
                          </div>

                          {/* Meta row */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {task.subjectName && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground">
                                {task.subjectName}
                              </span>
                            )}
                            <span
                              className={`text-xs ${
                                overdue
                                  ? "text-destructive font-semibold"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {formatRelativeDueDate(task.dueDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Menu button — always visible */}
                    <button
                      onClick={() =>
                        setMenuOpen(menuOpen === task.id ? null : task.id)
                      }
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center touch-target"
                    >
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Dropdown */}
                    {menuOpen === task.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setMenuOpen(null)}
                        />
                        <div className="absolute top-12 right-3 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[150px]">
                          <button
                            onClick={() => openEdit(task)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm active:bg-secondary/50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive active:bg-secondary/50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
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

      {/* Create/Edit Sheet */}
      <Sheet
        open={showSheet}
        onClose={() => {
          setShowSheet(false);
          resetForm();
        }}
        title={editingId ? "Editar tarea" : "Nueva tarea"}
      >
        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Titulo
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Entregar taller de grafos"
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Materia
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
            >
              <option value="">Seleccionar materia...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Descripcion (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Due date */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Fecha de entrega
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark]"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Prioridad
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TASK_PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value as Task["priority"])}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                    priority === p.value
                      ? "text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                  style={
                    priority === p.value
                      ? { backgroundColor: p.color }
                      : undefined
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Tipo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTaskType(t.value as Task["type"])}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    taskType === t.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving
              ? "Guardando..."
              : editingId
                ? "Guardar cambios"
                : "Crear tarea"}
          </button>
        </div>
      </Sheet>
    </AppShell>
  );
}
