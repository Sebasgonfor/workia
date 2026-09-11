/**
 * AudioWorklet que corre en el hilo de audio: convierte el Float32 que
 * entrega el navegador a PCM16 (lo que espera Gemini Live) y lo manda al
 * hilo principal por `port.postMessage`, en chunks pequeños para no
 * introducir latencia perceptible.
 *
 * Ver src/components/voice-agent.tsx (quien lo registra) y
 * src/lib/ai/live/gemini-live.ts (INPUT_SAMPLE_RATE = 16000 — el
 * `AudioContext` que crea este worklet debe abrirse a esa misma tasa).
 */
class PcmRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    const channel = input?.[0];
    if (!channel || channel.length === 0) return true;

    const pcm16 = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const clamped = Math.max(-1, Math.min(1, channel[i]));
      pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}

registerProcessor("pcm-recorder", PcmRecorderProcessor);
