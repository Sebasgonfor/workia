import JSZip from "jszip";

/** Class material sent to the scan API: plain text or an inline PDF data URL. */
export interface ClassMaterialPayload {
  name: string;
  text?: string;
  pdf?: string;
}

export const MATERIAL_KINDS = [
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "odt",
  "odp",
  "txt",
  "md",
  "csv",
  "vtt",
  "srt",
] as const;

export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const CLASS_MATERIAL_ACCEPT = [
  ...MATERIAL_KINDS.map((k) => `.${k}`),
  "text/plain",
  "application/pdf",
].join(",");

/** Combined size cap for all materials, keeps the request under the platform body limit. */
export const MAX_CLASS_MATERIAL_BYTES = 3 * 1024 * 1024;

export function getMaterialKind(file: File): MaterialKind | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if ((MATERIAL_KINDS as readonly string[]).includes(ext)) return ext as MaterialKind;
  if (file.type === "text/plain") return "txt";
  if (file.type === "application/pdf") return "pdf";
  return null;
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const stripTags = (s: string) => decodeXml(s.replace(/<[^>]+>/g, ""));

/** Joins the text runs (<w:t> / <a:t>) of each paragraph (<w:p> / <a:p>) in an OOXML part. */
function extractParagraphs(xml: string, ns: "w" | "a"): string {
  const paragraphs = xml.match(new RegExp(`<${ns}:p[ >][\\s\\S]*?</${ns}:p>`, "g")) ?? [];
  return paragraphs
    .map((p) =>
      (p.match(new RegExp(`<${ns}:t(?: [^>]*)?>([\\s\\S]*?)</${ns}:t>`, "g")) ?? [])
        .map(stripTags)
        .join("")
    )
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

const numberIn = (path: string) => Number(path.match(/(\d+)\.xml$/)?.[1] ?? 0);

async function extractDocx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const xml = await zip.file("word/document.xml")?.async("string");
  return xml ? extractParagraphs(xml, "w") : "";
}

async function extractPptx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const slides = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => numberIn(a) - numberIn(b));
  const texts = await Promise.all(
    slides.map(async (path, i) => {
      const xml = await zip.file(path)!.async("string");
      return `--- Diapositiva ${i + 1} ---\n${extractParagraphs(xml, "a")}`;
    })
  );
  return texts.join("\n\n");
}

/** Renders each worksheet as tab-separated rows, resolving shared strings. */
async function extractXlsx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const sharedXml = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const shared = (sharedXml.match(/<si>[\s\S]*?<\/si>/g) ?? []).map(stripTags);
  const sheets = Object.keys(zip.files)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .sort((a, b) => numberIn(a) - numberIn(b));

  const texts = await Promise.all(
    sheets.map(async (path, i) => {
      const xml = await zip.file(path)!.async("string");
      const rows = (xml.match(/<row[ >][\s\S]*?<\/row>/g) ?? []).map((row) =>
        (row.match(/<c[ >][\s\S]*?(?:<\/c>|\/>)/g) ?? [])
          .map((cell) => {
            const inline = cell.match(/<is>([\s\S]*?)<\/is>/)?.[1];
            if (inline) return stripTags(inline);
            const value = cell.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
            return /\st="s"/.test(cell) ? shared[Number(value)] ?? "" : decodeXml(value);
          })
          .join("\t")
      );
      return `--- Hoja ${i + 1} ---\n${rows.filter((r) => r.trim()).join("\n")}`;
    })
  );
  return texts.join("\n\n");
}

/** OpenDocument (odt/odp): text lives in <text:p> / <text:h> inside content.xml. */
async function extractOpenDocument(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const xml = (await zip.file("content.xml")?.async("string")) ?? "";
  return (xml.match(/<text:(?:p|h)[ >][\s\S]*?<\/text:(?:p|h)>/g) ?? [])
    .map(stripTags)
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

/** Drops cue numbers, timestamps and WEBVTT headers so only the spoken text remains. */
function cleanSubtitles(raw: string): string {
  return raw
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.trim() &&
        !/^WEBVTT/.test(line) &&
        !/^\d+$/.test(line.trim()) &&
        !/-->/.test(line) &&
        !/^(NOTE|STYLE|REGION)\b/.test(line)
    )
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .join("\n");
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export async function readClassMaterial(file: File): Promise<ClassMaterialPayload> {
  switch (getMaterialKind(file)) {
    case "pdf":
      return { name: file.name, pdf: await readAsDataUrl(file) };
    case "docx":
      return { name: file.name, text: await extractDocx(file) };
    case "pptx":
      return { name: file.name, text: await extractPptx(file) };
    case "xlsx":
      return { name: file.name, text: await extractXlsx(file) };
    case "odt":
    case "odp":
      return { name: file.name, text: await extractOpenDocument(file) };
    case "vtt":
    case "srt":
      return { name: file.name, text: cleanSubtitles(await file.text()) };
    default:
      return { name: file.name, text: await file.text() };
  }
}
