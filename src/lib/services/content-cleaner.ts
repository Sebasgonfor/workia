/** Strip rich-text markup from notes content so Gemini receives clean plain text */
export function cleanContentForPrompt(raw: string): string {
  return raw
    .replace(/```mermaid[\s\S]*?```/gi, "[diagrama]")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<nc-(?:def|formula|warn|ex|ai)>([\s\S]*?)<\/nc-(?:def|formula|warn|ex|ai)>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
