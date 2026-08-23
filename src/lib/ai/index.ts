import { createGeminiProvider } from "./providers/gemini";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible";
import { cookies } from "next/headers";
import type { AiCapability, AiImage, AiMessage, AiProvider, GenOptions } from "./types";
import { AiProviderError } from "./types";
import { parseAiJson } from "./parse-json";
import { AI_SELECTION_COOKIE, parseSelection, type AiSelection } from "./catalog";

export type { AiImage, AiMessage, GenOptions } from "./types";
export { AiProviderError } from "./types";
export { parseAiJson } from "./parse-json";
export { AI_SELECTION_COOKIE, PROVIDERS, getProvider } from "./catalog";
export type { AiSelection, ProviderId } from "./catalog";

/**
 * Capa única de acceso a modelos. Ninguna ruta debe importar un SDK directamente.
 *
 * El proveedor y el modelo se eligen por variable de entorno, no en el código:
 *   AI_TEXT_PROVIDER / AI_TEXT_MODEL       → llamadas de solo texto
 *   AI_VISION_PROVIDER / AI_VISION_MODEL   → llamadas con imágenes
 *   AI_FALLBACK_PROVIDER / AI_FALLBACK_MODEL → se usa si el primario falla
 *
 * La cookie `workia_ai_models` (que escribe el selector de la UI) tiene
 * prioridad sobre las env vars, para poder cambiar de modelo sin redesplegar.
 *
 * Proveedores soportados: gemini, groq, cerebras, openrouter, mistral, ollama.
 */

interface ProviderPreset {
  baseUrl: string;
  keyEnv: string;
  supportsVision: boolean;
  defaultModel: string;
}

const PRESETS: Record<string, ProviderPreset> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY",
    supportsVision: false,
    defaultModel: "llama-3.3-70b-versatile",
  },
  cerebras: {
    baseUrl: "https://api.cerebras.ai/v1",
    keyEnv: "CEREBRAS_API_KEY",
    supportsVision: false,
    defaultModel: "llama-3.3-70b",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    supportsVision: true,
    defaultModel: "meta-llama/llama-3.2-90b-vision-instruct:free",
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    keyEnv: "MISTRAL_API_KEY",
    supportsVision: true,
    defaultModel: "mistral-small-latest",
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    keyEnv: "",
    supportsVision: true,
    defaultModel: "llama3.2-vision",
  },
};

// Alias que Google mantiene apuntando al Flash vigente: sobrevive a las retiradas
// de modelos concretos (2.5-flash dejó de servirse a cuentas nuevas en 2026).
const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";

const cache = new Map<string, AiProvider>();

