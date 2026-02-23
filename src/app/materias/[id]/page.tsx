"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Calendar,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { useSubjects, useClasses } from "@/lib/hooks";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function SubjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.id as string;

  const { subjects } = useSubjects();
  const { classes, loading, addClass, updateClass, deleteClass } = useClasses(subjectId);

  const subject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const resetForm = () => {
    setTitle("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (id: string) => {
    const cls = classes.find((c) => c.id === id);
    if (!cls) return;
    setTitle(cls.title);
    setDate(format(cls.date, "yyyy-MM-dd"));
    setEditingId(id);
    setMenuOpen(null);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }

    try {
      const classDate = new Date(date + "T12:00:00");
      if (editingId) {
        await updateClass(editingId, { title: title.trim(), date: classDate });
        toast.success("Clase actualizada");
      } else {
        await addClass({ title: title.trim(), date: classDate });
        toast.success("Clase creada");
      }
      setShowCreate(false);
      resetForm();
    } catch {
      toast.error("Error al guardar");
    }
  };

  const handleDelete = async (id: string) => {
    setMenuOpen(null);
    try {
      await deleteClass(id);
      toast.success("Clase eliminada");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  // Group classes by month
  const groupedClasses = useMemo(() => {
    const groups: Record<string, typeof classes> = {};
    classes.forEach((cls) => {
      const key = format(cls.date, "MMMM yyyy", { locale: es });
      if (!groups[key]) groups[key] = [];
      groups[key].push(cls);
    });
    return groups;
  }, [classes]);

  if (!subject && !loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-5">
          <p className="text-muted-foreground">Materia no encontrada</p>
          <button
            onClick={() => router.replace("/materias")}
            className="mt-4 text-primary text-sm font-medium"
          >
            Volver a materias
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-enter">
        {/* Header */}
        <div
          className="px-5 pt-6 pb-5"
          style={{
            background: subject
              ? `linear-gradient(135deg, ${subject.color}15 0%, transparent 60%)`
              : undefined,
          }}
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground mb-4 active:opacity-70"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Materias</span>
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: (subject?.color || "#666") + "20" }}
              >
                {subject?.emoji || "📚"}
              </div>
              <div>
                <h1 className="text-xl font-bold">{subject?.name || "..."}</h1>
                <p className="text-sm text-muted-foreground">
                  {classes.length} clase{classes.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>

        {/* Classes List */}
        <div className="px-5">
          {loading ? (
            <div className="space-y-3 mt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-1">Sin clases aún</p>
              <p className="text-sm text-muted-foreground/60">
                Agrega tu primera clase para comenzar
              </p>
            </div>
          ) : (
            <div className="space-y-6 mt-2">
              {Object.entries(groupedClasses).map(([month, monthClasses]) => (
                <div key={month}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {month}
                  </p>
                  <div className="space-y-2">
                    {monthClasses.map((cls) => (
                      <div key={cls.id} className="relative group">
                        <button
                          onClick={() => {
                            router.push(`/materias/${subjectId}/${cls.id}`);
                          }}
                          className="w-full text-left p-4 rounded-xl bg-card border border-border active:scale-[0.98] transition-transform"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center w-12 shrink-0">
                              <span className="text-xs font-bold text-muted-foreground uppercase">
                                {format(cls.date, "MMM", { locale: es })}
                              </span>
                              <span className="text-xl font-bold">
                                {format(cls.date, "d")}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{cls.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(cls.date, "EEEE", { locale: es })}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </div>
                        </button>

                        {/* Menu button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(menuOpen === cls.id ? null : cls.id);
                          }}
                          className="absolute top-3 right-12 w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
                          style={{ opacity: menuOpen === cls.id ? 1 : undefined }}
                        >
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>

                        {/* Dropdown */}
                        {menuOpen === cls.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setMenuOpen(null)}
                            />
                            <div className="absolute top-12 right-12 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[150px]">
                              <button
                                onClick={() => openEdit(cls.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary/50 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleDelete(cls.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-secondary/50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Sheet */}
      <Sheet
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetForm();
        }}
        title={editingId ? "Editar clase" : "Nueva clase"}
      >
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Clase 5 - Grafos y recorridos"
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Fecha de la clase
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark]"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform"
          >
            {editingId ? "Guardar cambios" : "Crear clase"}
          </button>
        </div>
      </Sheet>
    </AppShell>
  );
}
