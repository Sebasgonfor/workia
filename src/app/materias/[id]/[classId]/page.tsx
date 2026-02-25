"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  FileText,
  CheckSquare,
  Paperclip,
  MoreVertical,
  Pencil,
  Trash2,
  Camera,
  PenLine,
  Layers,
  Loader2,
  ImagePlus,
  X,
  Sparkles,
  AlertTriangle,
  Check,
  Mic,
  MicOff,
  Upload,
  Brain,
  GitBranch,
  Calendar,
  CalendarCheck,
  Clock,
  ChevronRight,
  Bot,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Sheet } from "@/components/ui/sheet";
import { Confirm } from "@/components/ui/confirm";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { DynamicBoardTab } from "@/components/dynamic-board-tab";
import { useSubjects, useClasses, useBoardEntries, useFlashcards, useTasks, useQuizzes, useSubjectDocuments } from "@/lib/hooks";
import { uploadScanImage, uploadAudio, uploadNoteImage } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { BOARD_ENTRY_TYPES, TASK_TYPES, TASK_PRIORITIES } from "@/types";
import type { BoardEntry, Task, Flashcard, Quiz } from "@/types";
import { toast } from "sonner";

const ENTRY_ICONS = {
  notes: FileText,
  task: CheckSquare,
  resource: Paperclip,
} as const;

type ScanType = "auto" | "notes" | "task";

interface DetectedTask {
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  dateConfidence: string;
  priority: string;
  taskType: string;
  selected: boolean;
}

interface ScanNotesData {
  topic: string;
  content: string;
  tags: string[];
}

interface ScanResult {
  type: "task" | "notes" | "both";
  tasks?: DetectedTask[];
  notes?: ScanNotesData | null;
  rawText?: string;
  topic?: string;
  content?: string;
  tags?: string[];
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
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function isTaskOverdue(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function getDiffDays(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

function formatRelativeDueDate(date: Date): string {
  const diff = getDiffDays(date);
  if (diff < -1) return `Hace ${Math.abs(diff)}d`;
  if (diff === -1) return "Ayer";
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Manana";
  if (diff <= 7) return `En ${diff}d`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const subjectId = params.id as string;
  const classId = params.classId as string;

  const { subjects } = useSubjects();
  const { classes } = useClasses(subjectId);
  const { entries, loading, addEntry, updateEntry, deleteEntry } =
    useBoardEntries(subjectId, classId);
  const { addFlashcards } = useFlashcards(subjectId);
  const { addQuiz } = useQuizzes(subjectId);
  const { tasks: allTasks, addTask, updateTask: updateTaskStatus, deleteTask } = useTasks();
  const { documents: subjectDocuments } = useSubjectDocuments(subjectId);

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId), [subjects, subjectId]);
  const classSession = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);
  const classTasks = useMemo(() => allTasks.filter((t) => t.classSessionId === classId), [allTasks, classId]);

