import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const ENRICH_PROMPT = `Eres un profesor universitario experto en INGENIERÍA construyendo un tablero dinámico de conocimiento.

CONTEXTO:
- Materia: {subjectName}
- Fecha actual: {currentDate}
- Estado del tablero: {boardState}

MISIÓN:
{mission}

INSTRUCCIONES OBLIGATORIAS:

1. ESTRUCTURA con Markdown:
   - ## temas principales, ### subtemas
   - **negritas** en CADA concepto clave y término técnico
   - Listas numeradas para pasos, viñetas para propiedades
   - Tablas cuando haya múltiples conceptos comparables
   - ECUACIONES siempre LaTeX: $inline$ y $$bloque$$

2. SISTEMA DE COLORES — usar en CADA concepto sin excepción:
   <nc-def>contenido</nc-def>
   → Definición formal COMPLETA de cada concepto (amplía aunque ya esté en el input)

   <nc-formula>contenido</nc-formula>
   → Cada ecuación + nombre completo + explicación de CADA símbolo/variable/unidad

   <nc-ex>contenido</nc-ex>
   → Cada ejemplo del input + crea 1-2 ejemplos adicionales resueltos paso a paso

   <nc-warn>contenido</nc-warn>
   → Condiciones de validez, restricciones, errores comunes, casos especiales

   <nc-ai>contenido</nc-ai>
   → MÍNIMO 3 bloques por tema con aportes que NO estén en el input:
      · Propiedades y teoremas del tema
      · Intuición geométrica o física del concepto
      · Tabla comparativa si hay múltiples conceptos
      · Aplicaciones reales en ingeniería
      · Conexión con otros temas de la misma materia

3. REGLA DE ORO — NUNCA PIERDAS CONTENIDO:
   Si hay tablero existente, MANTÉN TODO su contenido y EXPÁNDELO con el nuevo material.
   NUNCA sobreescribas ni elimines información previa. Solo integra y enriquece.

4. DIAGRAMAS: Si detectas cualquier diagrama/figura/flujo, conviértelo a Mermaid:
   \`\`\`mermaid
   flowchart TD / sequenceDiagram / classDiagram / graph TB
   \`\`\`

5. MÍNIMO: el "content" nunca debe tener menos de 500 palabras.

{existingSection}
{notesSection}

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "content": "markdown enriquecido completo del tablero"
}`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API key de Gemini no configurada" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { existingContent, newImages, existingNotes, subjectName } = body as {
      existingContent?: string;
      newImages?: string[]; // base64 data URLs
      existingNotes?: string[];
      subjectName?: string;
    };

    const hasExisting = !!(existingContent && existingContent.trim());
    const hasImages = Array.isArray(newImages) && newImages.length > 0;
    const hasNotes = Array.isArray(existingNotes) && existingNotes.length > 0;

    if (!hasImages && !hasNotes) {
      return NextResponse.json(
        { success: false, error: "Debes agregar fotos o importar notas" },
        { status: 400 }
      );
    }

    const boardState = hasExisting
      ? "El tablero ya tiene contenido previo que DEBES conservar y expandir"
      : "El tablero está vacío — crea el contenido desde cero";

    const mission = hasExisting
      ? "Integra el nuevo material (imágenes y/o notas importadas) con el tablero existente, expandiendo y enriqueciendo cada sección sin eliminar nada."
      : "Crea un tablero de conocimiento completo y enriquecido basado en el material proporcionado.";

    const existingSection = hasExisting
      ? `TABLERO ACTUAL (conserva y expande todo esto):\n${existingContent}`
      : "";

    const notesSection =
      hasNotes && existingNotes
        ? `NOTAS IMPORTADAS DE LA CLASE (integra este contenido al tablero):\n${existingNotes.join("\n\n---\n\n")}`
        : "";

    const prompt = ENRICH_PROMPT
      .replace("{subjectName}", subjectName || "General")
      .replace("{currentDate}", new Date().toISOString().split("T")[0])
      .replace("{boardState}", boardState)
      .replace("{mission}", mission)
      .replace("{existingSection}", existingSection)
      .replace("{notesSection}", notesSection);

    // Build Gemini parts: prompt text + images
    const imageParts = (newImages || []).map((dataUrl: string) => {
      const [meta, base64] = dataUrl.split(",");
      const mimeType = meta.match(/data:(.*?);/)?.[1] || "image/jpeg";
      return { inlineData: { data: base64, mimeType } };
    });

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text().trim();

    let parsed: { content: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No se pudo parsear la respuesta de la IA");
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    if (!parsed.content) throw new Error("La IA no devolvió contenido");

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("dynamic-board enrich error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error al enriquecer el tablero" },
      { status: 500 }
    );
  }
}
