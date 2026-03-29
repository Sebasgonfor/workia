import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseGeminiResponse } from "@/app/api/_utils/parse-gemini-json";
import { cleanContentForPrompt as cleanContent } from "@/lib/services/content-cleaner";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const PROMPT = `Eres un experto en pedagogía y mapas conceptuales. Analiza el siguiente contenido académico y extrae un grafo de conocimiento con nodos (conceptos) y aristas (relaciones).

CONTENIDO:
{content}

MATERIA: {subjectName}

REGLAS:
- Extrae entre 5 y 15 conceptos clave como nodos.
- Cada nodo tiene un id único (n1, n2...), un label corto (2-4 palabras).
- Conecta los nodos con aristas que describan la relación (ej: "es un tipo de", "depende de", "se aplica en", "es opuesto a").
- strength: 1.0 para relaciones directas y fuertes, 0.5 para moderadas, 0.3 para débiles.
- No crear nodos huérfanos (sin conexiones).
- Prioriza relaciones jerárquicas y causales.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks):
{
  "nodes": [
    {"id": "n1", "label": "Concepto"}
  ],
  "edges": [
    {"source": "n1", "target": "n2", "label": "se relaciona con", "strength": 0.8}
  ]
}`;

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
    console.error("knowledge-graph/extract error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al extraer grafo" },
      { status: 500 }
    );
  }
}
