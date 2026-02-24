"use client";

import { useState, useMemo } from "react";
import {
  GraduationCap,
  BookOpen,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { useSubjects, useGrades } from "@/lib/hooks";
import type { CorteGrades, SubjectGradeRecord } from "@/types";
import { CORTE_WEIGHTS, MIN_PASSING_GRADE, MAX_GRADE } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Math utilities ──

const EMPTY_CORTE: CorteGrades = { formativa1: null, formativa2: null, parcial: null };

const calcCorteGrade = (c: CorteGrades): number =>
  (c.formativa1 ?? 0) * 0.25 + (c.formativa2 ?? 0) * 0.25 + (c.parcial ?? 0) * 0.5;

const isCorteComplete = (c: CorteGrades) =>
  c.formativa1 !== null && c.formativa2 !== null && c.parcial !== null;

const calcSummary = (c1: CorteGrades, c2: CorteGrades, c3: CorteGrades) => {
  const cortes = [c1, c2, c3];
  let accumulated = 0;
  let completedWeight = 0;
  cortes.forEach((c, i) => {
    if (isCorteComplete(c)) {
      accumulated += calcCorteGrade(c) * CORTE_WEIGHTS[i];
      completedWeight += CORTE_WEIGHTS[i];
    }
  });
  const remainingWeight = 1 - completedWeight;
  const minNeeded =
    remainingWeight > 0 ? (MIN_PASSING_GRADE - accumulated) / remainingWeight : null;
  const canStillPass =
    minNeeded === null ? accumulated >= MIN_PASSING_GRADE : minNeeded <= MAX_GRADE;
  const currentAvg = completedWeight > 0 ? accumulated / completedWeight : null;
  return { accumulated, completedWeight, remainingWeight, minNeeded, canStillPass, currentAvg };
};

// ── Types ──

type EditState = { corte1: CorteGrades; corte2: CorteGrades; corte3: CorteGrades };
type CorteKey = keyof EditState;
type AiResult = { analysis: string } | null;

const FIELD_LABELS: Record<keyof CorteGrades, string> = {
  formativa1: "Formativa 1\n(25%)",
  formativa2: "Formativa 2\n(25%)",
  parcial: "Parcial\n(50%)",
};

// ── Sub-components ──

function GradeInput({
  label,
  value,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number | null;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-muted-foreground leading-tight whitespace-pre-line text-center">
        {label}
      </label>
      <input
        type="number"
        min="0"
        max="5"
        step="0.1"
        placeholder="—"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="w-full px-2 py-2 text-sm text-center rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

// ── Page ──

export default function NotasPage() {
  const { subjects } = useSubjects();
  const { grades, saveGrades } = useGrades();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    corte1: { ...EMPTY_CORTE },
    corte2: { ...EMPTY_CORTE },
    corte3: { ...EMPTY_CORTE },
  });
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult>(null);
  const [activeCorte, setActiveCorte] = useState<CorteKey | null>(null);

  const gradeMap = useMemo(
    () => Object.fromEntries(grades.map((g) => [g.subjectId, g])),
    [grades]
  );

  const selectedSubject = subjects.find((s) => s.id === selectedId) ?? null;

  const summary = useMemo(
    () =>
      selectedId
        ? calcSummary(editState.corte1, editState.corte2, editState.corte3)
        : null,
    [editState, selectedId]
  );

  const handleOpen = (subjectId: string) => {
    const rec = gradeMap[subjectId] as SubjectGradeRecord | undefined;
    setEditState({
      corte1: rec?.corte1 ?? { ...EMPTY_CORTE },
      corte2: rec?.corte2 ?? { ...EMPTY_CORTE },
      corte3: rec?.corte3 ?? { ...EMPTY_CORTE },
    });
    setAiResult(null);
    setActiveCorte(null);
    setSelectedId(subjectId);
  };

  const handleCloseSheet = () => {
    setSelectedId(null);
    setActiveCorte(null);
  };

  const handleGradeChange = (
    corte: keyof EditState,
    field: keyof CorteGrades,
    raw: string
  ) => {
    const parsed = parseFloat(raw);
    const num = raw === "" ? null : isNaN(parsed) ? null : Math.min(MAX_GRADE, Math.max(0, parsed));
    setEditState((prev) => ({
      ...prev,
      [corte]: { ...prev[corte], [field]: num },
    }));
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await saveGrades(selectedId, editState);
      toast.success("Notas guardadas correctamente");
    } catch {
      toast.error("Error al guardar las notas");
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedSubject) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/grades/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectName: selectedSubject.name, grades: editState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error IA");
      setAiResult(data);
    } catch {
      toast.error("Error al analizar con IA");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-background page-enter">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 pt-safe pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Notas</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Escala 0.0 – 5.0 · Mínimo para aprobar: 3.0
          </p>
        </div>

        {/* Subject list */}
        <div className="px-4 py-4 space-y-3 stagger-children max-w-lg mx-auto">
          {subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aún no tienes materias.
                <br />
                Crea una desde la sección Materias.
              </p>
            </div>
          ) : (
            subjects.map((subject) => {
              const rec = gradeMap[subject.id] as SubjectGradeRecord | undefined;
              const s = rec ? calcSummary(rec.corte1, rec.corte2, rec.corte3) : null;
              const hasData = s !== null && s.completedWeight > 0;
              return (
                <button
                  key={subject.id}
                  onClick={() => handleOpen(subject.id)}
                  aria-label={`Ver notas de ${subject.name}`}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && handleOpen(subject.id)}
                  className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:bg-accent active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{subject.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{subject.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {hasData
                            ? `Promedio actual: ${s!.currentAvg!.toFixed(2)}`
                            : "Sin notas registradas"}
                        </p>
                      </div>
                    </div>
                    {hasData && (
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            s!.canStillPass ? "text-emerald-500" : "text-red-500"
                          )}
                        >
                          {s!.canStillPass ? "✓ Aprobable" : "✗ En riesgo"}
                        </span>
                        {s!.minNeeded !== null && (
                          <span className="text-[10px] text-muted-foreground">
                            Min. necesario: {s!.minNeeded.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Corte progress bar */}
                  {rec && (
                    <div className="flex gap-1.5 mt-3">
                      {([rec.corte1, rec.corte2, rec.corte3] as CorteGrades[]).map(
                        (c, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1.5 rounded-full",
                              i === 0 || i === 1 ? "flex-[3]" : "flex-[4]",
                              isCorteComplete(c) ? "bg-primary" : "bg-muted"
                            )}
                          />
                        )
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Grade Editor Sheet */}
      <Sheet
        open={!!selectedId}
        onClose={handleCloseSheet}
        title={
          selectedSubject
            ? `${selectedSubject.emoji} ${selectedSubject.name}`
            : "Notas"
        }
      >
        <div className="space-y-4 pb-6">
          {/* Summary banner */}
          {summary && summary.completedWeight > 0 && (
            <div
              className={cn(
                "p-3 rounded-xl text-sm flex items-start gap-2",
                summary.canStillPass
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-700 dark:text-red-400"
              )}
            >
              {summary.canStillPass ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>
                {summary.minNeeded !== null
                  ? summary.minNeeded <= 0
                    ? `¡Ya tienes la nota garantizada con ${summary.currentAvg!.toFixed(2)}!`
                    : `Necesitas mínimo ${summary.minNeeded.toFixed(2)} en los cortes restantes para aprobar.`
                  : summary.canStillPass
                  ? `¡Aprobaste con ${summary.accumulated.toFixed(2)}!`
                  : `Reprobaste con ${summary.accumulated.toFixed(2)}.`}
              </span>
            </div>
          )}

          {/* Step 1 – Corte selector */}
          {activeCorte === null ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground px-0.5">Selecciona el corte que quieres registrar:</p>
              {(["corte1", "corte2", "corte3"] as CorteKey[]).map((key, i) => {
                const c = editState[key];
                const complete = isCorteComplete(c);
                const avg = complete ? calcCorteGrade(c) : null;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCorte(key)}
                    aria-label={`Editar corte ${i + 1}`}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setActiveCorte(key)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent active:scale-[0.99] transition-all"
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-semibold text-sm">Corte {i + 1}</span>
                      <span className="text-xs text-muted-foreground">{CORTE_WEIGHTS[i] * 100}% de la nota final</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {avg !== null ? (
                        <span
                          className={cn(
                            "text-sm font-bold",
                            avg >= MIN_PASSING_GRADE ? "text-emerald-500" : "text-red-500"
                          )}
                        >
                          {avg.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin notas</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}

              {/* AI analysis */}
              <div className="rounded-xl border border-border p-4 space-y-3 mt-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Análisis con IA</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Analiza tu rendimiento para saber exactamente qué necesitas en cada evaluación pendiente.
                </p>
                <button
                  onClick={handleAnalyze}
                  disabled={aiLoading}
                  aria-label="Analizar rendimiento con inteligencia artificial"
                  className="w-full py-2.5 rounded-lg border border-primary text-primary text-sm font-medium disabled:opacity-60 active:scale-[0.99] transition-transform"
                >
                  {aiLoading ? "Analizando..." : "Analizar mi rendimiento"}
                </button>
                {aiResult && (
                  <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap bg-muted/50 rounded-lg p-3 border border-border">
                    {aiResult.analysis}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Step 2 – Grade inputs for selected corte */
            (() => {
              const idx = ["corte1", "corte2", "corte3"].indexOf(activeCorte);
              const c = editState[activeCorte];
              const complete = isCorteComplete(c);
              const avg = complete ? calcCorteGrade(c) : null;
              return (
                <div className="space-y-4">
                  {/* Back + title */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveCorte(null)}
                      aria-label="Volver a selección de corte"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setActiveCorte(null)}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <p className="font-semibold text-sm">Corte {idx + 1}</p>
                      <p className="text-xs text-muted-foreground">{CORTE_WEIGHTS[idx] * 100}% de la nota final</p>
                    </div>
                    {avg !== null && (
                      <span
                        className={cn(
                          "ml-auto text-sm font-bold",
                          avg >= MIN_PASSING_GRADE ? "text-emerald-500" : "text-red-500"
                        )}
                      >
                        {avg.toFixed(2)} / 5.0
                      </span>
                    )}
                  </div>

                  {/* Inputs */}
                  <div className="rounded-xl border border-border p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {(["formativa1", "formativa2", "parcial"] as (keyof CorteGrades)[]).map(
                        (field) => (
                          <GradeInput
                            key={field}
                            label={FIELD_LABELS[field]}
                            value={c[field]}
                            onChange={(v) => handleGradeChange(activeCorte, field, v)}
                            ariaLabel={`${FIELD_LABELS[field]} corte ${idx + 1}`}
                          />
                        )
                      )}
                    </div>
                  </div>

                  {/* Save */}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60 active:scale-[0.99] transition-transform"
                  >
                    {saving ? "Guardando..." : "Guardar notas"}
                  </button>
                </div>
              );
            })()
          )}
        </div>
      </Sheet>
    </AppShell>
  );
}
