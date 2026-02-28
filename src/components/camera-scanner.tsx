"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { X, Camera, ImagePlus, Loader2, Check } from "lucide-react";
import { loadOpenCV } from "@/lib/opencv-loader";
import {
  detectDocument,
  correctPerspective,
  areCornersStable,
  drawDetectionOverlay,
  matToBase64,
  matToBlob,
  type Point,
} from "@/lib/document-detection";

export interface CapturedImage {
  blob: Blob;
  preview: string;
  width: number;
  height: number;
}

interface CameraScannerProps {
  onCapture: (images: CapturedImage[]) => void;
  onClose: () => void;
}

export function CameraScanner({ onCapture, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [cvReady, setCvReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<"none" | "detecting" | "stable">(
    "none"
  );

  const stableCountRef = useRef(0);
  const lastCornersRef = useRef<Point[] | null>(null);
  const currentCornersRef = useRef<Point[] | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastDetectTimeRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Init: load OpenCV + start camera ──
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await loadOpenCV();
        if (!mounted) return;
        setCvReady(true);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            if (mounted) {
              setCameraReady(true);
              setLoading(false);
            }
          };
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Error al iniciar camara"
          );
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // ── Detection loop (10fps via requestAnimationFrame) ──
  useEffect(() => {
    if (!cvReady || !cameraReady) return;

    const cv = (window as any).cv;
    let running = true;

    const detectLoop = (timestamp: number) => {
      if (!running) return;

      // Limit to ~10fps
      if (timestamp - lastDetectTimeRef.current >= 100) {
        lastDetectTimeRef.current = timestamp;
        runDetection(cv);
      }

      animFrameRef.current = requestAnimationFrame(detectLoop);
    };

    animFrameRef.current = requestAnimationFrame(detectLoop);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cvReady, cameraReady]);

  const runDetection = useCallback(
    (cv: any) => {
      if (
        capturing ||
        !videoRef.current ||
        !processCanvasRef.current ||
        !overlayCanvasRef.current
      )
        return;

      const video = videoRef.current;
      const canvas = processCanvasRef.current;
      const overlay = overlayCanvasRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      // Process at reduced resolution for performance
      const DETECT_WIDTH = 640;
      const scale = DETECT_WIDTH / video.videoWidth;
      const detectHeight = Math.round(video.videoHeight * scale);

      canvas.width = DETECT_WIDTH;
      canvas.height = detectHeight;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, DETECT_WIDTH, detectHeight);

      // Run OpenCV detection
      let corners: Point[] | null = null;
      try {
        const src = cv.imread(canvas);
        corners = detectDocument(cv, src);
        src.delete();
      } catch {
        // OpenCV error, skip this frame
      }

      // Scale corners back to video resolution
      if (corners) {
        corners = corners.map((c) => ({
          x: Math.round(c.x / scale),
          y: Math.round(c.y / scale),
        }));
      }

      currentCornersRef.current = corners;

      // Draw overlay
      const oCtx = overlay.getContext("2d")!;
      const displayScaleX = overlay.clientWidth / video.videoWidth;
      const displayScaleY = overlay.clientHeight / video.videoHeight;

      drawDetectionOverlay(
        oCtx,
        corners,
        overlay.width,
        overlay.height,
        displayScaleX,
        displayScaleY
      );

      // Check stability for auto-capture
      if (corners && lastCornersRef.current) {
        if (areCornersStable(corners, lastCornersRef.current, 20)) {
          stableCountRef.current++;
          if (stableCountRef.current >= 7) {
            // ~700ms stable
            setStatus("stable");
            captureFrame(cv);
            stableCountRef.current = 0;
          } else if (stableCountRef.current >= 3) {
            setStatus("stable");
          } else {
            setStatus("detecting");
          }
        } else {
          stableCountRef.current = 0;
          setStatus("detecting");
        }
      } else if (corners) {
        setStatus("detecting");
        stableCountRef.current = 0;
      } else {
        setStatus("none");
        stableCountRef.current = 0;
      }

      lastCornersRef.current = corners;
    },
    [capturing]
  );

  // ── Capture current frame ──
  const captureFrame = useCallback(
    async (cvOverride?: any) => {
      if (capturing || !videoRef.current || !processCanvasRef.current) return;
      setCapturing(true);

      try {
        const cv = cvOverride || (window as any).cv;
        const video = videoRef.current;

        // Capture at full resolution
        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = video.videoWidth;
        fullCanvas.height = video.videoHeight;
        const fCtx = fullCanvas.getContext("2d")!;
        fCtx.drawImage(video, 0, 0);

        const src = cv.imread(fullCanvas);
        const corners = detectDocument(cv, src);

        let preview: string;
        let blob: Blob;
        let width: number;
        let height: number;

        if (corners) {
          const result = correctPerspective(cv, src, corners);
          preview = matToBase64(cv, result.mat);
          blob = await matToBlob(cv, result.mat);
          width = result.width;
          height = result.height;
          result.mat.delete();
        } else {
          preview = fullCanvas.toDataURL("image/jpeg", 0.92);
          blob = await new Promise<Blob>((res) =>
            fullCanvas.toBlob((b) => res(b!), "image/jpeg", 0.92)
          );
          width = fullCanvas.width;
          height = fullCanvas.height;
        }

        src.delete();

        setCapturedImages((prev) => [
          ...prev,
          { blob, preview, width, height },
        ]);

        // Reset stability
        stableCountRef.current = 0;
        lastCornersRef.current = null;
      } finally {
        setCapturing(false);
      }
    },
    [capturing]
  );

  const handleManualCapture = useCallback(() => {
    captureFrame();
  }, [captureFrame]);

  const removeCapture = useCallback((index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDone = useCallback(() => {
    // Stop camera
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    onCapture(capturedImages);
  }, [capturedImages, onCapture]);

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    onClose();
  }, [onClose]);

  // ── Overlay canvas resize ──
  useEffect(() => {
    if (!videoRef.current || !overlayCanvasRef.current) return;

    const resizeOverlay = () => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      overlay.width = overlay.clientWidth;
      overlay.height = overlay.clientHeight;
    };

    resizeOverlay();
    window.addEventListener("resize", resizeOverlay);
    return () => window.removeEventListener("resize", resizeOverlay);
  }, [cameraReady]);

  // ── Render ──

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
        <p className="text-white/80 text-sm">Cargando escaner...</p>
        <p className="text-white/40 text-xs">
          Primera vez puede tomar unos segundos
        </p>
        <button
          onClick={handleClose}
          className="mt-4 px-4 py-2 text-white/60 text-sm"
        >
          Cancelar
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-4 px-8">
        <Camera className="w-12 h-12 text-white/40" />
        <p className="text-white text-sm text-center">
          No se pudo acceder a la camara
        </p>
        <p className="text-white/50 text-xs text-center">{error}</p>
        <button
          onClick={handleClose}
          className="mt-4 px-6 py-2.5 rounded-xl bg-white/10 text-white text-sm"
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-safe flex justify-between items-center h-14">
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm">
          <span className="text-white text-xs font-medium">
            {status === "stable"
              ? "Documento detectado"
              : status === "detecting"
                ? "Detectando..."
                : "Apunta al documento"}
          </span>
        </div>
        <div className="w-10" />
      </div>

      {/* Camera feed + overlay */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {/* Hidden canvas for OpenCV processing */}
        <canvas ref={processCanvasRef} className="hidden" />

        {/* Capture flash */}
        {capturing && (
          <div className="absolute inset-0 bg-white/30 animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black/80 backdrop-blur-sm pb-safe">
        {/* Captured images strip */}
        {capturedImages.length > 0 && (
          <div className="px-4 pt-3 pb-2 flex items-center gap-3">
            <div className="flex gap-2 overflow-x-auto flex-1">
              {capturedImages.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img
                    src={img.preview}
                    alt={`Captura ${i + 1}`}
                    className="w-14 h-14 rounded-lg object-cover border border-white/20"
                  />
                  <button
                    onClick={() => removeCapture(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <span className="absolute bottom-0.5 left-0.5 px-1 rounded text-[9px] font-bold bg-black/60 text-white">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={handleDone}
              className="shrink-0 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Listo ({capturedImages.length})
            </button>
          </div>
        )}

        {/* Capture button row */}
        <div className="px-4 py-4 flex items-center justify-center gap-10">
          {/* Gallery button placeholder (left) */}
          <div className="w-10" />

          {/* Main capture button */}
          <button
            onClick={handleManualCapture}
            disabled={capturing}
            className="relative w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          >
            <div
              className={`w-[58px] h-[58px] rounded-full transition-colors ${
                status === "stable" ? "bg-blue-500" : "bg-white"
              }`}
            />
            {/* Stability progress ring */}
            {status === "detecting" && (
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 72 72"
              >
                <circle
                  cx="36"
                  cy="36"
                  r="33"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeDasharray={`${(stableCountRef.current / 7) * 207} 207`}
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>

          {/* Info (right) */}
          <div className="w-10 flex items-center justify-center">
            <span className="text-white/40 text-[10px] font-medium">AUTO</span>
          </div>
        </div>
      </div>
    </div>
  );
}
