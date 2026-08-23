import { GoogleGenAI } from "@google/genai";
import { getProvider, type ProviderId } from "./catalog";

export interface ModelOption {
  id: string;
  label: string;
}

/** Modelos que no sirven para generar texto/chat y solo ensucian el selector. */
const EXCLUDE = /embed|embedding|whisper|tts|audio-preview|imagen|veo|moderation|rerank|guard/i;

function clean(models: ModelOption[]): ModelOption[] {
  return models
    .filter((m) => m.id && !EXCLUDE.test(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function listGemini(): Promise<ModelOption[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("Falta GOOGLE_AI_API_KEY");
  const ai = new GoogleGenAI({ apiKey });
  const pager = await ai.models.list();

  const out: ModelOption[] = [];
  for await (const model of pager) {
    // Solo los que pueden generar contenido; el nombre viene como "models/xxx"
    const actions = model.supportedActions ?? [];
    if (actions.length > 0 && !actions.includes("generateContent")) continue;
    const id = (model.name ?? "").replace(/^models\//, "");
    if (!id) continue;
    out.push({ id, label: model.displayName || id });
  }
  return clean(out);
}

async function listOpenAICompatible(provider: ProviderId): Promise<ModelOption[]> {
  const BASE: Record<string, string> = {
    groq: "https://api.groq.com/openai/v1",
    cerebras: "https://api.cerebras.ai/v1",
    openrouter: "https://openrouter.ai/api/v1",
    mistral: "https://api.mistral.ai/v1",
    ollama: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  };
  const KEY_ENV: Record<string, string> = {
    groq: "GROQ_API_KEY",
    cerebras: "CEREBRAS_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    mistral: "MISTRAL_API_KEY",
    ollama: "",
  };

  const baseUrl = BASE[provider];
  const keyEnv = KEY_ENV[provider];
  const apiKey = keyEnv ? process.env[keyEnv] || "" : "";
  if (keyEnv && !apiKey) throw new Error(`Falta ${keyEnv}`);

  const res = await fetch(`${baseUrl}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    // La lista de modelos cambia poco; evita golpear al proveedor en cada carga.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  const data: Array<{ id?: string; name?: string }> = json?.data ?? json?.models ?? [];
  return clean(
    data.map((m) => ({ id: m.id ?? m.name ?? "", label: m.name ?? m.id ?? "" }))
  );
}

/** Pregunta al proveedor qué modelos ofrece ahora mismo. */
export async function listModels(provider: ProviderId): Promise<ModelOption[]> {
  if (!getProvider(provider)) throw new Error(`Proveedor desconocido: ${provider}`);
  if (provider === "gemini") return listGemini();
  return listOpenAICompatible(provider);
}
