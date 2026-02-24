/**
 * Builds Gemini-compatible context from subject documents.
 *
 * - image/* and application/pdf → fetched as base64 and passed as inlineData parts
 *   (Gemini 2.0 Flash supports both natively)
 * - All other file types → referenced by name only in the text context block
 *
 * Capped at MAX_INLINE_DOCS inline documents to avoid exceeding token limits.
 */

export interface DocRef {
  name: string;
  url: string;
  fileType: string;
}

interface InlineDataPart {
  inlineData: { data: string; mimeType: string };
}

export interface DocumentContext {
  /** Inline parts ready to be spread into model.generateContent([prompt, ...parts]) */
  parts: InlineDataPart[];
  /** Text block to inject into the prompt describing available documents */
  contextText: string;
}

const MAX_INLINE_DOCS = 5;
const INLINEABLE_TYPES = new Set(["application/pdf"]);

const isInlineable = (fileType: string): boolean =>
  fileType.startsWith("image/") || INLINEABLE_TYPES.has(fileType);

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch {
    return null;
  }
}

export async function buildDocumentContext(
  docs: DocRef[]
): Promise<DocumentContext> {
  if (!docs || docs.length === 0) {
    return { parts: [], contextText: "" };
  }

  const inlineable = docs.filter((d) => isInlineable(d.fileType)).slice(0, MAX_INLINE_DOCS);
  const textOnly = docs.filter((d) => !isInlineable(d.fileType));

  // Fetch inlineable docs in parallel
  const fetchResults = await Promise.all(
    inlineable.map(async (doc) => {
      const data = await fetchAsBase64(doc.url);
      return { doc, data };
    })
  );

  const parts: InlineDataPart[] = [];
  const inlinedNames: string[] = [];
  const failedNames: string[] = [];

  for (const { doc, data } of fetchResults) {
    if (data) {
      parts.push({ inlineData: { data, mimeType: doc.fileType } });
      inlinedNames.push(doc.name);
    } else {
      failedNames.push(doc.name);
    }
  }

  const textOnlyNames = [
    ...textOnly.map((d) => d.name),
    ...failedNames,
  ];

  // Build context block for the prompt
  const lines: string[] = [];

  if (inlinedNames.length > 0 || textOnlyNames.length > 0) {
    lines.push("DOCUMENTOS DE LA MATERIA (referencia adicional para tu respuesta):");
    inlinedNames.forEach((name) =>
      lines.push(`  - "${name}" [incluido como adjunto en este mensaje]`)
    );
    textOnlyNames.forEach((name) =>
      lines.push(`  - "${name}" [referenciado; no disponible como adjunto]`)
    );
    lines.push(
      "Usa estos documentos para enriquecer tu análisis, complementar los apuntes y proporcionar contexto adicional cuando sea relevante."
    );
  }

  return {
    parts,
    contextText: lines.join("\n"),
  };
}
