"use client";

import { useState, useCallback } from "react";
import { Brain, ChevronRight, RotateCcw, CheckCircle2, XCircle, AlertTriangle, Lightbulb, Loader2, X, Sparkles } from "lucide-react";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { useFeynmanSessions } from "@/lib/hooks/useFeynmanSessions";
import { toast } from "sonner";

interface FeynmanModeProps {
  content: string;
  subjectName: string;
  subjectId: string;
  classId: string;
  onClose: () => void;
}

interface Concept {
  id: string;
  name: string;
  difficulty: "basic" | "intermediate" | "advanced";
}

interface EvaluationResult {
  score: number;
  correct: string[];
  missed: string[];
  wrong: string[];
  suggestions: string[];
  detailedFeedback: string;
}

type Step = "concepts" | "explain" | "evaluating" | "results";

const difficultyColors = {
  basic: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Basico" },
  intermediate: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Intermedio" },
  advanced: { bg: "bg-red-500/10", text: "text-red-400", label: "Avanzado" },
};

export function FeynmanMode({ content, subjectName, subjectId, classId, onClose }: FeynmanModeProps) {
  const [step, setStep] = useState<Step>("concepts");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [userExplanation, setUserExplanation] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const { addSession } = useFeynmanSessions();

  const extractConcepts = useCallback(async () => {
    setExtracting(true);
    try {
      const res = await fetch("/api/feynman/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, subjectName }),
      });
      const data = await res.json();
      if (data.success && data.data?.concepts) {
        setConcepts(data.data.concepts);
      } else {
        toast.error("Error al extraer conceptos");
      }
    } catch {
      toast.error("Error de conexion");
    } finally {
      setExtracting(false);
    }
  }, [content, subjectName]);

  const handleSelectConcept = (concept: Concept) => {
    setSelectedConcept(concept);
    setStep("explain");
    setUserExplanation("");
    setEvaluation(null);
  };

  const handleEvaluate = async () => {
    if (!selectedConcept || !userExplanation.trim()) return;
    setStep("evaluating");
    setLoading(true);

    try {
      const res = await fetch("/api/feynman/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: selectedConcept.name,
          originalContent: content,
          userExplanation,
          subjectName,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setEvaluation(data.data);
        setStep("results");

        // Save session
        await addSession({
          subjectId,
          classSessionId: classId,
          concept: selectedConcept.name,
          score: data.data.score,
          userExplanation,
          feedback: data.data,
        });
      } else {
        toast.error("Error al evaluar");
        setStep("explain");
      }
    } catch {
      toast.error("Error de conexion");
      setStep("explain");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setUserExplanation("");
    setEvaluation(null);
    setStep("explain");
  };

  const handleNewConcept = () => {
    setSelectedConcept(null);
    setUserExplanation("");
    setEvaluation(null);
    setStep("concepts");
  };

  // Extract concepts on first render
  if (concepts.length === 0 && !extracting && step === "concepts") {
    extractConcepts();
  }

  const scoreColor = (score: number) =>
    score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";

  const scoreBg = (score: number) =>
    score >= 80 ? "from-emerald-500/20 to-emerald-500/5" : score >= 50 ? "from-amber-500/20 to-amber-500/5" : "from-red-500/20 to-red-500/5";

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-white">Modo Feynman</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center justify-center gap-2 py-3 px-4">
        {[
          { key: "concepts", label: "Concepto" },
          { key: "explain", label: "Explicar" },
          { key: "results", label: "Resultado" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              step === s.key || (step === "evaluating" && s.key === "results")
                ? "bg-purple-500 text-white"
                : ["concepts", "explain", "results"].indexOf(step) > i || (step === "evaluating" && i < 2)
                  ? "bg-purple-500/30 text-purple-300"
                  : "bg-white/10 text-zinc-500"
            }`}>
              {i + 1}
            </div>
            <span className={`text-xs hidden sm:inline ${step === s.key ? "text-white" : "text-zinc-500"}`}>{s.label}</span>
            {i < 2 && <ChevronRight className="w-4 h-4 text-zinc-600" />}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Step 1: Concept Selection */}
        {step === "concepts" && (
          <div className="max-w-lg mx-auto mt-4">
            <h2 className="text-lg font-semibold text-white mb-2">Elige un concepto para explicar</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Selecciona un concepto de tus apuntes. Tendras que explicarlo con tus propias palabras sin ver las notas.
            </p>
            {extracting ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-sm text-zinc-400">Analizando tus apuntes...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {concepts.map((concept) => {
                  const dc = difficultyColors[concept.difficulty];
                  return (
                    <button
                      key={concept.id}
                      onClick={() => handleSelectConcept(concept)}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-white font-medium">{concept.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${dc.bg} ${dc.text}`}>{dc.label}</span>
                        <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Explain */}
        {step === "explain" && selectedConcept && (
          <div className="max-w-lg mx-auto mt-4">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                {selectedConcept.name}
              </h2>
              <p className="text-sm text-purple-200/70 mt-1">
                Explica este concepto con tus propias palabras. No uses tus notas.
              </p>
            </div>

            <textarea
              value={userExplanation}
              onChange={(e) => setUserExplanation(e.target.value)}
              placeholder="Escribe tu explicacion aqui. Imagina que le estas enseñando a alguien que no sabe nada del tema..."
              className="w-full h-48 p-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-purple-500/50 text-sm"
              autoFocus
            />

            <div className="flex items-center justify-between mt-4">
              <button onClick={handleNewConcept} className="text-sm text-zinc-400 hover:text-white transition-colors">
                Cambiar concepto
              </button>
              <button
                onClick={handleEvaluate}
                disabled={!userExplanation.trim() || userExplanation.trim().length < 20}
                className="px-6 py-2.5 rounded-xl bg-purple-500 text-white font-medium hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Evaluar mi explicacion
              </button>
            </div>
          </div>
        )}

        {/* Step 2.5: Evaluating */}
        {step === "evaluating" && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
            <p className="text-white font-medium">Evaluando tu explicacion...</p>
            <p className="text-sm text-zinc-400 mt-1">Comparando con los apuntes originales</p>
          </div>
        )}

        {/* Step 3: Results */}
        {step === "results" && evaluation && (
          <div className="max-w-lg mx-auto mt-4 space-y-4">
            {/* Score */}
            <div className={`bg-gradient-to-b ${scoreBg(evaluation.score)} rounded-2xl p-6 text-center border border-white/10`}>
              <div className={`text-5xl font-bold ${scoreColor(evaluation.score)} mb-1`}>
                {evaluation.score}
              </div>
              <p className="text-sm text-zinc-400">de 100 puntos</p>
              <p className="text-white font-medium mt-2">{selectedConcept?.name}</p>
            </div>

            {/* Correct */}
            {evaluation.correct.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <h3 className="text-emerald-400 font-medium flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4" /> Lo que explicaste bien
                </h3>
                <ul className="space-y-1">
                  {evaluation.correct.map((item, i) => (
                    <li key={i} className="text-sm text-emerald-200/80 flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missed */}
            {evaluation.missed.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <h3 className="text-amber-400 font-medium flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" /> Lo que te falto
                </h3>
                <ul className="space-y-1">
                  {evaluation.missed.map((item, i) => (
                    <li key={i} className="text-sm text-amber-200/80 flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Wrong */}
            {evaluation.wrong.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <h3 className="text-red-400 font-medium flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4" /> Errores conceptuales
                </h3>
                <ul className="space-y-1">
                  {evaluation.wrong.map((item, i) => (
                    <li key={i} className="text-sm text-red-200/80 flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {evaluation.suggestions.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <h3 className="text-blue-400 font-medium flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4" /> Sugerencias
                </h3>
                <ul className="space-y-1">
                  {evaluation.suggestions.map((item, i) => (
                    <li key={i} className="text-sm text-blue-200/80 flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Detailed feedback */}
            {evaluation.detailedFeedback && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h3 className="text-white font-medium mb-2">Retroalimentacion detallada</h3>
                <div className="text-sm text-zinc-300">
                  <MarkdownMath content={evaluation.detailedFeedback} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2 pb-6">
              <button
                onClick={handleRetry}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 text-white hover:bg-white/15 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reintentar
              </button>
              <button
                onClick={handleNewConcept}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Otro concepto
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
