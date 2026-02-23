"use client";

import { useState, useRef, useMemo } from "react";
import { Camera, ImagePlus, X, Sparkles, FileText, CheckSquare } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useSubjects, useClasses } from "@/lib/hooks";
import { toast } from "sonner";

type ScanType = "auto" | "notes" | "task";

export default function EscanearPage() {
  const { subjects } = useSubjects();
  const [subjectId, setSubjectId] = useState("");
  const { classes } = useClasses(subjectId || null);

  const [classId, setClassId] = useState("");
  const [scanType, setScanType] = useState<ScanType>("auto");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const scanTypes: { value: ScanType; label: string; icon: typeof Sparkles }[] = [
    { value: "auto", label: "Auto", icon: Sparkles },
    { value: "notes", label: "Apuntes", icon: FileText },
    { value: "task", label: "Tarea", icon: CheckSquare },
  ];

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages = Array.from(files).map((file) => ({
      url: URL.createObjectURL(file),
      file,
    }));
    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleProcess = () => {
    if (images.length === 0) {
      toast.error("Agrega al menos una imagen");
      return;
    }
    toast("Proximamente", {
      description: "El procesamiento con IA se habilitara cuando se configure la API de Gemini.",
    });
  };

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );

  return (
    <AppShell>
      <div className="px-4 pt-safe page-enter">
        <h1 className="text-2xl font-bold mb-1">Escanear</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Toma foto al tablero o cuaderno
        </p>

        {/* Image area */}
        {images.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-8 mb-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Camera className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Captura con la camara o sube desde galeria
              </p>
              <div className="flex gap-2.5 justify-center">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform touch-target"
                >
                  <Camera className="w-4 h-4" />
                  Camara
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium active:scale-[0.98] transition-transform touch-target"
                >
                  <ImagePlus className="w-4 h-4" />
                  Galeria
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            {/* Image preview grid */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {images.map((img, i) => (
                <div key={i} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-border">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ))}
              {/* Add more button */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground active:bg-secondary/50"
              >
                <Camera className="w-5 h-5" />
                <span className="text-[10px]">Agregar</span>
              </button>
            </div>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {/* Scan type selector */}
        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Que buscar
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {scanTypes.map((t) => (
              <button
                key={t.value}
                onClick={() => setScanType(t.value)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  scanType === t.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subject + Class selection */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Materia
            </label>
            <select
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); setClassId(""); }}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm"
            >
              <option value="">Auto-detectar</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Clase
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={!subjectId}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm disabled:opacity-50"
            >
              <option value="">Mas reciente</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Context badge */}
        {selectedSubject && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 border border-border mb-4 text-sm">
            <span className="text-lg">{selectedSubject.emoji}</span>
            <span className="text-muted-foreground">
              Se guardara en <span className="font-medium text-foreground">{selectedSubject.name}</span>
            </span>
          </div>
        )}

        {/* Process button */}
        <button
          onClick={handleProcess}
          disabled={images.length === 0}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Procesar con IA
          {images.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-xs">
              {images.length}
            </span>
          )}
        </button>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-3 mb-4">
          Gemini Vision procesara las imagenes
        </p>
      </div>
    </AppShell>
  );
}
