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
import { Confirm } from "@/components/ui/confirm";
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
  if (seconds < 60) return "ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
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

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);
  const classSession = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);

  const [showSheet, setShowSheet] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [entryType, setEntryType] = useState<BoardEntry["type"]>("notes");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const resetForm = () => { setEntryType("notes"); setContent(""); setTagsInput(""); setEditingId(null); };
  const openCreate = () => { resetForm(); setShowSheet(true); };

  const openEdit = (entry: BoardEntry) => {
    setEntryType(entry.type);
    setContent(entry.content);
    setTagsInput(entry.tags.join(", "));
    setEditingId(entry.id);
    setMenuOpen(null);
    setShowSheet(true);
  };

  const handleSave = async () => {
    if (!content.trim()) { toast.error("El contenido es obligatorio"); return; }
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    setSaving(true);
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
    } catch { toast.error("Error al guardar"); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try { await deleteEntry(id); toast.success("Entrada eliminada"); }
    catch { toast.error("Error al eliminar"); }
  };

  const color = subject?.color || "#6366f1";

  if (!classSession && !loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <p className="text-muted-foreground">Clase no encontrada</p>
          <button onClick={() => router.replace(`/materias/${subjectId}`)} className="mt-4 text-primary text-sm font-medium">
            Volver a clases
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-enter">
        <div
          className="px-4 pt-safe pb-4"
          style={{ background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)` }}
        >
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-muted-foreground mb-3 active:opacity-70 touch-target">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{subject?.name || "Clases"}</span>
          </button>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{classSession?.title || "..."}</h1>
              <p className="text-xs text-muted-foreground">
                {entries.length} entrada{entries.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={openCreate} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target shrink-0">
              <Plus className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>

        <div className="px-4">
          {loading ? (
            <div className="space-y-2.5 mt-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">Sin entradas aun</p>
              <p className="text-xs text-muted-foreground/60 mb-5">Agrega apuntes, tareas o recursos</p>
              <div className="flex gap-2.5 justify-center">
                <button
                  onClick={() => toast("Proximamente", { description: "El escaneo OCR llegara pronto." })}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-sm font-medium active:scale-[0.98] transition-transform touch-target"
                >
                  <Camera className="w-4 h-4" /> Escanear
                </button>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform touch-target"
                >
                  <PenLine className="w-4 h-4" /> Escribir
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 mt-3">
              {entries.map((entry) => {
                const Icon = ENTRY_ICONS[entry.type];
                const typeLabel = BOARD_ENTRY_TYPES.find((t) => t.value === entry.type)?.label || entry.type;
                return (
                  <div key={entry.id} className="relative">
                    <div className="p-3.5 rounded-xl bg-card border border-border">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: color + "20" }}>
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0 pr-7">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[11px] font-semibold" style={{ color }}>{typeLabel}</span>
                            <span className="text-[11px] text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                          </div>
                          <p className="text-sm leading-relaxed line-clamp-3 whitespace-pre-wrap">{entry.content}</p>
                          {entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {entry.tags.map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] bg-secondary text-muted-foreground">{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setMenuOpen(menuOpen === entry.id ? null : entry.id)}
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-secondary/50 flex items-center justify-center touch-target"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {menuOpen === entry.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                        <div className="absolute top-10 right-2.5 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                          <button onClick={() => openEdit(entry)} className="w-full flex items-center gap-3 px-4 py-3 text-sm active:bg-secondary/50">
                            <Pencil className="w-4 h-4" /> Editar
                          </button>
                          <button onClick={() => { setMenuOpen(null); setDeleteId(entry.id); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive active:bg-secondary/50">
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

      <Sheet open={showSheet} onClose={() => { setShowSheet(false); resetForm(); }} title={editingId ? "Editar entrada" : "Nueva entrada"}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {BOARD_ENTRY_TYPES.map((t) => {
                const Icon = ENTRY_ICONS[t.value as BoardEntry["type"]];
                return (
                  <button
                    key={t.value}
                    onClick={() => setEntryType(t.value as BoardEntry["type"])}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      entryType === t.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Contenido</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe aqui..."
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tags (separados por coma)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="grafos, algoritmos"
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear entrada"}
          </button>
        </div>
      </Sheet>

      <Confirm open={!!deleteId} title="Eliminar entrada" message="Se eliminara esta entrada permanentemente." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </AppShell>
  );
}
