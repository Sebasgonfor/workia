/** Imagen o archivo binario adjunto a un mensaje, en base64. */
export interface AiImage {
  data: string;
  mimeType: string;
}

export type AiRole = "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: string;
  images?: AiImage[];
}

/** Qué tipo de modelo necesita la llamada. Decide a qué proveedor se rutea. */
export type AiCapability = "text" | "vision";

export interface GenOptions {
  /** Instrucción de sistema (rol, formato, reglas). */
  system?: string;
  /** Forzar salida JSON. */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  /** Por defecto se infiere: "vision" si algún mensaje trae imágenes. */
  capability?: AiCapability;
  /** Saltarse el fallback automático (útil para tests). */
  noFallback?: boolean;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  readonly supportsVision: boolean;
  generate(messages: AiMessage[], opts: GenOptions): Promise<string>;
  stream(messages: AiMessage[], opts: GenOptions): Promise<AsyncIterable<string>>;
}

/** Error de proveedor con la causa original, para poder decidir si vale la pena reintentar. */
export class AiProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly model: string,
    message: string,
    public readonly cause?: unknown,
    /** Código HTTP, cuando se pudo determinar. */
    public readonly status?: number
  ) {
    super(`[${provider}/${model}] ${message}`);
    this.name = "AiProviderError";
  }

  /**
   * Fallos pasajeros que merecen reintento: saturación del modelo (503),
   * límite de peticiones (429) y errores internos del proveedor.
   * Un 400/401/404 no se arregla reintentando.
   */
  get isTransient(): boolean {
    return this.status !== undefined && [429, 500, 502, 503, 504].includes(this.status);
  }
}
