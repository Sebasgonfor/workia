import { NextRequest, NextResponse } from "next/server";
import { generateText, parseAiJson } from "@/lib/ai";
import { cleanContentForPrompt as cleanContent } from "@/lib/services/content-cleaner";

const PROMPT = `Eres un evaluador académico experto. Un estudiante intentó explicar un concepto con sus propias palabras (Técnica Feynman). Compara su explicación con el contenido original y evalúa su comprensión.

CONCEPTO: {concept}
MATERIA: {subjectName}

CONTENIDO ORIGINAL DE LOS APUNTES:
{originalContent}

EXPLICACIÓN DEL ESTUDIANTE:
{userExplanation}

EVALÚA la explicación del estudiante siguiendo estos criterios:
1. ¿Cubrió los puntos clave del concepto?
2. ¿Hay errores conceptuales?
3. ¿Omitió información importante?
4. ¿La explicación demuestra comprensión real o solo memorización?

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks):
{
  "score": 75,
  "correct": ["Punto que explicó correctamente 1", "Punto correcto 2"],
  "missed": ["Punto importante que omitió 1", "Punto omitido 2"],
  "wrong": ["Error conceptual 1"],
  "suggestions": ["Sugerencia para mejorar comprensión 1", "Sugerencia 2"],
  "detailedFeedback": "Retroalimentación detallada en español usando markdown. Usa $LaTeX$ para fórmulas si aplica."
}

REGLAS para el score:
- 90-100: Explicación excelente, cubre todos los puntos clave correctamente
- 70-89: Buena explicación, falta algún detalle o tiene imprecisiones menores
- 50-69: Explicación parcial, faltan puntos importantes o hay errores
- 30-49: Comprensión superficial, muchos gaps o errores
- 0-29: No demuestra comprensión del concepto`;

export async function POST(req: NextRequest) {
  try {
    const { concept, originalContent, userExplanation, subjectName } = await req.json();

    if (!concept || !originalContent || !userExplanation) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const prompt = PROMPT
      .replace("{concept}", concept)
      .replace("{subjectName}", subjectName || "General")
      .replace("{originalContent}", cleanContent(originalContent))
      .replace("{userExplanation}", userExplanation);

    const text = (await generateText(prompt, { json: true })).trim();
    const parsed = parseAiJson(text);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("feynman/evaluate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al evaluar" },
      { status: 500 }
    );
  }
}
