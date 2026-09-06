"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronDown,
  Layers,
  Check,
  Search,
  GripVertical,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { Confirm } from "@/components/ui/confirm";
import { Select } from "@/components/ui/select";
import { useSubjects, useCycles } from "@/lib/hooks";
import { SUBJECT_COLORS, SUBJECT_EMOJIS } from "@/types";
import type { CycleKind } from "@/types";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const CYCLE_KIND_OPTIONS: { value: CycleKind; label: string }[] = [
  { value: "semestre", label: "Semestre" },
  { value: "trimestre", label: "Trimestre" },
  { value: "año", label: "Año" },
  { value: "otro", label: "Otro" },
];

const NO_CYCLE = "__none__";
const CREATE_CYCLE = "__create__";

interface DragHandleProps {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  isDragging: boolean;
}

type SortableRowData =
  | { type: "cycle" }
  | { type: "subject"; groupIds: string[] };

// Generic drag-and-drop-able row: wraps whatever is passed as children,
// exposing the drag handle props via a render-prop so only a small grip
// icon (not the whole card) needs to opt into starting the drag. `data`
// tags the item so a single shared onDragEnd can tell a cycle drag apart
// from a subject drag (dnd-kit only wants one DndContext on the page —
// nesting them makes both fight over the same pointer events).
function SortableRow({
  id,
  data,
  children,
}: {
  id: string;
  data?: SortableRowData;
  children: (props: DragHandleProps) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

export default function MateriasPage() {
  const { subjects, loading, addSubject, updateSubject, deleteSubject, reorderSubjects } =
    useSubjects();
  const {
    cycles,
    loading: cyclesLoading,
    addCycle,
    updateCycle,
    deleteCycle,
    reorderCycles,
  } = useCycles();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<{ id: string; top: number; right: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [reordering, setReordering] = useState(false);
  const [activeDrag, setActiveDrag] = useState<
    | { type: "cycle"; label: string; width: number }
    | { type: "subject"; emoji: string; name: string; color: string; width: number }
    | null
  >(null);

  const dndSensors = useSensors(
    // A near-zero threshold: the whole card is the drag surface (no click to
    // protect against here, we disable navigation/menu while reordering), so
    // we don't need slack — a bigger distance makes the overlay visibly
    // "jump" by that many px the instant the drag activates.
    useSensor(PointerSensor, { activationConstraint: { distance: 0 } })
  );

  // Cycle management sheet
  const [showCycles, setShowCycles] = useState(false);
  const [cycleEditingId, setCycleEditingId] = useState<string | null>(null);
  const [cycleName, setCycleName] = useState("");
  const [cycleKind, setCycleKind] = useState<CycleKind>("semestre");
  const [cycleSaving, setCycleSaving] = useState(false);
  const [cycleSubjectIds, setCycleSubjectIds] = useState<Set<string>>(new Set());
  const [cycleSubjectSearch, setCycleSubjectSearch] = useState("");
  const [deleteCycleId, setDeleteCycleId] = useState<string | null>(null);

  // Subject form state
  const [name, setName] = useState("");
  const [color, setColor] = useState<typeof SUBJECT_COLORS[number]>(SUBJECT_COLORS[0]);
  const [emoji, setEmoji] = useState<typeof SUBJECT_EMOJIS[number]>(SUBJECT_EMOJIS[0]);
  const [cycleId, setCycleId] = useState<string>(NO_CYCLE);

  // Inline "create a cycle" form shown right inside the subject sheet
  const [inlineNewCycleName, setInlineNewCycleName] = useState("");
  const [inlineNewCycleKind, setInlineNewCycleKind] = useState<CycleKind>("semestre");
  const [inlineCycleSaving, setInlineCycleSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setColor(SUBJECT_COLORS[0]);
    setEmoji(SUBJECT_EMOJIS[0]);
    setCycleId(NO_CYCLE);
    setInlineNewCycleName("");
    setInlineNewCycleKind("semestre");
    setEditingId(null);
  };

  const handleCycleSelect = (value: string) => {
    if (value === CREATE_CYCLE) {
      setInlineNewCycleName("");
      setInlineNewCycleKind("semestre");
    }
    setCycleId(value);
  };

  const handleCreateInlineCycle = async () => {
    if (!inlineNewCycleName.trim()) {
      toast.error("El nombre del ciclo es obligatorio");
      return;
    }
    setInlineCycleSaving(true);
    try {
      const newId = await addCycle({ name: inlineNewCycleName.trim(), kind: inlineNewCycleKind });
      if (newId) {
        setCycleId(newId);
        toast.success("Ciclo creado");
      }
    } catch (err) {
      console.error("Error al crear ciclo:", err);
      toast.error("Error al crear el ciclo");
    } finally {
      setInlineCycleSaving(false);
    }
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
    if (cycleId === CREATE_CYCLE) {
      toast.error("Terminá de crear el ciclo o elegí uno existente");
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
    setCycleSubjectIds(new Set());
    setCycleSubjectSearch("");
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
    setCycleSubjectIds(new Set(subjects.filter((s) => s.cycleId === id).map((s) => s.id)));
    setCycleSubjectSearch("");
  };

  const toggleCycleSubject = (subjectId: string) => {
    setCycleSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
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
        // Reconcile subject membership: add newly checked, remove unchecked
        // ones that used to belong here — only touch what actually changed.
        const changes = subjects
          .filter((s) => {
            const shouldBeIn = cycleSubjectIds.has(s.id);
            const isIn = s.cycleId === cycleEditingId;
            return shouldBeIn !== isIn;
          })
          .map((s) =>
            updateSubject(s.id, { cycleId: cycleSubjectIds.has(s.id) ? cycleEditingId : null })
          );
        await Promise.all(changes);
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
    // Manual drag order first (fallback keeps createdAt order for subjects
    // that predate this field / were never dragged).
    for (const list of Array.from(buckets.values())) {
      list.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
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

  // Single shared drag-end handler for both sortable scopes on this page
  // (cycles, and each cycle's subjects) — dnd-kit wants one DndContext per
  // page, so the item's own `data.type` says which reorder it belongs to.
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as SortableRowData | undefined;
    if (!data) return;
    // Match the overlay's width to the real card so it doesn't visually
    // resize/jump the moment it lifts off — it should feel like the exact
    // same card leaving from right under the cursor, not a different box.
    const width = event.active.rect.current.initial?.width ?? 0;
    if (data.type === "cycle") {
      const group = groups.find((g) => g.key === event.active.id);
      setActiveDrag({ type: "cycle", label: group?.label ?? "", width });
    } else {
      const subject = subjects.find((s) => s.id === event.active.id);
      if (subject) {
        setActiveDrag({
          type: "subject",
          emoji: subject.emoji,
          name: subject.name,
          color: subject.color,
          width,
        });
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const data = active.data.current as SortableRowData | undefined;
    if (!data) return;

    if (data.type === "cycle") {
      const ids = groups.filter((g) => g.key !== NO_CYCLE).map((g) => g.key);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      reorderCycles(arrayMove(ids, oldIndex, newIndex));
      return;
    }

    if (data.type === "subject") {
      const ids = data.groupIds;
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      reorderSubjects(arrayMove(ids, oldIndex, newIndex));
    }
  };

  const cycleSelectOptions = [
    { value: NO_CYCLE, label: "Sin ciclo" },
    ...cycles.map((c) => ({ value: c.id, label: c.name })),
    { value: CREATE_CYCLE, label: "+ Crear nuevo ciclo" },
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
              onClick={() => setReordering((v) => !v)}
              className={`w-10 h-10 rounded-full border flex items-center justify-center active:scale-95 transition-transform touch-target ${
                reordering
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-secondary/60 border-border"
              }`}
              aria-label={reordering ? "Terminar de reordenar" : "Reordenar ciclos y materias"}
              aria-pressed={reordering}
            >
              {reordering ? <Check className="w-4.5 h-4.5" /> : <Pencil className="w-4.5 h-4.5" />}
            </button>
            <button
              onClick={openCreateCycle}
              className="w-10 h-10 rounded-full bg-secondary/60 border border-border flex items-center justify-center active:scale-95 transition-transform touch-target"
              aria-label="Gestionar ciclo académico"
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
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDrag(null)}
          >
            <SortableContext
              items={groups.filter((g) => g.key !== NO_CYCLE).map((g) => g.key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6">
                {groups.map((group) => {
                  const isRealCycle = group.key !== NO_CYCLE;
                  const groupSubjectIds = group.subjects.map((s) => s.id);

                  const header = (dragHandle?: DragHandleProps) => {
                    const canDragHeader = reordering && isRealCycle && !!dragHandle;
                    return (
                    <div
                      {...(canDragHeader ? dragHandle!.attributes : {})}
                      {...(canDragHeader ? dragHandle!.listeners : {})}
                      className={`flex items-center gap-1.5 mb-2.5 ${
                        canDragHeader ? "cursor-grab active:cursor-grabbing touch-none" : ""
                      }`}
                    >
                      {reordering && isRealCycle && (
                        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <button
                        onClick={() =>
                          !reordering &&
                          setCollapsed((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                        }
                        className="flex-1 flex items-center justify-between group"
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
                    </div>
                  );
                  };

                  const body = (
                    <>
                      {!collapsed[group.key] && (
                        <SortableContext items={groupSubjectIds} strategy={rectSortingStrategy}>
                          <div className="space-y-2.5 stagger-children md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
                              {group.subjects.map((subject) => (
                                <SortableRow
                                  key={subject.id}
                                  id={subject.id}
                                  data={{ type: "subject", groupIds: groupSubjectIds }}
                                >
                                  {({ attributes, listeners }) => (
                                    <div className="relative">
                                      <button
                                        {...(reordering ? attributes : {})}
                                        {...(reordering ? listeners : {})}
                                        onClick={() =>
                                          !reordering && router.push(`/materias/${subject.id}`)
                                        }
                                        aria-label={reordering ? `Reordenar ${subject.name}` : undefined}
                                        className={`w-full text-left p-3.5 rounded-xl bg-card border border-border transition-transform ${
                                          reordering
                                            ? "pl-3.5 pr-12 cursor-grab active:cursor-grabbing touch-none"
                                            : "pr-12 active:scale-[0.98]"
                                        }`}
                                      >
                                        <div className="flex items-center gap-3.5">
                                          {reordering && (
                                            <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                                          )}
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
                                                {reordering ? "Arrastra para reordenar" : "Toca para ver clases"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </button>

                                      {!reordering && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (menuOpen?.id === subject.id) {
                                              setMenuOpen(null);
                                              return;
                                            }
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setMenuOpen({
                                              id: subject.id,
                                              top: rect.bottom + 4,
                                              right: window.innerWidth - rect.right,
                                            });
                                          }}
                                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center touch-target"
                                        >
                                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </SortableRow>
                              ))}
                          </div>
                        </SortableContext>
                      )}
                    </>
                  );

                  if (isRealCycle) {
                    return (
                      <SortableRow key={group.key} id={group.key} data={{ type: "cycle" }}>
                        {(dragHandle) => (
                          <div>
                            {header(dragHandle)}
                            {body}
                          </div>
                        )}
                      </SortableRow>
                    );
                  }
                  return (
                    <div key={group.key}>
                      {header()}
                      {body}
                    </div>
                  );
                })}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
              {activeDrag?.type === "subject" && (
                <div
                  style={{ width: activeDrag.width || undefined }}
                  className="p-3.5 pl-3.5 pr-12 rounded-xl bg-card border border-primary shadow-2xl scale-105 flex items-center gap-3.5 cursor-grabbing touch-none"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: activeDrag.color + "20" }}
                  >
                    {activeDrag.emoji}
                  </div>
                  <p className="font-semibold text-[15px] truncate">{activeDrag.name}</p>
                </div>
              )}
              {activeDrag?.type === "cycle" && (
                <div
                  style={{ width: activeDrag.width || undefined }}
                  className="px-4 py-2.5 rounded-xl bg-card border border-primary shadow-2xl scale-105 flex items-center gap-2 cursor-grabbing touch-none"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide">{activeDrag.label}</h2>
                </div>
              )}
            </DragOverlay>
          </DndContext>
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
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Ciclo académico <span className="text-muted-foreground/50 normal-case">(opcional)</span>
            </label>
            <Select
              value={cycleId}
              onChange={handleCycleSelect}
              options={cycleSelectOptions}
              ariaLabel="Ciclo de la materia"
            />

            {cycleId === CREATE_CYCLE && (
              <div className="mt-2.5 p-3 rounded-xl bg-secondary/40 border border-border space-y-2.5">
                <input
                  type="text"
                  value={inlineNewCycleName}
                  onChange={(e) => setInlineNewCycleName(e.target.value)}
                  placeholder="Ej: Semestre 1 - 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Select
                  value={inlineNewCycleKind}
                  onChange={(v) => setInlineNewCycleKind(v as CycleKind)}
                  options={CYCLE_KIND_OPTIONS}
                  ariaLabel="Tipo de ciclo nuevo"
                />
                <button
                  onClick={handleCreateInlineCycle}
                  disabled={inlineCycleSaving}
                  className="w-full py-2.5 rounded-xl bg-primary/90 text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {inlineCycleSaving ? "Creando..." : "Crear y usar este ciclo"}
                </button>
              </div>
            )}
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

      {/* Subject card menu — fixed + high z-index so it never renders behind
          a neighboring grid card (a plain "absolute" child stacks within its
          own card's grid cell and can end up painted under the row below). */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
          <div
            style={{ top: menuOpen.top, right: menuOpen.right }}
            className="fixed z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px] menu-enter"
          >
            <button
              onClick={() => openEdit(menuOpen.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary/50 active:bg-secondary/50 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={() => { const id = menuOpen.id; setMenuOpen(null); setDeleteId(id); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        </>
      )}

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
        title="Ciclo académico"
      >
        <div className="space-y-5 pt-3">
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

            {cycleEditingId && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Materias {cycleSubjectIds.size > 0 ? `(${cycleSubjectIds.size})` : ""}
                </label>
                {subjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">Todavia no tenes materias creadas</p>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={cycleSubjectSearch}
                        onChange={(e) => setCycleSubjectSearch(e.target.value)}
                        placeholder="Buscar materia..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-1.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-1.5 max-h-56 overflow-y-auto no-scrollbar">
                      {subjects
                        .filter((s) =>
                          s.name.toLowerCase().includes(cycleSubjectSearch.trim().toLowerCase())
                        )
                        .map((subject) => {
                      const checked = cycleSubjectIds.has(subject.id);
                      return (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => toggleCycleSubject(subject.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                            checked
                              ? "bg-primary/10 border-primary/60"
                              : "bg-secondary/40 border-border hover:bg-secondary/60"
                          }`}
                        >
                          <span className="text-lg shrink-0">{subject.emoji}</span>
                          <span className="flex-1 min-w-0 text-sm font-medium truncate">
                            {subject.name}
                          </span>
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              checked
                                ? "bg-primary border-primary"
                                : "border-border bg-transparent"
                            }`}
                          >
                            {checked && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                          </span>
                        </button>
                      );
                    })}
                    </div>
                  </>
                )}
              </div>
            )}

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
