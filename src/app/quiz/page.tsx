"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  PlayCircle,
  Trash2,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Confirm } from "@/components/ui/confirm";
import { useQuizzes, useSubjects } from "@/lib/hooks";
import type { Quiz } from "@/types";
import { toast } from "sonner";

const MSG_DELETE_SUCCESS = "Quiz eliminado";
const MSG_DELETE_ERROR = "Error al eliminar el quiz";

interface SubjectGroup {
  subjectId: string;
  subjectName: string;
  emoji: string;
  color: string;
  quizzes: Quiz[];
}

export default function QuizListPage() {
  const router = useRouter();
  const { quizzes, loading, deleteQuiz } = useQuizzes();
  const { subjects } = useSubjects();

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const groups = useMemo<SubjectGroup[]>(() => {
    const map = new Map<string, SubjectGroup>();
    for (const quiz of quizzes) {
      if (!map.has(quiz.subjectId)) {
        const sub = subjects.find((s) => s.id === quiz.subjectId);
        map.set(quiz.subjectId, {
          subjectId: quiz.subjectId,
          subjectName: quiz.subjectName || sub?.name || "Sin materia",
          emoji: sub?.emoji || "📚",
          color: sub?.color || "#6366f1",
          quizzes: [],
        });
      }
      map.get(quiz.subjectId)!.quizzes.push(quiz);
    }
    return Array.from(map.values());
  }, [quizzes, subjects]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await deleteQuiz(id);
      toast.success(MSG_DELETE_SUCCESS);
    } catch {
      toast.error(MSG_DELETE_ERROR);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <AppShell>
      <div className="px-4 pt-6 pb-32 max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Quiz</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tus evaluaciones generadas por IA
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && quizzes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mb-4">
              <HelpCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-base mb-1">Sin quizzes aún</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Genera un quiz desde los apuntes de una clase en la sección de Materias
            </p>
          </div>
        )}

        {/* Groups */}
        {!loading && groups.length > 0 && (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.subjectId}>
                {/* Subject header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: group.color + "20" }}
                  >
                    <span>{group.emoji}</span>
                  </div>
                  <span className="font-semibold text-sm truncate">
                    {group.subjectName}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {group.quizzes.length} quiz{group.quizzes.length !== 1 ? "zes" : ""}
                  </span>
                </div>

                {/* Quiz cards */}
                <div className="space-y-2">
                  {group.quizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border"
                    >
                      {/* Icon */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: group.color + "20" }}
                      >
                        <BookOpen
                          className="w-5 h-5"
                          style={{ color: group.color }}
                        />
                      </div>

                      {/* Info */}
                      <button
                        tabIndex={0}
                        aria-label={`Iniciar ${quiz.title}`}
                        onClick={() => router.push(`/quiz/${quiz.id}`)}
                        className="flex-1 min-w-0 text-left active:opacity-70"
                      >
                        <p className="font-medium text-[14px] truncate leading-tight">
                          {quiz.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {quiz.questions.length} pregunta
                          {quiz.questions.length !== 1 ? "s" : ""} ·{" "}
                          {formatDate(quiz.createdAt)}
                        </p>
                      </button>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          tabIndex={0}
                          aria-label={`Iniciar quiz ${quiz.title}`}
                          onClick={() => router.push(`/quiz/${quiz.id}`)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center active:bg-secondary/60"
                        >
                          <PlayCircle
                            className="w-4 h-4"
                            style={{ color: group.color }}
                          />
                        </button>
                        <button
                          tabIndex={0}
                          aria-label="Eliminar quiz"
                          onClick={() => setDeleteId(quiz.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center active:bg-secondary/60"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Confirm
        open={!!deleteId}
        title="Eliminar quiz"
        message="Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </AppShell>
  );
}
