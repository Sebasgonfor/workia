import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseGeminiResponse } from "@/app/api/_utils/parse-gemini-json";
import { cleanContentForPrompt } from "@/lib/services/content-cleaner";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const PROMPT = `Eres un profesor universitario experto preparando a un estudiante para un PARCIAL.

MATERIA: {subjectName}
TIPO DE EXAMEN: {examType}

CONTENIDO DE LOS TEMAS SELECCIONADOS PARA EL PARCIAL:
{content}

Genera una GUÍA DE ESTUDIO COMPLETA para el parcial. La guía debe contener:

1. **RESUMEN EJECUTIVO**: Panorama general de los temas del parcial (3-5 párrafos).

2. **CONCEPTOS CLAVE**: Lista de TODOS los conceptos que el estudiante DEBE dominar.
   Para cada concepto incluye:
   - Nombre del concepto
   - Definición concisa
   - Por qué es importante para el parcial
   - Nivel de dificultad: "fundamental" | "importante" | "avanzado"

3. **FÓRMULAS Y ECUACIONES**: Todas las fórmulas relevantes con:
   - La fórmula en LaTeX
   - Nombre
   - Cuándo usar cada una
   - Variables y sus unidades

4. **ERRORES COMUNES**: Los errores más frecuentes que los estudiantes cometen en estos temas.

5. **PREGUNTAS TIPO PARCIAL**: 8-12 preguntas que probablemente aparecerían en el parcial.
   Mezcla de:
   - "multiple_choice" (60%): 4 opciones con distractores plausibles
   - "open_ended" (20%): preguntas de desarrollo corto
   - "problem" (20%): ejercicios para resolver

6. **PLAN DE ESTUDIO**: Sugerencia de orden de estudio con tiempos estimados.

Usa $LaTeX$ para fórmulas inline y $$...$$ para bloques.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "summary": "markdown del resumen ejecutivo",
  "keyConcepts": [
    {"name": "...", "definition": "...", "importance": "...", "difficulty": "fundamental|importante|avanzado"}
  ],
  "formulas": [
    {"name": "...", "formula": "$...$", "whenToUse": "...", "variables": "..."}
  ],
  "commonMistakes": ["error 1", "error 2"],
  "practiceQuestions": [
    {
      "id": "q1",
      "question": "...",
      "type": "multiple_choice|open_ended|problem",
      "options": ["A","B","C","D"],
      "correctIndex": 0,
      "explanation": "...",
      "difficulty": "fundamental|importante|avanzado"
    }
  ],
  "studyPlan": [
    {"topic": "...", "estimatedMinutes": 30, "priority": "alta|media|baja"}
  ]
}`;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const { content, subjectName, examType } = await req.json() as {
      content: string;
      subjectName: string;
      examType?: string;
    };

    if (!content?.trim()) {
      return NextResponse.json({ error: "No se envio contenido" }, { status: 400 });
    }

    const prompt = PROMPT
      .replace("{content}", cleanContentForPrompt(content))
      .replace("{subjectName}", subjectName || "General")
      .replace("{examType}", examType || "Parcial");

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = parseGeminiResponse(text);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("exam-guide/generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar guia" },
      { status: 500 }
    );
  }
}
