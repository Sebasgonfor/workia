"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { MermaidChart } from "@/components/ui/mermaid-chart";
import { useSubjects, useClasses, useBoardEntries } from "@/lib/hooks";
import { toast } from "sonner";
import {
  GraduationCap, ChevronRight, Loader2, CheckCircle2, BookOpen, AlertTriangle,
  Brain, Clock, FileText, HelpCircle, Lightbulb, Timer, Trophy, ArrowLeft,
  Play, ChevronDown,
} from "lucide-react";

type Step = "select" | "generating" | "guide" | "simulating" | "exam" | "results";

interface ExamGuide {
  summary: string;
  keyConcepts: Array<{ name: string; definition: string; importance: string; difficulty: string }>;
  formulas: Array<{ name: string; formula: string; whenToUse: string; variables: string }>;
  commonMistakes: string[];
  practiceQuestions: Array<{
    id: string; question: string; type: string; options: string[];
    correctIndex: number; explanation: string; difficulty: string;
  }>;
  studyPlan: Array<{ topic: string; estimatedMinutes: number; priority: string }>;
}

interface SimExam {
  title: string;
  totalPoints: number;
  duration: number;
  questions: Array<{
    id: string; question: string; type: string; points: number; options: string[];
    correctIndex: number; expectedAnswer: string; solution: string; explanation: string; difficulty: string;
  }>;
}

const diffColors: Record<string, { bg: string; text: string }> = {
  fundamental: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  importante: { bg: "bg-amber-500/10", text: "text-amber-400" },
  avanzado: { bg: "bg-red-500/10", text: "text-red-400" },
  facil: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  medio: { bg: "bg-amber-500/10", text: "text-amber-400" },
  dificil: { bg: "bg-red-500/10", text: "text-red-400" },
};

