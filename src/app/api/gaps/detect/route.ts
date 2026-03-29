import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseGeminiResponse } from "@/app/api/_utils/parse-gemini-json";
import { cleanContentForPrompt as cleanContent } from "@/lib/services/content-cleaner";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const PROMPT = `Eres un profesor universitario experto en pedagogía. Analiza los siguientes apuntes de clase e identifica GAPS de conocimiento — temas incompletos, conceptos mencionados pero no explicados, prerequisitos faltantes, o áreas donde la explicación es superficial.

CONTENIDO DE LOS APUNTES:
{content}

MATERIA: {subjectName}

REGLAS:
- Identifica entre 2 y 6 gaps de conocimiento.
- severity "critical": prerequisito faltante o concepto central no explicado
- severity "moderate": explicación incompleta o falta de ejemplos
- severity "minor": detalle o caso especial no cubierto
- La sugerencia debe ser específica sobre qué debería estudiar el estudiante.
- Ordena de mayor a menor severidad.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks):
{
  "gaps": [
    {
      "topic": "Nombre del gap",
      "description": "Descripción de qué falta o está incompleto",
      "severity": "critical|moderate|minor",
      "suggestion": "Qué debería hacer el estudiante para llenar este gap"
    }
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
    console.error("gaps/detect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al detectar gaps" },
      { status: 500 }
    );
  }
}
