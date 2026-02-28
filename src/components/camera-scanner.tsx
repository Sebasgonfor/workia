"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { X, Camera, Loader2, Check } from "lucide-react";
import { processImage } from "@/lib/document-detection";

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

  const [cameraReady, setCameraReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [capturing, setCapturing] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);

  // ── Init camera (instant — no OpenCV loading) ──
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
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
    };
  }, []);

  // ── Capture current frame + detect & correct perspective ──
  const captureFrame = useCallback(async () => {
    if (capturing || !videoRef.current) return;
    setCapturing(true);

    try {
      const video = videoRef.current;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);

      // Detect document + correct perspective (pure JS, ~100-200ms)
      const result = await processImage(canvas);

      setCapturedImages((prev) => [
        ...prev,
        {
          blob: result.blob,
          preview: result.preview,
          width: result.width,
          height: result.height,
        },
      ]);
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  const removeCapture = useCallback((index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDone = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(capturedImages);
  }, [capturedImages, onCapture]);

  const handleClose = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  }, [onClose]);

  // ── Render ──

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
        <p className="text-white/80 text-sm">Iniciando camara...</p>
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
            {capturing ? "Procesando..." : "Apunta al documento"}
          </span>
        </div>
        <div className="w-10" />
      </div>

      {/* Camera feed */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Capture flash */}
        {capturing && (
          <div className="absolute inset-0 bg-white/30 pointer-events-none" />
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
          <div className="w-10" />

          {/* Main capture button */}
          <button
            onClick={captureFrame}
            disabled={capturing}
            className="relative w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          >
            <div
              className={`w-[58px] h-[58px] rounded-full transition-colors ${
                capturing ? "bg-blue-500" : "bg-white"
              }`}
            />
          </button>

          <div className="w-10" />
        </div>
      </div>
    </div>
  );
}
