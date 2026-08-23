/**
 * Catálogo de proveedores. Sin secretos ni dependencias de servidor:
 * este módulo se importa también desde componentes de cliente.
 */

export type ProviderId =
  | "gemini"
  | "groq"
  | "cerebras"
  | "openrouter"
  | "mistral"
  | "ollama";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Si sus modelos aceptan imágenes/PDF/audio. */
  supportsVision: boolean;
  /** Nota corta para mostrar en la UI. */
  note: string;
  /** Dónde sacar la key. */
  keyUrl?: string;
  /** Nombre de la env var con la key (vacío = no necesita). */
  keyEnv: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    supportsVision: true,
    note: "Gratis 1500 req/día. El mejor para fotos y audio.",
    keyUrl: "https://aistudio.google.com/apikey",
    keyEnv: "GOOGLE_AI_API_KEY",
  },
  {
    id: "groq",
    label: "Groq",
    supportsVision: false,
    note: "Gratis y muy rápido. Solo texto.",
    keyUrl: "https://console.groq.com/keys",
    keyEnv: "GROQ_API_KEY",
  },
  {
    id: "cerebras",
    label: "Cerebras",
    supportsVision: false,
    note: "Gratis, 1M tokens/día. Solo texto.",
    keyUrl: "https://cloud.cerebras.ai",
    keyEnv: "CEREBRAS_API_KEY",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    supportsVision: true,
    note: "Catálogo enorme, incluye modelos gratis.",
    keyUrl: "https://openrouter.ai/keys",
    keyEnv: "OPENROUTER_API_KEY",
  },
  {
    id: "mistral",
    label: "Mistral",
    supportsVision: true,
    note: "Free tier propio.",
    keyUrl: "https://console.mistral.ai",
    keyEnv: "MISTRAL_API_KEY",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    supportsVision: true,
    note: "Gratis e ilimitado, corre en tu Mac. Requiere `ollama serve`.",
    keyEnv: "",
  },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function isProviderId(id: unknown): id is ProviderId {
  return typeof id === "string" && PROVIDER_IDS.includes(id as ProviderId);
}

/** Selección activa de modelos. Lo que se guarda en la cookie. */
export interface AiSelection {
  textProvider: ProviderId;
  textModel: string;
  visionProvider: ProviderId;
  visionModel: string;
}

export const AI_SELECTION_COOKIE = "workia_ai_models";

/** Un ID de modelo válido: sin espacios ni caracteres raros que puedan alterar la petición. */
export function isValidModelId(model: unknown): model is string {
  return (
    typeof model === "string" &&
    model.length > 0 &&
    model.length <= 120 &&
    /^[A-Za-z0-9._\/:+-]+$/.test(model)
  );
}

export interface SelectionResult {
  selection: Partial<AiSelection>;
  /** Campos presentes en la entrada que no pasaron validación. */
  invalid: string[];
}

/**
 * Valida lo que venga del cliente o de la cookie.
 * Reporta qué campos vinieron mal para que quien llame decida si rechazar
 * la petición entera — guardar a medias dejaría pares proveedor/modelo incoherentes.
 */
export function validateSelection(raw: unknown): SelectionResult {
  if (!raw || typeof raw !== "object") return { selection: {}, invalid: [] };
  const v = raw as Record<string, unknown>;
  const selection: Partial<AiSelection> = {};
  const invalid: string[] = [];

  const check = <K extends keyof AiSelection>(
    key: K,
    ok: (val: unknown) => boolean
  ) => {
    if (v[key] === undefined) return;
    if (ok(v[key])) selection[key] = v[key] as AiSelection[K];
    else invalid.push(key);
  };

  check("textProvider", isProviderId);
  check("visionProvider", isProviderId);
  check("textModel", isValidModelId);
  check("visionModel", isValidModelId);

  return { selection, invalid };
}

/** Igual que validateSelection pero descartando lo inválido en silencio. Para leer la cookie. */
export function parseSelection(raw: unknown): Partial<AiSelection> {
  return validateSelection(raw).selection;
}
