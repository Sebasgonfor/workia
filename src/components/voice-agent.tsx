"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, AlertTriangle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { authHeader } from "@/lib/ai/client-auth-header";
import {
  connectLiveSession,
  INPUT_SAMPLE_RATE,
  OUTPUT_SAMPLE_RATE,
  type LiveSession,
} from "@/lib/ai/live/gemini-live";

type AgentState = "idle" | "connecting" | "listening" | "speaking" | "error";

/**
 * Tutor de voz en tiempo real (Gemini Live API). Requiere que el usuario
 * tenga su propia key de Gemini conectada (ver Perfil → BYOK) — el tutor
 * de voz no corre contra la key compartida del servidor.
 *
 * Ver specs/08-voice-agent-byok.md, Fase 6.
 */
export function VoiceAgent({ systemInstruction }: { systemInstruction?: string }) {
  const [state, setState] = useState<AgentState>("idle");
  const [hasKeyChecked, setHasKeyChecked] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputCaption, setInputCaption] = useState("");
  const [outputCaption, setOutputCaption] = useState("");

  const sessionRef = useRef<LiveSession | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playheadRef = useRef(0);

  // ¿El usuario tiene key BYOK conectada? Sin eso no hay tutor de voz.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/user-key", { headers: await authHeader() });
        const data = await res.json();
        if (!cancelled) setHasKey(Boolean(data.hasKey));
      } catch {
        if (!cancelled) setHasKey(false);
      } finally {
        if (!cancelled) setHasKeyChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Reproduce un chunk PCM16 (24kHz) encolándolo justo después del anterior. */
  const playAudioChunk = useCallback((chunk: ArrayBuffer) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    const pcm16 = new Int16Array(chunk);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, playheadRef.current);
    source.start(startAt);
    playheadRef.current = startAt + buffer.duration;

    setState("speaking");
    source.onended = () => {
      // Si no queda nada más encolado, volvemos a "listening".
      if (playheadRef.current <= ctx.currentTime + 0.05) setState("listening");
    };
  }, []);

  const stopMic = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    inputCtxRef.current?.close().catch(() => {});
    inputCtxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopMic();
    sessionRef.current?.close();
    sessionRef.current = null;
    outputCtxRef.current?.close().catch(() => {});
    outputCtxRef.current = null;
    playheadRef.current = 0;
    setState("idle");
    setInputCaption("");
    setOutputCaption("");
  }, [stopMic]);

  useEffect(() => stop, [stop]); // cleanup al desmontar

  const start = useCallback(async () => {
    setErrorMsg(null);
    setState("connecting");
    try {
      const tokenRes = await fetch("/api/ai/live-token", {
        method: "POST",
        headers: await authHeader(),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error || "No se pudo iniciar la sesión de voz");

      outputCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      playheadRef.current = 0;

      const session = await connectLiveSession({
        ephemeralToken: tokenData.token,
        systemInstruction,
        handlers: {
          onOpen: () => setState("listening"),
          onAudio: playAudioChunk,
          onInputTranscript: (text) => setInputCaption(text),
          onOutputTranscript: (text) => setOutputCaption((prev) => prev + text),
          onInterrupted: () => {
            // El usuario habló encima del agente: vaciar lo encolado y volver a escuchar.
            playheadRef.current = outputCtxRef.current?.currentTime ?? 0;
            setOutputCaption("");
            setState("listening");
          },
          onTurnComplete: () => setOutputCaption(""),
          onError: (message) => {
            setErrorMsg(message);
            setState("error");
            toast.error(message);
          },
          onClose: () => setState((s) => (s === "error" ? s : "idle")),
        },
      });
      sessionRef.current = session;

      // Captura de mic → worklet → PCM16 → sendAudioChunk
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: INPUT_SAMPLE_RATE, echoCancellation: true, noiseSuppression: true },
      });
      micStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      inputCtxRef.current = inputCtx;
      await inputCtx.audioWorklet.addModule("/audio/pcm-recorder-worklet.js");

      const source = inputCtx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(inputCtx, "pcm-recorder");
      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        sessionRef.current?.sendAudioChunk(e.data);
      };
      source.connect(worklet);
      workletNodeRef.current = worklet;
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo conectar el tutor de voz";
      setErrorMsg(message);
      setState("error");
      toast.error(message);
      stop();
    }
  }, [playAudioChunk, stop, systemInstruction]);

  if (!hasKeyChecked) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <KeyRound className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground max-w-xs">
          Conecta tu propia API key de Gemini en Perfil para usar el tutor de voz — el audio en
          tiempo real corre contra tu cuota, no la del servidor.
        </p>
      </div>
    );
  }

  const isActive = state === "listening" || state === "speaking" || state === "connecting";

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <button
        onClick={isActive ? stop : start}
        disabled={state === "connecting"}
        aria-label={isActive ? "Detener tutor de voz" : "Iniciar tutor de voz"}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
          state === "listening"
            ? "bg-primary text-primary-foreground animate-pulse"
            : state === "speaking"
              ? "bg-violet-500 text-white"
              : state === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-foreground"
        }`}
      >
        {state === "connecting" ? (
          <Loader2 className="w-8 h-8 animate-spin" />
        ) : isActive ? (
          <Mic className="w-8 h-8" />
        ) : (
          <MicOff className="w-8 h-8" />
        )}
      </button>

      <p className="text-sm text-muted-foreground">
        {state === "idle" && "Toca para hablar con tu tutor"}
        {state === "connecting" && "Conectando…"}
        {state === "listening" && "Escuchando…"}
        {state === "speaking" && "Respondiendo…"}
        {state === "error" && "Hubo un error"}
      </p>

      {(inputCaption || outputCaption) && (
        <div className="w-full max-w-sm text-xs text-center space-y-1 text-muted-foreground">
          {inputCaption && <p>Tú: {inputCaption}</p>}
          {outputCaption && <p className="text-foreground">{outputCaption}</p>}
        </div>
      )}

      {state === "error" && errorMsg && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 max-w-sm">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <span className="text-[11px] text-destructive break-words">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
