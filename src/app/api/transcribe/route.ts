import { NextRequest, NextResponse } from "next/server";
import { generateText, parseAiJson } from "@/lib/ai";
import { buildDocumentContext, type DocRef } from "@/app/api/_utils/document-context";

const VOICE_AUTO_PROMPT = `Escucha este audio de clase universitaria con MÁXIMA atención y extrae TODO su contenido con precisión absoluta.

CONTEXTO:
- Fecha actual: {currentDate}
- Materias del usuario: {existingSubjects}
- Materia seleccionada: {subjectName}

REGLAS DE TRANSCRIPCIÓN:
- Transcribe en el idioma en que fue hablado (español o inglés).
- No inventes ni rellenes información que no esté en el audio. Si no entiendes una palabra, usa [inaudible].
- Los nombres de profesores, términos técnicos y siglas: escríbelos como los escuches.
- Si el profesor dicta fórmulas o ecuaciones, transcríbelas en LaTeX.
- Captura TODO: preguntas del profesor, respuestas de estudiantes, explicaciones, ejemplos, tareas mencionadas.

INSTRUCCIONES:

1. APUNTES: Organiza el contenido académico del audio en apuntes estructurados.
   - Usa Markdown: ## temas principales, ### subtemas, **negrita** para conceptos clave.
   - ECUACIONES: Siempre en LaTeX. Inline con $...$ y bloque con $$...$$
   - Ejemplos: integral $\\int_0^1 x^2 dx$, derivada $\\frac{dy}{dx}$, matriz $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$
   - Si el profesor completa un desarrollo, inclúyelo completo con todos los pasos.
   - Marca aportes contextuales con: > 💡 **Complemento IA**: [aporte]
   - Si el audio es corto o una sola idea, igualmente estructúralo como apunte de clase.

2. TAREAS: Si en el audio se mencionan entregas, trabajos, evaluaciones, quizzes, parciales, proyectos o lecturas, extráelos.
   - "entregar el viernes" → dueDate = viernes de esta semana
   - "para la próxima clase" → dueDate = 7 días desde hoy con dateConfidence "low"
   - Si no hay tareas, deja tasks como arreglo vacío [].

3. TAGS: Genera 2-5 tags específicos del tema tratado. Ej: "cálculo-vectorial", "transformada-laplace".

RESPONDE SOLO CON JSON VÁLIDO (sin markdown wrapping, sin backticks):
{
  "type": "both",
  "tasks": [{"title":"","description":"con $LaTeX$ si aplica","dueDate":"YYYY-MM-DD","assignedDate":"{currentDate}","dateConfidence":"high|medium|low","priority":"high|medium|low","taskType":"taller|quiz|parcial|proyecto|lectura|otro","detectedSubject":"","subjectConfidence":"high|medium|low"}],
  "notes": {"topic":"Tema principal de la clase","content":"markdown con $LaTeX$","tags":["tag1","tag2"]} | null
}`;

// Map file extension to MIME type for Gemini
const MIME_MAP: Record<string, string> = {
  webm: "audio/webm",
  mp3: "audio/mpeg",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
};

function detectMimeType(audioUrl: string, providedMime?: string): string {
  if (providedMime && providedMime.startsWith("audio/")) return providedMime;
  const ext = audioUrl.split(".").pop()?.toLowerCase().split("?")[0] || "";
  return MIME_MAP[ext] || "audio/webm";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audioUrl, mimeType: providedMime, subjectName, existingSubjects, currentDate, subjectDocuments, existingNotes } = body as {
      audioUrl: string;
      mimeType?: string;
      subjectName?: string;
      existingSubjects: string[];
      currentDate: string;
      subjectDocuments?: DocRef[];
      existingNotes?: string[];
    };

    if (!audioUrl) {
      return NextResponse.json({ error: "No se proporcionó URL de audio" }, { status: 400 });
    }

    // Fetch audio from Cloudinary and convert to base64 for inline embedding
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return NextResponse.json(
        { error: `No se pudo descargar el audio (${audioRes.status})` },
        { status: 502 }
      );
    }

    const audioBuffer = await audioRes.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");
    const mimeType = detectMimeType(audioUrl, providedMime);

    let prompt = VOICE_AUTO_PROMPT
      .replaceAll("{currentDate}", currentDate)
      .replaceAll("{existingSubjects}", existingSubjects.join(", "))
      .replaceAll("{subjectName}", subjectName || "No especificada");

    // Inject existing class notes as context so AI understands prior topics
    if (Array.isArray(existingNotes) && existingNotes.length > 0) {
      const notesContext = existingNotes
        .slice(0, 5) // limit to 5 most recent notes to avoid token overflow
        .map((n, i) => `## Apunte previo ${i + 1}\n${n}`)
        .join("\n\n");
      prompt += `\n\nAPUNTES PREVIOS DE ESTA CLASE (úsalos como contexto para entender mejor el audio, no los incluyas en el output):\n${notesContext}`;
    }

    // Build document context from subject library
    const documentContext = await buildDocumentContext(subjectDocuments || []);
    if (documentContext.contextText) {
      prompt = `${prompt}\n\n${documentContext.contextText}`;
    }

    const text = await generateText(
      {
        prompt,
        images: [{ data: base64Audio, mimeType }, ...documentContext.images],
      },
      { json: true }
    );

    let parsed;
    try {
      parsed = parseAiJson(text);
    } catch {
      return NextResponse.json(
        { error: "Error al interpretar respuesta de IA", raw: text.slice(0, 500) },
        { status: 500 }
      );
    }

    // Normalize structure — same logic as /api/scan
    if (!Array.isArray(parsed.tasks)) {
      parsed.tasks = parsed.tasks ? [parsed.tasks] : [];
    }

    const notes = parsed.notes as Record<string, unknown> | null | undefined;
    if (notes && !notes.content) {
      parsed.notes = null;
    }

    // If no tasks and no notes, wrap raw content
    if ((parsed.tasks as unknown[]).length === 0 && !parsed.notes) {
      parsed.type = "notes";
      parsed.notes = {
        topic: "Clase transcrita",
        content: text,
        tags: [],
      };
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("Transcribe route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
