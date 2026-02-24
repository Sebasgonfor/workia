"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  ChevronRight,
  Brain,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { useAuth } from "@/lib/auth-context";
import { fetchQuizById } from "@/lib/hooks";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Quiz } from "@/types";
import { toast } from "sonner";

type AnswerState = "idle" | "correct" | "wrong";

export default function QuizRunnerPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !quizId) return;
    const load = async () => {
      try {
        const data = await fetchQuizById(user.uid, quizId);
        if (!data) { toast.error("Quiz no encontrado"); router.back(); return; }
        setQuiz(data);
      } catch {
        toast.error("Error al cargar el quiz");
        router.back();
      } finally {
        setLoadingQuiz(false);
      }
    };
    load();
  }, [user, quizId, router]);

  const currentQuestion = quiz?.questions[currentIndex] ?? null;

  const handleSelectOption = useCallback((optionIndex: number) => {
    if (answerState !== "idle" || !currentQuestion) return;
    setSelectedIndex(optionIndex);
    const isCorrect = optionIndex === currentQuestion.correctIndex;
    setAnswerState(isCorrect ? "correct" : "wrong");
    setUserAnswers((prev) => [...prev, optionIndex]);
  }, [answerState, currentQuestion]);

  const handleNext = useCallback(async () => {
    if (!quiz) return;
    const isLast = currentIndex + 1 >= quiz.questions.length;
    if (isLast) {
      setShowResult(true);
      // Save attempt
      if (user) {
        setSaving(true);
        try {
          const correctCount = userAnswers.filter(
            (ans, i) => ans === quiz.questions[i].correctIndex
          ).length;
          const score = Math.round((correctCount / quiz.questions.length) * 100);
          await addDoc(collection(db, "users", user.uid, "quizAttempts"), {
            quizId: quiz.id,
            subjectId: quiz.subjectId,
            subjectName: quiz.subjectName,
            score,
            correctAnswers: correctCount,
            totalQuestions: quiz.questions.length,
            completedAt: serverTimestamp(),
          });
        } catch {
          // Silent fail — result is already shown to user
        } finally {
          setSaving(false);
        }
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setAnswerState("idle");
    }
  }, [quiz, currentIndex, userAnswers, user]);

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedIndex(null);
    setAnswerState("idle");
    setUserAnswers([]);
    setShowResult(false);
  };

  if (loadingQuiz) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando quiz...</p>
        </div>
      </AppShell>
    );
  }

  if (!quiz) return null;

  const correctCount = userAnswers.filter(
    (ans, i) => ans === quiz.questions[i]?.correctIndex
  ).length;
  const score = quiz.questions.length > 0
    ? Math.round((correctCount / quiz.questions.length) * 100)
    : 0;

  // ── Results view ──
  if (showResult) {
    const scoreColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
    return (
      <AppShell>
        <div className="page-enter px-4 pt-safe pb-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-muted-foreground active:opacity-70 touch-target"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Salir</span>
            </button>
          </div>

          {/* Score circle */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-24 h-24 rounded-full flex flex-col items-center justify-center mb-3 border-4"
              style={{ borderColor: scoreColor, backgroundColor: scoreColor + "15" }}
            >
              <Trophy className="w-6 h-6 mb-1" style={{ color: scoreColor }} />
              <span className="text-2xl font-bold" style={{ color: scoreColor }}>{score}%</span>
            </div>
            <h2 className="text-lg font-bold">{quiz.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {correctCount} de {quiz.questions.length} correctas
            </p>
            {saving && (
              <p className="text-xs text-muted-foreground/50 mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Guardando resultado...
              </p>
            )}
          </div>

          {/* Answer breakdown */}
          <div className="space-y-3 mb-6">
            {quiz.questions.map((q, i) => {
              const isCorrect = userAnswers[i] === q.correctIndex;
              return (
                <div
                  key={q.id}
                  className="p-3.5 rounded-xl bg-card border border-border"
                  style={{ borderLeftWidth: "3px", borderLeftColor: isCorrect ? "#10b981" : "#ef4444" }}
                >
                  <div className="flex items-start gap-2.5">
                    {isCorrect
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        <MarkdownMath content={q.question} inline />
                      </p>
                      {!isCorrect && (
                        <p className="text-xs text-emerald-500 mt-1">
                          Correcta: <MarkdownMath content={q.options[q.correctIndex]} inline />
                        </p>
                      )}
                      {userAnswers[i] !== undefined && !isCorrect && (
                        <p className="text-xs text-destructive/70 mt-0.5">
                          Tu respuesta: <MarkdownMath content={q.options[userAnswers[i]]} inline />
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                        {q.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-foreground font-semibold active:scale-[0.98] transition-transform"
            >
              <RotateCcw className="w-4 h-4" /> Reintentar
            </button>
            <button
              onClick={() => router.back()}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform"
            >
              Terminar
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Question view ──
  const progress = ((currentIndex) / quiz.questions.length) * 100;

  return (
    <AppShell>
      <div className="page-enter px-4 pt-safe pb-6 flex flex-col min-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-muted-foreground active:opacity-70 touch-target"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Salir</span>
          </button>
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} / {quiz.questions.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-5">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question */}
        {currentQuestion && (
          <div className="flex-1 flex flex-col">
            <div className="mb-1">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">
                {currentQuestion.type === "true_false" ? "Verdadero o Falso" : "Opcion multiple"}
              </span>
            </div>
            <p className="text-base font-medium leading-relaxed mb-5">
              <MarkdownMath content={currentQuestion.question} />
            </p>

            {/* Options */}
            <div className="space-y-2.5 flex-1">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedIndex === idx;
                const isCorrectOption = idx === currentQuestion.correctIndex;
                const revealed = answerState !== "idle";

                let optionStyle = "bg-secondary border-border text-foreground";
                if (revealed && isCorrectOption) {
                  optionStyle = "bg-emerald-500/15 border-emerald-500 text-emerald-400";
                } else if (revealed && isSelected && !isCorrectOption) {
                  optionStyle = "bg-destructive/15 border-destructive text-destructive";
                } else if (isSelected && !revealed) {
                  optionStyle = "bg-primary/15 border-primary text-primary";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    disabled={revealed}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all active:scale-[0.98] disabled:cursor-default ${optionStyle}`}
                  >
                    <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold border-current">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-sm leading-snug flex-1">
                      <MarkdownMath content={option} inline />
                    </span>
                    {revealed && isCorrectOption && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    {revealed && isSelected && !isCorrectOption && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Explanation + Next */}
            {answerState !== "idle" && (
              <div className="mt-5">
                <div className="p-3 rounded-xl bg-secondary/60 mb-4">
                  <p className="text-xs text-muted-foreground italic">{currentQuestion.explanation}</p>
                </div>
                <button
                  onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform"
                >
                  {currentIndex + 1 >= quiz.questions.length ? "Ver resultados" : "Siguiente"}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
