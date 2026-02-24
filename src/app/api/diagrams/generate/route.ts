import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const DIAGRAM_PROMPT = `Eres un experto en diagramas Mermaid para uso académico universitario de INGENIERÍA.
El usuario quiere un diagrama a partir de esta descripción:

"{description}"

INSTRUCCIONES CRÍTICAS:
1. Responde ÚNICAMENTE con código Mermaid válido, sin texto adicional, sin backticks, sin explicaciones.
2. Elige el tipo de diagrama más apropiado según la descripción:
   - Proceso / algoritmo / pasos secuenciales  →  flowchart TD
   - Interacciones / llamadas entre sistemas   →  sequenceDiagram
   - Clases / herencia / OOP                  →  classDiagram
   - Jerarquía / árbol / organigrama           →  graph TB
   - Línea de tiempo                           →  timeline
   - Entidad-Relación (bases de datos)         →  erDiagram
   - Estado / autómata                         →  stateDiagram-v2
3. Usa texto en español, conciso y sin caracteres especiales problemáticos.
4. Máximo 18 nodos para mantenerlo legible en pantalla móvil.
5. Usa IDs simples tipo A, B, C o nombres cortos sin espacios.
6. Para flowchart: usa --- para flechas sin etiqueta y -->|texto| para con etiqueta.
`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const body = await req.json() as { description?: string };
    const description = body.description?.trim();

    if (!description) {
      return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent(
      DIAGRAM_PROMPT.replace("{description}", description)
    );

    const raw = result.response.text().trim();

    // Strip any accidental markdown fences the model may add
    const code = raw
      .replace(/^```(?:mermaid)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    return NextResponse.json({ success: true, code });
  } catch (err) {
    console.error("Diagram generation error:", err);
    return NextResponse.json({ error: "Error al generar diagrama" }, { status: 500 });
  }
}
