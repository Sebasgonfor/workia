"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BookOpen, Loader2, X, Save, FileText, HelpCircle, Key, Layers } from "lucide-react";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { useFlashcards } from "@/lib/hooks/useFlashcards";
import { useQuizzes } from "@/lib/hooks/useQuizzes";
import { toast } from "sonner";
import type { StudyKit } from "@/types";

interface StudyKitGeneratorProps {
  content: string;
  subjectName: string;
  subjectId: string;
  classId: string;
  subjectDocuments?: Array<{ name: string; url: string; fileType: string }>;
  onClose: () => void;
}

type Tab = "summary" | "flashcards" | "quiz" | "concepts";

const tabs: Array<{ key: Tab; label: string; icon: typeof FileText }> = [
  { key: "summary", label: "Resumen", icon: FileText },
  { key: "flashcards", label: "Cards", icon: Layers },
  { key: "quiz", label: "Quiz", icon: HelpCircle },
  { key: "concepts", label: "Conceptos", icon: Key },
];

export function StudyKitGenerator({ content, subjectName, subjectId, classId, subjectDocuments, onClose }: StudyKitGeneratorProps) {
  const [kit, setKit] = useState<StudyKit | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [savingFlashcards, setSavingFlashcards] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [flashcardsSaved, setFlashcardsSaved] = useState(false);
  const [quizSaved, setQuizSaved] = useState(false);
  const { addFlashcards } = useFlashcards();
  const { addQuiz } = useQuizzes();
  const generatedRef = useRef(false);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/study-kit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, subjectName, subjectDocuments }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setKit(data.data);
      } else {
        toast.error(data.error || "Error al generar kit");
      }
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, [content, subjectName, subjectDocuments]);

  useEffect(() => {
    if (!generatedRef.current) {
      generatedRef.current = true;
      generate();
    }
  }, [generate]);

  const handleSaveFlashcards = async () => {
    if (!kit || flashcardsSaved) return;
    setSavingFlashcards(true);
    try {
      await addFlashcards(
        kit.flashcards.map((fc) => ({
          subjectId,
          subjectName,
          noteId: null,
          question: fc.question,
          answer: fc.answer,
          type: fc.type,
        }))
      );
      setFlashcardsSaved(true);
      toast.success(`${kit.flashcards.length} flashcards guardadas`);
    } catch {
      toast.error("Error al guardar flashcards");
    } finally {
      setSavingFlashcards(false);
    }
  };

  const handleSaveQuiz = async () => {
    if (!kit || quizSaved) return;
    setSavingQuiz(true);
    try {
      await addQuiz({
        subjectId,
        subjectName,
        entryId: null,
        title: kit.quiz.title,
        questions: kit.quiz.questions,
      });
      setQuizSaved(true);
      toast.success("Quiz guardado");
    } catch {
      toast.error("Error al guardar quiz");
    } finally {
      setSavingQuiz(false);
    }
  };

  const importanceColors = {
    high: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
    medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
    low: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-white">Kit de Estudio</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
          <div className="text-center">
            <p className="text-white font-medium">Generando tu kit de estudio...</p>
            <p className="text-sm text-zinc-400 mt-1">Resumen, flashcards, quiz y conceptos clave</p>
          </div>
        </div>
      ) : kit ? (
        <>
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-emerald-400 border-b-2 border-emerald-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Summary */}
            {activeTab === "summary" && (
              <div className="max-w-lg mx-auto">
                <div className="prose prose-invert prose-sm max-w-none">
                  <MarkdownMath content={kit.summary} />
                </div>
              </div>
            )}

            {/* Flashcards */}
            {activeTab === "flashcards" && (
              <div className="max-w-lg mx-auto space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-zinc-400">{kit.flashcards.length} flashcards generadas</p>
                  <button
                    onClick={handleSaveFlashcards}
                    disabled={savingFlashcards || flashcardsSaved}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                  >
                    {savingFlashcards ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {flashcardsSaved ? "Guardadas" : "Guardar todas"}
                  </button>
                </div>
                {kit.flashcards.map((fc, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs text-zinc-500 mb-2">Pregunta {i + 1} — {fc.type}</p>
                    <div className="text-sm text-white mb-3">
                      <MarkdownMath content={fc.question} />
                    </div>
                    <div className="border-t border-white/10 pt-3">
                      <p className="text-xs text-zinc-500 mb-1">Respuesta</p>
                      <div className="text-sm text-emerald-300/90">
                        <MarkdownMath content={fc.answer} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quiz */}
            {activeTab === "quiz" && (
              <div className="max-w-lg mx-auto space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white font-medium">{kit.quiz.title}</p>
                    <p className="text-sm text-zinc-400">{kit.quiz.questions.length} preguntas</p>
                  </div>
                  <button
                    onClick={handleSaveQuiz}
                    disabled={savingQuiz || quizSaved}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                  >
                    {savingQuiz ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {quizSaved ? "Guardado" : "Guardar quiz"}
                  </button>
                </div>
                {kit.quiz.questions.map((q, i) => (
                  <div key={q.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-sm text-white mb-3">
                      <span className="text-zinc-500 mr-1">{i + 1}.</span>
                      <MarkdownMath content={q.question} />
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, j) => (
                        <div key={j} className={`text-sm px-3 py-2 rounded-lg ${
                          j === q.correctIndex
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-white/5 text-zinc-400"
                        }`}>
                          {opt}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-500 mt-2 italic">{q.explanation}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Key Concepts */}
            {activeTab === "concepts" && (
              <div className="max-w-lg mx-auto space-y-3">
                {kit.keyConcepts.map((concept, i) => {
                  const colors = importanceColors[concept.importance];
                  return (
                    <div key={i} className={`${colors.bg} border ${colors.border} rounded-xl p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium">{concept.name}</h3>
                        <span className={`text-xs ${colors.text}`}>
                          {concept.importance === "high" ? "Fundamental" : concept.importance === "medium" ? "Importante" : "Complementario"}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 mb-3">{concept.definition}</p>
                      {concept.relatedConcepts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {concept.relatedConcepts.map((rc, j) => (
                            <span key={j} className="text-xs px-2 py-1 rounded-full bg-white/10 text-zinc-400">
                              {rc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
