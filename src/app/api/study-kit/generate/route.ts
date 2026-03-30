import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildDocumentContext, type DocRef } from "@/app/api/_utils/document-context";
import { parseGeminiResponse } from "@/app/api/_utils/parse-gemini-json";
import { cleanContentForPrompt as cleanContent } from "@/lib/services/content-cleaner";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const PROMPT = `Eres un profesor universitario experto. A partir del siguiente contenido académico, genera un KIT DE ESTUDIO completo.

CONTENIDO:
{content}

MATERIA: {subjectName}

Genera TODO en una sola respuesta JSON con estos componentes:

1. RESUMEN: Un resumen conciso del contenido (máx 300 palabras) en markdown con $LaTeX$ para fórmulas.

2. FLASHCARDS: Entre 5 y 12 flashcards de alta calidad.
   Tipos: "definition", "application", "comparison", "calculation"
   Usa $LaTeX$ para fórmulas.

3. QUIZ: Entre 5 y 8 preguntas mezclando "multiple_choice" y "true_false".
   - Multiple choice: 4 opciones, distractores plausibles.
   - True/false: options siempre ["Verdadero", "Falso"].

4. CONCEPTOS CLAVE: Los 5-10 conceptos más importantes con sus relaciones.
   - importance: "high" para conceptos fundamentales, "medium" para complementarios, "low" para detalles.
   - relatedConcepts: nombres de otros conceptos del mismo contenido que se relacionan.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "summary": "## Resumen\\n\\nContenido en markdown...",
  "flashcards": [
    {"question": "...", "answer": "...", "type": "definition"}
  ],
  "quiz": {
    "title": "Quiz: [tema]",
    "questions": [
      {"id": "q1", "question": "...", "type": "multiple_choice", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..."}
    ]
  },
  "keyConcepts": [
    {"name": "...", "definition": "...", "relatedConcepts": ["..."], "importance": "high"}
  ]
}`;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const body = await req.json();
    const { content, subjectName, subjectDocuments } = body as {
      content: string;
      subjectName: string;
      subjectDocuments?: DocRef[];
    };

    if (!content?.trim()) {
      return NextResponse.json({ error: "No se envió contenido" }, { status: 400 });
    }

    let prompt = PROMPT
      .replace("{content}", cleanContent(content))
      .replace("{subjectName}", subjectName || "General");

    const documentContext = await buildDocumentContext(subjectDocuments || []);
    if (documentContext.contextText) {
      prompt = prompt + "\n\n" + documentContext.contextText;
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(
      documentContext.parts.length > 0
        ? [prompt, ...documentContext.parts]
        : prompt
    );
    const text = result.response.text().trim();
    const parsed = parseGeminiResponse(text);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("study-kit/generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar kit de estudio" },
      { status: 500 }
    );
  }
}
