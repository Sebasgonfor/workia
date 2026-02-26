"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Plus,
  Layers,
  ChevronRight,
  RotateCcw,
  Trash2,
  Sparkles,
  Loader2,
  X,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { Confirm } from "@/components/ui/confirm";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { useSubjects, useFlashcards, useClasses } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";
import { getDocs, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { REVIEW_RATINGS, FLASHCARD_TYPES } from "@/types";
import type { Flashcard } from "@/types";
import { toast } from "sonner";

type View = "list" | "study";

interface SubjectDeck {
  subjectId: string;
  subjectName: string;
  emoji: string;
  color: string;
  total: number;
  due: number;
}

export default function FlashcardsPage() {
  const { subjects } = useSubjects();
  const { user } = useAuth();
  const { flashcards, dueCards, loading, addFlashcard, addFlashcards, reviewFlashcard, deleteFlashcard } =
    useFlashcards();

  const [view, setView] = useState<View>("list");
  const [studySubjectId, setStudySubjectId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newType, setNewType] = useState<Flashcard["type"]>("definition");
  const [newSubjectId, setNewSubjectId] = useState("");

  // Generate form
  const [genSubjectId, setGenSubjectId] = useState("");
  const [genContent, setGenContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genClassId, setGenClassId] = useState("");
  const [loadingClassEntries, setLoadingClassEntries] = useState(false);

  // Classes for selected subject (used in generate sheet)
  const { classes: genClasses } = useClasses(genSubjectId || null);

  const handleLoadFromClass = useCallback(async () => {
    if (!genSubjectId || !genClassId || !user) return;
    setLoadingClassEntries(true);
    try {
      const entriesSnap = await getDocs(
        collection(db, "users", user.uid, "subjects", genSubjectId, "classes", genClassId, "entries")
      );
      const tasksSnap = await getDocs(
        query(
          collection(db, "users", user.uid, "tasks"),
          where("classSessionId", "==", genClassId)
        )
      );

      const parts: string[] = [];
      entriesSnap.docs.forEach((d) => {
        const entry = d.data();
        if (entry.content) parts.push(entry.content as string);
      });
      tasksSnap.docs.forEach((d) => {
        const task = d.data();
        const desc = task.description ? ` - ${task.description}` : "";
        parts.push(`Tarea: ${task.title}${desc}`);
      });

      if (parts.length === 0) { toast.error("Esta clase no tiene contenido"); return; }
      setGenContent(parts.join("\n\n---\n\n"));
      toast.success(`Contenido cargado (${parts.length} entradas)`);
    } catch {
      toast.error("Error al cargar el contenido");
    } finally {
      setLoadingClassEntries(false);
    }
  }, [genSubjectId, genClassId, user]);

  // Group flashcards by subject
  const decks = useMemo<SubjectDeck[]>(() => {
    const map = new Map<string, SubjectDeck>();
    const now = new Date();

    for (const fc of flashcards) {
      if (!map.has(fc.subjectId)) {
        const sub = subjects.find((s) => s.id === fc.subjectId);
        map.set(fc.subjectId, {
          subjectId: fc.subjectId,
          subjectName: fc.subjectName || sub?.name || "Sin materia",
          emoji: sub?.emoji || "📚",
          color: sub?.color || "#6366f1",
          total: 0,
          due: 0,
        });
      }
      const deck = map.get(fc.subjectId)!;
      deck.total += 1;
      if (fc.nextReview <= now) deck.due += 1;
    }

    return Array.from(map.values()).sort((a, b) => b.due - a.due);
  }, [flashcards, subjects]);

  // Cards for current study session
  const studyCards = useMemo(() => {
    if (!studySubjectId) return dueCards;
    return dueCards.filter((f) => f.subjectId === studySubjectId);
  }, [dueCards, studySubjectId]);

  const currentCard = studyCards[currentIndex] || null;

  const startStudy = (subjectId: string | null) => {
    setStudySubjectId(subjectId);
    setCurrentIndex(0);
    setFlipped(false);
    setView("study");
  };

  const handleReview = useCallback(
    async (quality: number) => {
      if (!currentCard) return;
      await reviewFlashcard(currentCard.id, quality);
      setFlipped(false);
      if (currentIndex + 1 < studyCards.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        toast.success("Sesion completada");
        setView("list");
      }
    },
    [currentCard, currentIndex, studyCards.length, reviewFlashcard]
  );

  const resetCreate = () => {
    setNewQuestion("");
    setNewAnswer("");
    setNewType("definition");
    setNewSubjectId("");
  };

  const handleCreate = async () => {
    if (!newQuestion.trim()) { toast.error("La pregunta es obligatoria"); return; }
    if (!newAnswer.trim()) { toast.error("La respuesta es obligatoria"); return; }
    if (!newSubjectId) { toast.error("Selecciona una materia"); return; }

    const sub = subjects.find((s) => s.id === newSubjectId);
    setSaving(true);
    try {
      await addFlashcard({
        subjectId: newSubjectId,
        subjectName: sub?.name || "",
        noteId: null,
        question: newQuestion.trim(),
        answer: newAnswer.trim(),
        type: newType,
      });
      toast.success("Flashcard creada");
      setShowCreate(false);
      resetCreate();
    } catch {
      toast.error("Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!genContent.trim()) { toast.error("Pega el contenido de tus apuntes"); return; }
    if (!genSubjectId) { toast.error("Selecciona una materia"); return; }

    const sub = subjects.find((s) => s.id === genSubjectId);
    setGenerating(true);

    try {
      const response = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: genContent.trim(),
          subjectName: sub?.name || "General",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al generar");
      }

      const generated = data.data.flashcards as { question: string; answer: string; type: string }[];
      if (!generated || generated.length === 0) {
        throw new Error("No se generaron flashcards. Intenta con un contenido más largo.");
      }

      await addFlashcards(
        generated.map((fc) => ({
          subjectId: genSubjectId,
          subjectName: sub?.name || "",
          noteId: null,
          question: fc.question,
          answer: fc.answer,
          type: (fc.type as Flashcard["type"]) || "definition",
        }))
      );

      toast.success(`${generated.length} flashcards generadas`);
      setShowGenerate(false);
      setGenContent("");
      setGenSubjectId("");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Error al generar flashcards");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await deleteFlashcard(id);
      toast.success("Flashcard eliminada");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const totalDue = dueCards.length;

  // ── Study View ──
  if (view === "study") {
    return (
      <AppShell>
        <div className="px-4 pt-safe page-enter min-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setView("list")}
              className="flex items-center gap-1.5 text-muted-foreground active:opacity-70 touch-target"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Volver</span>
            </button>
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {studyCards.length}
            </span>
          </div>

          {studyCards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mb-3">
                <Layers className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">No hay tarjetas pendientes</p>
              <p className="text-xs text-muted-foreground/60">Vuelve mas tarde</p>
            </div>
          ) : currentCard ? (
            <>
              {/* Progress bar */}
              <div className="h-1 rounded-full bg-secondary overflow-hidden mb-5">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${((currentIndex) / studyCards.length) * 100}%` }}
                />
              </div>

              {/* Card */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div style={{ perspective: "1200px" }} className="w-full max-w-sm">
                  <button
                    onClick={() => setFlipped(!flipped)}
                    aria-label={flipped ? "Ver pregunta" : "Ver respuesta"}
                    className={`relative w-full aspect-[3/4] transition-[transform] duration-500 [transform-style:preserve-3d] active:brightness-95 ${
                      flipped ? "[transform:rotateY(180deg)]" : ""
                    }`}
                  >
                    {/* Front — Question */}
                    <div className="absolute inset-0 rounded-2xl bg-card border border-border p-6 flex flex-col items-center justify-center text-center [backface-visibility:hidden]">
                      <span className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-3">
                        Pregunta
                      </span>
                      <div className="text-base leading-relaxed text-foreground">
                        <MarkdownMath content={currentCard.question} />
                      </div>
                      <p className="text-[10px] text-muted-foreground/50 mt-4">
                        Toca para ver respuesta
                      </p>
                    </div>
                    {/* Back — Answer */}
                    <div className="absolute inset-0 rounded-2xl bg-card border border-emerald-500/30 p-6 flex flex-col items-center justify-center text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-3">
                        Respuesta
                      </span>
                      <div className="text-base leading-relaxed text-emerald-400">
                        <MarkdownMath content={currentCard.answer} />
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Rating buttons */}
              {flipped && (
                <div className="grid grid-cols-4 gap-2 mt-4 mb-4 ratings-enter">
                  {REVIEW_RATINGS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => handleReview(r.value)}
                      className="py-3 rounded-xl text-sm font-medium text-white active:scale-[0.96] transition-transform"
                      style={{ backgroundColor: r.color }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </AppShell>
    );
  }

  // ── List View ──
  return (
    <AppShell>
      <div className="page-enter">
        <div className="px-4 pt-safe pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Flashcards</h1>
              <p className="text-sm text-muted-foreground">
                {totalDue > 0 ? `${totalDue} por repasar` : "Al dia"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowGenerate(true)}
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform touch-target"
              >
                <Sparkles className="w-4.5 h-4.5 text-primary" />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target"
              >
                <Plus className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Study all due button */}
        {totalDue > 0 && (
          <div className="px-4 pb-3">
            <button
              onClick={() => startStudy(null)}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Estudiar todas ({totalDue})
            </button>
          </div>
        )}

        {/* Decks */}
        <div className="px-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : decks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
                <Layers className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">Sin flashcards aun</p>
              <p className="text-xs text-muted-foreground/60 mb-5">
                Crea manualmente o genera con IA
              </p>
              <div className="flex gap-2.5 justify-center">
                <button
                  onClick={() => setShowGenerate(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-sm font-medium active:scale-[0.98] transition-transform touch-target"
                >
                  <Sparkles className="w-4 h-4" /> Generar con IA
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform touch-target"
                >
                  <Plus className="w-4 h-4" /> Crear
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 stagger-children">
              {decks.map((deck) => (
                <button
                  key={deck.subjectId}
                  onClick={() => deck.due > 0 ? startStudy(deck.subjectId) : toast("Sin tarjetas pendientes", { description: "Todas las tarjetas de esta materia estan al dia." })}
                  className="w-full p-3.5 rounded-xl bg-card border border-border flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: deck.color + "20" }}
                  >
                    {deck.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[15px] truncate">{deck.subjectName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{deck.total} tarjetas</span>
                      {deck.due > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-primary/15 text-primary font-semibold">
                          {deck.due} pendientes
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}

              {/* Individual cards list */}
              <div className="pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Todas las tarjetas</p>
                {flashcards.map((fc) => {
                  const isDue = fc.nextReview <= new Date();
                  return (
                    <div key={fc.id} className="flex items-center gap-2.5 py-2.5 border-b border-border/50 last:border-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDue ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{fc.question}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{fc.subjectName}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(fc.id); }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground active:bg-secondary/50 shrink-0 touch-target"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Sheet */}
      <Sheet
        open={showCreate}
        onClose={() => { setShowCreate(false); resetCreate(); }}
        title="Nueva flashcard"
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Materia</label>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm"
            >
              <option value="">Seleccionar...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Pregunta</label>
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Ej: Que es un grafo dirigido?"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Respuesta</label>
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Ej: Un grafo donde las aristas tienen direccion..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
            <div className="grid grid-cols-2 gap-1.5">
              {FLASHCARD_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setNewType(t.value as Flashcard["type"])}
                  className={`py-2 rounded-xl text-sm font-medium transition-all ${
                    newType === t.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Crear flashcard"}
          </button>
        </div>
      </Sheet>

      {/* Generate Sheet */}
      <Sheet
        open={showGenerate}
        onClose={() => { setShowGenerate(false); setGenContent(""); setGenSubjectId(""); setGenClassId(""); }}
        title="Generar con IA"
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Materia</label>
            <select
              value={genSubjectId}
              onChange={(e) => { setGenSubjectId(e.target.value); setGenClassId(""); setGenContent(""); }}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm"
            >
              <option value="">Seleccionar...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
              ))}
            </select>
          </div>

          {genSubjectId && genClasses.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cargar desde clase</label>
              <div className="flex gap-2">
                <select
                  value={genClassId}
                  onChange={(e) => setGenClassId(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm"
                >
                  <option value="">Seleccionar clase...</option>
                  {genClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} &mdash; {c.date.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLoadFromClass}
                  disabled={!genClassId || loadingClassEntries}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  {loadingClassEntries
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <BookOpen className="w-4 h-4 text-primary" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Contenido de apuntes
            </label>
            <textarea
              value={genContent}
              onChange={(e) => setGenContent(e.target.value)}
              placeholder="Pega aqui el contenido de tus apuntes de clase..."
              rows={6}
              className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm leading-relaxed"
            />
          </div>

          <p className="text-[10px] text-muted-foreground/60 text-center">
            Gemini generara flashcards basadas en el contenido
          </p>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generar flashcards
              </>
            )}
          </button>
        </div>
      </Sheet>

      <Confirm
        open={!!deleteId}
        title="Eliminar flashcard"
        message="Se eliminara esta flashcard permanentemente."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </AppShell>
  );
}
