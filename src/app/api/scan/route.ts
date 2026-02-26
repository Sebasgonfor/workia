import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildDocumentContext, type DocRef } from "@/app/api/_utils/document-context";
import { parseGeminiResponse } from "@/app/api/_utils/parse-gemini-json";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const TASK_PROMPT = `Eres un asistente experto en extraer tareas académicas de imágenes de tableros, cuadernos y presentaciones universitarias de INGENIERÍA.

CONTEXTO:
- Fecha actual: {currentDate}
- Materias del usuario: {existingSubjects}
- Materia seleccionada: {subjectName}

REGLAS CRÍTICAS:
1. Extrae TODAS las tareas visibles. Si hay 5 tareas, devuelve 5 objetos. NUNCA omitas tareas.
2. Si dice "viernes", "próxima semana", "en 3 días", conviértelo a fecha ISO basándote en la fecha actual.
3. Si no hay fecha explícita, usa una semana desde hoy y marca dateConfidence como "low".
4. La prioridad se infiere: < 2 días = high, < 5 días = medium, > 5 días = low.
5. Detecta la materia comparando con la lista de materias del usuario. Usa fuzzy matching.
6. Para descripciones con ecuaciones o fórmulas, usa notación LaTeX: $inline$ y $$bloque$$.
7. Transcribe ecuaciones matemáticas fielmente: integrales ($\\int$), derivadas ($\\frac{d}{dx}$), matrices ($\\begin{pmatrix}...\\end{pmatrix}$), vectores ($\\vec{F}$), etc.
8. No inventes información que no esté visible en la imagen.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "tasks": [{
    "title": "string - título conciso de la tarea",
    "description": "string - descripción con LaTeX si hay ecuaciones",
    "assignedDate": "YYYY-MM-DD - fecha en que se dejó/asignó la tarea (si no es clara, usa la fecha actual)",
    "dueDate": "YYYY-MM-DD - fecha de entrega",
    "dateConfidence": "high|medium|low",
    "priority": "high|medium|low",
    "taskType": "taller|quiz|parcial|proyecto|lectura|otro",
    "detectedSubject": "string - nombre de la materia detectada",
    "subjectConfidence": "high|medium|low"
  }],
  "rawText": "transcripción literal completa de todo lo visible en la imagen"
}`;

const NOTES_PROMPT = `Eres un profesor universitario experto en INGENIERÍA procesando apuntes de clase.
Misión: convertir apuntes crudos en material de estudio COMPLETO, RICO y EXPANDIDO.
El resultado SIEMPRE debe ser 3x más largo y útil que los apuntes originales.
Si los apuntes son escuetos, la IA rellena con conocimiento académico riguroso del tema.

CONTEXTO:
- Materia: {subjectName}
- Fecha: {currentDate}
- Materias del usuario: {existingSubjects}

INSTRUCCIONES OBLIGATORIAS:

1. ESTRUCTURA con Markdown:
   - ## temas principales, ### subtemas
   - **negritas** en CADA concepto clave y término técnico
   - Listas numeradas para pasos, viñetas para propiedades
   - Tablas cuando haya múltiples conceptos comparables
   - ECUACIONES siempre LaTeX: $inline$ y $$bloque$$
   - Ejemplos: $\\int_0^1 x^2\\,dx$, $\\frac{\\partial f}{\\partial x}$, $\\nabla \\times \\vec{F}$, $\\mathcal{L}\\{f(t)\\}=F(s)$

2. SISTEMA DE COLORES — usar en CADA concepto sin excepción:

   <nc-def>contenido</nc-def>
   → Definición formal COMPLETA de cada concepto mencionado (amplía aunque ya esté en la imagen)

   <nc-formula>contenido</nc-formula>
   → Cada ecuación + nombre completo + explicación de CADA símbolo/variable/unidad

   <nc-ex>contenido</nc-ex>
   → Cada ejemplo de la imagen + crea 1-2 ejemplos adicionales resueltos paso a paso

   <nc-warn>contenido</nc-warn>
   → Condiciones de validez, restricciones, errores comunes, casos especiales

   <nc-ai>contenido</nc-ai>
   → MÍNIMO 3 bloques obligatorios con aportes que NO estén en la imagen:
      · Propiedades y teoremas del tema
      · Intuición geométrica o física del concepto
      · Tabla comparativa si hay múltiples conceptos parecidos
      · Aplicaciones reales en ingeniería
      · Conexión con otros temas de la misma materia

3. EXPANSIÓN OBLIGATORIA:
   - El "content" debe ser 3x más largo y rico que lo visible en la imagen
   - Si los apuntes son escuetos: la IA rellena con conocimiento académico riguroso
   - NUNCA dejes un concepto sin al menos un bloque <nc-ai> de profundización
   - Si hay una lista de conceptos → crea tabla comparativa entre ellos en un <nc-ai>
   - Si hay una fórmula sin contexto → explica deducción breve, casos especiales, forma matricial

4. DIAGRAMAS: Si detectas cualquier diagrama/figura/flujo, conviértelo a Mermaid:
   \`\`\`mermaid
   flowchart TD / sequenceDiagram / classDiagram / graph TB / stateDiagram-v2
   \`\`\`
   Si no es representable en Mermaid (circuito, gráfica matemática), descríbelo con texto y LaTeX.

5. MÍNIMO de contenido: el "content" nunca debe tener menos de 500 palabras.

6. TAGS: 2-5 tags específicos. Ej: "cálculo-vectorial", "funciones-escalares", "gradiente".

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "topic": "Tema principal detectado",
  "content": "Markdown EXTENSO — mínimo 500 palabras — con LaTeX, etiquetas <nc-*> y mermaid si aplica",
  "tags": ["tag1", "tag2"],
  "detectedSubject": "nombre de materia detectada",
  "subjectConfidence": "high|medium|low"
}`;

