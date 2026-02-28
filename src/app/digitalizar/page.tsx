"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Plus,
  FileText,
  Camera,
  ImagePlus,
  X,
  Loader2,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { Confirm } from "@/components/ui/confirm";
import {
  useDigitalizations,
  useSubjects,
  useClasses,
  useSubjectDocuments,
  useClassDocuments,
} from "@/lib/hooks";
import { DIGITALIZATION_FILTERS } from "@/types";
import type { DigitalizationFilter } from "@/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CameraScanner, type CapturedImage } from "@/components/camera-scanner";
import { loadOpenCV, isOpenCVLoaded } from "@/lib/opencv-loader";
import { processImageWithOpenCV } from "@/lib/document-detection";

type Step = "upload" | "processing" | "preview";

interface ProcessedImage {
  base64: string;
  width: number;
  height: number;
}

interface PreparedImage {
  blob: Blob;
  preview: string;
  width: number;
  height: number;
}

export default function DigitalizarPage() {
  const { digitalizations, loading, addDigitalization, deleteDigitalization } =
    useDigitalizations();
  const { subjects } = useSubjects();

  // Creation sheet
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState<Step>("upload");

  // Upload form state — images are now pre-processed (perspective-corrected)
  const [preparedImages, setPreparedImages] = useState<PreparedImage[]>([]);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<DigitalizationFilter>("auto");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    null
  );
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Processing / preview state
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [processingGallery, setProcessingGallery] = useState(false);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);

  // OpenCV state
  const [cvLoaded, setCvLoaded] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks that depend on selected IDs
  const { classes } = useClasses(selectedSubjectId);
  const { addDocument: addSubjectDoc } = useSubjectDocuments(selectedSubjectId);
  const { addDocument: addClassDoc } = useClassDocuments(
    selectedSubjectId,
    selectedClassId
  );

  // ── Preload OpenCV.js ──
  useEffect(() => {
    loadOpenCV()
      .then(() => setCvLoaded(true))
      .catch((err) => console.warn("OpenCV preload failed:", err));
  }, []);

  // ── Camera capture ──

  const handleCameraCapture = useCallback((images: CapturedImage[]) => {
    setShowCamera(false);
    setPreparedImages((prev) => [
      ...prev,
      ...images.map((img) => ({
        blob: img.blob,
        preview: img.preview,
        width: img.width,
        height: img.height,
      })),
    ]);
  }, []);

  // ── Gallery file select ──

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      e.target.value = "";

      setProcessingGallery(true);

      for (const file of files) {
        try {
          // Load image into an HTMLImageElement
          const img = await loadImageFromFile(file);

          // Resize for processing (max 2000px)
          const canvas = resizeToCanvas(img, 2000);

          if (isOpenCVLoaded()) {
            // Process with OpenCV: detect document + correct perspective
            const cv = (window as any).cv;
            const result = await processImageWithOpenCV(cv, canvas);
            setPreparedImages((prev) => [
              ...prev,
              {
                blob: result.blob,
                preview: result.preview,
                width: result.width,
                height: result.height,
              },
            ]);
          } else {
            // OpenCV not ready: use image as-is (server will just enhance)
            const blob = await canvasToBlob(canvas);
            const preview = canvas.toDataURL("image/jpeg", 0.85);
            setPreparedImages((prev) => [
              ...prev,
              {
                blob,
                preview,
                width: canvas.width,
                height: canvas.height,
              },
            ]);
          }
        } catch (err) {
          console.error("Error processing gallery image:", err);
          toast.error("Error al cargar imagen");
        }
      }

      setProcessingGallery(false);
    },
    []
  );

  const removeImage = useCallback((index: number) => {
    setPreparedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Process images (send to server for enhancement) ──

  const handleDigitalize = useCallback(async () => {
    if (preparedImages.length === 0 || !title.trim()) return;

    setStep("processing");

    try {
      const fd = new FormData();
      for (const img of preparedImages) {
        fd.append("images", img.blob, "photo.jpg");
      }
      fd.append("filter", filter);

      const res = await fetch("/api/digitalize", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar");

      setProcessedImages(data.images as ProcessedImage[]);
      setStep("preview");
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar las imagenes");
      setStep("upload");
    }
  }, [preparedImages, title, filter]);

  // ── Save flow ──

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "px" });

      for (let i = 0; i < processedImages.length; i++) {
        const img = processedImages[i];
        if (i > 0) pdf.addPage();
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / img.width, pageH / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        pdf.addImage(img.base64, "JPEG", x, y, w, h);
      }

      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], `${title.trim()}.pdf`, {
        type: "application/pdf",
      });

      const pdfFd = new FormData();
      pdfFd.append("file", pdfFile);
      pdfFd.append("folder", "workia/digitalizations");
      const pdfRes = await fetch("/api/upload-document", {
        method: "POST",
        body: pdfFd,
      });
      const pdfData = await pdfRes.json();
      if (!pdfRes.ok) throw new Error(pdfData.error);

      await addDigitalization({
        title: title.trim(),
        subjectId: selectedSubjectId,
        classSessionId: selectedClassId,
        sourceImages: [],
        pdfUrl: pdfData.url,
        pdfPublicId: pdfData.publicId,
        pageCount: processedImages.length,
        filter,
      });

      if (selectedSubjectId) {
        const docData = {
          name: `${title.trim()}.pdf`,
          url: pdfData.url,
          publicId: pdfData.publicId,
          fileType: "application/pdf",
          fileSize: pdfBlob.size,
        };
        if (selectedClassId) {
          addClassDoc(docData);
        } else {
          addSubjectDoc(docData);
        }
      }

      toast.success("Digitalizacion guardada");
      resetForm();
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }, [
    processedImages,
    title,
    filter,
    selectedSubjectId,
    selectedClassId,
    addDigitalization,
    addSubjectDoc,
    addClassDoc,
  ]);

  // ── Reset ──

  const resetForm = useCallback(() => {
    setPreparedImages([]);
    setTitle("");
    setFilter("auto");
    setSelectedSubjectId(null);
    setSelectedClassId(null);
    setProcessedImages([]);
    setStep("upload");
    setSaving(false);
  }, []);

  // ── Delete ──

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await deleteDigitalization(id);
      toast.success("Digitalizacion eliminada");
    } catch {
      toast.error("Error al eliminar");
    }
  }, [deleteId, deleteDigitalization]);

  // ── Helpers ──

  const getSubjectForDig = (subjectId: string | null) => {
    if (!subjectId) return null;
    return subjects.find((s) => s.id === subjectId) || null;
  };

  return (
    <AppShell>
      <div className="page-enter">
        {/* Header */}
        <div className="px-4 pt-safe pb-3 md:px-8 md:pt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold">Digitalizar</h1>
              {digitalizations.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary">
                  {digitalizations.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* History list */}
        <div className="px-4 pb-24 md:px-8">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[72px] rounded-xl bg-card animate-pulse"
                />
              ))}
            </div>
          ) : digitalizations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">
                Sin digitalizaciones aun
              </p>
              <p className="text-xs text-muted-foreground/60 mb-5">
                Escanea tus apuntes y conviertelos en PDF
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform"
              >
                <Camera className="w-4 h-4" />
                Digitalizar
              </button>
            </div>
          ) : (
            <div className="space-y-2 stagger-children md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0">
              {digitalizations.map((dig) => {
                const subject = getSubjectForDig(dig.subjectId);
                return (
                  <button
                    key={dig.id}
                    onClick={() => window.open(dig.pdfUrl, "_blank")}
                    className="w-full p-3.5 rounded-xl bg-card border border-border flex items-center gap-3 active:scale-[0.98] transition-transform text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[15px] truncate">
                        {dig.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {dig.pageCount}{" "}
                          {dig.pageCount === 1 ? "pagina" : "paginas"} &middot;{" "}
                          {format(dig.createdAt, "d MMM yyyy", { locale: es })}
                        </span>
                        {subject && (
                          <span
                            className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{
                              backgroundColor: subject.color + "20",
                              color: subject.color,
                            }}
                          >
                            {subject.emoji} {subject.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(dig.id);
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/60 active:bg-secondary/80 shrink-0 opacity-0 group-hover:opacity-100 md:opacity-100 touch-target"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* FAB */}
        {digitalizations.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform z-50 md:bottom-8 md:right-8"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Creation Sheet */}
      <Sheet
        open={showCreate}
        onClose={() => {
          if (step === "processing") return;
          setShowCreate(false);
          resetForm();
        }}
        title={
          step === "upload"
            ? "Nueva digitalizacion"
            : step === "processing"
              ? "Procesando"
              : "Vista previa"
        }
      >
        {/* ── Step: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Capture options: Camera + Gallery */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Imagenes
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowCamera(true)}
                  className="py-6 rounded-xl border-2 border-dashed border-border bg-secondary/50 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <Camera className="w-7 h-7 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Camara
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    Deteccion en vivo
                  </span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-6 rounded-xl border-2 border-dashed border-border bg-secondary/50 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <ImagePlus className="w-7 h-7 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Galeria
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    Seleccionar fotos
                  </span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Processing gallery indicator */}
            {processingGallery && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                <span className="text-xs text-primary font-medium">
                  Detectando documentos...
                </span>
              </div>
            )}

            {/* Image thumbnails grid */}
            {preparedImages.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {preparedImages.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img.preview}
                      alt={`Imagen ${index + 1}`}
                      className="w-full h-32 object-cover rounded-xl border border-border"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium">
                      {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Filter selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Filtro
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DIGITALIZATION_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filter === f.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                {DIGITALIZATION_FILTERS.find((f) => f.value === filter)
                  ?.description || ""}
              </p>
            </div>

            {/* Title input */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Titulo
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Apuntes Calculo - Clase 5"
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            {/* Subject dropdown */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Materia (opcional)
              </label>
              <select
                value={selectedSubjectId || ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setSelectedSubjectId(val);
                  setSelectedClassId(null);
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm"
              >
                <option value="">Sin materia</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.emoji} {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class dropdown */}
            {selectedSubjectId && classes.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Clase (opcional)
                </label>
                <select
                  value={selectedClassId || ""}
                  onChange={(e) =>
                    setSelectedClassId(e.target.value || null)
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm"
                >
                  <option value="">Sin clase</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} &mdash;{" "}
                      {format(c.date, "d MMM", { locale: es })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Digitalizar button */}
            <button
              onClick={handleDigitalize}
              disabled={preparedImages.length === 0 || !title.trim()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Digitalizar
            </button>
          </div>
        )}

        {/* ── Step: Processing ── */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">
              Mejorando imagenes...
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              Aplicando filtros de escaner
            </p>
          </div>
        )}

        {/* ── Step: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {processedImages.length}{" "}
              {processedImages.length === 1
                ? "imagen procesada"
                : "imagenes procesadas"}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {processedImages.map((img, index) => (
                <div key={index} className="relative">
                  <img
                    src={img.base64}
                    alt={`Procesada ${index + 1}`}
                    className="w-full h-40 object-cover rounded-xl border border-border"
                  />
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setProcessedImages([]);
                  setStep("upload");
                }}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Camera Scanner Overlay */}
      {showCamera && (
        <CameraScanner
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Confirm delete dialog */}
      <Confirm
        open={!!deleteId}
        title="Eliminar digitalizacion"
        message="Se eliminara esta digitalizacion permanentemente."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </AppShell>
  );
}

// ── Utility functions ──

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };
    img.src = URL.createObjectURL(file);
  });
}

function resizeToCanvas(img: HTMLImageElement, maxDim: number): HTMLCanvasElement {
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.85
    );
  });
}
