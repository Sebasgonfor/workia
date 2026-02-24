import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { CorteGrades } from "@/types";
import { CORTE_WEIGHTS, MIN_PASSING_GRADE, MAX_GRADE } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

// ── Helpers ──

const calcCorteGrade = (c: CorteGrades): number =>
  (c.formativa1 ?? 0) * 0.25 + (c.formativa2 ?? 0) * 0.25 + (c.parcial ?? 0) * 0.5;

const isCorteComplete = (c: CorteGrades) =>
  c.formativa1 !== null && c.formativa2 !== null && c.parcial !== null;

const fmt = (n: number | null) => (n !== null ? n.toFixed(2) : "Sin registrar");

const buildGradesSummary = (
  subjectName: string,
  corte1: CorteGrades,
  corte2: CorteGrades,
  corte3: CorteGrades
): string => {
  const cortes = [corte1, corte2, corte3];
  let accumulated = 0;
  let completedWeight = 0;

  const lines: string[] = [`Materia: ${subjectName}`, ""];

  cortes.forEach((c, i) => {
    const weight = CORTE_WEIGHTS[i];
    const complete = isCorteComplete(c);
    const avg = complete ? calcCorteGrade(c) : null;
    if (complete) {
      accumulated += avg! * weight;
      completedWeight += weight;
    }
    lines.push(`Corte ${i + 1} (${weight * 100}% del total):`);
    lines.push(`  Formativa 1 (25% del corte): ${fmt(c.formativa1)}`);
    lines.push(`  Formativa 2 (25% del corte): ${fmt(c.formativa2)}`);
    lines.push(`  Parcial     (50% del corte): ${fmt(c.parcial)}`);
    lines.push(`  Promedio del corte: ${complete ? avg!.toFixed(2) : "Incompleto"}`);
    lines.push("");
  });

  const remainingWeight = 1 - completedWeight;
  const minNeeded =
    remainingWeight > 0 ? (MIN_PASSING_GRADE - accumulated) / remainingWeight : null;

  lines.push(`Nota acumulada actual: ${completedWeight > 0 ? (accumulated / completedWeight).toFixed(2) : "N/A"}`);
  lines.push(`Contribución acumulada ponderada: ${accumulated.toFixed(2)}`);
  if (minNeeded !== null) {
    lines.push(`Mínimo necesario en cortes restantes: ${minNeeded.toFixed(2)}`);
    lines.push(
      minNeeded > MAX_GRADE
        ? "Estado: REPROBADO (ya no es posible recuperar)"
        : minNeeded <= 0
        ? "Estado: APROBADO (ya tienes 3.0 garantizados)"
        : `Estado: APROBABLE (necesitas >= ${minNeeded.toFixed(2)} para pasar)`
    );
  } else {
    lines.push(
      accumulated >= MIN_PASSING_GRADE
        ? `Estado: APROBADO con ${accumulated.toFixed(2)}`
        : `Estado: REPROBADO con ${accumulated.toFixed(2)}`
    );
  }

  return lines.join("\n");
};

const PROMPT = `Eres un tutor académico universitario. Analiza el siguiente reporte de notas de un estudiante y proporciona:

1. **Diagnóstico actual**: cómo va el estudiante en esta materia (usa los datos exactos).
2. **Notas mínimas necesarias**: por cada corte/evaluación pendiente, indica exactamente qué nota mínima necesita para aprobar con 3.0. Sé específico con cada ítem faltante.
3. **Consejo personalizado**: 1-2 consejos prácticos y motivadores según el rendimiento.

REPORTE:
{summary}

REGLAS:
- Sé conciso y directo. Responde en español.
- Usa los pesos exactos: Formativa 1 = 25% del corte, Formativa 2 = 25% del corte, Parcial = 50% del corte. Corte 1 = 30%, Corte 2 = 30%, Corte 3 = 40% de la nota final.
- Escala: 0.0 a 5.0. Mínimo para aprobar: 3.0.
- NO uses markdown con asteriscos para el texto. Usa secciones separadas por saltos de línea.
- Máximo 200 palabras.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key de Gemini no configurada" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { subjectName, grades } = body as {
      subjectName: string;
      grades: { corte1: CorteGrades; corte2: CorteGrades; corte3: CorteGrades };
    };

    if (!subjectName || !grades) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const summary = buildGradesSummary(
      subjectName,
      grades.corte1,
      grades.corte2,
      grades.corte3
    );

    const prompt = PROMPT.replace("{summary}", summary);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const analysis = result.response.text().trim();

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("grades/analyze error:", error);
    return NextResponse.json(
      { error: "Error al analizar con IA" },
      { status: 500 }
    );
  }
}
