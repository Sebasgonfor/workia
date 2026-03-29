import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseGeminiResponse } from "@/app/api/_utils/parse-gemini-json";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

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

function cleanContent(raw: string): string {
  return raw
    .replace(/\`\`\`mermaid[\s\S]*?\`\`\`/gi, "[diagrama]")
    .replace(/\`\`\`[\s\S]*?\`\`\`/g, "")
    .replace(/<nc-(?:def|formula|warn|ex|ai)>([\s\S]*?)<\/nc-(?:def|formula|warn|ex|ai)>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const { content, subjectName } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "No se envió contenido" }, { status: 400 });
    }

    const prompt = PROMPT
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
    console.error("feynman/extract error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al extraer conceptos" },
      { status: 500 }
    );
  }
}
