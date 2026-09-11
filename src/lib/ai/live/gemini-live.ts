"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

/**
 * Wrapper delgado sobre la Live API de `@google/genai`, aislado igual que
 * `providers/gemini.ts` hace con la API normal — el resto del código no
 * debe tocar el SDK directamente.
 *
 * Conexión directa desde el navegador: el `ephemeralToken` (obtenido de
 * `POST /api/ai/live-token`) hace de "apiKey" de un uso muy limitado, así
 * que la key BYOK real del usuario nunca sale del servidor.
 *
 * NOTA: la Live API está marcada `@experimental` en el SDK — nombres de
 * modelo, sample rates y formatos exactos pueden cambiar entre versiones.
 * Confirmar contra la doc vigente de Gemini si algo no calza al probar.
 */

/** Modelo con audio nativo. Confirmar que sigue vigente al desplegar —
 *  Google retira/renombra modelos Live con cierta frecuencia. */
export const DEFAULT_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";

/** Sample rates que espera/devuelve la Live API (PCM16 mono). */
export const INPUT_SAMPLE_RATE = 16_000;
export const OUTPUT_SAMPLE_RATE = 24_000;

export interface LiveSessionHandlers {
  onOpen?: () => void;
  onAudio?: (chunk: ArrayBuffer) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
}

export interface LiveSession {
  /** Manda un chunk de audio del mic, PCM16 mono a `INPUT_SAMPLE_RATE`. */
  sendAudioChunk(chunk: ArrayBuffer): void;
  /** Manda texto (p.ej. si en algún momento se ofrece fallback a texto). */
  sendText(text: string): void;
  close(): void;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function connectLiveSession(opts: {
  ephemeralToken: string;
  model?: string;
  systemInstruction?: string;
  handlers: LiveSessionHandlers;
}): Promise<LiveSession> {
  const { ephemeralToken, model = DEFAULT_LIVE_MODEL, systemInstruction, handlers } = opts;

  // El token efímero hace de apiKey; requiere v1alpha, igual que al crearlo.
  const ai = new GoogleGenAI({ apiKey: ephemeralToken, httpOptions: { apiVersion: "v1alpha" } });

  const onMessage = (message: LiveServerMessage) => {
    const content = message.serverContent;
    if (!content) return;

    if (content.interrupted) handlers.onInterrupted?.();

    for (const part of content.modelTurn?.parts ?? []) {
      const inline = part.inlineData;
      if (inline?.data && inline.mimeType?.startsWith("audio/")) {
        handlers.onAudio?.(base64ToArrayBuffer(inline.data));
      }
    }

    if (content.inputTranscription?.text) {
      handlers.onInputTranscript?.(content.inputTranscription.text);
    }
    if (content.outputTranscription?.text) {
      handlers.onOutputTranscript?.(content.outputTranscription.text);
    }
    if (content.turnComplete) handlers.onTurnComplete?.();
  };

  const session: Session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      ...(systemInstruction ? { systemInstruction } : {}),
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks: {
      onopen: () => handlers.onOpen?.(),
      onmessage: onMessage,
      onerror: (e) => handlers.onError?.(e.message || "Error de conexión con Gemini Live"),
      onclose: () => handlers.onClose?.(),
    },
  });

  return {
    sendAudioChunk(chunk: ArrayBuffer) {
      session.sendRealtimeInput({
        media: { data: arrayBufferToBase64(chunk), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
      });
    },
    sendText(text: string) {
      session.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }] });
    },
    close() {
      session.close();
    },
  };
}
