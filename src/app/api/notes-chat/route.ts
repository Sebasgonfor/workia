import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildDocumentContext, type DocRef } from "@/app/api/_utils/document-context";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const SYSTEM_INSTRUCTION = `Eres un asistente de estudio académico universitario inteligente y experto. \
Estás integrado en los apuntes de clase del estudiante y tienes acceso completo a sus notas, \
imágenes escaneadas, documentos de la materia y tareas.

REGLAS:
1. Responde siempre en español.
2. Usa Markdown enriquecido: headers (##, ###), listas, tablas, bloques de código cuando aplique.
3. Usa LaTeX inline ($...$) o en bloque ($$...$$) para fórmulas matemáticas.
4. Si el estudiante adjunta imágenes, analízalas detalladamente.
5. Si te preguntan sobre el contenido de los apuntes o imágenes previas, usa todo el contexto disponible.
6. Sé preciso, completo y académicamente riguroso.
7. Si detectas errores en los apuntes, señálalos amablemente.
8. Puedes explicar, resumir, ampliar, o analizar cualquier parte de los apuntes.

ACCIONES SOBRE TAREAS:
Cuando el estudiante quiera crear, editar o eliminar tareas, responde con un bloque de acción \
al FINAL de tu respuesta en este formato exacto:

Para CREAR una tarea:
\`\`\`action
{"action":"create_task","title":"...","description":"...","dueDate":"YYYY-MM-DD","priority":"high|medium|low","type":"taller|quiz|parcial|proyecto|lectura|otro"}
\`\`\`

Para EDITAR una tarea (usa el taskId proporcionado en el contexto):
\`\`\`action
{"action":"edit_task","taskId":"...","updates":{"title":"...","description":"...","dueDate":"YYYY-MM-DD","priority":"...","status":"pending|completed"}}
\`\`\`

Para ELIMINAR una tarea:
\`\`\`action
{"action":"delete_task","taskId":"..."}
\`\`\`

Para COMPLETAR una tarea:
\`\`\`action
{"action":"complete_task","taskId":"..."}
\`\`\`

IMPORTANTE sobre acciones:
- Solo incluye un bloque \`\`\`action cuando el estudiante EXPLÍCITAMENTE pida crear/editar/eliminar/completar una tarea.
- Siempre incluye una respuesta legible ANTES del bloque de acción.
- Si no tienes suficiente información para la acción, pregunta al estudiante.
- Para fechas, usa el formato YYYY-MM-DD.
- NO inventes taskIds, solo usa los que están en el contexto de tareas.`;

interface ChatMessage {
  role: "user" | "model";
  parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>;
}

interface TaskDto {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  dueDate: string;
  assignedDate: string;
  status: string;
}

interface RequestBody {
  subjectName: string;
  classTitle: string;
  classNotes: string[];
  noteImages: string[];
  tasks: TaskDto[];
  subjectDocuments: DocRef[];
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    imageUrls?: string[];
  }>;
  currentDate: string;
}

const buildNotesContext = (body: RequestBody): string => {
  const { subjectName, classTitle, classNotes, tasks, currentDate } = body;
  const lines: string[] = [
    "══════════ CONTEXTO DE LA CLASE ══════════",
    `Materia: ${subjectName}`,
    `Clase: ${classTitle}`,
    `Fecha actual: ${currentDate}`,
    "",
  ];

  if (classNotes.length > 0) {
    lines.push("══════════ APUNTES DE LA CLASE ══════════");
    classNotes.forEach((note, i) => {
      lines.push(`\n--- Apunte ${i + 1} ---\n${note}`);
    });
    lines.push("");
  }

  if (tasks.length > 0) {
    lines.push("══════════ TAREAS DE LA CLASE ══════════");
    tasks.forEach((task, i) => {
      lines.push(
        `\n--- Tarea ${i + 1} ---`,
        `ID: ${task.id}`,
        `Título: ${task.title}`,
        `Tipo: ${task.type}`,
        `Prioridad: ${task.priority}`,
        `Estado: ${task.status}`,
        `Fecha asignada: ${task.assignedDate}`,
        `Fecha entrega: ${task.dueDate}`,
        task.description ? `Descripción: ${task.description}` : ""
      );
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
    const { messages, subjectDocuments, noteImages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No se enviaron mensajes" }, { status: 400 });
    }

    const notesContext = buildNotesContext(body);
    const documentContext = await buildDocumentContext(subjectDocuments || []);

    // Build image parts from noteImages (class source images)
    const noteImageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
    if (noteImages && noteImages.length > 0) {
      const imagesToFetch = noteImages.slice(0, 5);
      for (const url of imagesToFetch) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const buffer = await res.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType = res.headers.get("content-type") || "image/jpeg";
          noteImageParts.push({ inlineData: { data: base64, mimeType: contentType } });
        } catch {
          // skip failed images
        }
      }
    }

    // Enrich the first user message with context
    const enrichedMessages = messages.map((msg, idx) => {
      const isFirstUserMsg = idx === messages.findIndex((m) => m.role === "user");
      if (isFirstUserMsg) {
        const docBlock = documentContext.contextText
          ? `\n${documentContext.contextText}\n\n`
          : "";
        const imgNote = noteImageParts.length > 0
          ? `\n[Se adjuntan ${noteImageParts.length} imagen(es) de los apuntes de clase para referencia]\n\n`
          : "";
        return { ...msg, content: `${notesContext}\n${docBlock}${imgNote}${msg.content}` };
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

    // Build parts for the last message
    type GeminiPart = string | { inlineData: { data: string; mimeType: string } };
    const lastParts: GeminiPart[] = [lastMessage.content];

    // Add inline user images from last message
    if (lastMessage.imageUrls && lastMessage.imageUrls.length > 0) {
      for (const url of lastMessage.imageUrls.slice(0, 3)) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const buffer = await res.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType = res.headers.get("content-type") || "image/jpeg";
          lastParts.push({ inlineData: { data: base64, mimeType: contentType } });
        } catch {
          // skip
        }
      }
    }

    // On first message, add document and note image parts
    const isFirstExchange = enrichedMessages.filter((m) => m.role === "user").length <= 1;
    if (isFirstExchange) {
      lastParts.push(...documentContext.parts, ...noteImageParts);
    }

    const result = await chat.sendMessageStream(
      lastParts as Parameters<typeof chat.sendMessageStream>[0]
    );

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
