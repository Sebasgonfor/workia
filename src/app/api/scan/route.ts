import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildDocumentContext, type DocRef } from "@/app/api/_utils/document-context";

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

const NOTES_PROMPT = `Eres un asistente académico experto en procesar apuntes de clases universitarias de INGENIERÍA.
Tu trabajo es TRANSCRIBIR fielmente, ESTRUCTURAR con claridad, COLOREAR por categoría y COMPLEMENTAR inteligentemente.

CONTEXTO:
- Materia: {subjectName}
- Fecha: {currentDate}
- Materias del usuario: {existingSubjects}

INSTRUCCIONES CRÍTICAS:

1. TRANSCRIPCIÓN FIEL:
   - Transcribe TODO lo visible, incluyendo diagramas descritos textualmente.
   - ECUACIONES: Usa LaTeX SIEMPRE. Inline con $...$ y en bloque con $$...$$
   - Ejemplos: $\\int_0^1 x^2 \\, dx$, $\\frac{\\partial f}{\\partial x}$, $\\nabla \\times \\vec{F}$, $\\mathcal{L}\\{f(t)\\} = F(s)$

2. ESTRUCTURA (Markdown):
   - ## para temas principales, ### para subtemas
   - **negritas** para conceptos clave y términos a memorizar
   - Listas numeradas para pasos, listas con viñetas para propiedades
   - Tablas cuando haya datos comparativos

3. SISTEMA DE COLORES (OBLIGATORIO):
   Envuelve bloques de contenido con estas etiquetas según su tipo:

   - <nc-formula>contenido</nc-formula>
     → Ecuaciones y fórmulas del apunte + explicación de cada símbolo/variable
     → Si el apunte NO explica la fórmula, la IA DEBE explicarla automáticamente

   - <nc-def>contenido</nc-def>
     → Definiciones formales, conceptos explicados, términos técnicos con descripción

   - <nc-warn>contenido</nc-warn>
     → Condiciones de validez, restricciones, casos especiales, advertencias

   - <nc-ex>contenido</nc-ex>
     → Ejemplos numéricos, aplicaciones específicas, casos ilustrativos

   - <nc-ai>contenido</nc-ai>
     → Todo aporte propio de la IA que NO estaba en los apuntes originales

4. DETECCIÓN DE FÓRMULAS SIN CONTEXTO (REGLA CRÍTICA):
   Si una fórmula/ecuación aparece en los apuntes sin definir sus símbolos ni su propósito:
   a) Transcribe la fórmula dentro de <nc-formula> con LaTeX
   b) Agrega INMEDIATAMENTE un bloque <nc-ai> con:
      - Nombre completo de la fórmula, ley o teorema
      - Significado de CADA símbolo/variable (con unidades si aplica)
      - Condiciones de validez y dominio de aplicación
      - Contexto: en qué tipo de problemas se usa

5. NO hagas resúmenes. El resultado debe ser MÁS completo que el original.

6. GENERA 2-5 tags específicos. Ej: "cálculo-vectorial", "transformada-laplace", "EDO-segundo-orden".

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "topic": "Tema principal detectado",
  "content": "Markdown completo con LaTeX y etiquetas <nc-*> aquí",
  "tags": ["tag1", "tag2"],
  "detectedSubject": "nombre de materia detectada",
  "subjectConfidence": "high|medium|low"
}`;

const AUTO_PROMPT = `Eres un asistente académico experto en contenido universitario de INGENIERÍA.
Analiza esta imagen y extrae TODO el contenido: tanto apuntes como tareas.

CONTEXTO:
- Fecha actual: {currentDate}
- Materias del usuario: {existingSubjects}
- Materia seleccionada: {subjectName}

REGLAS PARA ECUACIONES:
- SIEMPRE usa LaTeX para cualquier expresión matemática
- Inline: $...$ | Bloque: $$...$$
- Integrales, derivadas, matrices, vectores, transformadas, todo en LaTeX

INSTRUCCIONES:
1. Extrae TODAS las tareas visibles (entregas, talleres, quizzes, parciales, proyectos). Si ves fechas de entrega o instrucciones de trabajo, son tareas.
2. Extrae TODOS los apuntes visibles (explicaciones, fórmulas, definiciones, demostraciones). Si ves contenido educativo, son apuntes.
3. Es MUY COMÚN que una imagen tenga AMBOS: apuntes de clase + tareas asignadas. Extrae TODO.
4. Si no hay tareas, deja el array vacío. Si no hay apuntes, deja notes como null.
5. Para cada tarea: si no hay fecha explícita, usa una semana desde hoy con dateConfidence "low".
6. Prioridad: < 2 días = high, < 5 días = medium, > 5 días = low.
7. Para los apuntes, aplica el sistema de colores con etiquetas <nc-*>:
   - <nc-formula> para ecuaciones (incluye explicación si el apunte no la tiene)
   - <nc-def> para definiciones, <nc-warn> para condiciones, <nc-ex> para ejemplos, <nc-ai> para aportes IA

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "type": "both",
  "tasks": [{"title":"","description":"con $LaTeX$","dueDate":"YYYY-MM-DD","assignedDate":"{currentDate}","dateConfidence":"high|medium|low","priority":"high|medium|low","taskType":"taller|quiz|parcial|proyecto|lectura|otro","detectedSubject":"","subjectConfidence":"high|medium|low"}],
  "notes": {"topic":"","content":"markdown con $LaTeX$ y etiquetas <nc-*>","tags":[],"detectedSubject":"","subjectConfidence":"high|medium|low"} | null,
  "rawText": "transcripción completa"
}`;

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
    const { images, type, subjectName, existingSubjects, currentDate, subjectDocuments } = body as {
      images: string[];
      type: "auto" | "notes" | "task";
      subjectName?: string;
      existingSubjects: string[];
      currentDate: string;
      subjectDocuments?: DocRef[];
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

    // Build document context from subject library
    const documentContext = await buildDocumentContext(subjectDocuments || []);
    if (documentContext.contextText) {
      prompt = `${prompt}\n\n${documentContext.contextText}`;
    }

    const imageParts = images.map((dataUrl: string) => {
      const [meta, base64] = dataUrl.split(",");
      const mimeType = meta.match(/data:(.*?);/)?.[1] || "image/jpeg";
      return {
        inlineData: { data: base64, mimeType },
      };
    });

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
      // First try direct parse (responseMimeType should give clean JSON)
      parsed = JSON.parse(text);
    } catch {
      try {
        // Fallback: strip markdown code block wrapping
        const cleaned = text
          .replace(/^```(?:json)?\s*\n?/i, "")
          .replace(/\n?```\s*$/i, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        try {
          // Last resort: extract first complete JSON object
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("No JSON found");
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return NextResponse.json(
            { error: "Error al interpretar respuesta de IA", raw: text },
            { status: 500 }
          );
        }
      }
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
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
