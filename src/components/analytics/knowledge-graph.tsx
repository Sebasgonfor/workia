"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2, Share2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import type { GraphNode, GraphEdge } from "@/types";

interface KnowledgeGraphProps {
  content: string;
  subjectName: string;
  subjectColor: string;
  onClose: () => void;
}

interface SimNode extends GraphNode {
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

export function KnowledgeGraph({ content, subjectName, subjectColor, onClose }: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{ nodeId: string | null; panning: boolean; lastX: number; lastY: number }>({
    nodeId: null, panning: false, lastX: 0, lastY: 0,
  });
  const animRef = useRef<number>(0);

  // Fetch graph data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/knowledge-graph/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, subjectName }),
        });
        const data = await res.json();
        if (data.success && data.data?.nodes) {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const simNodes: SimNode[] = data.data.nodes.map((n: GraphNode) => ({
            ...n,
            subjectColor,
            mastery: 50,
            x: w / 2 + (Math.random() - 0.5) * 300,
            y: h / 2 + (Math.random() - 0.5) * 300,
            vx: 0,
            vy: 0,
          }));
          setNodes(simNodes);
          setEdges(data.data.edges || []);
        } else {
          toast.error("Error al generar grafo");
        }
      } catch {
        toast.error("Error de conexion");
      } finally {
        setLoading(false);
      }
    })();
  }, [content, subjectName, subjectColor]);

  // Force simulation
  const simulate = useCallback(() => {
    setNodes((prev) => {
      const next = prev.map((n) => ({ ...n }));
      const k = 0.01; // spring constant
      const repulsion = 5000;
      const damping = 0.85;
      const centerX = (containerRef.current?.clientWidth || 800) / 2;
      const centerY = (containerRef.current?.clientHeight || 600) / 2;

      // Repulsion between all nodes
      for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) {
          const dx = next[j].x! - next[i].x!;
          const dy = next[j].y! - next[i].y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          next[i].vx -= fx;
          next[i].vy -= fy;
          next[j].vx += fx;
          next[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const source = next.find((n) => n.id === edge.source);
        const target = next.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x! - source.x!;
        const dy = target.y! - source.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = k * (dist - 150) * edge.strength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // Center gravity
      for (const node of next) {
        node.vx += (centerX - node.x!) * 0.001;
        node.vy += (centerY - node.y!) * 0.001;
        if (draggingRef.current.nodeId !== node.id) {
          node.vx *= damping;
          node.vy *= damping;
          node.x! += node.vx;
          node.y! += node.vy;
        }
      }

      return next;
    });
  }, [edges]);

  // Animation loop
  useEffect(() => {
    if (nodes.length === 0) return;

    const loop = () => {
      simulate();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animRef.current);
  }, [nodes.length > 0, simulate]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    for (const edge of edges) {
      const source = nodes.find((n) => n.id === edge.source);
      const target = nodes.find((n) => n.id === edge.target);
      if (!source || !target) continue;

      const isSelected = selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target);
      ctx.beginPath();
      ctx.moveTo(source.x!, source.y!);
      ctx.lineTo(target.x!, target.y!);
      ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)";
      ctx.lineWidth = edge.strength * 2;
      ctx.stroke();

      // Edge label
      if (isSelected) {
        const mx = (source.x! + target.x!) / 2;
        const my = (source.y! + target.y!) / 2;
        ctx.font = "10px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.textAlign = "center";
        ctx.fillText(edge.label, mx, my - 5);
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const connections = edges.filter((e) => e.source === node.id || e.target === node.id).length;
      const radius = 16 + connections * 3;
      const isSelected = selectedNode?.id === node.id;
      const isConnected = selectedNode && edges.some(
        (e) => (e.source === selectedNode.id && e.target === node.id) || (e.target === selectedNode.id && e.source === node.id)
      );
      const dimmed = selectedNode && !isSelected && !isConnected;

      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);
      ctx.fillStyle = dimmed ? "rgba(100,100,100,0.2)" : (isSelected ? subjectColor : subjectColor + "60");
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = subjectColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.font = `${isSelected ? "bold " : ""}12px system-ui`;
      ctx.fillStyle = dimmed ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.9)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Word wrap label
      const words = node.label.split(" ");
      if (words.length > 2) {
        const mid = Math.ceil(words.length / 2);
        ctx.fillText(words.slice(0, mid).join(" "), node.x!, node.y! - 6);
        ctx.fillText(words.slice(mid).join(" "), node.x!, node.y! + 8);
      } else {
        ctx.fillText(node.label, node.x!, node.y!);
      }
    }

    ctx.restore();
  });

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Mouse/Touch handlers
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left - offset.x) / zoom,
      y: (clientY - rect.top - offset.y) / zoom,
    };
  };

  const findNodeAt = (x: number, y: number) => {
    for (const node of [...nodes].reverse()) {
      const connections = edges.filter((e) => e.source === node.id || e.target === node.id).length;
      const radius = 16 + connections * 3;
      const dx = x - node.x!;
      const dy = y - node.y!;
      if (dx * dx + dy * dy < radius * radius) return node;
    }
    return null;
  };

  const handlePointerDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    const node = findNodeAt(pos.x, pos.y);
    if (node) {
      draggingRef.current = { nodeId: node.id, panning: false, lastX: e.clientX, lastY: e.clientY };
      setSelectedNode(node);
    } else {
      draggingRef.current = { nodeId: null, panning: true, lastX: e.clientX, lastY: e.clientY };
      setSelectedNode(null);
    }
  };

  const handlePointerMove = (e: React.MouseEvent) => {
    const d = draggingRef.current;
    if (d.nodeId) {
      const dx = (e.clientX - d.lastX) / zoom;
      const dy = (e.clientY - d.lastY) / zoom;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      setNodes((prev) =>
        prev.map((n) => n.id === d.nodeId ? { ...n, x: n.x! + dx, y: n.y! + dy, vx: 0, vy: 0 } : n)
      );
    } else if (d.panning) {
      setOffset((prev) => ({
        x: prev.x + e.clientX - d.lastX,
        y: prev.y + e.clientY - d.lastY,
      }));
      d.lastX = e.clientX;
      d.lastY = e.clientY;
    }
  };

  const handlePointerUp = () => {
    draggingRef.current = { nodeId: null, panning: false, lastX: 0, lastY: 0 };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5" style={{ color: subjectColor }} />
          <span className="font-semibold text-white">Mapa de Conocimiento</span>
          <span className="text-xs text-zinc-500">{subjectName}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.min(z + 0.2, 3))} className="p-2 rounded-lg hover:bg-white/10">
            <ZoomIn className="w-4 h-4 text-zinc-400" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))} className="p-2 rounded-lg hover:bg-white/10">
            <ZoomOut className="w-4 h-4 text-zinc-400" />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: subjectColor }} />
          <p className="text-sm text-zinc-400">Generando mapa de conocimiento...</p>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
          />

          {/* Selected node info */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 right-4 max-w-sm mx-auto p-4 rounded-xl bg-zinc-900/90 border border-white/10 backdrop-blur">
              <h3 className="text-white font-medium">{selectedNode.label}</h3>
              <div className="mt-2 flex flex-wrap gap-1">
                {edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e, i) => {
                    const otherId = e.source === selectedNode.id ? e.target : e.source;
                    const other = nodes.find((n) => n.id === otherId);
                    return (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-white/10 text-zinc-400">
                        {e.label} → {other?.label}
                      </span>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-3 left-3 text-xs text-zinc-500">
            <p>{nodes.length} conceptos · {edges.length} relaciones</p>
          </div>
        </div>
      )}
    </div>
  );
}
