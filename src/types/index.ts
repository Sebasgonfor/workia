export interface Subject {
  id: string;
  name: string;
  color: string;
  emoji: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassSession {
  id: string;
  subjectId: string;
  date: Date;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardEntry {
  id: string;
  classSessionId: string;
  subjectId: string;
  type: "notes" | "task" | "resource";
  content: string; // Markdown enriched content
  rawContent: string; // Original OCR transcription
  sourceImages: string[];
  tags: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  description: string;
  dueDate: Date;
  status: "pending" | "in_progress" | "completed" | "overdue";
  priority: "high" | "medium" | "low";
  type: "taller" | "quiz" | "parcial" | "proyecto" | "lectura" | "otro";
  sourceImageUrl: string | null;
  classSessionId: string | null;
  createdAt: Date;
}

export interface Flashcard {
  id: string;
  subjectId: string;
  subjectName: string;
  noteId: string | null;
  question: string;
  answer: string;
  type: "definition" | "application" | "comparison" | "calculation";
  // SM-2 spaced repetition
  easeFactor: number; // default 2.5, min 1.3
  interval: number; // days between reviews
  repetitions: number; // consecutive correct reviews
  nextReview: Date;
  createdAt: Date;
}

export const FLASHCARD_TYPES = [
  { value: "definition", label: "Definicion" },
  { value: "application", label: "Aplicacion" },
  { value: "comparison", label: "Comparacion" },
  { value: "calculation", label: "Calculo" },
] as const;

export const REVIEW_RATINGS = [
  { value: 0, label: "Otra vez", color: "#ef4444" },
  { value: 3, label: "Dificil", color: "#f59e0b" },
  { value: 4, label: "Bien", color: "#10b981" },
  { value: 5, label: "Facil", color: "#3b82f6" },
] as const;

// Subject color presets
export const SUBJECT_COLORS = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ef4444", // red
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
] as const;

export const SUBJECT_EMOJIS = [
  "📐", "💻", "📊", "🧪", "📚", "🎨", "⚡", "🔬", "📝", "🌍",
  "🧮", "🏛️", "💡", "🔧", "📈", "🎵", "🧬", "⚖️", "🤖", "📖",
] as const;

export const TASK_TYPES = [
  { value: "taller", emoji: "🛠️", label: "Taller" },
  { value: "quiz", emoji: "❓", label: "Quiz" },
  { value: "parcial", emoji: "📝", label: "Parcial" },
  { value: "proyecto", emoji: "🚀", label: "Proyecto" },
  { value: "lectura", emoji: "📖", label: "Lectura" },
  { value: "otro", emoji: "📌", label: "Otro" },
] as const;

export const TASK_PRIORITIES = [
  { value: "high", color: "#ef4444", label: "Alta" },
  { value: "medium", color: "#f59e0b", label: "Media" },
  { value: "low", color: "#10b981", label: "Baja" },
] as const;

export const BOARD_ENTRY_TYPES = [
  { value: "notes", icon: "FileText", label: "Apuntes" },
  { value: "task", icon: "CheckSquare", label: "Tarea" },
  { value: "resource", icon: "Paperclip", label: "Recurso" },
] as const;
