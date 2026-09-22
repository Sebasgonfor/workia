/**
 * Sanitize a JSON string returned by la IA that may contain:
 * - Unescaped control characters inside string values (\n, \t, \r as raw bytes)
 * - LaTeX backslash sequences that are invalid JSON escapes (e.g. \f → formfeed, \b → backspace, \i, \v, etc.)
 * - Trailing commas before } or ]
 * - Markdown code-block wrapping
 */
function sanitizeAiJson(raw: string): string {
  // 1. Strip markdown fences
  let text = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // 2. Fix control chars and bad escapes INSIDE string values only.
  //    Walk through the string tracking whether we're inside a JSON string.
  let out = "";
  let inString = false;
  const simpleEscapes = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }

    // Inside a JSON string value:
    if (ch === '"') { inString = false; out += ch; continue; }
    if (ch === "\n") { out += "\\n"; continue; }
    if (ch === "\r") { out += "\\r"; continue; }
    if (ch === "\t") { out += "\\t"; continue; }

    if (ch === "\\") {
      const next = text[i + 1];
      const isUnicode = next === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6));
      // \f and \b followed by a letter are LaTeX (\frac, \beta), not control chars.
      const isLatexFB = (next === "f" || next === "b") && /[a-zA-Z]/.test(text[i + 2] ?? "");
      if (next !== undefined && (isUnicode || (simpleEscapes.has(next) && !isLatexFB))) {
        // Valid escape: copy both chars so the escaped char is never re-interpreted.
        out += ch + next;
        i++;
        continue;
      }
      // Invalid escape (\int, \underbrace, \(...) → double it so it decodes to a literal backslash.
      out += "\\\\";
      continue;
    }

    out += ch;
  }

  // 3. Remove trailing commas: ,] and ,}
  out = out.replace(/,(\s*[}\]])/g, "$1");

  return out;
}

/** Try multiple strategies to parse JSON from la IA output */
export function parseAiJson<T = Record<string, unknown>>(text: string): T {
  // Strategy 1: Direct parse (responseMimeType should give clean JSON)
  try { return JSON.parse(text) as T; } catch {}

  // Strategy 2: Sanitize and parse
  try { return JSON.parse(sanitizeAiJson(text)) as T; } catch {}

  // Strategy 3: Extract the outermost JSON object and sanitize
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(sanitizeAiJson(jsonMatch[0])) as T; } catch {}
  }

  throw new Error("No se pudo interpretar la respuesta de la IA");
}
