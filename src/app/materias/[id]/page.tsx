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
import { Confirm } from "@/components/ui/confirm";
import { SubjectDocuments } from "@/components/subject-documents";
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
  const [activeTab, setActiveTab] = useState<"clases" | "documentos">("clases");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const resetForm = () => {
    setTitle("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setEditingId(null);
  };

  const openCreate = () => { resetForm(); setShowCreate(true); };

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
    if (!title.trim()) { toast.error("El titulo es obligatorio"); return; }
    setSaving(true);
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
    } catch { toast.error("Error al guardar"); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try { await deleteClass(id); toast.success("Clase eliminada"); }
    catch { toast.error("Error al eliminar"); }
  };

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
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <p className="text-muted-foreground">Materia no encontrada</p>
          <button onClick={() => router.replace("/materias")} className="mt-4 text-primary text-sm font-medium">
            Volver a materias
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-enter">
        {/* Header — compact */}
        <div
          className="px-4 pt-safe pb-4"
          style={{
            background: subject ? `linear-gradient(135deg, ${subject.color}15 0%, transparent 60%)` : undefined,
          }}
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-muted-foreground mb-3 active:opacity-70 touch-target"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Materias</span>
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: (subject?.color || "#666") + "20" }}
              >
                {subject?.emoji || "📚"}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold truncate">{subject?.name || "..."}</h1>
                <p className="text-xs text-muted-foreground">
                  {classes.length} clase{classes.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {activeTab === "clases" && (
              <button
                onClick={openCreate}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target shrink-0"
              >
                <Plus className="w-5 h-5 text-primary-foreground" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 p-1 bg-secondary/50 rounded-xl">
            <button
              onClick={() => setActiveTab("clases")}
              aria-label="Ver clases"
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "clases"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground active:opacity-70"
              }`}
            >
              Clases
            </button>
            <button
              onClick={() => setActiveTab("documentos")}
              aria-label="Ver documentos"
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "documentos"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground active:opacity-70"
              }`}
            >
              Documentos
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="px-4">
          {activeTab === "documentos" && (
            <div className="mt-3">
              <SubjectDocuments subjectId={subjectId} subject={subject} />
            </div>
          )}
          {activeTab === "clases" && (
            <>
              {loading ? (
                <div className="space-y-2.5 mt-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
                  ))}
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm mb-1">Sin clases aun</p>
                  <p className="text-xs text-muted-foreground/60">Agrega tu primera clase</p>
                </div>
              ) : (
                <div className="space-y-5 mt-2 pb-4">
                  {Object.entries(groupedClasses).map(([month, monthClasses]) => (
                    <div key={month}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        {month}
                      </p>
                      <div className="space-y-2">
                        {monthClasses.map((cls) => (
                          <div key={cls.id} className="relative">
                            <button
                              onClick={() => router.push(`/materias/${subjectId}/${cls.id}`)}
                              className="w-full text-left p-3.5 rounded-xl bg-card border border-border active:scale-[0.98] transition-transform"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center justify-center w-10 shrink-0">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    {format(cls.date, "MMM", { locale: es })}
                                  </span>
                                  <span className="text-lg font-bold">{format(cls.date, "d")}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-[15px] truncate">{cls.title}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {format(cls.date, "EEEE", { locale: es })}
                                  </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              </div>
                            </button>

                            <button
                              onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === cls.id ? null : cls.id); }}
                              className="absolute top-2.5 right-10 w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center touch-target"
                            >
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>

                            {menuOpen === cls.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                                <div className="absolute top-11 right-10 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                                  <button onClick={() => openEdit(cls.id)} className="w-full flex items-center gap-3 px-4 py-3 text-sm active:bg-secondary/50">
                                    <Pencil className="w-4 h-4" /> Editar
                                  </button>
                                  <button onClick={() => { setMenuOpen(null); setDeleteId(cls.id); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive active:bg-secondary/50">
                                    <Trash2 className="w-4 h-4" /> Eliminar
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
            </>
          )}
        </div>
      </div>

      <Sheet
        open={showCreate}
        onClose={() => { setShowCreate(false); resetForm(); }}
        title={editingId ? "Editar clase" : "Nueva clase"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Titulo</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Clase 5 - Grafos"
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="min-w-0">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block truncate">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-w-0 px-2 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark]"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear clase"}
          </button>
        </div>
      </Sheet>

      <Confirm
        open={!!deleteId}
        title="Eliminar clase"
        message="Se eliminaran todas las entradas de esta clase."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </AppShell>
  );
}
