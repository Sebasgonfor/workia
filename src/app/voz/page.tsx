"use client";

import { Mic } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { VoiceAgent } from "@/components/voice-agent";

export default function VozPage() {
  return (
    <AppShell>
      <div className="px-4 pt-6 pb-32 md:px-8 md:pt-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Mic className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tutor de voz</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Conversa en tiempo real con un tutor de IA
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border">
          <VoiceAgent systemInstruction="Eres un tutor universitario paciente y didáctico. Responde en español, con explicaciones claras y ejemplos concretos. Haz preguntas para verificar que el estudiante entendió." />
        </div>
      </div>
    </AppShell>
  );
}
