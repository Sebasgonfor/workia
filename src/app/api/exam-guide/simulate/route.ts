import { NextRequest, NextResponse } from "next/server";
import { generateText, parseAiJson } from "@/lib/ai";
import { cleanContentForPrompt } from "@/lib/services/content-cleaner";

const PROMPT = `Eres un profesor universitario creando un SIMULACRO DE PARCIAL realista.

MATERIA: {subjectName}
DURACIÓN DEL EXAMEN: {duration} minutos
DIFICULTAD: {difficulty}

CONTENIDO DE LOS TEMAS:
{content}

Crea un examen simulado que replique las condiciones reales de un parcial universitario.

REGLAS:
- Genera exactamente {questionCount} preguntas.
- Distribución: 50% opción múltiple, 25% desarrollo corto, 25% problemas/ejercicios.
- Los problemas deben requerir cálculos o razonamiento paso a paso.
- Para opción múltiple: exactamente 4 opciones con distractores basados en errores comunes.
- Para desarrollo: la respuesta esperada debe ser 2-4 oraciones.
- Para problemas: incluye todos los datos necesarios y la solución completa.
- Asigna puntos a cada pregunta (total = 100 puntos).
- Usa $LaTeX$ para fórmulas.
- Ordena de menor a mayor dificultad.

RESPONDE SOLO CON JSON VÁLIDO:
{
  "title": "Simulacro: [tema]",
  "totalPoints": 100,
  "duration": {duration},
  "questions": [
    {
      "id": "q1",
      "question": "...",
      "type": "multiple_choice|short_answer|problem",
      "points": 10,
      "options": ["A","B","C","D"],
      "correctIndex": 0,
      "expectedAnswer": "respuesta para desarrollo/problemas",
      "solution": "solucion paso a paso",
      "explanation": "...",
      "difficulty": "facil|medio|dificil"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const { content, subjectName, duration, difficulty, questionCount } = await req.json() as {
      content: string;
      subjectName: string;
      duration?: number;
      difficulty?: string;
      questionCount?: number;
    };

    if (!content?.trim()) {
      return NextResponse.json({ error: "No se envio contenido" }, { status: 400 });
    }

    const prompt = PROMPT
      .replace("{content}", cleanContentForPrompt(content))
      .replace("{subjectName}", subjectName || "General")
      .replace(/\{duration\}/g, String(duration || 60))
      .replace("{difficulty}", difficulty || "medio")
      .replace("{questionCount}", String(questionCount || 10));

    const text = (await generateText(prompt, { json: true })).trim();
    const parsed = parseAiJson(text);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("exam-guide/simulate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar simulacro" },
      { status: 500 }
    );
  }
}
