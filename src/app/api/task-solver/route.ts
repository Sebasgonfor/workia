import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildDocumentContext, type DocRef } from "@/app/api/_utils/document-context";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const SYSTEM_INSTRUCTION = `Eres un tutor académico universitario experto y brillante. \
Tu misión es ayudar al estudiante a resolver o entender sus tareas académicas de la mejor \
manera posible, usando los apuntes de clase y documentos disponibles como base.

REGLAS:
1. Responde siempre en español.
2. Usa Markdown enriquecido: headers (##, ###), listas, tablas, bloques de código cuando aplique.
3. Usa LaTeX inline ($...$) o en bloque ($$...$$) para fórmulas matemáticas.
4. Estructura tu respuesta en secciones claras y bien organizadas.
5. Si hay apuntes de clase, úsalos como base principal de la respuesta.
6. Si la tarea es un taller, resuelve cada punto/ejercicio detalladamente.
7. Si es una lectura, proporciona un resumen analítico y puntos clave.
8. Si es un proyecto, elabora un plan de desarrollo paso a paso.
9. Para preguntas de seguimiento, mantén el contexto de la conversación.
10. Sé completo, preciso y académicamente riguroso.
11. FORMATO DE ECUACIONES: Cuando resuelvas ecuaciones paso a paso, usa SIEMPRE una lista numerada. \
Cada ítem debe tener una línea de texto con la descripción breve de la operación realizada, \
seguida de la ecuación en un bloque separado ($$...$$) en su propia línea. \
Nunca encadenes múltiples transformaciones en una sola línea de LaTeX. \
Ejemplo correcto:
1. Aplicamos distributiva:
$$2(x + 3) = 2x + 6$$
2. Despejamos x:
$$x = \\frac{6 - 4}{2} = 1$$`;

interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

interface TaskDto {
  title: string;
  description: string;
  type: string;
  priority: string;
  dueDate: string;
  assignedDate: string;
}

interface RequestBody {
  task: TaskDto;
  classTitle: string;
  subjectName: string;
  subjectDocuments: DocRef[];
  classNotes: string[];
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

const buildTaskContext = (body: RequestBody): string => {
  const { task, classTitle, subjectName, classNotes } = body;
  const lines: string[] = [
    "══════════ CONTEXTO DE LA TAREA ══════════",
    `Título: ${task.title}`,
    `Tipo: ${task.type}`,
    `Prioridad: ${task.priority}`,
    `Fecha asignada: ${task.assignedDate}`,
    `Fecha de entrega: ${task.dueDate}`,
  ];
  if (task.description) lines.push(`Descripción: ${task.description}`);
  lines.push("", `Materia: ${subjectName}`, `Clase: ${classTitle}`, "");
  if (classNotes.length > 0) {
    lines.push("══════════ APUNTES DE LA CLASE ══════════");
    classNotes.forEach((note, i) => {
      lines.push(`\n--- Apunte ${i + 1} ---\n${note}`);
    });
    lines.push("");
  }
  lines.push("══════════════════════════════════════════");
  return lines.join("\n");
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key no configurada" }, { status: 500 });
    }

    const body = (await req.json()) as RequestBody;
    const { messages, subjectDocuments } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No se enviaron mensajes" }, { status: 400 });
    }

    const taskContext = buildTaskContext(body);
    const documentContext = await buildDocumentContext(subjectDocuments || []);

    // Inject task context into the first user message in the history
    const enrichedMessages = messages.map((msg, idx) => {
      const isFirstUserMsg =
        idx === messages.findIndex((m) => m.role === "user");
      if (isFirstUserMsg) {
        const docBlock = documentContext.contextText
          ? `\n${documentContext.contextText}\n\n`
          : "";
        return { ...msg, content: `${taskContext}\n${docBlock}${msg.content}` };
      }
      return msg;
    });

    // Build Gemini chat history (all messages except the last)
    const history: ChatMessage[] = enrichedMessages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const lastMessage = enrichedMessages[enrichedMessages.length - 1];

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const chat = model.startChat({ history });

    const userParts =
      documentContext.parts.length > 0 &&
      enrichedMessages.filter((m) => m.role === "user").length <= 1
        ? [lastMessage.content, ...documentContext.parts]
        : lastMessage.content;

    const result = await chat.sendMessageStream(userParts as Parameters<typeof chat.sendMessageStream>[0]);

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
