import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const PROMPT = `Eres un profesor universitario experto en crear flashcards de estudio.

A partir del siguiente contenido academico, genera flashcards de alta calidad para estudio con repeticion espaciada.

CONTENIDO:
{content}

MATERIA: {subjectName}

REGLAS:
- Genera entre 3 y 10 flashcards dependiendo de la cantidad de contenido.
- Cada flashcard debe tener una pregunta clara y una respuesta concisa.
- Tipos de flashcard:
  - "definition": Conceptos y definiciones
  - "application": Aplicacion practica o ejercicios
  - "comparison": Comparaciones entre conceptos
  - "calculation": Formulas o calculos
- Las preguntas deben cubrir los conceptos clave del contenido.
- Las respuestas deben ser precisas y estudiantiles (faciles de memorizar).
- No repitas el mismo concepto en multiples flashcards.

RESPONDE SOLO CON JSON VALIDO (sin markdown, sin backticks):
{
  "flashcards": [
    {
      "question": "string",
      "answer": "string",
      "type": "definition|application|comparison|calculation"
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
    const { content, subjectName } = body as {
      content: string;
      subjectName: string;
    };

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "No se envio contenido" },
        { status: 400 }
      );
    }

    const prompt = PROMPT
      .replace("{content}", content)
      .replace("{subjectName}", subjectName || "General");

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
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
