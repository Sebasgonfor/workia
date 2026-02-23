import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    "dueDate": "YYYY-MM-DD",
    "dateConfidence": "high|medium|low",
    "priority": "high|medium|low",
    "taskType": "taller|quiz|parcial|proyecto|lectura|otro",
    "detectedSubject": "string - nombre de la materia detectada",
    "subjectConfidence": "high|medium|low"
  }],
  "rawText": "transcripción literal completa de todo lo visible en la imagen"
}`;

const NOTES_PROMPT = `Eres un asistente académico experto en procesar apuntes de clases universitarias de INGENIERÍA.
Tu trabajo es TRANSCRIBIR fielmente, ESTRUCTURAR con claridad, y COMPLEMENTAR inteligentemente.

CONTEXTO:
- Materia: {subjectName}
- Fecha: {currentDate}
- Materias del usuario: {existingSubjects}

INSTRUCCIONES CRÍTICAS:

1. TRANSCRIPCIÓN FIEL:
   - Transcribe TODO lo visible, incluyendo diagramas descritos textualmente.
   - ECUACIONES: Usa LaTeX SIEMPRE. Inline con $...$ y en bloque con $$...$$
   - Ejemplos de transcripción correcta:
     * Integral: $\\int_0^1 x^2 \\, dx$
     * Derivada parcial: $\\frac{\\partial f}{\\partial x}$
     * Gradiente: $\\nabla f = \\left(\\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y}\\right)$
     * Rotacional: $\\nabla \\times \\vec{F}$
     * Matriz: $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$
     * Laplace: $\\mathcal{L}\\{f(t)\\} = F(s)$
     * EDO: $\\frac{d^2y}{dx^2} + p(x)\\frac{dy}{dx} + q(x)y = g(x)$
     * Sumatoria: $\\sum_{n=0}^{\\infty} a_n x^n$
     * Límite: $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$

2. ESTRUCTURA (Markdown):
   - ## para temas principales
   - ### para subtemas
   - **negritas** para conceptos clave y términos a memorizar
   - Listas numeradas para pasos de procedimientos
   - Listas con viñetas para propiedades y características
   - Tablas cuando haya datos comparativos

3. COMPLEMENTO AI (sin modificar lo original):
   - Definiciones formales de conceptos mencionados
   - Pasos intermedios faltantes en desarrollos matemáticos
   - Correcciones de errores evidentes (señalándolos)
   - MARCA SIEMPRE con: > 💡 **Complemento IA**: [tu aporte]

4. NO hagas resúmenes. El resultado debe ser MÁS completo que el original.

5. GENERA 2-5 tags específicos. Ej: "cálculo-vectorial", "transformada-laplace", "EDO-segundo-orden", "matrices-inversas".

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "topic": "Tema principal detectado",
  "content": "Markdown completo con LaTeX aquí",
  "tags": ["tag1", "tag2"],
  "detectedSubject": "nombre de materia detectada",
  "subjectConfidence": "high|medium|low"
}`;

const AUTO_PROMPT = `Eres un asistente académico experto en contenido universitario de INGENIERÍA.
Analiza esta imagen y determina qué tipo de contenido es.

PRIMERO clasifica:
- "task": si es una tarea, entrega, quiz, parcial, trabajo, o instrucciones de actividad a realizar
- "notes": si son apuntes, explicaciones, demostraciones, diagramas, fórmulas, contenido de clase

CONTEXTO:
- Fecha actual: {currentDate}
- Materias del usuario: {existingSubjects}
- Materia seleccionada: {subjectName}

REGLAS PARA ECUACIONES:
- SIEMPRE usa LaTeX para cualquier expresión matemática
- Inline: $...$ | Bloque: $$...$$
- Integrales, derivadas, matrices, vectores, transformadas, todo en LaTeX

Si es TAREA, extrae TODAS las tareas (pueden ser múltiples) y responde:
{"type":"task","tasks":[{"title":"","description":"con $LaTeX$ si hay ecuaciones","dueDate":"YYYY-MM-DD","dateConfidence":"high|medium|low","priority":"high|medium|low","taskType":"taller|quiz|parcial|proyecto|lectura|otro","detectedSubject":"","subjectConfidence":"high|medium|low"}],"rawText":"transcripción completa"}

Si son APUNTES, transcribe todo fielmente con LaTeX y responde:
{"type":"notes","topic":"","content":"markdown con $LaTeX$","tags":[],"detectedSubject":"","subjectConfidence":"high|medium|low"}

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks).`;

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
    const { images, type, subjectName, existingSubjects, currentDate } = body as {
      images: string[];
      type: "auto" | "notes" | "task";
      subjectName?: string;
      existingSubjects: string[];
      currentDate: string;
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

    const imageParts = images.map((dataUrl: string) => {
      const [meta, base64] = dataUrl.split(",");
      const mimeType = meta.match(/data:(.*?);/)?.[1] || "image/jpeg";
      return {
        inlineData: { data: base64, mimeType },
      };
    });

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([prompt, ...imageParts]);
    const text = result.response.text();

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        { error: "Error al interpretar respuesta de IA", raw: text },
        { status: 500 }
      );
    }

    // Normalize: ensure task results always have tasks array
    if (parsed.type === "task" || (parsed.tasks && !parsed.type)) {
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
