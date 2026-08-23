import type { AiMessage, AiProvider, GenOptions } from "../types";
import { AiProviderError } from "../types";

/**
 * Cliente para cualquier API que hable el protocolo /chat/completions de OpenAI:
 * Groq, Cerebras, OpenRouter, Mistral, Together, Ollama local, etc.
 * Sin SDK — solo fetch, para no arrastrar dependencias por proveedor.
 */

type OpenAIContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: OpenAIContent;
}

function toMessages(messages: AiMessage[], system?: string): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];
  if (system) out.push({ role: "system", content: system });

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "assistant" : "user";
    if (!msg.images?.length) {
      out.push({ role, content: msg.content });
      continue;
    }
    const parts: Exclude<OpenAIContent, string> = [];
    if (msg.content) parts.push({ type: "text", text: msg.content });
    for (const img of msg.images) {
      parts.push({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}` },
      });
    }
    out.push({ role, content: parts });
  }
  return out;
}

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsVision: boolean;
}

export function createOpenAICompatibleProvider(cfg: OpenAICompatibleConfig): AiProvider {
  const { name, baseUrl, apiKey, model, supportsVision } = cfg;

  async function post(body: Record<string, unknown>, signal?: AbortSignal) {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Ollama no pide auth; mandar un Bearer vacío rompe algunos servidores.
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, ...body }),
      signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
      (error as Error & { status?: number }).status = res.status;
      throw error;
    }
    return res;
  }

  function buildBody(messages: AiMessage[], opts: GenOptions) {
    const body: Record<string, unknown> = {
      messages: toMessages(messages, opts.system),
    };
    if (opts.json) body.response_format = { type: "json_object" };
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.maxOutputTokens !== undefined) body.max_tokens = opts.maxOutputTokens;
    return body;
  }

  return {
    name,
    model,
    supportsVision,

    async generate(messages, opts) {
      try {
        const res = await post(buildBody(messages, opts));
        const json = await res.json();
        const text: string | undefined = json?.choices?.[0]?.message?.content;
        if (!text) throw new Error("respuesta vacía");
        return text;
      } catch (err) {
        throw new AiProviderError(name, model, describe(err), err, statusOf(err));
      }
    },

    async stream(messages, opts) {
      let res: Response;
      try {
        res = await post({ ...buildBody(messages, opts), stream: true });
      } catch (err) {
        throw new AiProviderError(name, model, describe(err), err, statusOf(err));
      }
      const body = res.body;
      if (!body) throw new AiProviderError(name, model, "stream sin body");

      return (async function* () {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Los eventos SSE llegan separados por línea en blanco, pero varios
          // proveedores mandan una línea "data:" suelta por chunk. Procesamos por línea.
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload);
              const delta: string | undefined = chunk?.choices?.[0]?.delta?.content;
              if (delta) yield delta;
            } catch {
              // fragmento incompleto: se ignora, el resto llega en el siguiente read
            }
          }
        }
      })();
    },
  };
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function statusOf(err: unknown): number | undefined {
  const direct = (err as { status?: unknown })?.status;
  return typeof direct === "number" ? direct : undefined;
}
