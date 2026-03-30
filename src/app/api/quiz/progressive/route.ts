import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseGeminiResponse } from "@/app/api/_utils/parse-gemini-json";
import { cleanContentForPrompt as cleanContent } from "@/lib/services/content-cleaner";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  recognition: `NIVEL: RECONOCIMIENTO (Fácil)
- Preguntas de opción múltiple donde la respuesta correcta es casi textual del contenido.
- Los distractores deben ser claramente diferentes.
- El estudiante solo necesita RECONOCER la información correcta.
- Incluye preguntas tipo "¿Cuál de los siguientes...?", "¿Qué es...?"`,

  recall: `NIVEL: RECUERDO (Medio)
- Preguntas que requieren que el estudiante RECUERDE la información sin verla.
- Los distractores deben ser plausibles y más cercanos a la respuesta correcta.
- Incluye preguntas tipo "Explica brevemente...", "¿Cómo se calcula...?", "Completa: ..."
- Algunas preguntas deben requerir conectar dos conceptos.`,

  application: `NIVEL: APLICACIÓN (Difícil)
- Preguntas basadas en ESCENARIOS que requieren aplicar el conocimiento.
- El estudiante debe usar conceptos para resolver un problema nuevo.
- Incluye cálculos, análisis de casos, predicciones.
- Los distractores deben ser resultados de errores comunes.
- Tipo: "Si... entonces ¿qué pasaría?", "Dado el siguiente escenario..."`
};

const PROMPT = `Eres un profesor universitario experto en evaluación por competencias.

{difficultyInstructions}

CONTENIDO:
{content}

MATERIA: {subjectName}

REGLAS:
- Genera entre 5 y 8 preguntas del nivel indicado.
- Mezcla "multiple_choice" (70%) y "true_false" (30%).
- Multiple choice: exactamente 4 opciones.
- True/false: options siempre ["Verdadero", "Falso"].
- Usa $LaTeX$ para fórmulas.
- explanation: justificación breve de la respuesta correcta.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks):
{
  "title": "Quiz [nivel]: [tema]",
  "questions": [
    {"id": "q1", "question": "...", "type": "multiple_choice", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..."}
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const { content, subjectName, difficulty } = await req.json() as {
      content: string;
      subjectName: string;
      difficulty: string;
    };

    if (!content?.trim()) {
      return NextResponse.json({ error: "No se envió contenido" }, { status: 400 });
    }

    const diffLevel = difficulty && DIFFICULTY_INSTRUCTIONS[difficulty] ? difficulty : "recognition";

    const prompt = PROMPT
      .replace("{difficultyInstructions}", DIFFICULTY_INSTRUCTIONS[diffLevel])
      .replace("{content}", cleanContent(content))
      .replace("{subjectName}", subjectName || "General");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = parseGeminiResponse(text);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("quiz/progressive error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar quiz progresivo" },
      { status: 500 }
    );
  }
}
