"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  FileText,
  CheckSquare,
  Paperclip,
  MoreVertical,
  Pencil,
  Trash2,
  Camera,
  PenLine,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { useSubjects, useClasses, useBoardEntries } from "@/lib/hooks";
import { BOARD_ENTRY_TYPES } from "@/types";
import type { BoardEntry } from "@/types";
import { toast } from "sonner";

const ENTRY_ICONS = {
  notes: FileText,
  task: CheckSquare,
  resource: Paperclip,
} as const;

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "hace un momento";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.id as string;
  const classId = params.classId as string;

  const { subjects } = useSubjects();
  const { classes } = useClasses(subjectId);
  const { entries, loading, addEntry, updateEntry, deleteEntry } =
    useBoardEntries(subjectId, classId);

  const subject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );
  const classSession = useMemo(
    () => classes.find((c) => c.id === classId),
    [classes, classId]
  );

  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Form state
  const [entryType, setEntryType] = useState<BoardEntry["type"]>("notes");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const resetForm = () => {
    setEntryType("notes");
    setContent("");
    setTagsInput("");
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowSheet(true);
  };

  const openEdit = (entry: BoardEntry) => {
    setEntryType(entry.type);
    setContent(entry.content);
    setTagsInput(entry.tags.join(", "));
    setEditingId(entry.id);
    setMenuOpen(null);
    setShowSheet(true);
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("El contenido es obligatorio");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingId) {
        await updateEntry(editingId, { type: entryType, content: content.trim(), tags });
        toast.success("Entrada actualizada");
      } else {
        await addEntry({ type: entryType, content: content.trim(), tags });
        toast.success("Entrada creada");
      }
      setShowSheet(false);
      resetForm();
    } catch {
      toast.error("Error al guardar");
    }
  };

  const handleDelete = async (id: string) => {
    setMenuOpen(null);
    try {
      await deleteEntry(id);
      toast.success("Entrada eliminada");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const color = subject?.color || "#6366f1";

  if (!classSession && !loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-5">
          <p className="text-muted-foreground">Clase no encontrada</p>
          <button
            onClick={() => router.replace(`/materias/${subjectId}`)}
            className="mt-4 text-primary text-sm font-medium"
          >
            Volver a clases
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
            background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)`,
          }}
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground mb-4 active:opacity-70"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">{subject?.name || "Clases"}</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">
                {classSession?.title || "..."}
              </h1>
              <p className="text-sm text-muted-foreground">
                {entries.length} entrada{entries.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={openCreate}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>

        {/* Entries List */}
        <div className="px-5">
          {loading ? (
            <div className="space-y-3 mt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-1">Sin entradas aun</p>
              <p className="text-sm text-muted-foreground/60 mb-6">
                Agrega apuntes, tareas o recursos
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() =>
                    toast("Proximamente", {
                      description: "El escaneo OCR se implementara en la Fase 2.",
                    })
                  }
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  <Camera className="w-4 h-4" />
                  Escanear
                </button>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  <PenLine className="w-4 h-4" />
                  Escribir
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {entries.map((entry) => {
                const Icon = ENTRY_ICONS[entry.type];
                const typeLabel =
                  BOARD_ENTRY_TYPES.find((t) => t.value === entry.type)?.label ||
                  entry.type;

                return (
                  <div key={entry.id} className="relative group">
                    <div className="p-4 rounded-xl bg-card border border-border">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: color + "20" }}
                        >
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold" style={{ color }}>
                              {typeLabel}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {timeAgo(entry.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed line-clamp-4 whitespace-pre-wrap">
                            {entry.content}
                          </p>
                          {entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Menu button */}
                    <button
                      onClick={() =>
                        setMenuOpen(menuOpen === entry.id ? null : entry.id)
                      }
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
                      style={{
                        opacity: menuOpen === entry.id ? 1 : undefined,
                      }}
                    >
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>

                    {/* Dropdown */}
                    {menuOpen === entry.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setMenuOpen(null)}
                        />
                        <div className="absolute top-12 right-3 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[150px]">
                          <button
                            onClick={() => openEdit(entry)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary/50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-secondary/50 transition-colors"
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
        title={editingId ? "Editar entrada" : "Nueva entrada"}
      >
        <div className="space-y-6">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Tipo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BOARD_ENTRY_TYPES.map((t) => {
                const Icon = ENTRY_ICONS[t.value as BoardEntry["type"]];
                const selected = entryType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setEntryType(t.value as BoardEntry["type"])}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Contenido
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe tus apuntes aqui..."
              rows={5}
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              autoFocus
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Tags (separados por coma)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Ej: grafos, algoritmos, parcial"
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform"
          >
            {editingId ? "Guardar cambios" : "Crear entrada"}
          </button>
        </div>
      </Sheet>
    </AppShell>
  );
}