const AUTO_PROMPT = `Eres un profesor universitario experto en INGENIERÍA analizando contenido académico.
Extrae TODO el contenido visible: apuntes Y tareas. Para los apuntes genera material COMPLETO y EXPANDIDO.

CONTEXTO:
- Fecha actual: {currentDate}
- Materias del usuario: {existingSubjects}
- Materia seleccionada: {subjectName}

REGLAS PARA ECUACIONES: LaTeX SIEMPRE — $inline$ y $$bloque$$

INSTRUCCIONES PARA TAREAS:
1. Extrae TODAS las tareas (entregas, talleres, quizzes, parciales, proyectos, fechas de entrega).
2. Si no hay fecha explícita, usa una semana desde hoy con dateConfidence "low".
3. Prioridad: < 2 días = high, < 5 días = medium, > 5 días = low.
4. Si no hay tareas, deja el array vacío. Si no hay apuntes, deja notes como null.

INSTRUCCIONES PARA APUNTES — OBLIGATORIO SEGUIR AL PIE DE LA LETRA:
A. ESTRUCTURA: ## temas, ### subtemas, **negritas** en cada concepto clave.
B. SISTEMA DE COLORES en TODO el contenido académico:
   - <nc-def> → definición formal y COMPLETA de CADA concepto (amplía aunque ya esté en la imagen)
   - <nc-formula> → CADA ecuación + nombre + explicación de cada símbolo/variable + unidades
   - <nc-ex> → CADA ejemplo visible + agrega 1-2 ejemplos resueltos adicionales paso a paso
   - <nc-warn> → restricciones, condiciones de validez, errores comunes
   - <nc-ai> → MÍNIMO 3 bloques con aportes que NO estén en la imagen:
       · Propiedades y teoremas del tema
       · Intuición geométrica o física
       · Tabla comparativa si hay múltiples conceptos
       · Aplicaciones en ingeniería
       · Conexión con otros temas de la materia
C. EXPANSIÓN: el "content" debe ser 3x más rico que lo visible en la imagen.
   Si hay poco texto visible, la IA rellena con conocimiento académico riguroso.
   NUNCA dejes un concepto sin al menos un <nc-ai> de profundización.
D. DIAGRAMAS: si detectas cualquier diagrama/figura en la imagen, conviértelo a Mermaid:
   \`\`\`mermaid
   flowchart TD / sequenceDiagram / classDiagram / graph TB / stateDiagram-v2
   \`\`\`
   Si no es representable en Mermaid, descríbelo con texto y LaTeX.
E. MÍNIMO: el "content" nunca debe tener menos de 500 palabras.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "type": "both",
  "tasks": [{"title":"","description":"con $LaTeX$","dueDate":"YYYY-MM-DD","assignedDate":"{currentDate}","dateConfidence":"high|medium|low","priority":"high|medium|low","taskType":"taller|quiz|parcial|proyecto|lectura|otro","detectedSubject":"","subjectConfidence":"high|medium|low"}],
  "notes": {"topic":"","content":"Markdown EXTENSO con LaTeX, etiquetas <nc-*> y mermaid si aplica","tags":[],"detectedSubject":"","subjectConfidence":"high|medium|low"} | null,
  "rawText": "transcripción completa"
}`;

