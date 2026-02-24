"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BookOpen, Sparkles, ScanLine, Bell } from "lucide-react";

export default function Home() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.replace("/inicio");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="flex flex-col min-h-screen px-6 py-12 pt-safe">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <BookOpen className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Workia</h1>
        <p className="text-muted-foreground text-lg mb-10">
          Tu asistente académico inteligente
        </p>

        {/* Features */}
        <div className="w-full space-y-4 mb-12">
          {[
            {
              icon: ScanLine,
              title: "Escanea tu cuaderno",
              desc: "La IA extrae tareas y organiza apuntes",
            },
            {
              icon: Sparkles,
              title: "Apuntes enriquecidos",
              desc: "Complementa y estructura con inteligencia artificial",
            },
            {
              icon: Bell,
              title: "Nunca olvides una tarea",
              desc: "Notificaciones inteligentes antes de cada entrega",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-4 text-left p-4 rounded-xl bg-card border border-border"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-muted-foreground text-sm">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sign in button */}
      <button
        onClick={signInWithGoogle}
        className="w-full py-4 px-6 rounded-xl bg-white text-black font-semibold text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continuar con Google
      </button>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Tus datos quedan seguros en tu cuenta de Google
      </p>
    </div>
  );
}
