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
  assignedDate: Date;
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

// ── Schedule ──

export interface ScheduleSlot {
  id: string;
  subjectId: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Dom, 1=Lun … 6=Sab
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  room: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const DAYS_OF_WEEK = [
  { value: 1 as const, label: "Lun", full: "Lunes" },
  { value: 2 as const, label: "Mar", full: "Martes" },
  { value: 3 as const, label: "Mie", full: "Miercoles" },
  { value: 4 as const, label: "Jue", full: "Jueves" },
  { value: 5 as const, label: "Vie", full: "Viernes" },
  { value: 6 as const, label: "Sab", full: "Sabado" },
  { value: 0 as const, label: "Dom", full: "Domingo" },
] as const;

export const SCHEDULE_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6–22

// ── Grades ──

export interface CorteGrades {
  formativa1: number | null;
  formativa2: number | null;
  parcial: number | null;
}

export interface SubjectGradeRecord {
  subjectId: string;
  corte1: CorteGrades;
  corte2: CorteGrades;
  corte3: CorteGrades;
  updatedAt: Date;
}

/** Weights for each corte: 30%, 30%, 40% */
export const CORTE_WEIGHTS = [0.30, 0.30, 0.40] as const;

/** Minimum passing grade on a 0–5 scale */
export const MIN_PASSING_GRADE = 3.0;

/** Maximum grade on a 0–5 scale */
export const MAX_GRADE = 5.0;

// ── Quiz ──

export interface QuizQuestion {
  id: string;
  question: string;
  type: "multiple_choice" | "true_false";
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  subjectId: string;
  subjectName: string;
  entryId: string | null;
  title: string;
  questions: QuizQuestion[];
  createdAt: Date;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  subjectId: string;
  subjectName: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  completedAt: Date;
}

/** Returns the next occurrence date+slot for a given subject, or null if no slots exist. */
export const nextClassDate = (
  slots: ScheduleSlot[],
  subjectId: string
): { date: Date; slot: ScheduleSlot } | null => {
  const subjectSlots = slots.filter((s) => s.subjectId === subjectId);
  if (subjectSlots.length === 0) return null;

  const now = new Date();
  let best: { date: Date; slot: ScheduleSlot } | null = null;

  for (const slot of subjectSlots) {
    const [slotH, slotM] = slot.startTime.split(":").map(Number);
    let daysAhead = (slot.dayOfWeek - now.getDay() + 7) % 7;
    // If same day but time already passed, move to next week
    if (
      daysAhead === 0 &&
      (now.getHours() > slotH || (now.getHours() === slotH && now.getMinutes() >= slotM))
    ) {
      daysAhead = 7;
    }
    const date = new Date(now);
    date.setDate(date.getDate() + daysAhead);
    date.setHours(slotH, slotM, 0, 0);
    if (!best || date < best.date) best = { date, slot };
  }

  return best;
};