export const maxDuration = 60; // Allow up to 60s for Gemini processing

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key de Gemini no configurada. Agrega GOOGLE_AI_API_KEY en .env" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { images, type, subjectName, existingSubjects, currentDate, subjectDocuments, existingNotes } = body as {
      images: string[];
      type: "auto" | "notes" | "task";
      subjectName?: string;
      existingSubjects: string[];
      currentDate: string;
      subjectDocuments?: DocRef[];
      existingNotes?: string[];
    };

    if (!images || images.length === 0) {
      return NextResponse.json({ error: "No se enviaron imágenes" }, { status: 400 });
    }

    let prompt: string;
    if (type === "task") {
      prompt = TASK_PROMPT;
    } else if (type === "notes") {
      prompt = NOTES_PROMPT;
    } else {
      prompt = AUTO_PROMPT;
    }

    prompt = prompt
      .replaceAll("{currentDate}", currentDate)
      .replaceAll("{existingSubjects}", existingSubjects.join(", "))
      .replaceAll("{subjectName}", subjectName || "No especificada");

    // Inject existing class notes as context for better AI understanding
    if (Array.isArray(existingNotes) && existingNotes.length > 0) {
      const notesContext = existingNotes
        .slice(0, 5)
        .map((n, i) => `## Apunte previo ${i + 1}\n${n}`)
        .join("\n\n");
      prompt += `\n\nAPUNTES PREVIOS DE ESTA CLASE (úsalos como contexto del tema para enriquecer el output, no los repitas literalmente):\n${notesContext}`;
    }

    // Build document context from subject library
    const documentContext = await buildDocumentContext(subjectDocuments || []);
    if (documentContext.contextText) {
      prompt = `${prompt}\n\n${documentContext.contextText}`;
    }

    const imageParts = images
      .filter((dataUrl: string) => typeof dataUrl === "string" && dataUrl.includes(","))
      .map((dataUrl: string) => {
        const [meta, base64] = dataUrl.split(",");
        const mimeType = meta.match(/data:(.*?);/)?.[1] || "image/jpeg";
        return {
          inlineData: { data: base64, mimeType },
        };
      });

    if (imageParts.length === 0) {
      return NextResponse.json({ error: "No se pudieron procesar las imágenes" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent([prompt, ...imageParts, ...documentContext.parts]);
    const text = result.response.text();

    let parsed;
    try {
      parsed = parseGeminiResponse(text);
    } catch {
      return NextResponse.json(
        { error: "Error al interpretar respuesta de IA", raw: text.slice(0, 500) },
        { status: 500 }
      );
    }

    // Normalize response structure based on scan type
    if (type === "notes" || (parsed.content && parsed.topic && !parsed.tasks)) {
      // Notes-only response
      parsed.type = "notes";
    } else if (parsed.type === "both") {
      // Dual extraction: ensure tasks is array, notes can be null
      if (!Array.isArray(parsed.tasks)) {
        parsed.tasks = parsed.tasks ? [parsed.tasks] : [];
      }
    } else if (type === "task" || parsed.tasks) {
      parsed.type = "task";
      if (!Array.isArray(parsed.tasks)) {
        parsed.tasks = [parsed.tasks || parsed];
      }
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: unknown) {
    console.error("Scan route error:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