  // Entry CRUD state
  const [showSheet, setShowSheet] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingQuizId, setGeneratingQuizId] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"apuntes" | "tablero">("apuntes");

  // Reader state
  const [readerEntry, setReaderEntry] = useState<BoardEntry | null>(null);

  const [entryType, setEntryType] = useState<BoardEntry["type"] | "voice">("notes");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  // Manual task form fields (when entryType === "task")
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignedDate, setTaskAssignedDate] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState<Task["priority"]>("medium");
  const [taskTypeValue, setTaskTypeValue] = useState<Task["type"]>("otro");

  // Filter state
  const [filter, setFilter] = useState<"all" | BoardEntry["type"]>("all");
  const filteredEntries = filter === "all" ? entries : entries.filter((e) => e.type === filter);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioUploadFile, setAudioUploadFile] = useState<File | null>(null);
  const [voiceTab, setVoiceTab] = useState<"record" | "upload">("record");
  const [processingVoice, setProcessingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const noteImageInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // Track mount state to avoid setState after navigation
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Diagram / note image state
  const [uploadingNoteImage, setUploadingNoteImage] = useState(false);
  const [showDiagramGen, setShowDiagramGen] = useState(false);
  const [diagramPrompt, setDiagramPrompt] = useState("");
  const [generatingDiagram, setGeneratingDiagram] = useState(false);

  // Scan state
  const [showScan, setShowScan] = useState(false);
  const [scanType, setScanType] = useState<ScanType>("auto");
  const [scanImages, setScanImages] = useState<{ url: string; file: File }[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Scan result state
  const [showScanResult, setShowScanResult] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [savingScan, setSavingScan] = useState(false);

  // Editable task fields (for multi-task editing)
  const [editTasks, setEditTasks] = useState<DetectedTask[]>([]);
  const [editingTaskIdx, setEditingTaskIdx] = useState(0);

  // Editable notes fields
  const [editNotesContent, setEditNotesContent] = useState("");
  const [editNotesTags, setEditNotesTags] = useState("");

  // Entry form
  const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const resetForm = () => {
    setEntryType("notes"); setContent(""); setTagsInput(""); setEditingId(null);
    setTaskTitle(""); setTaskDescription(""); setTaskAssignedDate(toDateStr(new Date())); setTaskDueDate(""); setTaskPriority("medium"); setTaskTypeValue("otro");
    // Voice cleanup
    setIsRecording(false); setRecordingTime(0);
    setAudioBlob(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setAudioUploadFile(null);
    setVoiceTab("record");
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    // Diagram cleanup
    setShowDiagramGen(false);
    setDiagramPrompt("");
  };
  const openCreate = () => { resetForm(); setShowSheet(true); };

  const openEdit = (entry: BoardEntry) => {
    setEntryType(entry.type);
    setContent(entry.content);
    setTagsInput(entry.tags.join(", "));
    setEditingId(entry.id);
    setMenuOpen(null);
    setShowSheet(true);
  };

  const handleSave = async () => {
    // Voice is processed separately via handleProcessVoice
    if (entryType === "voice") return;

    // Task type → create a real Task
    if (entryType === "task" && !editingId) {
      if (!taskTitle.trim()) { toast.error("El titulo es obligatorio"); return; }
      if (!taskDueDate) { toast.error("La fecha de entrega es obligatoria"); return; }
      setSaving(true);
      try {
        const dueDateObj = new Date(taskDueDate + "T23:59:59");
        const assignedDateObj = taskAssignedDate ? new Date(taskAssignedDate + "T00:00:00") : new Date();
        await addTask({
          title: taskTitle.trim(),
          subjectId,
          subjectName: subject?.name || "",
          description: taskDescription.trim(),
          assignedDate: assignedDateObj,
          dueDate: dueDateObj,
          status: "pending",
          priority: taskPriority,
          type: taskTypeValue,
          sourceImageUrl: null,
          classSessionId: classId,
        });
        toast.success("Tarea creada");
        setShowSheet(false);
        resetForm();
      } catch { toast.error("Error al guardar tarea"); } finally { setSaving(false); }
      return;
    }

    // Notes/Resource type → create BoardEntry
    if (!content.trim()) { toast.error("El contenido es obligatorio"); return; }
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    setSaving(true);
    try {
      if (editingId) {
        await updateEntry(editingId, { type: entryType, content: content.trim(), tags });
        toast.success("Entrada actualizada");
      } else {
        await addEntry({ type: entryType, content: content.trim(), tags });
        toast.success("Entrada creada");
      }
      setShowSheet(false);
      resetForm();
    } catch { toast.error("Error al guardar"); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try { await deleteEntry(id); toast.success("Entrada eliminada"); }
    catch { toast.error("Error al eliminar"); }
  };

  const handleGenerateFlashcards = async (entry: BoardEntry) => {
    setMenuOpen(null);
    setGeneratingId(entry.id);
    try {
      const response = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: entry.content,
          subjectName: subject?.name || "General",
          subjectDocuments: subjectDocuments.map((d) => ({ url: d.url, fileType: d.fileType, name: d.name })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Error al generar");
      const generated = data.data.flashcards as { question: string; answer: string; type: string }[];
      if (!generated || generated.length === 0) throw new Error("No se generaron flashcards");
      await addFlashcards(
        generated.map((fc) => ({
          subjectId,
          subjectName: subject?.name || "",
          noteId: entry.id,
          question: fc.question,
          answer: fc.answer,
          type: (fc.type as Flashcard["type"]) || "definition",
        }))
      );
      toast.success(`${generated.length} flashcards generadas`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerateQuiz = async (entry: BoardEntry) => {
    setMenuOpen(null);
    setGeneratingQuizId(entry.id);
    try {
      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: entry.content,
          subjectName: subject?.name || "General",
          subjectDocuments: subjectDocuments.map((d) => ({ url: d.url, fileType: d.fileType, name: d.name })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Error al generar quiz");
      const { title, questions } = data.data as { title: string; questions: unknown[] };
      if (!questions || questions.length === 0) throw new Error("No se generaron preguntas");
      const quizId = await addQuiz({
        subjectId,
        subjectName: subject?.name || "",
        entryId: entry.id,
        title: title || `Quiz — ${classSession?.title || "Clase"}`,
        questions: questions as Quiz["questions"],
      });
      if (!quizId) throw new Error("Error al guardar el quiz");
      toast.success("Quiz generado");
      router.push(`/quiz/${quizId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGeneratingQuizId(null);
    }
  };

  // ── Scan functions ──

  const handleScanFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages = Array.from(files).map((file) => ({
      url: URL.createObjectURL(file),
      file,
    }));
    setScanImages((prev) => [...prev, ...newImages]);
  };

  const removeScanImage = (index: number) => {
    setScanImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleProcess = async () => {
    if (scanImages.length === 0) { toast.error("Agrega al menos una imagen"); return; }

    // Close the sheet immediately so the user can navigate freely
    setShowScan(false);
    setProcessing(true);

    const toastId = toast.loading("Analizando imagen con IA...", {
      description: "Puedes seguir usando la app mientras termina",
    });

    // Snapshot images before they may be cleared
    const imageSnapshot = [...scanImages];
    const scanTypeSnapshot = scanType;

    try {
      const base64Images = await Promise.all(imageSnapshot.map((img) => fileToBase64(img.file)));

      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: base64Images,
          type: scanTypeSnapshot,
          subjectName: subject?.name,
          existingSubjects: subjects.map((s) => s.name),
          currentDate: new Date().toISOString().split("T")[0],
          subjectDocuments: subjectDocuments.map((d) => ({ url: d.url, fileType: d.fileType, name: d.name })),
          existingNotes: entries
            .filter((e) => e.type === "notes" && e.content.trim().length > 30)
            .slice(0, 5)
            .map((e) => e.content),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Error al procesar");

      const result = data.data as ScanResult;

      const today = new Date().toISOString().split("T")[0];

      // Handle tasks
      const tasks = result.tasks || [];
      if (tasks.length > 0) {
        setEditTasks(tasks.map((t) => ({ ...t, assignedDate: t.assignedDate || today, selected: true })));
        setEditingTaskIdx(0);
      }

      // Handle notes
      let notesData: ScanNotesData | null = null;
      if (result.type === "both" && result.notes) {
        notesData = result.notes;
      } else if (result.type === "notes") {
        notesData = {
          topic: result.topic || "",
          content: result.content || "",
          tags: result.tags || [],
        };
      }
      if (notesData && notesData.content) {
        setEditNotesContent(notesData.content);
        setEditNotesTags((notesData.tags || []).join(", "));
      }

      setScanResult(result);

      const parts: string[] = [];
      if (tasks.length > 0) parts.push(`${tasks.length} tarea(s)`);
      if (notesData?.content) parts.push("apuntes");
      const summary = parts.join(" + ") || "contenido procesado";

      toast.dismiss(toastId);

      if (isMountedRef.current) {
        // User is still on this page — open result sheet directly
        setShowScanResult(true);
        toast.success(`Listo: ${summary}`);
      } else {
        // User navigated away — auto-save directly to Firebase so nothing is lost
        try {
          const savedParts: string[] = [];

          // Auto-save detected tasks
          for (const task of tasks) {
            const dueDateObj = task.dueDate
              ? new Date(task.dueDate + "T23:59:59")
              : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const assignedDateObj = task.assignedDate
              ? new Date(task.assignedDate + "T00:00:00")
              : new Date();
            await addTask({
              title: task.title.trim(),
              subjectId,
              subjectName: subject?.name || "",
              description: task.description.trim(),
              assignedDate: assignedDateObj,
              dueDate: dueDateObj,
              status: "pending",
              priority: (task.priority as Task["priority"]) || "medium",
              type: (task.taskType as Task["type"]) || "otro",
              sourceImageUrl: null,
              classSessionId: classId,
            });
          }
          if (tasks.length > 0) savedParts.push(`${tasks.length} tarea(s)`);

          // Auto-save detected notes
          if (notesData?.content) {
            const tags = notesData.tags || [];
            await addEntry({ type: "notes", content: notesData.content.trim(), tags });
            savedParts.push("apuntes");
          }

          toast.success(
            `Guardado automáticamente: ${savedParts.join(" + ") || "contenido"}`,
            { description: "El contenido fue guardado en la clase", duration: 8000 }
          );
        } catch {
          toast.error("Error al guardar automáticamente", {
            description: "Vuelve a la clase para intentar de nuevo",
            duration: 8000,
          });
        }
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err instanceof Error ? err.message : "Error al procesar imagen");
    } finally {
      if (isMountedRef.current) {
        setProcessing(false);
        setProcessStep("");
      }
    }
  };

  const handleSaveScanTasks = async () => {
    const selected = editTasks.filter((t) => t.selected);
    if (selected.length === 0) { toast.error("Selecciona al menos una tarea"); return; }

    setSavingScan(true);
    try {
      let sourceImageUrl: string | null = null;
      if (user && scanImages.length > 0) {
        try {
          const uploadPromise = uploadScanImage(user.uid, scanImages[0].file, 0);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 15000)
          );
          sourceImageUrl = await Promise.race([uploadPromise, timeoutPromise]);
        } catch {
          toast.error("Imagen no subida, guardando tareas sin imagen");
        }
      }

      for (const task of selected) {
        const dueDateObj = task.dueDate
          ? new Date(task.dueDate + "T23:59:59")
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const assignedDateObj = task.assignedDate
          ? new Date(task.assignedDate + "T00:00:00")
          : new Date();

        await addTask({
          title: task.title.trim(),
          subjectId,
          subjectName: subject?.name || "",
          description: task.description.trim(),
          assignedDate: assignedDateObj,
          dueDate: dueDateObj,
          status: "pending",
          priority: (task.priority as Task["priority"]) || "medium",
          type: (task.taskType as Task["type"]) || "otro",
          sourceImageUrl,
          classSessionId: classId,
        });
      }

      // If "both" mode, also save notes — merge into most recent note if one exists
      if (scanResult?.type === "both" && editNotesContent.trim()) {
        const tags = editNotesTags.split(",").map((t) => t.trim()).filter(Boolean);
        const existingNotesEntries = entries
          .filter((e) => e.type === "notes")
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        if (existingNotesEntries.length > 0) {
          const target = existingNotesEntries[0];
          const mergedContent = `${target.content}\n\n---\n\n${editNotesContent.trim()}`;
          const mergedTags = Array.from(new Set([...target.tags, ...tags]));
          await updateEntry(target.id, { type: "notes", content: mergedContent, tags: mergedTags });
        } else {
          await addEntry({ type: "notes", content: editNotesContent.trim(), tags });
        }
      }

      const parts: string[] = [`${selected.length} tarea(s)`];
      if (scanResult?.type === "both" && editNotesContent.trim()) parts.push("apuntes");
      toast.success(`${parts.join(" + ")} guardado(s)`);
      clearScan();
    } catch (err) {
      console.error("Error guardando:", err);
      const msg = err instanceof Error && err.message.includes("permissions")
        ? "Sin permisos. Revisa las reglas de Firebase."
        : "Error al guardar";
      toast.error(msg);
    } finally {
      setSavingScan(false);
    }
  };

  const handleSaveScanNotes = async () => {
    if (!editNotesContent.trim()) { toast.error("El contenido es obligatorio"); return; }

    setSavingScan(true);
    try {
      const tags = editNotesTags.split(",").map((t) => t.trim()).filter(Boolean);

      // Find the most recent notes entry from this class to merge into
      const existingNotesEntries = entries
        .filter((e) => e.type === "notes")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      if (existingNotesEntries.length > 0) {
        // Merge: append new content to the most recent note
        const target = existingNotesEntries[0];
        const mergedContent = `${target.content}\n\n---\n\n${editNotesContent.trim()}`;
        const mergedTags = Array.from(new Set([...target.tags, ...tags]));
        await updateEntry(target.id, { type: "notes", content: mergedContent, tags: mergedTags });
        toast.success("Transcripción unificada con los apuntes existentes");
      } else {
        // No existing notes: create a new entry
        await addEntry({ type: "notes", content: editNotesContent.trim(), tags });
        toast.success("Apuntes guardados en el tablero");
      }

      clearScan();
    } catch (err) {
      console.error("Error guardando apuntes:", err);
      toast.error("Error al guardar apuntes");
    } finally {
      setSavingScan(false);
    }
  };

  const clearScan = () => {
    setShowScanResult(false);
    setScanResult(null);
    setEditTasks([]);
    setEditNotesContent("");
    setEditNotesTags("");
    scanImages.forEach((img) => URL.revokeObjectURL(img.url));
    setScanImages([]);
  };

  const updateTaskField = (idx: number, field: string, value: string | boolean) => {
    setEditTasks((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  // ── Note image upload ──

  const handleNoteImageUpload = async (file: File) => {
    if (!user) { toast.error("Debes iniciar sesión"); return; }
    setUploadingNoteImage(true);
    try {
      const url = await uploadNoteImage(user.uid, file);
      setContent((prev) => `${prev}\n![imagen](${url})\n`);
      toast.success("Imagen adjuntada");
    } catch {
      toast.error("Error al subir imagen");
    } finally {
      setUploadingNoteImage(false);
    }
  };

  // ── AI diagram generation ──

  const handleGenerateDiagram = async () => {
    if (!diagramPrompt.trim()) { toast.error("Describe el diagrama primero"); return; }
    setGeneratingDiagram(true);
    try {
      const res = await fetch("/api/diagrams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: diagramPrompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Error al generar");
      const mermaidBlock = `\n\`\`\`mermaid\n${data.code}\n\`\`\`\n`;
      setContent((prev) => prev + mermaidBlock);
      setDiagramPrompt("");
      setShowDiagramGen(false);
      toast.success("Diagrama añadido a los apuntes");
    } catch {
      toast.error("Error al generar diagrama");
    } finally {
      setGeneratingDiagram(false);
    }
  };

  // ── Voice recording functions ──

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleProcessVoice = async () => {
    const mimeType = audioBlob?.type || audioUploadFile?.type || "audio/webm";
    const file = audioBlob
      ? new File([audioBlob], `clase-${Date.now()}.webm`, { type: mimeType })
      : audioUploadFile;

    if (!file) { toast.error("Graba o sube un audio primero"); return; }

    setProcessingVoice(true);
    setProcessStep("Subiendo audio...");

    try {
      const audioUrl = await uploadAudio(user?.uid || "anon", file);

      setProcessStep("Transcribiendo con IA...");

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioUrl,
          mimeType: file.type,
          subjectName: subject?.name,
          existingSubjects: subjects.map((s) => s.name),
          currentDate: new Date().toISOString().split("T")[0],
          subjectDocuments: subjectDocuments.map((d) => ({ url: d.url, fileType: d.fileType, name: d.name })),
          existingNotes: entries
            .filter((e) => e.type === "notes" && e.content.trim().length > 30)
            .slice(0, 5)
            .map((e) => e.content),
        }),
      });

      const transcribeData = await transcribeRes.json();
      if (!transcribeRes.ok || !transcribeData.success) {
        throw new Error(transcribeData.error || "Error al transcribir");
      }

      const result = transcribeData.data as ScanResult;
      setScanResult(result);

      const today = new Date().toISOString().split("T")[0];
      const tasks = result.tasks || [];
      if (tasks.length > 0) {
        setEditTasks(tasks.map((t) => ({ ...t, assignedDate: t.assignedDate || today, selected: true })));
        setEditingTaskIdx(0);
      }

      let notesData: ScanNotesData | null = null;
      if (result.type === "both" && result.notes) {
        notesData = result.notes;
      } else if (result.type === "notes") {
        notesData = { topic: result.topic || "", content: result.content || "", tags: result.tags || [] };
      }
      if (notesData?.content) {
        setEditNotesContent(notesData.content);
        setEditNotesTags((notesData.tags || []).join(", "));
      }

      setShowSheet(false);
      setShowScanResult(true);

      const parts: string[] = [];
      if (tasks.length > 0) parts.push(`${tasks.length} tarea(s)`);
      if (notesData?.content) parts.push("apuntes");
      toast.success(`Detectado: ${parts.join(" + ") || "contenido procesado"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setProcessingVoice(false);
      setProcessStep("");
    }
  };

  const color = subject?.color || "#6366f1";
  const currentTask = editTasks[editingTaskIdx];

  if (!classSession && !loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <p className="text-muted-foreground">Clase no encontrada</p>
          <button onClick={() => router.replace(`/materias/${subjectId}`)} className="mt-4 text-primary text-sm font-medium">
            Volver a clases
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-enter">
        <div
          className="px-4 pt-safe pb-4"
          style={{ background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)` }}
        >
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-muted-foreground mb-3 active:opacity-70 touch-target">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">{subject?.name || "Clases"}</span>
          </button>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{classSession?.title || "..."}</h1>
              <p className="text-xs text-muted-foreground">
                {entries.length} entrada{entries.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setShowScan(true)} className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center active:scale-95 transition-transform touch-target">
                <Camera className="w-5 h-5 text-primary" />
              </button>
              <button onClick={openCreate} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform touch-target">
                <Plus className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl">
            <button
              onClick={() => setActiveTab("apuntes")}
              aria-label="Ver apuntes"
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "apuntes"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground active:opacity-70"
              }`}
            >
              Apuntes
            </button>
            <button
              onClick={() => setActiveTab("tablero")}
              aria-label="Ver tablero dinámico"
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "tablero"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground active:opacity-70"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Tablero
            </button>
          </div>
        </div>

        {activeTab === "apuntes" && (
          <>
        {/* Filters */}
        {entries.length > 0 && (
          <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1.5">
            {[
              { key: "all" as const, label: "Todo" },
              { key: "notes" as const, label: "Apuntes" },
              { key: "task" as const, label: "Tareas" },
              { key: "resource" as const, label: "Recursos" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="px-4">
          {loading ? (
            <div className="space-y-2.5 mt-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm mb-1">Sin entradas aun</p>
              <p className="text-xs text-muted-foreground/60 mb-5">Agrega apuntes, tareas o recursos</p>
              <div className="flex gap-2.5 justify-center">
                <button
                  onClick={() => setShowScan(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-sm font-medium active:scale-[0.98] transition-transform touch-target"
                >
                  <Camera className="w-4 h-4" /> Escanear
                </button>
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform touch-target"
                >
                  <PenLine className="w-4 h-4" /> Escribir
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 mt-3">
              {filteredEntries.map((entry) => {
                const Icon = ENTRY_ICONS[entry.type];
                const typeLabel = BOARD_ENTRY_TYPES.find((t) => t.value === entry.type)?.label || entry.type;
                const isGenerating = generatingId === entry.id;
                return (
                  <div key={entry.id} className="relative">
                    <div
                      className={`p-3.5 rounded-xl bg-card border border-border ${entry.type === "notes" ? "cursor-pointer active:scale-[0.99] transition-transform" : ""}`}
                      onClick={entry.type === "notes" ? () => setReaderEntry(entry) : undefined}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: color + "20" }}>
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0 pr-7">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[11px] font-semibold" style={{ color }}>{typeLabel}</span>
                            <span className="text-[11px] text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                          </div>
                          <div className="text-sm leading-relaxed line-clamp-4">
                            <MarkdownMath content={entry.content} />
                          </div>
                          {entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {entry.tags.map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] bg-secondary text-muted-foreground">{tag}</span>
                              ))}
                            </div>
                          )}
                          {entry.type === "notes" && entry.content.length > 30 && (
                            <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGenerateFlashcards(entry); }}
                                disabled={isGenerating || generatingQuizId === entry.id}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium active:scale-[0.97] transition-transform disabled:opacity-50"
                              >
                                {isGenerating ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" /> Generando...</>
                                ) : (
                                  <><Layers className="w-3 h-3" /> Flashcards</>
                                )}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGenerateQuiz(entry); }}
                                disabled={generatingQuizId === entry.id || isGenerating}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 text-[11px] font-medium active:scale-[0.97] transition-transform disabled:opacity-50"
                              >
                                {generatingQuizId === entry.id ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" /> Generando...</>
                                ) : (
                                  <><Brain className="w-3 h-3" /> Quiz</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === entry.id ? null : entry.id); }}
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-secondary/50 flex items-center justify-center touch-target"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {menuOpen === entry.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                        <div className="absolute top-10 right-2.5 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
                          <button onClick={() => openEdit(entry)} className="w-full flex items-center gap-3 px-4 py-3 text-sm active:bg-secondary/50">
                            <Pencil className="w-4 h-4" /> Editar
                          </button>
                          {entry.type === "notes" && entry.content.length > 30 && (
                            <button
                              onClick={() => handleGenerateFlashcards(entry)}
                              disabled={isGenerating}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-primary active:bg-secondary/50 disabled:opacity-50"
                            >
                              <Layers className="w-4 h-4" /> Flashcards
                            </button>
                          )}
                          {entry.type === "notes" && entry.content.length > 30 && (
                            <button
                              onClick={() => handleGenerateQuiz(entry)}
                              disabled={generatingQuizId === entry.id}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-emerald-500 active:bg-secondary/50 disabled:opacity-50"
                            >
                              <Brain className="w-4 h-4" /> Quiz
                            </button>
                          )}
                          <button onClick={() => { setMenuOpen(null); setDeleteId(entry.id); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive active:bg-secondary/50">
                            <Trash2 className="w-4 h-4" /> Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tasks linked to this class */}
          {classTasks.length > 0 && (filter === "all" || filter === "task") && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Tareas de esta clase ({classTasks.length})
              </p>
              <div className="space-y-2">
                {classTasks.map((task) => {
                  const isComplete = task.status === "completed";
                  const priorityData = TASK_PRIORITIES.find((p) => p.value === task.priority);
                  const typeData = TASK_TYPES.find((t) => t.value === task.type);
                  const overdue = !isComplete && task.dueDate < new Date();

                  return (
                    <button
                      key={task.id}
                      onClick={() => setDetailTask(task)}
                      className="w-full text-left p-3 rounded-xl bg-card border border-border active:scale-[0.98] transition-transform"
                      style={{ borderLeftWidth: "3px", borderLeftColor: priorityData?.color || "#666" }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, { status: isComplete ? "pending" : "completed" }); }}
                          className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors cursor-pointer touch-target ${
                            isComplete ? "bg-primary border-primary" : "border-muted-foreground/40"
                          }`}
                        >
                          {isComplete && (
                            <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{typeData?.emoji || "📌"}</span>
                            <span className={`text-sm font-medium ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                              <MarkdownMath content={task.title} inline />
                            </span>
                          </div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              <MarkdownMath content={task.description} className="text-xs" />
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock className={`w-3 h-3 ${overdue ? "text-destructive" : "text-muted-foreground/60"}`} />
                            <span className={`text-[11px] font-medium ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                              {formatRelativeDueDate(task.dueDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/materias/${subjectId}/${classId}/resolver/${task.id}`);
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label="Resolver tarea con IA"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                router.push(`/materias/${subjectId}/${classId}/resolver/${task.id}`);
                              }
                            }}
                            className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center active:scale-90 transition-transform touch-target cursor-pointer"
                          >
                            <Bot className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
          </>
        )}

        {activeTab === "tablero" && (
          <div className="px-4">
            <DynamicBoardTab
              subjectId={subjectId}
              classId={classId}
              subjectName={subject?.name || ""}
              color={color}
              boardEntries={entries}
            />
          </div>
        )}
      </div>

      {/* Task Detail Sheet */}
      <Sheet open={!!detailTask} onClose={() => setDetailTask(null)} title="Detalle de tarea">
        {detailTask && (() => {
          const priorityData = TASK_PRIORITIES.find((p) => p.value === detailTask.priority);
          const typeData = TASK_TYPES.find((t) => t.value === detailTask.type);
          const isComplete = detailTask.status === "completed";
          const overdue = !isComplete && isTaskOverdue(detailTask.dueDate);

          return (
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl">{typeData?.emoji}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: priorityData?.color }}
                >
                  {priorityData?.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground">
                  {typeData?.label}
                </span>
                {isComplete && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/20 text-primary">
                    Completada
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className={`text-xl font-bold leading-tight ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                <MarkdownMath content={detailTask.title} inline />
              </h2>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">Asignada</span>
                  </div>
                  <p className="text-sm font-medium">{formatDate(detailTask.assignedDate)}</p>
                </div>
                <div className={`p-3 rounded-xl border ${overdue ? "bg-destructive/10 border-destructive/30" : "bg-secondary/50 border-border"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <CalendarCheck className={`w-3.5 h-3.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`} />
                    <span className={`text-[10px] font-medium uppercase ${overdue ? "text-destructive" : "text-muted-foreground"}`}>Entrega</span>
                  </div>
                  <p className={`text-sm font-medium ${overdue ? "text-destructive" : ""}`}>
                    {formatDate(detailTask.dueDate)}
                    <span className={`text-[10px] ml-1.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                      ({formatRelativeDueDate(detailTask.dueDate)})
                    </span>
                  </p>
                </div>
              </div>

              {/* Description */}
              {detailTask.description && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 rounded-full bg-primary" />
                    <span className="text-sm font-semibold">Descripcion</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/40 border border-border">
                    <MarkdownMath content={detailTask.description} />
                  </div>
                </div>
              )}

              {/* Resolver con IA */}
              <button
                onClick={() => {
                  setDetailTask(null);
                  router.push(`/materias/${subjectId}/${classId}/resolver/${detailTask.id}`);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform text-primary-foreground"
                style={{ backgroundColor: color }}
                aria-label="Resolver tarea con IA"
              >
                <Bot className="w-4 h-4" />
                Resolver con IA
              </button>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { updateTaskStatus(detailTask.id, { status: isComplete ? "pending" : "completed" }); setDetailTask(null); }}
                  className={`flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform ${
                    isComplete ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isComplete ? "Marcar pendiente" : "Completar"}
                </button>
                <button
                  onClick={() => { setDetailTask(null); deleteTask(detailTask.id); }}
                  className="px-4 py-3 rounded-xl bg-destructive/10 text-destructive font-medium active:scale-[0.98] transition-transform"
                  aria-label="Eliminar tarea"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}
      </Sheet>

      {/* Create/Edit Entry Sheet */}
      <Sheet open={showSheet} onClose={() => { setShowSheet(false); resetForm(); }} title={editingId ? "Editar entrada" : "Nueva entrada"}>
        <div className="space-y-4">
          {/* Type selector (hide when editing existing entry) */}
          {!editingId && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo</label>
            <div className="grid grid-cols-2 gap-1.5">
                {[
                  { value: "notes", Icon: FileText, label: "Apuntes" },
                  { value: "task", Icon: CheckSquare, label: "Tarea" },
                  { value: "resource", Icon: Paperclip, label: "Recurso" },
                  { value: "voice", Icon: Mic, label: "Voz" },
                ].map(({ value, Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setEntryType(value as BoardEntry["type"] | "voice")}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      entryType === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Voice form */}
          {entryType === "voice" && !editingId && (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-1.5">
                {(["record", "upload"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setVoiceTab(tab)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      voiceTab === tab ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {tab === "record" ? "Grabar" : "Subir archivo"}
                  </button>
                ))}
              </div>

              {voiceTab === "record" ? (
                <div className="rounded-2xl border border-border bg-card/50 p-6 flex flex-col items-center gap-4">
                  {/* Waveform bars */}
                  <div className="flex items-end justify-center gap-1" style={{ height: "40px" }}>
                    {Array.from({ length: 9 }, (_, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-full bg-primary"
                        style={{
                          height: `${8 + Math.abs(Math.sin(i * 0.9)) * 24}px`,
                          opacity: isRecording ? 1 : 0.3,
                          transition: "opacity 0.3s ease",
                          animation: isRecording
                            ? `voiceBar 0.${5 + (i % 5)}s ease-in-out ${i * 0.09}s infinite alternate`
                            : "none",
                          transformOrigin: "bottom",
                        }}
                      />
                    ))}
                  </div>

                  {/* Timer */}
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      isRecording ? "text-destructive font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {String(Math.floor(recordingTime / 60)).padStart(2, "0")}:{String(recordingTime % 60).padStart(2, "0")}
                  </span>

                  {/* Mic button / audio preview */}
                  {!audioBlob ? (
                    <button
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                      aria-label={isRecording ? "Detener grabación" : "Iniciar grabación"}
                      className={`w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-all touch-target ${
                        isRecording
                          ? "bg-destructive text-white shadow-lg shadow-destructive/30 animate-pulse"
                          : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      }`}
                    >
                      {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <audio controls src={audioPreviewUrl || ""} className="w-full h-9" />
                      <button
                        onClick={() => {
                          setAudioBlob(null);
                          if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                          setAudioPreviewUrl(null);
                          setRecordingTime(0);
                        }}
                        className="text-xs text-muted-foreground underline"
                      >
                        Grabar de nuevo
                      </button>
                    </div>
                  )}

                  {isRecording && (
                    <p className="text-[11px] text-muted-foreground animate-pulse">
                      Grabando… toca el botón para detener
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full rounded-2xl border-2 border-dashed border-border bg-card/50 p-6 flex flex-col items-center gap-2 active:scale-[0.99] transition-transform"
                  >
                    <Upload className="w-7 h-7 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Toca para seleccionar audio</span>
                    <span className="text-[11px] text-muted-foreground/60">.mp3 .m4a .webm .wav</span>
                  </button>

                  {audioUploadFile && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary border border-border">
                      <Mic className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm truncate flex-1">{audioUploadFile.name}</span>
                      <button
                        onClick={() => setAudioUploadFile(null)}
                        className="shrink-0 text-muted-foreground"
                        aria-label="Quitar archivo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.m4a,.webm,.wav"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setAudioUploadFile(f); }}
                    className="hidden"
                  />
                </div>
              )}

              {/* Context badge */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/50 border border-border text-xs">
                <span className="text-base">{subject?.emoji}</span>
                <span className="text-muted-foreground">{subject?.name} &middot; {classSession?.title}</span>
              </div>

              {/* Process button */}
              <button
                onClick={handleProcessVoice}
                disabled={processingVoice || (!audioBlob && !audioUploadFile)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {processingVoice ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {processStep || "Procesando..."}</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Transcribir con IA</>
                )}
              </button>
            </div>
          )}

          {/* Task form (when type is "task" and creating new) */}
          {entryType === "task" && !editingId ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Titulo</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ej: Entregar taller capitulo 3"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 overflow-hidden">
                <div className="min-w-0 overflow-hidden">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block truncate">Asignada</label>
                  <input
                    type="date"
                    value={taskAssignedDate}
                    onChange={(e) => setTaskAssignedDate(e.target.value)}
                    className="w-full min-w-0 max-w-full px-1.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark] text-xs"
                  />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block truncate">Entrega</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full min-w-0 max-w-full px-1.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark] text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridad</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TASK_PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setTaskPriority(p.value as Task["priority"])}
                      className={`py-2 rounded-xl text-sm font-medium transition-all ${
                        taskPriority === p.value ? "text-white" : "bg-secondary text-muted-foreground"
                      }`}
                      style={taskPriority === p.value ? { backgroundColor: p.color } : undefined}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de tarea</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TASK_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTaskTypeValue(t.value as Task["type"])}
                      className={`flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        taskTypeValue === t.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <span>{t.emoji}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Descripcion <span className="text-muted-foreground/50">— soporta $LaTeX$</span>
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Detalles... Usa $ecuacion$ para math"
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-sm"
                />
              </div>

              {/* Context badge */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/50 border border-border text-xs text-muted-foreground">
                <span className="text-sm">{subject?.emoji}</span>
                <span>{subject?.name} &middot; {classSession?.title}</span>
              </div>
            </div>
          ) : (
            /* Notes/Resource form */
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Contenido <span className="text-muted-foreground/50">— soporta $LaTeX$</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe aqui... Usa $ecuacion$ para math inline"
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tags (separados por coma)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="calculo-vectorial, integrales"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Diagram and image toolbar — Notes/Resource only */}
              {(entryType === "notes" || entryType === "resource") && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => noteImageInputRef.current?.click()}
                      disabled={uploadingNoteImage}
                      aria-label="Adjuntar imagen o escaneo"
                      className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-xs font-medium active:scale-[0.98] transition-transform disabled:opacity-50 touch-target"
                    >
                      {uploadingNoteImage
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo...</>
                        : <><ImagePlus className="w-3.5 h-3.5" /> Adjuntar imagen</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDiagramGen((v) => !v); setDiagramPrompt(""); }}
                      aria-label="Generar diagrama con IA"
                      className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl text-xs font-medium active:scale-[0.98] transition-transform touch-target ${
                        showDiagramGen ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                      }`}
                    >
                      <GitBranch className="w-3.5 h-3.5" /> Diagrama IA
                    </button>
                  </div>

                  {showDiagramGen && (
                    <div className="rounded-xl bg-secondary/50 border border-border p-3 space-y-2">
                      <p className="text-[11px] text-muted-foreground">Describe el diagrama que quieres generar</p>
                      <input
                        type="text"
                        value={diagramPrompt}
                        onChange={(e) => setDiagramPrompt(e.target.value)}
                        placeholder="Ej: diagrama de flujo de un algoritmo de ordenamiento burbuja"
                        onKeyDown={(e) => { if (e.key === "Enter") handleGenerateDiagram(); }}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        onClick={handleGenerateDiagram}
                        disabled={generatingDiagram || !diagramPrompt.trim()}
                        className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {generatingDiagram
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
                          : <><Sparkles className="w-3.5 h-3.5" /> Generar diagrama</>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {entryType !== "voice" && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : entryType === "task" ? "Crear tarea" : "Crear entrada"}
            </button>
          )}
        </div>
      </Sheet>

      {/* Scan Sheet */}
      <Sheet open={showScan} onClose={() => setShowScan(false)} title="Escanear contenido">
        <div className="space-y-4">
          {/* Images */}
          {scanImages.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-6 text-center">
              <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-3">Captura o sube imagenes</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  <Camera className="w-3.5 h-3.5" /> Camara
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium active:scale-[0.98] transition-transform"
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Galeria
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {scanImages.map((img, i) => (
                <div key={i} className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeScanImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground"
              >
                <Camera className="w-4 h-4" />
                <span className="text-[9px]">Mas</span>
              </button>
            </div>
          )}

          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleScanFiles(e.target.files)} className="hidden" />
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleScanFiles(e.target.files)} className="hidden" />
          {/* Hidden input for attaching images to notes */}
          <input
            ref={noteImageInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleNoteImageUpload(file);
              e.target.value = "";
            }}
            className="hidden"
          />

          {/* Scan type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Que buscar</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: "auto" as const, label: "Auto", icon: Sparkles },
                { value: "notes" as const, label: "Apuntes", icon: FileText },
                { value: "task" as const, label: "Tareas", icon: CheckSquare },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setScanType(t.value)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    scanType === t.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Context badge */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/50 border border-border text-xs">
            <span className="text-base">{subject?.emoji}</span>
            <span className="text-muted-foreground">
              {subject?.name} &middot; {classSession?.title}
            </span>
          </div>

          <button
            onClick={handleProcess}
            disabled={scanImages.length === 0 || processing}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {processing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {processStep}</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Procesar con IA</>
            )}
          </button>
        </div>
      </Sheet>

      {/* Scan Result: Tasks (from "task" or "both") */}
      {(scanResult?.type === "task" || scanResult?.type === "both") && editTasks.length > 0 && (
        <Sheet
          open={showScanResult}
          onClose={() => { setShowScanResult(false); clearScan(); }}
          title={scanResult.type === "both" ? `${editTasks.length} tarea(s) + apuntes` : `${editTasks.length} tarea(s) detectada(s)`}
        >
          <div className="space-y-3">
            {/* Task list with checkboxes */}
            <div className="space-y-2">
              {editTasks.map((task, idx) => (
                <div
                  key={idx}
                  onClick={() => setEditingTaskIdx(idx)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                    editingTaskIdx === idx ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); updateTaskField(idx, "selected", !task.selected); }}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                      task.selected ? "bg-primary border-primary" : "border-border"
                    }`}
                  >
                    {task.selected && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block"><MarkdownMath content={task.title || "Sin titulo"} inline /></span>
                    <p className="text-[11px] text-muted-foreground">
                      {task.dueDate || "Sin fecha"} &middot; {task.priority}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Edit selected task */}
            {currentTask && (
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground">
                  Editando tarea {editingTaskIdx + 1} de {editTasks.length}
                </p>

                {currentTask.dateConfidence === "low" && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Fecha con baja confianza
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Titulo</label>
                  <input
                    type="text"
                    value={currentTask.title}
                    onChange={(e) => updateTaskField(editingTaskIdx, "title", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 overflow-hidden">
                  <div className="min-w-0 overflow-hidden">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block truncate">Asignada</label>
                    <input
                      type="date"
                      value={currentTask.assignedDate}
                      onChange={(e) => updateTaskField(editingTaskIdx, "assignedDate", e.target.value)}
                      className="w-full min-w-0 max-w-full px-1.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark] text-xs"
                    />
                  </div>
                  <div className="min-w-0 overflow-hidden">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block truncate">Entrega</label>
                    <input
                      type="date"
                      value={currentTask.dueDate}
                      onChange={(e) => updateTaskField(editingTaskIdx, "dueDate", e.target.value)}
                      className="w-full min-w-0 max-w-full px-1.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary [color-scheme:dark] text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridad</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TASK_PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => updateTaskField(editingTaskIdx, "priority", p.value)}
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${
                          currentTask.priority === p.value ? "text-white" : "bg-secondary text-muted-foreground"
                        }`}
                        style={currentTask.priority === p.value ? { backgroundColor: p.color } : undefined}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {currentTask.description && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripcion</label>
                    <textarea
                      value={currentTask.description}
                      onChange={(e) => updateTaskField(editingTaskIdx, "description", e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TASK_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => updateTaskField(editingTaskIdx, "taskType", t.value)}
                        className={`flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium transition-all ${
                          currentTask.taskType === t.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        <span>{t.emoji}</span> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notes preview when both detected */}
            {scanResult?.type === "both" && editNotesContent.trim() && (
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Apuntes detectados (se guardaran tambien)</p>
                <div className="p-2.5 rounded-xl bg-secondary/50 border border-border max-h-28 overflow-y-auto">
                  <MarkdownMath content={editNotesContent} className="text-xs" />
                </div>
              </div>
            )}

            <button
              onClick={handleSaveScanTasks}
              disabled={savingScan || editTasks.filter((t) => t.selected).length === 0}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {savingScan ? "Guardando..." : scanResult?.type === "both" && editNotesContent.trim()
                ? `Guardar ${editTasks.filter((t) => t.selected).length} tarea(s) + apuntes`
                : `Guardar ${editTasks.filter((t) => t.selected).length} tarea(s)`}
            </button>
          </div>
        </Sheet>
      )}

      {/* Scan Result: Notes only (no tasks detected) */}
      {((scanResult?.type === "notes") || (scanResult?.type === "both" && editTasks.length === 0)) && editNotesContent.trim() && (
        <Sheet
          open={showScanResult}
          onClose={() => { setShowScanResult(false); clearScan(); }}
          title="Apuntes detectados"
        >
          <div className="space-y-3.5">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Preview</label>
              <div className="p-3 rounded-xl bg-secondary/50 border border-border max-h-36 overflow-y-auto">
                <MarkdownMath content={editNotesContent} className="text-xs" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Contenido <span className="text-muted-foreground/50">— editable, soporta $LaTeX$</span>
              </label>
              <textarea
                value={editNotesContent}
                onChange={(e) => setEditNotesContent(e.target.value)}
                rows={5}
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-sm leading-relaxed"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
              <input
                type="text"
                value={editNotesTags}
                onChange={(e) => setEditNotesTags(e.target.value)}
                placeholder="separados por coma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <button
              onClick={handleSaveScanNotes}
              disabled={savingScan}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {savingScan ? "Guardando..." : "Guardar apuntes"}
            </button>
          </div>
        </Sheet>
      )}

      <Confirm open={!!deleteId} title="Eliminar entrada" message="Se eliminara esta entrada permanentemente." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />

      {/* Notes Reader Fullscreen */}
      {readerEntry && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header */}
          <div
            className="shrink-0 px-4 pt-safe pb-3 border-b border-border"
            style={{ background: `linear-gradient(135deg, ${color}15 0%, transparent 60%)` }}
          >
            <button
              onClick={() => setReaderEntry(null)}
              className="flex items-center gap-1.5 text-muted-foreground mb-2 active:opacity-70 touch-target"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">{subject?.name || "Volver"}</span>
            </button>
            <h1 className="text-lg font-bold leading-tight">
              {readerEntry.content.match(/^##?\s+(.+)/m)?.[1] || "Apuntes"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {readerEntry.createdAt.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
              </span>
              {classSession && (
                <span className="text-xs text-muted-foreground">&middot; {classSession.title}</span>
              )}
            </div>
            {readerEntry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {readerEntry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{ backgroundColor: color + "20", color }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <MarkdownMath content={readerEntry.content} />
          </div>

          {/* Floating actions */}
          <div className="shrink-0 px-4 pb-safe pt-2 border-t border-border bg-background/80 backdrop-blur-lg">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => { const entry = readerEntry; setReaderEntry(null); openEdit(entry); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium active:scale-[0.97] transition-transform"
              >
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button
                onClick={() => { handleGenerateFlashcards(readerEntry); }}
                disabled={generatingId === readerEntry.id}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium active:scale-[0.97] transition-transform disabled:opacity-50"
                style={{ backgroundColor: color + "20", color }}
              >
                {generatingId === readerEntry.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                ) : (
                  <><Layers className="w-4 h-4" /> Flashcards</>
                )}
              </button>
              <button
                onClick={() => { const id = readerEntry.id; setReaderEntry(null); setDeleteId(id); }}
                className="px-3 py-2.5 rounded-xl bg-destructive/10 text-destructive active:scale-[0.97] transition-transform"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
