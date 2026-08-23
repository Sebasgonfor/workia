import { NextRequest, NextResponse } from "next/server";
import { generateText, parseAiJson } from "@/lib/ai";
import { cleanContentForPrompt as cleanContent } from "@/lib/services/content-cleaner";

const PROMPT = `Eres un profesor universitario experto. Analiza el siguiente contenido académico y extrae los conceptos clave que el estudiante debería poder explicar.

CONTENIDO:
{content}

MATERIA: {subjectName}

REGLAS:
- Extrae entre 3 y 8 conceptos clave del contenido.
- Cada concepto debe ser un tema específico y evaluable (no demasiado amplio ni demasiado estrecho).
- Clasifica la dificultad según la complejidad del concepto.
- El nombre del concepto debe ser corto (2-5 palabras).
- Prioriza conceptos que requieren comprensión profunda, no solo memorización.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks):
{
  "concepts": [
    {
      "id": "c1",
      "name": "Nombre del concepto",
      "difficulty": "basic|intermediate|advanced"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const { content, subjectName } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "No se envió contenido" }, { status: 400 });
    }

    const prompt = PROMPT
      .replace("{content}", cleanContent(content))
      .replace("{subjectName}", subjectName || "General");

    const text = (await generateText(prompt, { json: true })).trim();
    const parsed = parseAiJson(text);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("feynman/extract error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al extraer conceptos" },
      { status: 500 }
    );
  }
}
