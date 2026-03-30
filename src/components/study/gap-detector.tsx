"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AlertTriangle, Loader2, X, Search, GraduationCap, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { KnowledgeGap } from "@/types";

interface GapDetectorProps {
  content: string;
  subjectName: string;
  onOpenSocratic?: (topic: string) => void;
  onClose: () => void;
}

const severityConfig = {
  critical: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", label: "Critico", icon: "!!" },
  moderate: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", label: "Moderado", icon: "!" },
  minor: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", label: "Menor", icon: "i" },
};

export function GapDetector({ content, subjectName, onOpenSocratic, onClose }: GapDetectorProps) {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [error, setError] = useState(false);
  const detectedRef = useRef(false);

  const detectGaps = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/gaps/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, subjectName }),
      });
      const data = await res.json();
      if (data.success && data.data?.gaps) {
        setGaps(data.data.gaps);
      } else {
        toast.error("Error al detectar gaps");
      }
    } catch {
      toast.error("Error de conexion");
      setError(true);
    } finally {
      setLoading(false);
      setAnalyzed(true);
    }
  }, [content, subjectName]);

  useEffect(() => {
    if (!detectedRef.current) {
      detectedRef.current = true;
      detectGaps();
    }
  }, [detectGaps]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-white">Detector de Gaps</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="text-sm text-zinc-400">Analizando tus apuntes en busca de gaps...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-white font-medium">Error al analizar</p>
            <p className="text-sm text-zinc-400 text-center max-w-xs">
              No se pudieron detectar los gaps. Revisa tu conexion e intenta de nuevo.
            </p>
            <button
              onClick={() => {
                detectedRef.current = false;
                setError(false);
                detectGaps();
              }}
              className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/15 transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Reintentar
            </button>
          </div>
        ) : gaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-white font-medium">Sin gaps detectados</p>
            <p className="text-sm text-zinc-400 text-center max-w-xs">
              Tus apuntes parecen cubrir los conceptos principales de manera completa.
            </p>
          </div>
        ) : (
          <div className="max-w-lg mx-auto space-y-3">
            <p className="text-sm text-zinc-400 mb-4">
              Se encontraron <span className="text-white font-medium">{gaps.length} gaps</span> en tus apuntes
            </p>
            {gaps.map((gap, i) => {
              const config = severityConfig[gap.severity];
              return (
                <div key={i} className={`${config.bg} border ${config.border} rounded-xl p-4`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-white font-medium flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full ${config.bg} ${config.text} flex items-center justify-center text-xs font-bold`}>
                        {config.icon}
                      </span>
                      {gap.topic}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 mb-3">{gap.description}</p>
                  <div className="bg-black/20 rounded-lg p-3 mb-3">
                    <p className="text-xs text-zinc-500 mb-1">Sugerencia</p>
                    <p className="text-sm text-zinc-300">{gap.suggestion}</p>
                  </div>
                  {onOpenSocratic && (
                    <button
                      onClick={() => onOpenSocratic(gap.topic)}
                      className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <GraduationCap className="w-4 h-4" />
                      Profundizar con Tutor Socratico
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
