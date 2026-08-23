import { GoogleGenAI } from "@google/genai";
import type { AiMessage, AiProvider, GenOptions } from "../types";
import { AiProviderError } from "../types";

type GeminiPart = { text: string } | { inlineData: { data: string; mimeType: string } };

function toParts(msg: AiMessage): GeminiPart[] {
  const parts: GeminiPart[] = [];
  if (msg.content) parts.push({ text: msg.content });
  for (const img of msg.images ?? []) {
    parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
  }
  return parts;
}

function toContents(messages: AiMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: toParts(m),
  }));
}

function buildConfig(opts: GenOptions) {
  const config: Record<string, unknown> = {};
  if (opts.system) config.systemInstruction = opts.system;
  if (opts.json) config.responseMimeType = "application/json";
  if (opts.temperature !== undefined) config.temperature = opts.temperature;
  if (opts.maxOutputTokens !== undefined) config.maxOutputTokens = opts.maxOutputTokens;
  return config;
}

export function createGeminiProvider(apiKey: string, model: string): AiProvider {
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",
    model,
    supportsVision: true,

    async generate(messages, opts) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: toContents(messages),
          config: buildConfig(opts),
        });
        const text = res.text;
        if (!text) throw new Error(emptyReason(res));
        return text;
      } catch (err) {
        throw new AiProviderError("gemini", model, describe(err), err, statusOf(err));
      }
    },

    async stream(messages, opts) {
      try {
        const iterator = await ai.models.generateContentStream({
          model,
          contents: toContents(messages),
          config: buildConfig(opts),
        });
        return (async function* () {
          for await (const chunk of iterator) {
            const text = chunk.text;
            if (text) yield text;
          }
        })();
      } catch (err) {
        throw new AiProviderError("gemini", model, describe(err), err, statusOf(err));
      }
    },
  };
}

/**
 * Una respuesta sin texto casi nunca es un fallo de red: suele ser el presupuesto
 * de tokens agotado por el "thinking" del modelo, o un filtro de contenido.
 */
function emptyReason(res: { candidates?: Array<{ finishReason?: string }> }): string {
  const reason = res.candidates?.[0]?.finishReason;
  if (reason === "MAX_TOKENS") {
    return "respuesta vacía: se agotó maxOutputTokens (los modelos con razonamiento " +
      "consumen presupuesto antes de escribir; sube el límite o quítalo)";
  }
  if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT") {
    return `respuesta vacía: el modelo bloqueó el contenido (${reason})`;
  }
  return reason ? `respuesta vacía (finishReason: ${reason})` : "respuesta vacía";
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** El SDK expone `status`; si no, el código viene dentro del JSON del mensaje. */
function statusOf(err: unknown): number | undefined {
  const direct = (err as { status?: unknown })?.status;
  if (typeof direct === "number") return direct;
  const match = describe(err).match(/"code"\s*:\s*(\d{3})/);
  return match ? Number(match[1]) : undefined;
}