function buildProvider(providerName: string, model?: string): AiProvider {
  const key = `${providerName}:${model ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let provider: AiProvider;

  if (providerName === "gemini") {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error("Falta GOOGLE_AI_API_KEY en el entorno");
    provider = createGeminiProvider(apiKey, model || GEMINI_DEFAULT_MODEL);
  } else {
    const preset = PRESETS[providerName];
    if (!preset) throw new Error(`Proveedor de IA desconocido: "${providerName}"`);
    const apiKey = preset.keyEnv ? process.env[preset.keyEnv] || "" : "";
    if (preset.keyEnv && !apiKey) {
      throw new Error(`Falta ${preset.keyEnv} en el entorno (proveedor "${providerName}")`);
    }
    provider = createOpenAICompatibleProvider({
      name: providerName,
      baseUrl: preset.baseUrl,
      apiKey,
      model: model || preset.defaultModel,
      supportsVision: preset.supportsVision,
    });
  }

  cache.set(key, provider);
  return provider;
}

/**
 * Lee la selección hecha desde la UI. Devuelve {} si no hay cookie, si está
 * corrupta, o si estamos fuera del scope de una petición (build, script).
 */
function readSelectionCookie(): Partial<AiSelection> {
  try {
    const raw = cookies().get(AI_SELECTION_COOKIE)?.value;
    if (!raw) return {};
    return parseSelection(JSON.parse(raw));
  } catch {
    return {};
  }
}

function resolveProvider(capability: AiCapability): AiProvider {
  const selection = readSelectionCookie();

  if (capability === "vision") {
    return buildProvider(
      selection.visionProvider || process.env.AI_VISION_PROVIDER || "gemini",
      selection.visionModel || process.env.AI_VISION_MODEL
    );
  }
  return buildProvider(
    selection.textProvider || process.env.AI_TEXT_PROVIDER || "gemini",
    selection.textModel || process.env.AI_TEXT_MODEL
  );
}

/** Qué proveedores tienen su key puesta en el servidor. Nunca expone los valores. */
export function getConfiguredProviders(): Record<string, boolean> {
  const out: Record<string, boolean> = { gemini: Boolean(process.env.GOOGLE_AI_API_KEY) };
  for (const [id, preset] of Object.entries(PRESETS)) {
    out[id] = preset.keyEnv ? Boolean(process.env[preset.keyEnv]) : true;
  }
  return out;
}

function resolveFallback(capability: AiCapability): AiProvider | null {
  const name = process.env.AI_FALLBACK_PROVIDER;
  if (!name) return null;
  try {
    const provider = buildProvider(name, process.env.AI_FALLBACK_MODEL);
    if (capability === "vision" && !provider.supportsVision) return null;
    return provider;
  } catch {
    // Fallback mal configurado no debe romper la llamada principal.
    return null;
  }
}

function inferCapability(messages: AiMessage[], opts: GenOptions): AiCapability {
  if (opts.capability) return opts.capability;
  return messages.some((m) => m.images?.length) ? "vision" : "text";
}

/** Los modelos gratis devuelven 503 por saturación bastante a menudo. */
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 700;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ejecuta contra un proveedor reintentando solo los fallos pasajeros
 * (saturación, rate limit, error interno), con espera creciente.
 */
async function runWithRetries<T>(
  provider: AiProvider,
  run: (provider: AiProvider) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await run(provider);
    } catch (err) {
      lastError = err;
      const transient = err instanceof AiProviderError && err.isTransient;
      if (!transient || attempt === MAX_ATTEMPTS) break;

      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `[ai] ${provider.name}/${provider.model} no disponible (intento ${attempt}/${MAX_ATTEMPTS}), ` +
          `reintentando en ${delay}ms`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

async function withFallback<T>(
  messages: AiMessage[],
  opts: GenOptions,
  run: (provider: AiProvider) => Promise<T>
): Promise<T> {
  const capability = inferCapability(messages, opts);
  const primary = resolveProvider(capability);

  try {
    return await runWithRetries(primary, run);
  } catch (primaryError) {
    if (opts.noFallback) throw primaryError;
    const fallback = resolveFallback(capability);
    // Mismo proveedor con OTRO modelo sí es un respaldo válido: sirve cuando
    // un modelo concreto está saturado pero el resto del proveedor responde.
    const isSameTarget =
      fallback && fallback.name === primary.name && fallback.model === primary.model;
    if (!fallback || isSameTarget) throw primaryError;

    console.warn(
      `[ai] ${primary.name}/${primary.model} falló, reintentando con ${fallback.name}/${fallback.model}:`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );
    try {
      return await runWithRetries(fallback, run);
    } catch {
      // El error del primario es el informativo; el fallback solo confirma el fallo.
      throw primaryError;
    }
  }
}

// ── API pública ──

export interface PromptInput {
  prompt: string;
  system?: string;
  images?: AiImage[];
}

/** Entrada aceptada: un prompt suelto, un prompt con imágenes, o una conversación. */
export type AiInput = string | PromptInput | AiMessage[];

function toMessages(input: AiInput): AiMessage[] {
  if (typeof input === "string") return [{ role: "user", content: input }];
  if (Array.isArray(input)) return input;
  return [{ role: "user", content: input.prompt, images: input.images }];
}

function toOptions(input: AiInput, opts: GenOptions): GenOptions {
  if (typeof input === "string" || Array.isArray(input)) return opts;
  return { ...opts, system: opts.system ?? input.system };
}

/** Genera texto plano. */
export function generateText(input: AiInput, opts: GenOptions = {}): Promise<string> {
  const messages = toMessages(input);
  const options = toOptions(input, opts);
  return withFallback(messages, options, (p) => p.generate(messages, options));
}

/** Genera y parsea JSON. Tolera fences de markdown y LaTeX mal escapado. */
export async function generateJSON<T = Record<string, unknown>>(
  input: AiInput,
  opts: GenOptions = {}
): Promise<T> {
  const raw = await generateText(input, { ...opts, json: true });
  return parseAiJson<T>(raw);
}

/** Devuelve un stream de fragmentos de texto. */
export function streamText(
  input: AiInput,
  opts: GenOptions = {}
): Promise<AsyncIterable<string>> {
  const messages = toMessages(input);
  const options = toOptions(input, opts);
  return withFallback(messages, options, (p) => p.stream(messages, options));
}

/** Empaqueta un stream de texto como ReadableStream para devolverlo en una Response. */
export function toReadableStream(chunks: AsyncIterable<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        controller.error(err);
        return;
      }
      controller.close();
    },
  });
}

/** Mensaje de error legible para devolver al cliente. */
export function aiErrorMessage(err: unknown): string {
  if (err instanceof AiProviderError) {
    return `El modelo (${err.provider}) no pudo responder: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return "Error desconocido de la IA";
}

/** Qué proveedor/modelo está activo. Útil para diagnóstico. */
export function describeConfig() {
  const safe = (fn: () => AiProvider) => {
    try {
      const p = fn();
      return { provider: p.name, model: p.model, ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  };
  return {
    text: safe(() => resolveProvider("text")),
    vision: safe(() => resolveProvider("vision")),
    fallback: process.env.AI_FALLBACK_PROVIDER
      ? safe(() => resolveFallback("text") ?? (() => { throw new Error("no disponible"); })())
      : null,
  };
}
