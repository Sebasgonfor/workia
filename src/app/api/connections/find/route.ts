import { NextRequest, NextResponse } from "next/server";
import { generateText, parseAiJson } from "@/lib/ai";
import { cleanContentForPrompt } from "@/lib/services/content-cleaner";

const PROMPT = `Eres un profesor universitario experto en pedagogia. Analiza los siguientes apuntes de DIFERENTES clases/materias y encuentra CONEXIONES conceptuales entre ellos.

APUNTES:
{entries}

REGLAS:
- Encuentra entre 2 y 8 conexiones significativas entre los apuntes.
- Cada conexion debe vincular conceptos de DIFERENTES clases o sesiones.
- La relacion debe ser pedagogicamente relevante (no trivial).
- Tipos de relacion: "prerequisito", "aplicacion", "analogia", "extension", "contraste", "complemento"
- strength: 1.0 para conexiones directas y fuertes, 0.5 para moderadas, 0.3 para debiles.
- Prioriza conexiones que ayuden al estudiante a entender mejor ambos conceptos.

RESPONDE SOLO CON JSON VALIDO (sin markdown, sin backticks):
{
  "connections": [
    {
      "sourceClass": "Nombre de la clase/sesion 1",
      "sourceConcept": "Concepto especifico del apunte 1",
      "targetClass": "Nombre de la clase/sesion 2",
      "targetConcept": "Concepto especifico del apunte 2",
      "relationship": "prerequisito|aplicacion|analogia|extension|contraste|complemento",
      "explanation": "Explicacion breve de por que estos conceptos estan conectados",
      "strength": 0.8
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const { entries } = await req.json() as {
      entries: Array<{ classTitle: string; subjectName: string; content: string }>;
    };

    if (!entries || entries.length < 2) {
      return NextResponse.json({ error: "Se necesitan al menos 2 apuntes" }, { status: 400 });
    }

    const entriesText = entries
      .map((e, i) => `--- Apunte ${i + 1}: ${e.subjectName} / ${e.classTitle} ---\n${cleanContentForPrompt(e.content)}`)
      .join("\n\n");

    const prompt = PROMPT.replace("{entries}", entriesText);

    const text = (await generateText(prompt, { json: true })).trim();
    const parsed = parseAiJson(text);

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("connections/find error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al buscar conexiones" },
      { status: 500 }
    );
  }
}
