"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RotateCcw, Crop, SkipForward, Loader2 } from "lucide-react";
import { detectDocument, type DocumentCorners } from "@/lib/document-detection";

// ── Types ──

interface CornerPoint {
  x: number;
  y: number;
}

interface Corners {
  topLeft: CornerPoint;
  topRight: CornerPoint;
  bottomRight: CornerPoint;
  bottomLeft: CornerPoint;
}

interface CornerEditorProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  initialCorners: Corners | null;
  onConfirm: (corners: Corners | null) => void;
  onSkip: () => void;
}

// ── Constants ──

const HANDLE_RADIUS = 14;
const HANDLE_HIT_RADIUS = 28;
const CORNER_KEYS: (keyof Corners)[] = [
  "topLeft",
  "topRight",
  "bottomRight",
  "bottomLeft",
];

// ── Component ──

export type { Corners, CornerPoint };

export const CornerEditor = ({
  imageUrl,
  imageWidth,
  imageHeight,
  initialCorners,
  onConfirm,
  onSkip,
}: CornerEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [corners, setCorners] = useState<Corners | null>(initialCorners);
  const [dragging, setDragging] = useState<keyof Corners | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // Compute display dimensions preserving aspect ratio
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight - 80; // Reserve space for buttons
      const scale = Math.min(containerW / imageWidth, containerH / imageHeight);
      setDisplaySize({
        width: Math.round(imageWidth * scale),
        height: Math.round(imageHeight * scale),
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [imageWidth, imageHeight]);

  // Scale factor from display to original image coordinates
  const scaleX = displaySize.width > 0 ? imageWidth / displaySize.width : 1;
  const scaleY = displaySize.height > 0 ? imageHeight / displaySize.height : 1;

  // Convert image coords to display coords
  const toDisplay = useCallback(
    (p: CornerPoint) => ({
      x: p.x / scaleX,
      y: p.y / scaleY,
    }),
    [scaleX, scaleY]
  );

  // Convert display coords to image coords
  const toImage = useCallback(
    (x: number, y: number) => ({
      x: Math.round(x * scaleX),
      y: Math.round(y * scaleY),
    }),
    [scaleX, scaleY]
  );

  // Get pointer position relative to image display area
  const getPointerPos = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const imgEl = containerRef.current.querySelector(
        "[data-corner-image]"
      ) as HTMLElement;
      if (!imgEl) return { x: 0, y: 0 };
      const rect = imgEl.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  // Find which corner handle is near the pointer
  const findNearestCorner = useCallback(
    (px: number, py: number): keyof Corners | null => {
      if (!corners) return null;
      for (const key of CORNER_KEYS) {
        const dp = toDisplay(corners[key]);
        const dist = Math.hypot(px - dp.x, py - dp.y);
        if (dist <= HANDLE_HIT_RADIUS) return key;
      }
      return null;
    },
    [corners, toDisplay]
  );

  // ── Pointer handlers ──

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!corners) return;
      const pos = getPointerPos(e);
      const corner = findNearestCorner(pos.x, pos.y);
      if (!corner) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(corner);
    },
    [corners, getPointerPos, findNearestCorner]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !corners) return;
      e.preventDefault();
      const pos = getPointerPos(e);
      // Clamp to display bounds
      const clampedX = Math.max(0, Math.min(pos.x, displaySize.width));
      const clampedY = Math.max(0, Math.min(pos.y, displaySize.height));
      const imgCoords = toImage(clampedX, clampedY);

      setCorners((prev) =>
        prev ? { ...prev, [dragging]: imgCoords } : null
      );
    },
    [dragging, corners, getPointerPos, displaySize, toImage]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  // ── Auto-detect corners ──

  const handleAutoDetect = useCallback(async () => {
    setDetecting(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imageUrl;
      });

      const detected = await detectDocument(img);
      if (detected) {
        setCorners(detected);
      } else {
        // Default to full image corners if detection fails
        setCorners({
          topLeft: { x: 0, y: 0 },
          topRight: { x: imageWidth, y: 0 },
          bottomRight: { x: imageWidth, y: imageHeight },
          bottomLeft: { x: 0, y: imageHeight },
        });
      }
    } catch (err) {
      console.error("Auto-detect failed:", err);
    } finally {
      setDetecting(false);
    }
  }, [imageUrl, imageWidth, imageHeight]);

  // ── Render SVG overlay ──

  const renderOverlay = () => {
    if (!corners || displaySize.width === 0) return null;

    const points = CORNER_KEYS.map((k) => toDisplay(corners[k]));
    const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${displaySize.width} ${displaySize.height}`}
        style={{ width: displaySize.width, height: displaySize.height }}
      >
        {/* Semi-transparent fill */}
        <polygon
          points={polygonPoints}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="rgba(59, 130, 246, 0.8)"
          strokeWidth="2"
        />

        {/* Edge lines */}
        {points.map((p, i) => {
          const next = points[(i + 1) % 4];
          return (
            <line
              key={`line-${i}`}
              x1={p.x}
              y1={p.y}
              x2={next.x}
              y2={next.y}
              stroke="rgba(59, 130, 246, 0.8)"
              strokeWidth="2"
            />
          );
        })}

        {/* Corner handles */}
        {points.map((p, i) => (
          <g key={`handle-${i}`}>
            {/* Outer ring */}
            <circle
              cx={p.x}
              cy={p.y}
              r={HANDLE_RADIUS}
              fill="white"
              stroke="rgba(59, 130, 246, 1)"
              strokeWidth="2.5"
              className="drop-shadow-md"
            />
            {/* Inner dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill="rgba(59, 130, 246, 1)"
            />
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full"
      aria-label="Document corner editor"
    >
      {/* Image + overlay area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden relative">
        <div
          className="relative touch-none select-none"
          style={{ width: displaySize.width, height: displaySize.height }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-corner-image
            src={imageUrl}
            alt="Document to crop"
            className="w-full h-full object-contain rounded-lg"
            style={{ width: displaySize.width, height: displaySize.height }}
            draggable={false}
          />
          {renderOverlay()}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3 py-4 px-4">
        <button
          onClick={handleAutoDetect}
          disabled={detecting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
          aria-label="Auto-detect document corners"
          tabIndex={0}
        >
          {detecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          Auto-detectar
        </button>

        <button
          onClick={() => onConfirm(corners)}
          disabled={!corners}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
          aria-label="Crop document with selected corners"
          tabIndex={0}
        >
          <Crop className="w-4 h-4" />
          Recortar
        </button>

        <button
          onClick={onSkip}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium active:scale-[0.98] transition-transform"
          aria-label="Skip cropping for this image"
          tabIndex={0}
        >
          <SkipForward className="w-4 h-4" />
          Sin recorte
        </button>
      </div>
    </div>
  );
};
