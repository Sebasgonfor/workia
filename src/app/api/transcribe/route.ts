import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildDocumentContext, type DocRef } from "@/app/api/_utils/document-context";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const VOICE_AUTO_PROMPT = `Escucha este audio de clase universitaria y extrae TODO su contenido.

CONTEXTO:
- Fecha actual: {currentDate}
- Materias del usuario: {existingSubjects}
- Materia seleccionada: {subjectName}

INSTRUCCIONES:

1. APUNTES: Transcribe y estructura el contenido académico explicado en el audio.
   - Usa Markdown: ## temas principales, ### subtemas, **negrita** para conceptos clave.
   - ECUACIONES: Siempre en LaTeX. Inline con $...$ y en bloque con $$...$$
   - Ejemplos: integral $\\int_0^1 x^2 dx$, derivada $\\frac{dy}{dx}$, matriz $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$
   - Si el profesor completa un desarrollo, inclúyelo completo.
   - Marca aportes contextuales con: > 💡 **Complemento IA**: [aporte]

2. TAREAS: Si en el audio se mencionan entregas, trabajos, evaluaciones, quizzes, parciales, proyectos o lecturas, extráelos como tareas.
   - "entregar el viernes" → dueDate = viernes de esta semana
   - "para la próxima clase" → dueDate = 7 días desde hoy con dateConfidence "low"
   - Si no hay tareas mencionadas, deja tasks vacío.

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
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key de Gemini no configurada. Agrega GOOGLE_AI_API_KEY en .env" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { audioUrl, mimeType: providedMime, subjectName, existingSubjects, currentDate, subjectDocuments } = body as {
      audioUrl: string;
      mimeType?: string;
      subjectName?: string;
      existingSubjects: string[];
      currentDate: string;
      subjectDocuments?: DocRef[];
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

    // Build document context from subject library
    const documentContext = await buildDocumentContext(subjectDocuments || []);
    if (documentContext.contextText) {
      prompt = `${prompt}\n\n${documentContext.contextText}`;
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Audio,
          mimeType,
        },
      },
      ...documentContext.parts,
    ]);

    const text = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      try {
        const cleaned = text
          .replace(/^```(?:json)?\s*\n?/i, "")
          .replace(/\n?```\s*$/i, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
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
      }
    }

    // Normalize structure — same logic as /api/scan
    if (!Array.isArray(parsed.tasks)) {
      parsed.tasks = parsed.tasks ? [parsed.tasks] : [];
    }

    if (parsed.notes && !parsed.notes.content) {
      parsed.notes = null;
    }

    // If no tasks and no notes, wrap raw content
    if (parsed.tasks.length === 0 && !parsed.notes) {
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
