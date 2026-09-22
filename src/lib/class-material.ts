import JSZip from "jszip";

/** Class material sent to the scan API: plain text or an inline PDF data URL. */
export interface ClassMaterialPayload {
  name: string;
  text?: string;
  pdf?: string;
}

export const CLASS_MATERIAL_ACCEPT =
  ".txt,.pdf,.docx,.pptx,text/plain,application/pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Combined size cap for all materials, keeps the request under the platform body limit. */
export const MAX_CLASS_MATERIAL_BYTES = 3 * 1024 * 1024;

type MaterialKind = "txt" | "pdf" | "docx" | "pptx";

export function getMaterialKind(file: File): MaterialKind | null {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "txt" || ext === "pdf" || ext === "docx" || ext === "pptx") return ext;
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

/** Joins the text runs (<w:t> / <a:t>) of each paragraph (<w:p> / <a:p>) in an OOXML part. */
function extractParagraphs(xml: string, ns: "w" | "a"): string {
  const paragraphs = xml.match(new RegExp(`<${ns}:p[ >][\\s\\S]*?</${ns}:p>`, "g")) ?? [];
  return paragraphs
    .map((p) =>
      (p.match(new RegExp(`<${ns}:t(?: [^>]*)?>([\\s\\S]*?)</${ns}:t>`, "g")) ?? [])
        .map((t) => decodeXml(t.replace(/<[^>]+>/g, "")))
        .join("")
    )
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

async function extractDocx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const xml = await zip.file("word/document.xml")?.async("string");
  return xml ? extractParagraphs(xml, "w") : "";
}

async function extractPptx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const slideNumber = (path: string) => Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
  const slides = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  const texts = await Promise.all(
    slides.map(async (path, i) => {
      const xml = await zip.file(path)!.async("string");
      return `--- Diapositiva ${i + 1} ---\n${extractParagraphs(xml, "a")}`;
    })
  );
  return texts.join("\n\n");
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
    default:
      return { name: file.name, text: await file.text() };
  }
}
