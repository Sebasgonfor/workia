import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildDocumentContext, type DocRef } from "@/app/api/_utils/document-context";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const PROMPT = `Eres un profesor universitario experto en crear evaluaciones de estudio de alta calidad.

A partir del siguiente contenido académico, genera un quiz de evaluación con preguntas de opción múltiple y verdadero/falso.

CONTENIDO:
{content}

MATERIA: {subjectName}

REGLAS GENERALES:
- Genera entre 4 y 10 preguntas según la cantidad y densidad del contenido.
- Si el contenido es corto (<300 palabras): 4-5 preguntas.
- Si el contenido es medio (300-700 palabras): 6-8 preguntas.
- Si el contenido es largo (>700 palabras): 8-10 preguntas.
- Mezcla los tipos: aproximadamente 60% "multiple_choice" y 40% "true_false".
- Las preguntas deben cubrir los conceptos más importantes del contenido.
- No repitas el mismo concepto en varias preguntas.

REGLAS PARA OPCIÓN MÚLTIPLE ("multiple_choice"):
- Exactamente 4 opciones (options array de 4 strings).
- Una sola opción correcta (correctIndex: 0, 1, 2 o 3).
- Las opciones incorrectas deben ser plausibles, no ridículas.
- Evita pistas obvias como "todas las anteriores" o "ninguna".

REGLAS PARA VERDADERO/FALSO ("true_false"):
- El options array SIEMPRE debe ser: ["Verdadero", "Falso"].
- correctIndex: 0 si es Verdadero, 1 si es Falso.
- La afirmación debe ser clara y sin ambigüedades.

REGLAS DE FORMATO:
- ECUACIONES: Usa LaTeX inline ($...$) para fórmulas matemáticas.
- explanation: breve justificación de la respuesta correcta (máx 1-2 oraciones).
- Los IDs deben ser "q1", "q2", "q3", etc.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks):
{
  "title": "Quiz: [tema principal del contenido]",
  "questions": [
    {
      "id": "q1",
      "question": "texto de la pregunta",
      "type": "multiple_choice",
      "options": ["opcion A", "opcion B", "opcion C", "opcion D"],
      "correctIndex": 2,
      "explanation": "breve explicacion de por que es correcta"
    },
    {
      "id": "q2",
      "question": "afirmacion para evaluar si es verdadera o falsa",
      "type": "true_false",
      "options": ["Verdadero", "Falso"],
      "correctIndex": 0,
      "explanation": "breve explicacion"
    }
  ]
}`;

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
    const { content, subjectName, subjectDocuments } = body as {
      content: string;
      subjectName: string;
      subjectDocuments?: DocRef[];
    };

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "No se envio contenido" },
        { status: 400 }
      );
    }

    let prompt = PROMPT
      .replace("{content}", content)
      .replace("{subjectName}", subjectName || "General");

    // Build document context from subject library
    const documentContext = await buildDocumentContext(subjectDocuments || []);
    if (documentContext.contextText) {
      prompt = `${prompt}\n\n${documentContext.contextText}`;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(
      documentContext.parts.length > 0
        ? [prompt, ...documentContext.parts]
        : prompt
    );
    const text = result.response.text();

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "Error al interpretar respuesta de IA", raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
