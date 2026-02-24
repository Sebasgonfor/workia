"use client";

import { useState, useRef } from "react";
import { useSubjectDocuments } from "@/lib/hooks";
import { useAuth } from "@/lib/auth-context";
import { Confirm } from "@/components/ui/confirm";
import {
  FileText,
  ImageIcon,
  File,
  Upload,
  Trash2,
  X,
  ExternalLink,
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

const isPreviewable = (fileType: string): boolean =>
  fileType === "application/pdf" || fileType.startsWith("image/");

interface SubjectDocumentsProps {
  subjectId: string;
  subject: Subject | undefined;
}

export function SubjectDocuments({ subjectId, subject }: SubjectDocumentsProps) {
  const { user } = useAuth();
  const { documents, loading, addDocument, deleteDocument } = useSubjectDocuments(subjectId);

  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [preview, setPreview] = useState<SubjectDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Subir documento"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-95 transition-transform disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? "Subiendo..." : "Subir"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
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
                  onClick={() =>
                    isPreviewable(document.fileType)
                      ? setPreview(document)
                      : window.open(document.url, "_blank")
                  }
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
                    onClick={() => window.open(document.url, "_blank")}
                    className="w-8 h-8 rounded-lg flex items-center justify-center active:bg-secondary/60"
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
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
                aria-label="Abrir en nueva pestana"
                onClick={() => window.open(preview.url, "_blank")}
                className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center active:opacity-70"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                aria-label="Cerrar preview"
                onClick={() => setPreview(null)}
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
            ) : (
              <iframe
                src={preview.url}
                title={preview.name}
                className="w-full h-full border-0"
              />
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
