"use client";

import { useState, useRef, useMemo } from "react";
import {
  Camera,
  ImagePlus,
  X,
  Sparkles,
  FileText,
  CheckSquare,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { useSubjects, useClasses, useTasks } from "@/lib/hooks";
import { uploadScanImage } from "@/lib/storage";
import { TASK_TYPES, TASK_PRIORITIES } from "@/types";
import type { Task } from "@/types";
import { toast } from "sonner";

type ScanType = "auto" | "notes" | "task";

interface DetectedTask {
  title: string;
  description: string;
  dueDate: string;
  dateConfidence: string;
  priority: string;
  taskType: string;
  detectedSubject: string;
  subjectConfidence: string;
}

interface TaskResult {
  type: "task";
  tasks: DetectedTask[];
  rawText: string;
}

interface NotesResult {
  type: "notes";
  topic: string;
  content: string;
  tags: string[];
  detectedSubject: string;
  subjectConfidence: string;
}

type ScanResult = TaskResult | NotesResult;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function EscanearPage() {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const { addTask } = useTasks();

  // Main selectors
  const [subjectId, setSubjectId] = useState("");
  const { classes } = useClasses(subjectId || null);
  const [classId, setClassId] = useState("");
  const [scanType, setScanType] = useState<ScanType>("auto");
  const [images, setImages] = useState<{ url: string; file: File }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Processing
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState("");

  // Result + editing
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields for task results
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState<Task["priority"]>("medium");
  const [editTaskType, setEditTaskType] = useState<Task["type"]>("otro");

  // Editable fields for notes results
  const [editTopic, setEditTopic] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");

  // Result subject/class (may differ from main selectors after AI detection)
  const [resultSubjectId, setResultSubjectId] = useState("");
  const { classes: resultClasses } = useClasses(resultSubjectId || null);
  const [resultClassId, setResultClassId] = useState("");

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

  const matchSubject = (name: string | undefined) => {
    if (!name) return "";
    const lower = name.toLowerCase();
    const match = subjects.find((s) => s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase()));
    return match?.id || "";
  };

  const handleProcess = async () => {
    if (images.length === 0) {
      toast.error("Agrega al menos una imagen");
      return;
    }

    setProcessing(true);
    setProcessStep("Preparando imagenes...");

    try {
      const base64Images = await Promise.all(
        images.map((img) => fileToBase64(img.file))
      );

      setProcessStep("Analizando con IA...");

      const selectedSubject = subjects.find((s) => s.id === subjectId);
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: base64Images,
          type: scanType,
          subjectName: selectedSubject?.name,
          existingSubjects: subjects.map((s) => s.name),
          currentDate: new Date().toISOString().split("T")[0],
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error al procesar");
      }

      const scanData = data.data as ScanResult;
      setResult(scanData);

      if (scanData.type === "task" && scanData.tasks?.length > 0) {
        const t = scanData.tasks[0];
        setEditTitle(t.title || "");
        setEditDescription(t.description || "");
        setEditDueDate(t.dueDate || "");
        setEditPriority((t.priority as Task["priority"]) || "medium");
        setEditTaskType((t.taskType as Task["type"]) || "otro");
        const matched = matchSubject(t.detectedSubject);
        setResultSubjectId(matched || subjectId);
      } else if (scanData.type === "notes") {
        setEditTopic(scanData.topic || "");
        setEditContent(scanData.content || "");
        setEditTags((scanData.tags || []).join(", "));
        const matched = matchSubject(scanData.detectedSubject);
        setResultSubjectId(matched || subjectId);
        setResultClassId(classId);
      }

      setShowResult(true);
      toast.success("Imagen procesada");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(msg);
    } finally {
      setProcessing(false);
      setProcessStep("");
    }
  };

  const handleSaveTask = async () => {
    if (!editTitle.trim()) { toast.error("El titulo es obligatorio"); return; }
    if (!resultSubjectId) { toast.error("Selecciona una materia"); return; }
    if (!editDueDate) { toast.error("La fecha es obligatoria"); return; }

    const sub = subjects.find((s) => s.id === resultSubjectId);
    const dueDateObj = new Date(editDueDate + "T23:59:59");

    setSaving(true);
    try {
      let sourceImageUrl: string | null = null;
      if (user && images.length > 0) {
        try {
          const uploadPromise = uploadScanImage(user.uid, images[0].file, 0);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout subiendo imagen")), 15000)
          );
          sourceImageUrl = await Promise.race([uploadPromise, timeoutPromise]);
        } catch (uploadErr) {
          console.error("Error subiendo imagen:", uploadErr);
          toast.error("No se pudo subir la imagen. Guardando tarea sin imagen.");
        }
      }

      await addTask({
        title: editTitle.trim(),
        subjectId: resultSubjectId,
        subjectName: sub?.name || "",
        description: editDescription.trim(),
        dueDate: dueDateObj,
        status: "pending",
        priority: editPriority,
        type: editTaskType,
        sourceImageUrl,
        classSessionId: classId || null,
      });

      toast.success("Tarea creada desde escaneo");
      clearAfterSave();
    } catch (err) {
      console.error("Error guardando tarea:", err);
      const msg = err instanceof Error && err.message.includes("permissions")
        ? "Sin permisos. Revisa las reglas de Firebase."
        : "Error al guardar tarea";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!editContent.trim()) { toast.error("El contenido es obligatorio"); return; }
    if (!resultSubjectId) { toast.error("Selecciona una materia"); return; }
    if (!resultClassId) { toast.error("Selecciona una clase"); return; }
    if (!user) return;

    setSaving(true);
    try {
      let sourceImageUrls: string[] = [];
      if (images.length > 0) {
        sourceImageUrls = await Promise.all(
          images.map((img, i) => uploadScanImage(user.uid, img.file, i))
        );
      }

      const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);

      await addDoc(
        collection(db, "users", user.uid, "subjects", resultSubjectId, "classes", resultClassId, "entries"),
        {
          type: "notes",
          content: editContent.trim(),
          rawContent: editContent.trim(),
          sourceImages: sourceImageUrls,
          tags,
          order: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      toast.success("Apuntes guardados desde escaneo");
      clearAfterSave();
    } catch {
      toast.error("Error al guardar apuntes");
    } finally {
      setSaving(false);
    }
  };

  const clearAfterSave = () => {
    setShowResult(false);
    setResult(null);
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
  };

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );

  const isTask = result?.type === "task";

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
          disabled={images.length === 0 || processing}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {processStep}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Procesar con IA
              {images.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-xs">
                  {images.length}
                </span>
              )}
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-muted-foreground/50 mt-3 mb-4">
          Gemini Vision procesara las imagenes
        </p>
      </div>

      {/* Result Sheet — Task */}
      {result?.type === "task" && (
        <Sheet
          open={showResult}
          onClose={() => setShowResult(false)}
          title="Tarea detectada"
        >
          <div className="space-y-3.5">
            {/* Confidence warning */}
            {result.tasks[0]?.dateConfidence === "low" && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Fecha con baja confianza, verifica antes de guardar
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Titulo</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Materia</label>
                <select
                  value={resultSubjectId}
                  onChange={(e) => setResultSubjectId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark] text-sm"
                />
              </div>
            </div>

            {editDescription && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripcion</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridad</label>
              <div className="grid grid-cols-3 gap-1.5">
                {TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setEditPriority(p.value as Task["priority"])}
                    className={`py-2 rounded-xl text-sm font-medium transition-all ${
                      editPriority === p.value ? "text-white" : "bg-secondary text-muted-foreground"
                    }`}
                    style={editPriority === p.value ? { backgroundColor: p.color } : undefined}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
              <div className="grid grid-cols-3 gap-1.5">
                {TASK_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setEditTaskType(t.value as Task["type"])}
                    className={`flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium transition-all ${
                      editTaskType === t.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <span className="text-xs">{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {result.tasks.length > 1 && (
              <p className="text-xs text-muted-foreground text-center">
                Se detectaron {result.tasks.length} tareas. Se guardara la primera.
              </p>
            )}

            <button
              onClick={handleSaveTask}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar tarea"}
            </button>
          </div>
        </Sheet>
      )}

      {/* Result Sheet — Notes */}
      {result?.type === "notes" && (
        <Sheet
          open={showResult}
          onClose={() => setShowResult(false)}
          title="Apuntes detectados"
        >
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tema</label>
              <input
                type="text"
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Contenido</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="separados por coma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Materia</label>
                <select
                  value={resultSubjectId}
                  onChange={(e) => { setResultSubjectId(e.target.value); setResultClassId(""); }}
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Clase</label>
                <select
                  value={resultClassId}
                  onChange={(e) => setResultClassId(e.target.value)}
                  disabled={!resultSubjectId}
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none text-sm disabled:opacity-50"
                >
                  <option value="">Seleccionar...</option>
                  {resultClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar apuntes"}
            </button>
          </div>
        </Sheet>
      )}
    </AppShell>
  );
}
