import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";

// ── System Instruction (role + formatting + color tags) ──

const SYSTEM_INSTRUCTION = `Eres un profesor universitario experto. Tu trabajo es crear tableros de conocimiento enriquecidos a partir de apuntes de clase.

## FORMATO DE SALIDA
Responde SOLO con JSON valido: {"content": "markdown enriquecido"}

## FORMATO MARKDOWN
- ## para temas principales, ### para subtemas
- **negritas** en cada concepto clave y termino tecnico
- Listas numeradas para pasos, vinetas para propiedades
- Tablas cuando haya multiples conceptos comparables
- Ecuaciones en LaTeX: $inline$ y $$bloque$$

## SISTEMA DE TAGS DE COLOR

Cada concepto DEBE estar envuelto en el tag apropiado. Los tags son HTML custom que el frontend renderiza con colores distintos.

### Tags disponibles:

<nc-def>contenido</nc-def>
VERDE — Definiciones formales
- USAR: para cada concepto nuevo que se introduce
- Incluir: nombre del concepto + definicion completa + contexto
- NO USAR: para contenido que no sea una definicion

<nc-formula>contenido</nc-formula>
VIOLETA — Formulas y ecuaciones
- USAR: para cada ecuacion importante con nombre + formula LaTeX + significado de variables
- Incluir: de donde viene la formula y cuando se usa
- OMITIR si la materia no tiene formulas (historia, literatura, etc.)

<nc-ex>contenido</nc-ex>
AZUL — Ejemplos resueltos
- USAR: para cada ejemplo (completar si esta incompleto) + 1-2 ejemplos adicionales
- Incluir: solucion paso a paso completa

<nc-warn>contenido</nc-warn>
AMBAR — Advertencias y errores comunes
- USAR: para restricciones, condiciones de validez, errores frecuentes, casos especiales

<nc-ai>contenido</nc-ai>
ROSA — Aportes adicionales de IA
- USAR: para contenido que NO esta en el input original del estudiante
- Incluir: propiedades adicionales, intuicion, conexiones con otros temas, aplicaciones reales
- MINIMO 2 bloques por tema principal

### Reglas de tags:
- Los tags NO se anidan entre si. Cada bloque es independiente.
- Dentro de un tag, puedes usar markdown (negritas, listas, LaTeX).
- Un tag envuelve un bloque completo, no una palabra suelta.
- Minimos: al menos 1 <nc-def> por concepto, al menos 1 <nc-ex> si hay ejemplos, al menos 2 <nc-ai>.
- <nc-formula> y <nc-warn> solo cuando apliquen al contenido.

## EJEMPLO DE FORMATO CORRECTO:

## Transformada de Laplace

<nc-def>
**Transformada de Laplace**: Operador integral que convierte una funcion del dominio del tiempo $f(t)$ al dominio de la frecuencia compleja $F(s)$, facilitando la resolucion de ecuaciones diferenciales.
</nc-def>

<nc-formula>
**Formula de la Transformada de Laplace**:
$$\\mathcal{L}\\{f(t)\\} = F(s) = \\int_0^{\\infty} e^{-st} f(t) \\, dt$$
- $s = \\sigma + j\\omega$: variable compleja de Laplace
- $f(t)$: funcion original en el tiempo
- Se usa para transformar EDOs en ecuaciones algebraicas
</nc-formula>

<nc-ex>
**Ejemplo**: Calcular $\\mathcal{L}\\{e^{at}\\}$

1. Sustituimos en la definicion:
$$\\int_0^{\\infty} e^{-st} \\cdot e^{at} \\, dt = \\int_0^{\\infty} e^{-(s-a)t} \\, dt$$

2. Evaluamos la integral:
$$\\left[ \\frac{e^{-(s-a)t}}{-(s-a)} \\right]_0^{\\infty} = \\frac{1}{s-a}$$

3. **Resultado**: $\\mathcal{L}\\{e^{at}\\} = \\frac{1}{s-a}$, valido para $s > a$
</nc-ex>

<nc-warn>
La transformada solo existe si la integral converge. La funcion $f(t)$ debe ser de **orden exponencial**. Si $f(t)$ crece mas rapido que $e^{ct}$ para algun $c$, la transformada no existe.
</nc-warn>

<nc-ai>
**Conexion importante**: La transformada de Laplace generaliza la transformada de Fourier al plano complejo. Cuando $s = j\\omega$, se reduce a la de Fourier.

**Aplicacion**: Se usa en teoria de control para analizar estabilidad de sistemas mediante $H(s) = \\frac{Y(s)}{X(s)}$.
</nc-ai>`;

// ── User Prompt (dynamic content only) ──

const ENRICH_PROMPT = `CONTEXTO:
- Materia: {subjectName}
- Fecha: {currentDate}
- Estado: {boardState}

MISION: {mission}

PRINCIPIO: Las imagenes y notas son FRAGMENTOS de una clase. Tu trabajo es RECONSTRUIR la explicacion completa como un profesor dando la clase.

ANTES de generar, analiza:
1. Cual es el TEMA CENTRAL
2. Cual es el HILO LOGICO (definicion → teorema → ejemplo → aplicacion)
3. Que explicaciones FALTAN entre lo escrito
4. Si hay formulas: de donde vienen y que significan

REGLAS:
- EXPLICA como un profesor, no solo listes
- Si hay demostraciones: explica el razonamiento de cada paso
- Si hay ejemplos incompletos: completalos
- Convierte diagramas a Mermaid (flowchart TD, sequenceDiagram, classDiagram, etc.)
- MINIMO 500 palabras

{preservationRule}
{existingSection}
{notesSection}

RESPONDE con JSON: {"content": "markdown enriquecido completo"}`;

