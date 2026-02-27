"use client";

import { useState, useRef, useCallback } from "react";
import { useSubjectDocuments } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";
import { Confirm } from "@/components/ui/confirm";
import { downloadFile, fetchFileBlob, getSignedUrl } from "@/lib/file-helpers";
import {
  FileText,
  ImageIcon,
  File,
  Upload,
  Trash2,
  X,
  ExternalLink,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Subject, SubjectDocument } from "@/types";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const MSG_FILE_TOO_LARGE = "El archivo no puede superar los 20 MB";
const MSG_UPLOAD_SUCCESS = "Documento subido";
const MSG_UPLOAD_ERROR = "Error al subir el documento";
const MSG_DELETE_SUCCESS = "Documento eliminado";
const MSG_DELETE_ERROR = "Error al eliminar";
const MSG_DOWNLOAD_ERROR = "Error al descargar el documento";

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

interface SubjectDocumentsProps {
  subjectId: string;
  subject: Subject | undefined;
}

export function SubjectDocuments({ subjectId, subject }: SubjectDocumentsProps) {
  const { user } = useAuth();
  const { documents, loading, addDocument, deleteDocument } = useSubjectDocuments(subjectId);

  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<SubjectDocument | null>(null);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [pdfPreviewFallback, setPdfPreviewFallback] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = useCallback(async (doc: SubjectDocument) => {
    if (downloadingId === doc.id || !doc.url) return;
    setDownloadingId(doc.id);
    try {
      await downloadFile(doc.url, doc.name, doc.fileType);
    } catch {
      toast.error(MSG_DOWNLOAD_ERROR);
    } finally {
      setDownloadingId(null);
    }
  }, [downloadingId]);

  const handlePreview = useCallback(async (doc: SubjectDocument) => {
    if (doc.fileType.startsWith("image/")) {
      setPreview(doc);
      setPreviewFileUrl(null);
      setPdfPreviewFallback(false);
      setPreviewLoading(true);
      // Images uploaded as raw resources also need signed URLs
      try {
        const signedUrl = await getSignedUrl(doc.url);
        setPreviewFileUrl(signedUrl);
      } catch {
        // Fallback to original URL (works for image/ resource type uploads)
        setPreviewFileUrl(doc.url);
      } finally {
        setPreviewLoading(false);
      }
      return;
    }
    if (doc.fileType === "application/pdf") {
      setPreview(doc);
      setPreviewFileUrl(null);
      setPdfPreviewFallback(false);
      setPreviewLoading(true);
      try {
        const blob = await fetchFileBlob(doc.url, doc.name, "application/pdf");
        const objectUrl = URL.createObjectURL(blob);
        setPreviewFileUrl(objectUrl);
      } catch {
        // Fallback: Google Docs Viewer with signed URL
        try {
          const signedUrl = await getSignedUrl(doc.url);
          setPdfPreviewFallback(true);
          setPreviewFileUrl(signedUrl);
        } catch {
          setPdfPreviewFallback(true);
          setPreviewFileUrl(doc.url);
        }
      } finally {
        setPreviewLoading(false);
      }
      return;
    }
    // Other file types: get signed URL and open
    try {
      const signedUrl = await getSignedUrl(doc.url);
      window.open(signedUrl, "_blank");
    } catch {
      window.open(doc.url, "_blank");
    }
  }, []);

  const closePreview = useCallback(() => {
    if (previewFileUrl && previewFileUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewFileUrl);
    }
    setPreviewFileUrl(null);
    setPdfPreviewFallback(false);
    setPreviewLoading(false);
    setPreview(null);
  }, [previewFileUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";

    if (file.size > MAX_FILE_SIZE) {
      toast.error(MSG_FILE_TOO_LARGE);
      return;
    }

    setUploading(true);
    try {
      const folder = `workia/${user.uid}/documents`;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload-document", {
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
      toast.success(MSG_UPLOAD_SUCCESS);
    } catch {
      toast.error(MSG_UPLOAD_ERROR);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await deleteDocument(id);
      toast.success(MSG_DELETE_SUCCESS);
    } catch {
      toast.error(MSG_DELETE_ERROR);
    }
  };

  return (
    <>
      {/* Upload button */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {loading ? "\u00b7\u00b7\u00b7" : `${documents.length} documento${documents.length !== 1 ? "s" : ""}`}
        </p>
        <label
          aria-label="Subir documento"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}
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

      {/* List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm mb-1">Sin documentos aun</p>
          <p className="text-xs text-muted-foreground/60">Sube el primer documento</p>
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {documents.map((document) => {
            const Icon = getFileIcon(document.fileType);
            return (
              <div
                key={document.id}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: (subject?.color || "#6366f1") + "20" }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: subject?.color || "#6366f1" }}
                  />
                </div>

                <button
                  tabIndex={0}
                  aria-label={`Ver ${document.name}`}
                  onClick={() => handlePreview(document)}
                  className="flex-1 min-w-0 text-left active:opacity-70"
                >
                  <p className="font-medium text-[14px] truncate">{document.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(document.fileSize)}
                  </p>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    tabIndex={0}
                    aria-label="Abrir en nueva pestana"
                    onClick={async () => {
                      try {
                        const signedUrl = await getSignedUrl(document.url);
                        window.open(signedUrl, "_blank");
                      } catch {
                        window.open(document.url, "_blank");
                      }
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:bg-secondary/60"
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    tabIndex={0}
                    aria-label="Descargar documento"
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
                    tabIndex={0}
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
      )}

      {/* Inline preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 pt-safe pb-3 border-b border-border shrink-0">
            <p className="font-semibold text-sm truncate flex-1 mr-2">{preview.name}</p>
            <div className="flex items-center gap-2">
              <button
                aria-label="Descargar documento"
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
            {previewLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : preview.fileType.startsWith("image/") ? (
              <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewFileUrl || preview.url}
                  alt={preview.name}
                  className="max-w-full max-h-full object-contain rounded-xl"
                />
              </div>
            ) : preview.fileType === "application/pdf" ? (
              previewFileUrl && !pdfPreviewFallback ? (
                <iframe
                  src={previewFileUrl}
                  title={preview.name}
                  className="w-full h-full border-0"
                />
              ) : pdfPreviewFallback && previewFileUrl ? (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewFileUrl)}&embedded=true`}
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
