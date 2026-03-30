import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseGeminiResponse } from "@/app/api/_utils/parse-gemini-json";
import { cleanContentForPrompt } from "@/lib/services/content-cleaner";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

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
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

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

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = parseGeminiResponse(text);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("exam-guide/simulate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar simulacro" },
      { status: 500 }
    );
  }
}