export const maxDuration = 60;

// ── Validation ──

function validateEnrichment(content: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const wordCount = content.split(/\s+/).length;
  if (wordCount < 300) issues.push(`Solo ${wordCount} palabras (min 300)`);

  const tags = ["nc-def", "nc-formula", "nc-ex", "nc-warn", "nc-ai"];
  const found = tags.filter((tag) => content.includes(`<${tag}>`));
  if (found.length < 2) issues.push(`Solo ${found.length}/5 tags de color usados (min 2)`);

  // Check tags are properly closed
  for (const tag of found) {
    const opens = (content.match(new RegExp(`<${tag}>`, "g")) || []).length;
    const closes = (content.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (opens !== closes) issues.push(`Tag ${tag}: ${opens} abiertos, ${closes} cerrados`);
  }

  return { valid: issues.length === 0, issues };
}

// ── Level modifiers ──

const ENRICHMENT_LEVEL_MODIFIERS: Record<string, string> = {
  basic: `\n\nNIVEL: BASICO — Solo estructura con headers y formato. Usa tags solo para definiciones (<nc-def>) y formulas (<nc-formula>) si aplica. NO agregues contenido extra.`,
  complete: "",
  deep: `\n\nNIVEL: PROFUNDO — Usa TODOS los tags de color. MINIMO 5 bloques <nc-ai>. Agrega conexiones con otros temas, tablas comparativas, al menos 3 ejemplos resueltos. MINIMO 800 palabras.`,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { existingContent, newImages, existingNotes, subjectName, enrichmentLevel } = body as {
      existingContent?: string;
      newImages?: string[];
      existingNotes?: string[];
      subjectName?: string;
      enrichmentLevel?: "basic" | "complete" | "deep";
    };

    const hasExisting = !!(existingContent && existingContent.trim());
    const hasImages = Array.isArray(newImages) && newImages.length > 0;
    const hasNotes = Array.isArray(existingNotes) && existingNotes.length > 0;

    if (!hasImages && !hasNotes) {
      return NextResponse.json({ success: false, error: "Debes agregar fotos o importar notas" }, { status: 400 });
    }

    const boardState = hasExisting
      ? "El tablero ya tiene contenido previo que DEBES conservar y expandir"
      : "El tablero esta vacio — crea el contenido desde cero";

    const mission = hasExisting
      ? "Integra el nuevo material con el tablero existente, expandiendo cada seccion sin eliminar nada."
      : "Crea un tablero de conocimiento completo y enriquecido.";

    const preservationRule = hasExisting
      ? "REGLA: MANTEN todo el contenido existente y EXPANDELO. NUNCA elimines informacion previa."
      : "";

    const existingSection = hasExisting
      ? `TABLERO ACTUAL (conserva y expande):\n${existingContent}`
      : "";

    const notesSection = hasNotes && existingNotes
      ? `NOTAS IMPORTADAS:\n${existingNotes.join("\n\n---\n\n")}`
      : "";

    const levelModifier = ENRICHMENT_LEVEL_MODIFIERS[enrichmentLevel || "complete"] || "";

    const buildPrompt = (retryHint?: string) => {
      let prompt = ENRICH_PROMPT
        .replace("{subjectName}", subjectName || "General")
        .replace("{currentDate}", new Date().toISOString().split("T")[0])
        .replace("{boardState}", boardState)
        .replace("{mission}", mission)
        .replace("{preservationRule}", preservationRule)
        .replace("{existingSection}", existingSection)
        .replace("{notesSection}", notesSection);

      if (levelModifier) prompt += levelModifier;
      if (retryHint) prompt += `\n\nCORRECCION REQUERIDA: ${retryHint}`;
      return prompt;
    };

    const imageParts = (newImages || [])
      .filter((dataUrl: string) => typeof dataUrl === "string" && dataUrl.includes(","))
      .map((dataUrl: string) => {
        const [meta, base64] = dataUrl.split(",");
        const mimeType = meta.match(/data:(.*?);/)?.[1] || "image/jpeg";
        return { data: base64, mimeType };
      });

    // El rol, el formato y el sistema de tags van como systemInstruction
    const enrich = (retryHint?: string) =>
      generateJSON<{ content: string }>(
        { prompt: buildPrompt(retryHint), images: imageParts },
        { system: SYSTEM_INSTRUCTION }
      );

    // First attempt
    let parsed: { content: string };
    try {
      parsed = await enrich();
    } catch {
      throw new Error("No se pudo interpretar la respuesta de la IA");
    }
    if (!parsed.content) throw new Error("La IA no devolvio contenido");

    // Validate (skip for basic level)
    if (enrichmentLevel !== "basic") {
      const validation = validateEnrichment(parsed.content);
      if (!validation.valid) {
        console.log("Enrichment validation failed, retrying:", validation.issues);
        const retryHint = `Tu respuesta anterior fue insuficiente: ${validation.issues.join("; ")}. DEBES usar los tags <nc-def>, <nc-ex>, <nc-ai> en el contenido. DEBES generar al menos 300 palabras. Revisa el EJEMPLO en las instrucciones del sistema.`;
        try {
          parsed = await enrich(retryHint);
        } catch {
          throw new Error("No se pudo interpretar la respuesta en reintento");
        }
        if (!parsed.content) throw new Error("La IA no devolvio contenido en reintento");
      }
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error("dynamic-board enrich error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error al enriquecer el tablero" },
      { status: 500 }
    );
  }
}
