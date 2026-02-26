"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, ImagePlus, BookOpen, Loader2, Sparkles, X, Trash2, FileText } from "lucide-react";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { Sheet } from "@/components/ui/sheet";
import { useDynamicBoard } from "@/lib/hooks";
import { uploadScanImage } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import type { BoardEntry } from "@/types";
import { toast } from "sonner";

class ApiError extends Error {}

interface DynamicBoardTabProps {
  subjectId: string;
  classId: string;
  subjectName: string;
  color: string;
  boardEntries: BoardEntry[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "ahora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days}d`
    : date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export function DynamicBoardTab({
  subjectId,
  classId,
  subjectName,
  color,
  boardEntries,
}: DynamicBoardTabProps) {
  const { user } = useAuth();
  const { board, loading, saveBoard, clearBoard } = useDynamicBoard(subjectId, classId);

  const [pendingImages, setPendingImages] = useState<{ url: string; file: File }[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const notesEntries = boardEntries.filter(
    (e) => e.type === "notes" && e.content.trim().length > 30
  );

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({ url: URL.createObjectURL(file), file }));
    setPendingImages((prev) => [...prev, ...next]);
  };

  const removePending = (idx: number) => {
    setPendingImages((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleEnrich = useCallback(
    async (importEntryIds?: Set<string>) => {
      const hasImages = pendingImages.length > 0;
      const hasImport = importEntryIds && importEntryIds.size > 0;
      if (!hasImages && !hasImport) {
        toast.error("Agrega fotos o importa notas primero");
        return;
      }

      setProcessing(true);
      const toastId = toast.loading("La IA está enriqueciendo el tablero...");

      try {
        // Upload source images (non-blocking, best effort)
        const uploadedUrls: string[] = [];
        if (user && pendingImages.length > 0) {
          for (let i = 0; i < pendingImages.length; i++) {
            try {
              const url = await uploadScanImage(user.uid, pendingImages[i].file, i);
              uploadedUrls.push(url);
            } catch { /* skip failed */ }
          }
        }

        const base64Images = await Promise.all(
          pendingImages.map((img) => fileToBase64(img.file))
        );

        const importNotes = importEntryIds
          ? boardEntries.filter((e) => importEntryIds.has(e.id)).map((e) => e.content)
          : [];

        const response = await fetch("/api/dynamic-board/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            existingContent: board?.content || "",
            newImages: base64Images,
            existingNotes: importNotes,
            subjectName,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) throw new ApiError(data.error || "Error al enriquecer");

        await saveBoard(data.data.content, uploadedUrls);

        pendingImages.forEach((img) => URL.revokeObjectURL(img.url));
        setPendingImages([]);
        setSelectedIds(new Set());
        setShowImport(false);

        toast.dismiss(toastId);
        toast.success("¡Tablero actualizado!");
      } catch (err) {
        toast.dismiss(toastId);
        toast.error(err instanceof ApiError ? err.message : "Error al enriquecer el tablero");
      } finally {
        setProcessing(false);
      }
    },
    [pendingImages, board, boardEntries, subjectName, user, saveBoard]
  );

  const handleImportConfirm = () => {
    if (selectedIds.size === 0) { toast.error("Selecciona al menos una nota"); return; }
    handleEnrich(selectedIds);
  };

  if (loading) {
    return (
      <div className="space-y-3 mt-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 pb-36">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Board content or empty state */}
      {board?.content ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color }} />
              <span className="text-[11px] font-semibold" style={{ color }}>
                Tablero dinámico
              </span>
              <span className="text-[11px] text-muted-foreground">
                · {timeAgo(board.updatedAt)}
              </span>
            </div>
            <button
              onClick={() => setConfirmClear(true)}
              aria-label="Limpiar tablero"
              className="w-7 h-7 rounded-full bg-secondary/60 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="p-4 rounded-2xl bg-card border border-border">
            <MarkdownMath content={board.content} />
          </div>
          {board.sourceImages.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              {board.sourceImages.length} foto
              {board.sourceImages.length !== 1 ? "s" : ""} fuente
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: color + "20" }}
          >
            <Sparkles className="w-7 h-7" style={{ color }} />
          </div>
          <p className="font-semibold mb-1">Tablero dinámico vacío</p>
          <p className="text-xs text-muted-foreground/70 max-w-[260px] mx-auto">
            Agrega fotos de tus apuntes o importa notas existentes y la IA construirá un
            tablero de conocimiento enriquecido para esta clase
          </p>
        </div>
      )}

      {/* Pending images strip */}
      {pendingImages.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {pendingImages.length} foto{pendingImages.length !== 1 ? "s" : ""} pendiente
            {pendingImages.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt="foto pendiente"
                  className="w-16 h-16 rounded-xl object-cover border border-border"
                />
                <button
                  onClick={() => removePending(idx)}
                  aria-label="Quitar foto"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+4rem)] left-0 right-0 px-4 z-30">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl p-3 shadow-lg">
          {pendingImages.length > 0 && (
            <button
              onClick={() => handleEnrich()}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-primary-foreground font-semibold text-sm mb-2.5 active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{ backgroundColor: color }}
              aria-label="Enriquecer tablero con IA"
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Enriqueciendo...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Enriquecer con IA</>
              )}
            </button>
          )}
          <div className={`grid gap-2 ${notesEntries.length > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={processing}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-secondary text-foreground text-xs font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              aria-label="Tomar foto"
            >
              <Camera className="w-4 h-4" /> Cámara
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-secondary text-foreground text-xs font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              aria-label="Subir fotos"
            >
              <ImagePlus className="w-4 h-4" /> Galería
            </button>
            {notesEntries.length > 0 && (
              <button
                onClick={() => { setSelectedIds(new Set()); setShowImport(true); }}
                disabled={processing}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-secondary text-foreground text-xs font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                aria-label="Importar notas"
              >
                <BookOpen className="w-4 h-4" /> Importar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Import notes sheet */}
      <Sheet
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Importar notas al tablero"
      >
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Selecciona las notas que quieres integrar en el tablero dinámico. La IA las
            fusionará con el contenido existente.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notesEntries.map((entry) => {
              const isSelected = selectedIds.has(entry.id);
              return (
                <button
                  key={entry.id}
                  onClick={() => toggleEntry(entry.id)}
                  aria-pressed={isSelected}
                  aria-label="Seleccionar nota"
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                    isSelected ? "border-primary bg-primary/5" : "border-border bg-secondary/30"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-primary-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <FileText className="w-3 h-3 shrink-0" style={{ color }} />
                      <span className="text-[11px] font-medium" style={{ color }}>
                        Apunte
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {entry.content.replace(/<[^>]+>/g, "").slice(0, 120)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            onClick={handleImportConfirm}
            disabled={selectedIds.size === 0 || processing}
            className="w-full py-3 rounded-xl text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
            style={{ backgroundColor: color }}
            aria-label="Confirmar importación"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Enriqueciendo...
              </span>
            ) : (
              `Importar ${selectedIds.size > 0 ? `${selectedIds.size} ` : ""}nota${selectedIds.size !== 1 ? "s" : ""}`
            )}
          </button>
        </div>
      </Sheet>

      {/* Clear confirmation overlay */}
      {confirmClear && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setConfirmClear(false)}
          />
          <div className="fixed inset-x-4 bottom-1/3 z-50 bg-card border border-border rounded-2xl p-5 shadow-xl max-w-sm mx-auto">
            <p className="font-semibold mb-1">Limpiar tablero</p>
            <p className="text-sm text-muted-foreground mb-4">
              Se borrará todo el contenido del tablero dinámico. Esta acción no se puede
              deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 py-2.5 rounded-xl bg-secondary font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await clearBoard();
                  setConfirmClear(false);
                  toast.success("Tablero limpiado");
                }}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-white font-medium text-sm"
              >
                Limpiar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
