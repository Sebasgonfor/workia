export interface Subject {
  id: string;
  name: string;
  color: string;
  emoji: string;
  cycleId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CycleKind = "semestre" | "trimestre" | "año" | "otro";

export interface Cycle {
  id: string;
  name: string;
  kind: CycleKind;
  order: number;
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

// ── Class Documents ──

export interface ClassDocument {
  id: string;
  subjectId: string;
  classSessionId: string;
  name: string;
  url: string;
  publicId: string;
  fileType: string; // mime type
  fileSize: number; // bytes
  createdAt: Date;
}

// ── Subject Documents ──

export interface SubjectDocument {
  id: string;
  subjectId: string;
  name: string;
  url: string;
  publicId: string;
  fileType: string; // mime type, e.g. "application/pdf", "image/png"
  fileSize: number; // bytes
  createdAt: Date;
}

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

// ── Dynamic Board ──

export interface DynamicBoard {
  id: string;
  subjectId: string;
  classSessionId: string;
  content: string; // AI-enriched markdown
  sourceImages: string[]; // Cloudinary URLs of all uploaded photos
  createdAt: Date;
  updatedAt: Date;
}

// ── Task Solver Chat ──

export interface TaskSolverMessage {
  id: string;
  taskId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

// ── Notes AI Chat ──

export interface NotesChatMessage {
  id: string;
  subjectId: string;
  classSessionId: string;
  role: "user" | "assistant";
  content: string;
  imageUrls: string[];
  createdAt: Date;
}

export interface ChatConversation {
  id: string;
  subjectId: string;
  classSessionId: string;
  title: string;
  lastMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Digitalizations ──

export interface Digitalization {
  id: string;
  title: string;
  subjectId: string | null;
  classSessionId: string | null;
  sourceImages: string[];
  pdfUrl: string;
  pdfPublicId: string;
  pageCount: number;
  filter: DigitalizationFilter;
  createdAt: Date;
  updatedAt: Date;
}

export type DigitalizationFilter = "auto" | "document" | "grayscale" | "enhanced" | "original";

export const DIGITALIZATION_FILTERS = [
  { value: "auto" as const, label: "Auto", description: "Deteccion automatica" },
  { value: "document" as const, label: "Documento", description: "Blanco y negro limpio" },
  { value: "grayscale" as const, label: "Gris", description: "Escala de grises" },
  { value: "enhanced" as const, label: "Color+", description: "Color mejorado" },
  { value: "original" as const, label: "Original", description: "Sin cambios" },
] as const;

// ── Feynman Mode ──

export interface FeynmanSession {
  id: string;
  subjectId: string;
  classSessionId: string;
  concept: string;
  score: number;
  userExplanation: string;
  feedback: FeynmanFeedback;
  createdAt: Date;
}

export interface FeynmanFeedback {
  score: number;
  correct: string[];
  missed: string[];
  wrong: string[];
  suggestions: string[];
  detailedFeedback: string;
}

// ── Socratic Tutor ──

export interface SocraticSession {
  id: string;
  subjectId: string;
  classSessionId: string;
  topic: string;
  score: number;
  messageCount: number;
  mastered: boolean;
  createdAt: Date;
}

// ── Mastery Dashboard ──

export interface SubjectMastery {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  subjectEmoji: string;
  flashcardMastery: number;
  quizMastery: number;
  feynmanMastery: number;
  socraticMastery: number;
  overallMastery: number;
  totalStudyItems: number;
  conceptsToReview: string[];
}

// ── Study Kit ──

export interface StudyKit {
  summary: string;
  flashcards: Array<{
    question: string;
    answer: string;
    type: "definition" | "application" | "comparison" | "calculation";
  }>;
  quiz: {
    title: string;
    questions: Array<{
      id: string;
      question: string;
      type: "multiple_choice" | "true_false";
      options: string[];
      correctIndex: number;
      explanation: string;
    }>;
  };
  keyConcepts: Array<{
    name: string;
    definition: string;
    relatedConcepts: string[];
    importance: "high" | "medium" | "low";
  }>;
}

// ── Knowledge Graph ──

export interface GraphNode {
  id: string;
  label: string;
  subjectId: string;
  subjectColor: string;
  mastery: number;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  strength: number;
}

// ── Gap Detection ──

export interface KnowledgeGap {
  topic: string;
  description: string;
  severity: "critical" | "moderate" | "minor";
  suggestion: string;
}

export type QuizDifficulty = "recognition" | "recall" | "application";

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