export default function ParcialPage() {
  const { subjects } = useSubjects();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>("select");
  const [guide, setGuide] = useState<ExamGuide | null>(null);
  const [guideTab, setGuideTab] = useState<"summary" | "concepts" | "formulas" | "practice" | "plan">("summary");
  const [exam, setExam] = useState<SimExam | null>(null);
  const [examAnswers, setExamAnswers] = useState<Record<string, number | string>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examTimeLeft, setExamTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [duration, setDuration] = useState(60);
  const [questionCount, setQuestionCount] = useState(10);

  const { classes } = useClasses(selectedSubject);
  const subject = useMemo(() => subjects.find((s) => s.id === selectedSubject), [subjects, selectedSubject]);

  // Collect content from selected classes
  const selectedContent = useMemo(() => {
    if (!selectedSubject || selectedClasses.size === 0) return "";
    return "Content will be fetched on generate";
  }, [selectedSubject, selectedClasses]);

  const toggleClass = (id: string) => {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleGenerateGuide = useCallback(async () => {
    if (!selectedSubject || selectedClasses.size === 0) return;
    setStep("generating");

    try {
      // Fetch entries for all selected classes
      const contents: string[] = [];
      const classIds = Array.from(selectedClasses);
      for (const classId of classIds) {
        const cls = classes.find((c) => c.id === classId);
        contents.push(`--- ${cls?.title || "Clase"} ---`);
      }

      // For now, use class titles as placeholder. In real usage, we'd fetch entries.
      // The actual content is passed from the board entries

      const res = await fetch("/api/exam-guide/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Materia: ${subject?.name}\nClases seleccionadas: ${classes.filter((c) => selectedClasses.has(c.id)).map((c) => c.title).join(", ")}`,
          subjectName: subject?.name || "",
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setGuide(data.data);
        setStep("guide");
      } else {
        toast.error(data.error || "Error al generar guia");
        setStep("select");
      }
    } catch {
      toast.error("Error de conexion");
      setStep("select");
    }
  }, [selectedSubject, selectedClasses, classes, subject]);

  const handleStartExam = useCallback(async () => {
    setStep("simulating");
    try {
      const res = await fetch("/api/exam-guide/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: guide ? `${guide.summary}\n\nConceptos: ${guide.keyConcepts.map((c) => `${c.name}: ${c.definition}`).join("\n")}` : "",
          subjectName: subject?.name || "",
          duration,
          questionCount,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setExam(data.data);
        setExamAnswers({});
        setExamSubmitted(false);
        setExamTimeLeft(duration * 60);
        setStep("exam");
        // Start timer
        timerRef.current = setInterval(() => {
          setExamTimeLeft((prev) => {
            if (prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              setExamSubmitted(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast.error(data.error || "Error al generar simulacro");
        setStep("guide");
      }
    } catch {
      toast.error("Error de conexion");
      setStep("guide");
    }
  }, [guide, subject, duration, questionCount]);

  const handleSubmitExam = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setExamSubmitted(true);
    setStep("results");
  };

  const examScore = useMemo(() => {
    if (!exam || !examSubmitted) return { correct: 0, total: 0, points: 0, totalPoints: 0 };
    let correct = 0;
    let points = 0;
    for (const q of exam.questions) {
      if (q.type === "multiple_choice" && examAnswers[q.id] === q.correctIndex) {
        correct++;
        points += q.points;
      }
    }
    return { correct, total: exam.questions.length, points, totalPoints: exam.totalPoints };
  }, [exam, examAnswers, examSubmitted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const color = subject?.color || "#6366f1";

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {step !== "select" && (
            <button
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                setStep(step === "guide" || step === "generating" ? "select" : "guide");
              }}
              className="p-2 rounded-lg bg-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-400" />
              Preparar Parcial
            </h1>
            {subject && <p className="text-xs text-muted-foreground">{subject.emoji} {subject.name}</p>}
          </div>
        </div>

        {/* Step: Select subject and classes */}
        {step === "select" && (
          <div className="space-y-4">
            {!selectedSubject ? (
              <>
                <p className="text-sm text-muted-foreground">Selecciona la materia del parcial:</p>
                <div className="space-y-2">
                  {subjects.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSubject(s.id)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: s.color + "20" }}>
                        {s.emoji}
                      </div>
                      <span className="font-medium flex-1 text-left">{s.name}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Selecciona las clases que entran en el parcial:</p>
                  <button onClick={() => { setSelectedSubject(null); setSelectedClasses(new Set()); }} className="text-xs text-primary">
                    Cambiar materia
                  </button>
                </div>
                <div className="space-y-2">
                  {classes.map((c) => {
                    const isSelected = selectedClasses.has(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleClass(c.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.date.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedClasses.size > 0 && (
                  <button
                    onClick={handleGenerateGuide}
                    className="w-full py-3 rounded-xl text-white font-semibold text-sm"
                    style={{ backgroundColor: color }}
                  >
                    Generar guia de estudio ({selectedClasses.size} clase{selectedClasses.size !== 1 ? "s" : ""})
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Step: Generating */}
        {step === "generating" && (
          <div className="flex flex-col items-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-white font-medium">Generando guia de estudio...</p>
            <p className="text-sm text-muted-foreground">Analizando {selectedClasses.size} clases</p>
          </div>
        )}

        {/* Step: Guide */}
        {step === "guide" && guide && (
          <div className="space-y-4">
            {/* Guide Tabs */}
            <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl overflow-x-auto no-scrollbar">
              {[
                { key: "summary" as const, label: "Resumen", icon: FileText },
                { key: "concepts" as const, label: "Conceptos", icon: Brain },
                { key: "formulas" as const, label: "Formulas", icon: BookOpen },
                { key: "practice" as const, label: "Practica", icon: HelpCircle },
                { key: "plan" as const, label: "Plan", icon: Clock },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setGuideTab(t.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    guideTab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <t.icon className="w-3 h-3" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {guideTab === "summary" && (
              <div className="bg-card border border-border rounded-xl p-4">
                <MarkdownMath content={guide.summary} />
              </div>
            )}

            {guideTab === "concepts" && (
              <div className="space-y-2">
                {guide.keyConcepts.map((c, i) => {
                  const dc = diffColors[c.difficulty] || diffColors.importante;
                  return (
                    <div key={i} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm">{c.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${dc.bg} ${dc.text}`}>{c.difficulty}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        <MarkdownMath content={c.definition} inline />
                      </p>
                      <p className="text-xs text-primary/80 mt-2">
                        <Lightbulb className="w-3 h-3 inline mr-1" />{c.importance}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {guideTab === "formulas" && (
              <div className="space-y-2">
                {guide.formulas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay formulas para esta materia</p>
                ) : guide.formulas.map((f, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <h3 className="font-medium text-sm mb-2">{f.name}</h3>
                    <div className="bg-secondary/50 rounded-lg p-3 mb-2">
                      <MarkdownMath content={f.formula} />
                    </div>
                    <p className="text-xs text-muted-foreground"><strong>Cuando usar:</strong> {f.whenToUse}</p>
                    <p className="text-xs text-muted-foreground mt-1"><strong>Variables:</strong> {f.variables}</p>
                  </div>
                ))}
              </div>
            )}

            {guideTab === "practice" && (
              <div className="space-y-3">
                {guide.commonMistakes.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
                    <h3 className="text-amber-400 font-medium text-sm flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" /> Errores comunes en parciales
                    </h3>
                    <ul className="space-y-1">
                      {guide.commonMistakes.map((m, i) => (
                        <li key={i} className="text-xs text-amber-200/80 flex items-start gap-2">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400 shrink-0" />{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {guide.practiceQuestions.map((q, i) => (
                  <div key={q.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium flex-1">
                        <span className="text-muted-foreground mr-1">{i + 1}.</span>
                        <MarkdownMath content={q.question} inline />
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ml-2 shrink-0 ${(diffColors[q.difficulty] || diffColors.importante).bg} ${(diffColors[q.difficulty] || diffColors.importante).text}`}>
                        {q.difficulty}
                      </span>
                    </div>
                    {q.options.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {q.options.map((opt, j) => (
                          <div key={j} className={`text-xs px-3 py-2 rounded-lg ${
                            j === q.correctIndex ? "bg-emerald-500/10 text-emerald-400" : "bg-secondary/50 text-muted-foreground"
                          }`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 italic">{q.explanation}</p>
                  </div>
                ))}
              </div>
            )}

            {guideTab === "plan" && (
              <div className="space-y-2">
                {guide.studyPlan.map((s, i) => {
                  const pColor = s.priority === "alta" ? "text-red-400" : s.priority === "media" ? "text-amber-400" : "text-emerald-400";
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.topic}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />{s.estimatedMinutes} min
                          </span>
                          <span className={`text-xs ${pColor}`}>Prioridad {s.priority}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="bg-secondary/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Tiempo total: <strong>{guide.studyPlan.reduce((sum, s) => sum + s.estimatedMinutes, 0)} minutos</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Simulate Exam Button */}
            <div className="pt-4 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Duracion (min)</label>
                  <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full mt-1 p-2 rounded-lg bg-secondary text-sm">
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Preguntas</label>
                  <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full mt-1 p-2 rounded-lg bg-secondary text-sm">
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleStartExam}
                className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Iniciar Simulacro de Parcial
              </button>
            </div>
          </div>
        )}

        {/* Step: Simulating */}
        {step === "simulating" && (
          <div className="flex flex-col items-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="font-medium">Generando simulacro de parcial...</p>
            <p className="text-sm text-muted-foreground">{questionCount} preguntas, {duration} minutos</p>
          </div>
        )}

        {/* Step: Exam */}
        {step === "exam" && exam && !examSubmitted && (
          <div className="space-y-4">
            {/* Timer */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="font-semibold text-sm">{exam.title}</p>
                <p className="text-xs text-muted-foreground">{exam.questions.length} preguntas · {exam.totalPoints} pts</p>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-sm font-bold ${
                examTimeLeft < 300 ? "bg-red-500/20 text-red-400" : "bg-secondary text-foreground"
              }`}>
                <Timer className="w-4 h-4" />
                {formatTime(examTimeLeft)}
              </div>
            </div>

            {/* Questions */}
            {exam.questions.map((q, i) => (
              <div key={q.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-medium flex-1">
                    <span className="text-muted-foreground mr-1">{i + 1}.</span>
                    <MarkdownMath content={q.question} inline />
                  </p>
                  <span className="text-xs text-muted-foreground ml-2">{q.points} pts</span>
                </div>
                {q.type === "multiple_choice" && q.options.length > 0 ? (
                  <div className="space-y-1.5">
                    {q.options.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => setExamAnswers((prev) => ({ ...prev, [q.id]: j }))}
                        className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                          examAnswers[q.id] === j
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-secondary/50 text-foreground hover:bg-secondary"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    placeholder="Escribe tu respuesta..."
                    value={(examAnswers[q.id] as string) || ""}
                    onChange={(e) => setExamAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full p-3 rounded-lg bg-secondary/50 text-sm resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            ))}

            <button
              onClick={handleSubmitExam}
              className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm"
            >
              Entregar Examen
            </button>
          </div>
        )}

        {/* Step: Results */}
        {(step === "results" || examSubmitted) && exam && (
          <div className="space-y-4">
            {/* Score */}
            <div className={`rounded-2xl p-6 text-center border border-border ${
              examScore.points >= examScore.totalPoints * 0.6 ? "bg-emerald-500/10" : "bg-red-500/10"
            }`}>
              <Trophy className={`w-8 h-8 mx-auto mb-2 ${
                examScore.points >= examScore.totalPoints * 0.6 ? "text-emerald-400" : "text-red-400"
              }`} />
              <p className="text-3xl font-bold">{examScore.points}/{examScore.totalPoints}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {examScore.correct} de {examScore.total} correctas (opcion multiple)
              </p>
            </div>

            {/* Review */}
            {exam.questions.map((q, i) => {
              const userAnswer = examAnswers[q.id];
              const isCorrect = q.type === "multiple_choice" && userAnswer === q.correctIndex;
              return (
                <div key={q.id} className={`bg-card border rounded-xl p-4 ${
                  q.type === "multiple_choice"
                    ? isCorrect ? "border-emerald-500/30" : "border-red-500/30"
                    : "border-border"
                }`}>
                  <p className="text-sm font-medium mb-2">
                    <span className="text-muted-foreground mr-1">{i + 1}.</span>
                    <MarkdownMath content={q.question} inline />
                  </p>
                  {q.type === "multiple_choice" && q.options.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {q.options.map((opt, j) => (
                        <div key={j} className={`text-xs px-3 py-2 rounded-lg ${
                          j === q.correctIndex ? "bg-emerald-500/10 text-emerald-400" :
                          j === userAnswer ? "bg-red-500/10 text-red-400" : "bg-secondary/30 text-muted-foreground"
                        }`}>
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.solution && (
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3 mt-2">
                      <p className="text-xs text-blue-400 font-medium mb-1">Solucion:</p>
                      <div className="text-xs text-muted-foreground">
                        <MarkdownMath content={q.solution} />
                      </div>
                    </div>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{q.explanation}</p>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => { setStep("guide"); setExamSubmitted(false); }}
              className="w-full py-3 rounded-xl bg-secondary text-foreground font-medium text-sm"
            >
              Volver a la guia
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
