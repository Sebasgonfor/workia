"use client";

import { useState, useRef, useCallback } from "react";
import { useClassDocuments } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";
import { Confirm } from "@/components/ui/confirm";
import { downloadFile, fetchFileBlob } from "@/lib/file-helpers";
import {
  ImageIcon,
  FileText,
  File,
  Upload,
  Trash2,
  X,
  Download,
  Loader2,
  Camera,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import type { ClassDocument } from "@/types";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith("image/")) return ImageIcon;
  if (fileType === "application/pdf") return FileText;
  return File;
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface ClassDocumentsProps {
  subjectId: string;
  classId: string;
  color: string;
}

export function ClassDocuments({ subjectId, classId, color }: ClassDocumentsProps) {
  const { user } = useAuth();
  const { documents, loading, addDocument, deleteDocument } =
    useClassDocuments(subjectId, classId);

  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClassDocument | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewFallback, setPdfPreviewFallback] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = useCallback(async (doc: ClassDocument) => {
    if (downloadingId === doc.id || !doc.url) return;
    setDownloadingId(doc.id);
    try {
      await downloadFile(doc.url, doc.name, doc.fileType);
    } catch {
      toast.error("Error al descargar");
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId]);

  const handlePreview = useCallback(async (doc: ClassDocument) => {
    if (doc.fileType.startsWith("image/")) {
      setPdfPreviewUrl(null);
      setPdfPreviewFallback(false);
      setPdfLoading(false);
      setPreview(doc);
      return;
    }
    if (doc.fileType === "application/pdf") {
      setPreview(doc);
      setPdfPreviewUrl(null);
      setPdfPreviewFallback(false);
      setPdfLoading(true);
      try {
        const blob = await fetchFileBlob(doc.url, doc.name, "application/pdf");
        const objectUrl = URL.createObjectURL(blob);
        setPdfPreviewUrl(objectUrl);
      } catch {
        // Fallback: Google Docs Viewer
        setPdfPreviewFallback(true);
      } finally {
        setPdfLoading(false);
      }
      return;
    }
    window.open(doc.url, "_blank");
  }, []);

  const closePreview = useCallback(() => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setPdfPreviewFallback(false);
    setPdfLoading(false);
    setPreview(null);
  }, [pdfPreviewUrl]);

  const handleUpload = async (file: File) => {
    if (!user) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("El archivo no puede superar los 20 MB");
      return;
    }

    setUploading(true);
    try {
      const folder = `workia/${user.uid}/class-documents`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const isImage = file.type.startsWith("image/");
      const endpoint = isImage ? "/api/upload" : "/api/upload-document";

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");

      await addDocument({
        name: file.name,
        url: data.url,
        publicId: data.publicId,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
      });
      toast.success("Documento guardado");
    } catch {
      toast.error("Error al subir el documento");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await handleUpload(file);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await deleteDocument(id);
      toast.success("Documento eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const images = documents.filter((d) => d.fileType.startsWith("image/"));
  const otherFiles = documents.filter((d) => !d.fileType.startsWith("image/"));

  return (
    <>
      {/* Upload buttons */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {loading
            ? "\u00b7\u00b7\u00b7"
            : `${documents.length} documento${documents.length !== 1 ? "s" : ""}`}
        </p>
        <div className="flex items-center gap-2">
          <label
            aria-label="Tomar foto"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-sm font-medium active:scale-95 transition-transform cursor-pointer ${
              uploading ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <Camera className="w-4 h-4" />
            Foto
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
          <label
            aria-label="Subir archivo"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform cursor-pointer ${
              uploading ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading ? "Subiendo..." : "Subir"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm mb-1">Sin documentos aun</p>
          <p className="text-xs text-muted-foreground/60">
            Guarda fotos de apuntes y el tablero
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {/* Image grid */}
          {images.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Fotos ({images.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div key={img.id} className="relative group">
                    <button
                      onClick={() => handlePreview(img)}
                      className="w-full aspect-square rounded-xl overflow-hidden bg-card border border-border active:opacity-80"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <button
                      aria-label="Eliminar foto"
                      onClick={() => setDeleteId(img.id)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other files list */}
          {otherFiles.length > 0 && (
            <div>
              {images.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Archivos ({otherFiles.length})
                </p>
              )}
              <div className="space-y-2">
                {otherFiles.map((document) => {
                  const Icon = getFileIcon(document.fileType);
                  return (
                    <div
                      key={document.id}
                      className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color + "20" }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <button
                        onClick={() => handlePreview(document)}
                        className="flex-1 min-w-0 text-left active:opacity-70"
                      >
                        <p className="font-medium text-[14px] truncate">
                          {document.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatBytes(document.fileSize)}
                        </p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          aria-label="Descargar"
                          onClick={() => handleDownload(document)}
                          disabled={downloadingId === document.id}
                          className="w-8 h-8 rounded-lg flex items-center justify-center active:bg-secondary/60 disabled:opacity-50"
                        >
                          {downloadingId === document.id ? (
                            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        <button
                          aria-label="Eliminar documento"
                          onClick={() => setDeleteId(document.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center active:bg-secondary/60"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 pt-safe pb-3 border-b border-border shrink-0">
            <p className="font-semibold text-sm truncate flex-1 mr-2">
              {preview.name}
            </p>
            <div className="flex items-center gap-2">
              <button
                aria-label="Descargar"
                onClick={() => handleDownload(preview)}
                className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center active:opacity-70"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                aria-label="Cerrar preview"
                onClick={closePreview}
                className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center active:opacity-70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {preview.fileType.startsWith("image/") ? (
              <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="max-w-full max-h-full object-contain rounded-xl"
                />
              </div>
            ) : preview.fileType === "application/pdf" ? (
              pdfLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  title={preview.name}
                  className="w-full h-full border-0"
                />
              ) : pdfPreviewFallback ? (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(preview.url)}&embedded=true`}
                  title={preview.name}
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground text-sm">
                  <p>No se pudo previsualizar el PDF</p>
                  <button
                    onClick={() => handleDownload(preview)}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform"
                  >
                    Descargar archivo
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No se puede previsualizar este archivo
              </div>
            )}
          </div>
        </div>
      )}

      <Confirm
        open={!!deleteId}
        title="Eliminar documento"
        message="Esta accion no se puede deshacer."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
