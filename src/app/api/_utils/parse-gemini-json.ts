/**
 * Sanitize a JSON string returned by Gemini that may contain:
 * - Unescaped control characters inside string values (\n, \t, \r as raw bytes)
 * - LaTeX backslash sequences that are invalid JSON escapes (e.g. \f → formfeed, \b → backspace, \i, \v, etc.)
 * - Trailing commas before } or ]
 * - Markdown code-block wrapping
 */
function sanitizeGeminiJSON(raw: string): string {
  // 1. Strip markdown fences
  let text = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // 2. Fix control chars and bad escapes INSIDE string values only.
  //    Walk through the string tracking whether we're inside a JSON string.
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && (i === 0 || text[i - 1] !== "\\")) {
      inString = !inString;
      out += ch;
      continue;
    }

    if (!inString) {
      out += ch;
      continue;
    }

    // Inside a JSON string value:
    if (ch === "\n") { out += "\\n"; continue; }
    if (ch === "\r") { out += "\\r"; continue; }
    if (ch === "\t") { out += "\\t"; continue; }

    // Handle backslash sequences
    if (ch === "\\") {
      // Valid JSON escapes: " \ / b f n r t uXXXX
      const validEscapes = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);
      if (next && !validEscapes.has(next)) {
        // Invalid escape like \i, \s, \p, \v, \d, \x, \( etc → double the backslash
        // so LaTeX \int becomes \\int in JSON which decodes to \int
        out += "\\\\";
        continue;
      }
    }

    out += ch;
  }

  // 3. Remove trailing commas: ,] and ,}
  out = out.replace(/,(\s*[}\]])/g, "$1");

  return out;
}

/** Try multiple strategies to parse JSON from Gemini output */
export function parseGeminiResponse(text: string): Record<string, unknown> {
  // Strategy 1: Direct parse (responseMimeType should give clean JSON)
  try { return JSON.parse(text); } catch {}

  // Strategy 2: Sanitize and parse
  try { return JSON.parse(sanitizeGeminiJSON(text)); } catch {}

  // Strategy 3: Extract the outermost JSON object and sanitize
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(sanitizeGeminiJSON(jsonMatch[0])); } catch {}
  }

  throw new Error("No se pudo interpretar la respuesta de la IA");
}
