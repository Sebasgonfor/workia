"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, MapPin, Clock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { Confirm } from "@/components/ui/confirm";
import { useSubjects, useSchedule } from "@/lib/hooks";
import { DAYS_OF_WEEK, SCHEDULE_HOURS } from "@/types";
import type { ScheduleSlot } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAY_TABS = DAYS_OF_WEEK; // Lun-Dom

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(m).padStart(2, "0")}${period}`;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function HorarioPage() {
  const { subjects } = useSubjects();
  const { slots, loading, addSlot, updateSlot, deleteSlot } = useSchedule();

  const todayIndex = new Date().getDay(); // 0=Dom
  const defaultTab = DAY_TABS.find((d) => d.value === todayIndex) ?? DAY_TABS[0];
  const [selectedDay, setSelectedDay] = useState<(typeof DAY_TABS)[number]>(defaultTab);

  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [subjectId, setSubjectId] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [room, setRoom] = useState("");

  const slotsForDay = useMemo(
    () =>
      slots
        .filter((s) => s.dayOfWeek === selectedDay.value)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [slots, selectedDay]
  );

  const resetForm = () => {
    setSubjectId("");
    setStartTime("08:00");
    setEndTime("10:00");
    setRoom("");
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowSheet(true);
  };

  const openEdit = (slot: ScheduleSlot) => {
    setSubjectId(slot.subjectId);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setRoom(slot.room ?? "");
    setEditingId(slot.id);
    setShowSheet(true);
  };

  const handleSave = async () => {
    if (!subjectId) { toast.error("Selecciona una materia"); return; }
    if (!startTime || !endTime) { toast.error("Ingresa las horas"); return; }
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      toast.error("La hora de fin debe ser mayor a la de inicio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        subjectId,
        dayOfWeek: selectedDay.value as ScheduleSlot["dayOfWeek"],
        startTime,
        endTime,
        room: room.trim() || null,
      };
      if (editingId) {
        await updateSlot(editingId, payload);
        toast.success("Clase actualizada");
      } else {
        await addSlot(payload);
        toast.success("Clase agregada");
      }
      setShowSheet(false);
      resetForm();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await deleteSlot(id);
      toast.success("Clase eliminada");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const getSubject = (id: string) => subjects.find((s) => s.id === id);

  // Weekly summary: count slots per day
  const slotsByDay = useMemo(() => {
    const map: Record<number, number> = {};
    slots.forEach((s) => {
      map[s.dayOfWeek] = (map[s.dayOfWeek] ?? 0) + 1;
    });
    return map;
  }, [slots]);

  return (
    <AppShell>
      <div className="page-enter">
        {/* Header */}
        <div className="px-4 pt-safe pb-3">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold">Horario</h1>
            <button
              onClick={openCreate}
              aria-label="Agregar clase"
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target"
            >
              <Plus className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {slots.length} {slots.length === 1 ? "clase" : "clases"} en tu semana
          </p>
        </div>

        {/* Day tabs */}
        <div className="flex gap-1 px-4 mb-4 overflow-x-auto scrollbar-none">
          {DAY_TABS.map((day) => {
            const isActive = selectedDay.value === day.value;
            const count = slotsByDay[day.value] ?? 0;
            return (
              <button
                key={day.value}
                onClick={() => setSelectedDay(day)}
                aria-label={day.full}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors touch-target min-w-[48px]",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground active:bg-secondary/70"
                )}
              >
                <span className="text-[11px] font-semibold">{day.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "text-[9px] font-bold rounded-full px-1",
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "text-primary"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Slots list */}
        <div className="px-4 space-y-2 pb-28">
          {loading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-secondary animate-pulse" />
              ))}
            </div>
          )}

          {!loading && slotsForDay.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl mb-3">📅</span>
              <p className="font-semibold text-foreground">Sin clases el {selectedDay.full}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Toca <strong>+</strong> para agregar una clase
              </p>
            </div>
          )}

          {!loading && slotsForDay.length > 0 && (
            <div className="space-y-2 stagger-children">
              {slotsForDay.map((slot) => {
                const subject = getSubject(slot.subjectId);
                return (
                  <div
                    key={slot.id}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border"
                  >
                    {/* Color indicator */}
                    <div
                      className="w-1 self-stretch rounded-full flex-shrink-0"
                      style={{ backgroundColor: subject?.color ?? "#6366f1" }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-base leading-none">{subject?.emoji}</span>
                        <span className="font-semibold text-sm truncate">{subject?.name ?? "Materia eliminada"}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                        </span>
                        {slot.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {slot.room}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(slot)}
                        aria-label="Editar clase"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground active:bg-secondary touch-target"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(slot.id)}
                        aria-label="Eliminar clase"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground active:bg-secondary touch-target"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Sheet */}
      <Sheet
        open={showSheet}
        onClose={() => { setShowSheet(false); resetForm(); }}
        title={editingId ? "Editar clase" : `Clase del ${selectedDay.full}`}
      >
        <div className="space-y-4 pb-4">
          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Materia
            </label>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tienes materias. Crea una primero.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSubjectId(s.id)}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-colors text-left touch-target",
                      subjectId === s.id
                        ? "border-transparent text-white"
                        : "border-border bg-secondary text-foreground active:bg-secondary/70"
                    )}
                    style={subjectId === s.id ? { backgroundColor: s.color } : {}}
                  >
                    <span className="text-lg leading-none">{s.emoji}</span>
                    <span className="text-xs font-medium truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                Hora inicio
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {SCHEDULE_HOURS.flatMap((h) =>
                  ["00", "30"].map((m) => {
                    const val = `${String(h).padStart(2, "0")}:${m}`;
                    return <option key={val} value={val}>{formatTime(val)}</option>;
                  })
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                Hora fin
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {SCHEDULE_HOURS.flatMap((h) =>
                  ["00", "30"].map((m) => {
                    const val = `${String(h).padStart(2, "0")}:${m}`;
                    return <option key={val} value={val}>{formatTime(val)}</option>;
                  })
                )}
              </select>
            </div>
          </div>

          {/* Room */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Salon / Aula <span className="normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Ej: Salon 301, Laboratorio…"
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !subjectId}
            className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm active:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Guardando…" : editingId ? "Actualizar clase" : "Agregar clase"}
          </button>
        </div>
      </Sheet>

      {/* Confirm delete */}
      <Confirm
        open={!!deleteId}
        title="Eliminar clase"
        message="Esta clase se eliminara del horario. Las tareas existentes no se veran afectadas."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </AppShell>
  );
}
