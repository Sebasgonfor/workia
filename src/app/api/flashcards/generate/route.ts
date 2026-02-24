import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildDocumentContext, type DocRef } from "@/app/api/_utils/document-context";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const PROMPT = `Eres un profesor universitario de INGENIERÍA experto en crear flashcards de estudio.

A partir del siguiente contenido académico, genera flashcards de alta calidad para estudio con repetición espaciada.

CONTENIDO:
{content}

MATERIA: {subjectName}

REGLAS:
- Genera entre 3 y 10 flashcards dependiendo de la cantidad de contenido.
- Cada flashcard debe tener una pregunta clara y una respuesta concisa.
- Tipos de flashcard:
  - "definition": Conceptos y definiciones
  - "application": Aplicación práctica o ejercicios
  - "comparison": Comparaciones entre conceptos
  - "calculation": Fórmulas o cálculos
- ECUACIONES: Usa LaTeX en preguntas y respuestas. Inline: $...$ | Bloque: $$...$$
  Ejemplo pregunta: "¿Cuál es la fórmula de la transformada de Laplace?"
  Ejemplo respuesta: "$\\mathcal{L}\\{f(t)\\} = \\int_0^{\\infty} e^{-st} f(t) \\, dt$"
- Las preguntas deben cubrir los conceptos clave del contenido.
- Las respuestas deben ser precisas y estudiantiles (fáciles de memorizar).
- No repitas el mismo concepto en múltiples flashcards.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks):
{
  "flashcards": [
    {
      "question": "string con $LaTeX$ si aplica",
      "answer": "string con $LaTeX$ si aplica",
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
