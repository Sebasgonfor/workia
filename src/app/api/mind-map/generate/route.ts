import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/ai";
import { cleanContentForPrompt } from "@/lib/services/content-cleaner";

const PROMPT = `Genera un mapa mental en formato Mermaid mindmap a partir del siguiente contenido académico.

MATERIA: {subjectName}
CONTENIDO:
{content}

REGLAS:
- Usa la sintaxis de Mermaid mindmap.
- El nodo central debe ser el tema principal.
- Máximo 3 niveles de profundidad.
- Máximo 20 nodos totales para legibilidad.
- Usa texto conciso en español (2-5 palabras por nodo).
- Organiza jerárquicamente: tema → subtemas → conceptos.
- NO uses caracteres especiales, paréntesis, ni comillas en los nodos.

Responde ÚNICAMENTE con código Mermaid válido, sin backticks, sin explicaciones:

mindmap
  root((Tema Central))
    Subtema 1
      Concepto A
      Concepto B
    Subtema 2
      Concepto C
      Concepto D`;

export async function POST(req: NextRequest) {
  try {
    const { content, subjectName } = await req.json() as {
      content: string;
      subjectName: string;
    };

    if (!content?.trim()) {
      return NextResponse.json({ error: "No se envio contenido" }, { status: 400 });
    }

    const prompt = PROMPT
      .replace("{content}", cleanContentForPrompt(content))
      .replace("{subjectName}", subjectName || "General");

    const raw = (await generateText(prompt)).trim();

    const code = raw
      .replace(/^```(?:mermaid)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    return NextResponse.json({ success: true, code });
  } catch (err) {
    console.error("mind-map/generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar mapa mental" },
      { status: 500 }
    );
  }
}
