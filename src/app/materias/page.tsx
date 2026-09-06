"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreVertical, Pencil, Trash2, ChevronDown, Layers } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { Confirm } from "@/components/ui/confirm";
import { Select } from "@/components/ui/select";
import { useSubjects, useCycles } from "@/lib/hooks";
import { SUBJECT_COLORS, SUBJECT_EMOJIS } from "@/types";
import type { CycleKind } from "@/types";
import { toast } from "sonner";

const CYCLE_KIND_OPTIONS: { value: CycleKind; label: string }[] = [
  { value: "semestre", label: "Semestre" },
  { value: "trimestre", label: "Trimestre" },
  { value: "año", label: "Año" },
  { value: "otro", label: "Otro" },
];

const NO_CYCLE = "__none__";

export default function MateriasPage() {
  const { subjects, loading, addSubject, updateSubject, deleteSubject } = useSubjects();
  const {
    cycles,
    loading: cyclesLoading,
    addCycle,
    updateCycle,
    deleteCycle,
  } = useCycles();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Cycle management sheet
  const [showCycles, setShowCycles] = useState(false);
  const [cycleEditingId, setCycleEditingId] = useState<string | null>(null);
  const [cycleName, setCycleName] = useState("");
  const [cycleKind, setCycleKind] = useState<CycleKind>("semestre");
  const [cycleSaving, setCycleSaving] = useState(false);
  const [deleteCycleId, setDeleteCycleId] = useState<string | null>(null);

  // Subject form state
  const [name, setName] = useState("");
  const [color, setColor] = useState<typeof SUBJECT_COLORS[number]>(SUBJECT_COLORS[0]);
  const [emoji, setEmoji] = useState<typeof SUBJECT_EMOJIS[number]>(SUBJECT_EMOJIS[0]);
  const [cycleId, setCycleId] = useState<string>(NO_CYCLE);

  const resetForm = () => {
    setName("");
    setColor(SUBJECT_COLORS[0]);
    setEmoji(SUBJECT_EMOJIS[0]);
    setCycleId(NO_CYCLE);
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
    setCycleId(subject.cycleId ?? NO_CYCLE);
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
      const resolvedCycleId = cycleId === NO_CYCLE ? null : cycleId;
      if (editingId) {
        await updateSubject(editingId, { name: name.trim(), color, emoji, cycleId: resolvedCycleId });
        toast.success("Materia actualizada");
      } else {
        await addSubject({ name: name.trim(), color, emoji, cycleId: resolvedCycleId });
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

  // --- Cycle management ---

  const resetCycleForm = () => {
    setCycleName("");
    setCycleKind("semestre");
    setCycleEditingId(null);
  };

  const openCreateCycle = () => {
    resetCycleForm();
    setShowCycles(true);
  };

  const openEditCycle = (id: string) => {
    const cycle = cycles.find((c) => c.id === id);
    if (!cycle) return;
    setCycleName(cycle.name);
    setCycleKind(cycle.kind);
    setCycleEditingId(id);
  };

  const handleSaveCycle = async () => {
    if (!cycleName.trim()) {
      toast.error("El nombre del ciclo es obligatorio");
      return;
    }
    setCycleSaving(true);
    try {
      if (cycleEditingId) {
        await updateCycle(cycleEditingId, { name: cycleName.trim(), kind: cycleKind });
        toast.success("Ciclo actualizado");
      } else {
        await addCycle({ name: cycleName.trim(), kind: cycleKind });
        toast.success("Ciclo creado");
      }
      resetCycleForm();
    } catch (err) {
      console.error("Error al guardar ciclo:", err);
      toast.error("Error al guardar el ciclo");
    } finally {
      setCycleSaving(false);
    }
  };

  const handleDeleteCycle = async () => {
    if (!deleteCycleId) return;
    const id = deleteCycleId;
    setDeleteCycleId(null);
    try {
      await deleteCycle(id);
      toast.success("Ciclo eliminado. Sus materias pasaron a Sin ciclo");
    } catch (err) {
      console.error("Error al eliminar ciclo:", err);
      toast.error("Error al eliminar el ciclo");
    }
  };

  // --- Grouping ---

  const groups = useMemo(() => {
    const byId = new Map(cycles.map((c) => [c.id, c]));
    const buckets = new Map<string, typeof subjects>();
    for (const subject of subjects) {
      const key = subject.cycleId && byId.has(subject.cycleId) ? subject.cycleId : NO_CYCLE;
      const list = buckets.get(key) ?? [];
      list.push(subject);
      buckets.set(key, list);
    }
    const ordered: { key: string; label: string; subjects: typeof subjects }[] = cycles
      .map((c) => ({ key: c.id, label: c.name, subjects: buckets.get(c.id) ?? [] }))
      .filter((g) => g.subjects.length > 0);
    const unassigned = buckets.get(NO_CYCLE) ?? [];
    if (unassigned.length > 0 || cycles.length === 0) {
      ordered.push({ key: NO_CYCLE, label: "Sin ciclo", subjects: unassigned });
    }
    return ordered;
  }, [subjects, cycles]);

  const cycleSelectOptions = [
    { value: NO_CYCLE, label: "Sin ciclo" },
    ...cycles.map((c) => ({ value: c.id, label: c.name })),
  ];

  const totalCount = subjects.length;

  return (
    <AppShell>
      <div className="px-4 pt-safe page-enter md:px-8 md:pt-8 md:max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold">Materias</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalCount} materia{totalCount !== 1 ? "s" : ""}
              {cycles.length > 0 ? ` en ${cycles.length} ciclo${cycles.length !== 1 ? "s" : ""}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateCycle}
              className="w-10 h-10 rounded-full bg-secondary/60 border border-border flex items-center justify-center active:scale-95 transition-transform touch-target"
              aria-label="Gestionar ciclos"
            >
              <Layers className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={openCreate}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target"
              aria-label="Nueva materia"
            >
              <Plus className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>

        {/* Subject Cards */}
        {loading || cyclesLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[72px] rounded-xl bg-card animate-pulse" />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
              <Plus className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-1">Sin materias aun</p>
            <p className="text-xs text-muted-foreground/60">
              Agrega tus materias y organizalas por ciclo
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key}>
                <button
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                  }
                  className="w-full flex items-center justify-between mb-2.5 group"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.label}
                    </h2>
                    <span className="text-xs text-muted-foreground/60">
                      {group.subjects.length}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      collapsed[group.key] ? "-rotate-90" : ""
                    }`}
                  />
                </button>

                {!collapsed[group.key] && (
                  <div className="space-y-2.5 stagger-children md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
                    {group.subjects.map((subject) => (
                      <div key={subject.id} className="relative">
                        <button
                          onClick={() => router.push(`/materias/${subject.id}`)}
                          className="w-full text-left p-3.5 pr-12 rounded-xl bg-card border border-border active:scale-[0.98] transition-transform"
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
                            <div className="absolute top-12 right-3 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px] menu-enter">
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
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Subject Sheet */}
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
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ciclo</label>
            <Select
              value={cycleId}
              onChange={setCycleId}
              options={cycleSelectOptions}
              ariaLabel="Ciclo de la materia"
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

      {/* Cycle Management Sheet */}
      <Sheet
        open={showCycles}
        onClose={() => { setShowCycles(false); resetCycleForm(); }}
        title="Ciclos"
      >
        <div className="space-y-5">
          {cycles.length > 0 && (
            <div className="space-y-2">
              {cycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-secondary/40 border border-border"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{cycle.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{cycle.kind}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditCycle(cycle.id)}
                      className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center touch-target"
                      aria-label={`Editar ${cycle.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteCycleId(cycle.id)}
                      className="w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center touch-target text-destructive"
                      aria-label={`Eliminar ${cycle.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground pt-3">
              {cycleEditingId ? "Editar ciclo" : "Nuevo ciclo"}
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre</label>
              <input
                type="text"
                value={cycleName}
                onChange={(e) => setCycleName(e.target.value)}
                placeholder="Ej: Semestre 1 - 2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo</label>
              <Select
                value={cycleKind}
                onChange={(v) => setCycleKind(v as CycleKind)}
                options={CYCLE_KIND_OPTIONS}
                ariaLabel="Tipo de ciclo"
              />
            </div>
            <div className="flex gap-2">
              {cycleEditingId && (
                <button
                  onClick={resetCycleForm}
                  className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-semibold active:scale-[0.98] transition-transform"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleSaveCycle}
                disabled={cycleSaving}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {cycleSaving ? "Guardando..." : cycleEditingId ? "Guardar cambios" : "Crear ciclo"}
              </button>
            </div>
          </div>
        </div>
      </Sheet>

      <Confirm
        open={!!deleteCycleId}
        title="Eliminar ciclo"
        message="El ciclo se eliminara. Sus materias no se borran: pasaran a Sin ciclo."
        onConfirm={handleDeleteCycle}
        onCancel={() => setDeleteCycleId(null)}
      />
    </AppShell>
  );
}
