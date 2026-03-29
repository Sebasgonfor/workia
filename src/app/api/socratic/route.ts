import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { cleanContentForPrompt } from "@/lib/services/content-cleaner";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const SYSTEM_INSTRUCTION = `Eres un tutor socrático universitario. Tu ÚNICA herramienta son las preguntas. NUNCA das respuestas directas.

REGLAS ABSOLUTAS:
1. NUNCA expliques un concepto directamente. SIEMPRE haz preguntas guía.
2. Empieza con preguntas amplias sobre el tema, luego ve a lo específico.
3. Si el estudiante responde correctamente, profundiza con una pregunta más avanzada.
4. Si el estudiante responde incorrectamente, NO corrijas. Haz una pregunta que lo guíe a reconsiderar.
5. Si el estudiante está completamente perdido, da UNA pista mínima y luego pregunta.
6. Usa LaTeX ($..$ y $$..$$) para fórmulas matemáticas.
7. Responde siempre en español.
8. Mantén tus mensajes cortos (máx 3-4 oraciones + la pregunta).
9. Después de que el estudiante demuestre comprensión sólida (3-5 respuestas correctas consecutivas sobre aspectos clave), declara maestría con este bloque EXACTO al final:

\`\`\`mastery
{"score": 85, "summary": "Resumen de lo que el estudiante demostró entender correctamente sobre el tema."}
\`\`\`

10. El score de maestría debe reflejar la calidad de las respuestas del estudiante:
    - 90-100: Respondió todo correctamente sin ayuda
    - 70-89: Necesitó algunas pistas pero llegó a la respuesta
    - 50-69: Necesitó bastante guía
    - <50: No logró demostrar comprensión

CONTEXTO DE LA CLASE:
Materia: {subjectName}
Clase: {classTitle}
Fecha: {currentDate}

APUNTES DE REFERENCIA (usa esto para formular preguntas relevantes):
{notesContent}

TEMA QUE EL ESTUDIANTE QUIERE DOMINAR: {topic}

Comienza con una pregunta introductoria sobre el tema.`;

interface ChatMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface RequestBody {
  subjectName: string;
  classTitle: string;
  notesContent: string;
  topic: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  currentDate: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const body = (await req.json()) as RequestBody;
    const { subjectName, classTitle, notesContent, topic, messages, currentDate } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No se enviaron mensajes" }, { status: 400 });
    }

    const cleanedNotes = cleanContentForPrompt(notesContent || "");
    const systemInstruction = SYSTEM_INSTRUCTION
      .replace("{subjectName}", subjectName || "General")
      .replace("{classTitle}", classTitle || "Clase")
      .replace("{currentDate}", currentDate || new Date().toISOString().split("T")[0])
      .replace("{notesContent}", cleanedNotes || "Sin apuntes disponibles")
      .replace("{topic}", topic || "General");

    const history: ChatMessage[] = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = messages[messages.length - 1];

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction,
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage.content);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(new TextEncoder().encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
