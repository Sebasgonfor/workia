"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Link2, Loader2, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Connection {
  sourceClass: string;
  sourceConcept: string;
  targetClass: string;
  targetConcept: string;
  relationship: string;
  explanation: string;
  strength: number;
}

interface ConnectionsPanelProps {
  entries: Array<{ classTitle: string; subjectName: string; content: string }>;
  onClose: () => void;
}

const relationshipLabels: Record<string, { label: string; color: string }> = {
  prerequisito: { label: "Prerequisito", color: "#ef4444" },
  aplicacion: { label: "Aplicacion", color: "#3b82f6" },
  analogia: { label: "Analogia", color: "#8b5cf6" },
  extension: { label: "Extension", color: "#10b981" },
  contraste: { label: "Contraste", color: "#f59e0b" },
  complemento: { label: "Complemento", color: "#06b6d4" },
};

export function ConnectionsPanel({ entries, onClose }: ConnectionsPanelProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const findConnections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connections/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (data.success && data.data?.connections) {
        setConnections(data.data.connections);
      } else {
        toast.error("Error al buscar conexiones");
      }
    } catch {
      toast.error("Error de conexion");
    } finally {
      setLoading(false);
    }
  }, [entries]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      findConnections();
    }
  }, [findConnections]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-white">Conexiones entre Apuntes</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm text-zinc-400">Analizando conexiones entre tus apuntes...</p>
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Link2 className="w-10 h-10 text-zinc-600" />
            <p className="text-white font-medium">Sin conexiones encontradas</p>
            <p className="text-sm text-zinc-400 text-center max-w-xs">
              Agrega mas apuntes a diferentes clases para descubrir conexiones.
            </p>
          </div>
        ) : (
          <div className="max-w-lg mx-auto space-y-3">
            <p className="text-sm text-zinc-400 mb-4">
              <span className="text-white font-medium">{connections.length} conexiones</span> encontradas entre tus apuntes
            </p>
            {connections.map((conn, i) => {
              const rel = relationshipLabels[conn.relationship] || { label: conn.relationship, color: "#6b7280" };
              return (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: rel.color + "20", color: rel.color }}
                    >
                      {rel.label}
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[10px] text-zinc-500">
                      {Math.round(conn.strength * 100)}%
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-zinc-500 mb-0.5">{conn.sourceClass}</p>
                      <p className="text-sm text-white font-medium">{conn.sourceConcept}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0 mt-3" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-zinc-500 mb-0.5">{conn.targetClass}</p>
                      <p className="text-sm text-white font-medium">{conn.targetConcept}</p>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 mt-3 pt-3 border-t border-white/5">
                    {conn.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
