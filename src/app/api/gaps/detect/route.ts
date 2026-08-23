import { NextRequest, NextResponse } from "next/server";
import { generateText, parseAiJson } from "@/lib/ai";
import { cleanContentForPrompt as cleanContent } from "@/lib/services/content-cleaner";

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
    console.error("gaps/detect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al detectar gaps" },
      { status: 500 }
    );
  }
}
