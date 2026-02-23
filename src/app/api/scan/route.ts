import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const TASK_PROMPT = `Eres un asistente que extrae tareas académicas de imágenes de cuadernos, tableros o presentaciones universitarias.

CONTEXTO:
- Fecha actual: {currentDate}
- Materias del usuario: {existingSubjects}
- Si dice "viernes", "próxima semana", "en 3 días", conviértelo a fecha ISO.
- Si no hay fecha explícita, usa una semana desde hoy.

REGLAS:
- Extrae TODA la información visible, no inventes datos que no estén.
- Si un campo no es claro, marca confidence como "low".
- Si hay múltiples tareas en la imagen, retorna un array.
- La prioridad se infiere: < 2 días = alta, < 5 días = media, > 5 días = baja.
- Detecta la materia comparando con la lista de materias del usuario.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks):
{
  "tasks": [{
    "title": "string",
    "description": "string",
    "dueDate": "YYYY-MM-DD",
    "dateConfidence": "high|medium|low",
    "priority": "high|medium|low",
    "taskType": "taller|quiz|parcial|proyecto|lectura|otro",
    "detectedSubject": "string",
    "subjectConfidence": "high|medium|low"
  }],
  "rawText": "transcripción literal de lo visible en la imagen"
}`;

const NOTES_PROMPT = `Eres un asistente académico que procesa apuntes de cuadernos universitarios.
Tu trabajo es TRANSCRIBIR, ESTRUCTURAR y COMPLEMENTAR los apuntes.

CONTEXTO:
- Materia: {subjectName}
- Fecha: {currentDate}

INSTRUCCIONES:
1. TRANSCRIBE todo lo que veas en la imagen. No omitas nada.
2. ESTRUCTURA el contenido con Markdown: ## para temas, ### para subtemas, **negritas** para conceptos clave, listas, \`backticks\` para fórmulas.
3. COMPLEMENTA (sin modificar lo original): definiciones formales, pasos faltantes, correcciones señaladas. MARCA con: > 💡 **Complemento IA**: [tu aporte]
4. NO hagas resúmenes. El resultado debe ser MÁS completo que el original.
5. GENERA 2-5 tags relevantes.

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks):
{
  "topic": "Tema principal",
  "content": "Markdown completo aquí",
  "tags": ["tag1", "tag2"],
  "detectedSubject": "nombre de materia",
  "subjectConfidence": "high|medium|low"
}`;

const AUTO_PROMPT = `Eres un asistente académico. Analiza esta imagen de un contexto universitario.

PRIMERO determina qué tipo de contenido es:
- "task": si es una tarea, entrega, quiz, parcial, o instrucciones de trabajo
- "notes": si son apuntes, explicaciones, diagramas, fórmulas, contenido de clase

CONTEXTO:
- Fecha actual: {currentDate}
- Materias del usuario: {existingSubjects}

Si es TAREA, responde con:
{"type":"task","tasks":[{"title":"","description":"","dueDate":"YYYY-MM-DD","dateConfidence":"high|medium|low","priority":"high|medium|low","taskType":"taller|quiz|parcial|proyecto|lectura|otro","detectedSubject":"","subjectConfidence":"high|medium|low"}],"rawText":""}

Si son APUNTES, responde con:
{"type":"notes","topic":"","content":"markdown","tags":[],"detectedSubject":"","subjectConfidence":"high|medium|low"}

RESPONDE SOLO CON JSON VÁLIDO (sin markdown, sin backticks).`;

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
      images: string[]; // base64 data URLs
      type: "auto" | "notes" | "task";
      subjectName?: string;
      existingSubjects: string[];
      currentDate: string;
    };

    if (!images || images.length === 0) {
      return NextResponse.json({ error: "No se enviaron imágenes" }, { status: 400 });
    }

    // Select prompt
    let prompt: string;
    if (type === "task") {
      prompt = TASK_PROMPT;
    } else if (type === "notes") {
      prompt = NOTES_PROMPT;
    } else {
      prompt = AUTO_PROMPT;
    }

    // Fill template vars
    prompt = prompt
      .replace("{currentDate}", currentDate)
      .replace("{existingSubjects}", existingSubjects.join(", "))
      .replace("{subjectName}", subjectName || "No especificada");

    // Build parts: prompt text + image(s)
    const imageParts = images.map((dataUrl: string) => {
      const [meta, base64] = dataUrl.split(",");
      const mimeType = meta.match(/data:(.*?);/)?.[1] || "image/jpeg";
      return {
        inlineData: { data: base64, mimeType },
      };
    });

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      prompt,
      ...imageParts,
    ]);

    const text = result.response.text();

    // Parse JSON from response (handle potential markdown wrapping)
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

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
