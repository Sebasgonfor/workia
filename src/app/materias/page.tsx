"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { Confirm } from "@/components/ui/confirm";
import { useSubjects } from "@/lib/hooks";
import { SUBJECT_COLORS, SUBJECT_EMOJIS } from "@/types";
import { toast } from "sonner";

export default function MateriasPage() {
  const { subjects, loading, addSubject, updateSubject, deleteSubject } = useSubjects();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [color, setColor] = useState<typeof SUBJECT_COLORS[number]>(SUBJECT_COLORS[0]);
  const [emoji, setEmoji] = useState<typeof SUBJECT_EMOJIS[number]>(SUBJECT_EMOJIS[0]);

  const resetForm = () => {
    setName("");
    setColor(SUBJECT_COLORS[0]);
    setEmoji(SUBJECT_EMOJIS[0]);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (id: string) => {
    const subject = subjects.find((s) => s.id === id);
    if (!subject) return;
    setName(subject.name);
    setColor(subject.color as typeof SUBJECT_COLORS[number]);
    setEmoji(subject.emoji as typeof SUBJECT_EMOJIS[number]);
    setEditingId(id);
    setMenuOpen(null);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateSubject(editingId, { name: name.trim(), color, emoji });
        toast.success("Materia actualizada");
      } else {
        await addSubject({ name: name.trim(), color, emoji });
        toast.success("Materia creada");
      }
      setShowCreate(false);
      resetForm();
    } catch (err) {
      console.error("Error al guardar materia:", err);
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
      await deleteSubject(id);
      toast.success("Materia eliminada");
    } catch (err) {
      console.error("Error al eliminar materia:", err);
      toast.error("Error al eliminar");
    }
  };

  return (
    <AppShell>
      <div className="px-4 pt-safe page-enter">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold">Materias</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {subjects.length} materia{subjects.length !== 1 ? "s" : ""} este semestre
            </p>
          </div>
          <button
            onClick={openCreate}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target"
          >
            <Plus className="w-5 h-5 text-primary-foreground" />
          </button>
        </div>

        {/* Subject Cards */}
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[72px] rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
              <Plus className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-1">Sin materias aun</p>
            <p className="text-xs text-muted-foreground/60">
              Agrega tus materias del semestre
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {subjects.map((subject) => (
              <div key={subject.id} className="relative">
                <button
                  onClick={() => router.push(`/materias/${subject.id}`)}
                  className="w-full text-left p-3.5 rounded-xl bg-card border border-border active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: subject.color + "20" }}
                    >
                      {subject.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">{subject.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: subject.color }}
                        />
                        <span className="text-xs text-muted-foreground">
                          Toca para ver clases
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(menuOpen === subject.id ? null : subject.id);
                  }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center touch-target"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>

                {menuOpen === subject.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                    <div className="absolute top-12 right-3 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                      <button
                        onClick={() => openEdit(subject.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm active:bg-secondary/50"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => { setMenuOpen(null); setDeleteId(subject.id); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive active:bg-secondary/50"
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
        )}
      </div>

      {/* Create/Edit Sheet */}
      <Sheet
        open={showCreate}
        onClose={() => { setShowCreate(false); resetForm(); }}
        title={editingId ? "Editar materia" : "Nueva materia"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Analisis de Algoritmos"
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Emoji</label>
            <div className="flex flex-wrap gap-1.5 py-0.5">
              {SUBJECT_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 transition-all ${
                    emoji === e
                      ? "bg-primary/20 ring-2 ring-primary scale-110"
                      : "bg-secondary active:bg-secondary/80"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Color</label>
            <div className="flex flex-wrap gap-2.5 py-0.5">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full shrink-0 transition-all ${
                    color === c ? "ring-2 ring-offset-2 ring-offset-card scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear materia"}
          </button>
        </div>
      </Sheet>

      <Confirm
        open={!!deleteId}
        title="Eliminar materia"
        message="Se eliminaran todas las clases, entradas y tareas asociadas. Esta accion no se puede deshacer."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </AppShell>
  );
}
