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
  noteId: string;
  subjectId: string;
  question: string;
  answer: string;
  type: "definition" | "application" | "comparison" | "calculation";
  mastery: number;
  nextReview: Date;
  reviewCount: number;
}

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
