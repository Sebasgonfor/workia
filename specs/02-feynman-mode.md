# SPEC 02: Feynman Mode (Teach-Back)

## Goal
Student selects a concept from their notes, the app hides the notes, and asks them to explain it in their own words. AI compares their explanation to the original and identifies gaps, mistakes, and oversimplifications.

## User Flow
1. From any class board entry or dynamic board, user taps "Modo Feynman"
2. AI extracts key concepts from the notes and presents them as selectable chips
3. User selects a concept → notes are hidden
4. Text area appears: "Explica este concepto con tus propias palabras"
5. User types/speaks their explanation
6. AI analyzes: compares user's explanation vs original notes
7. Returns a scored report:
   - Accuracy score (0-100)
   - What they got RIGHT (green)
   - What they MISSED (yellow)
   - What they got WRONG (red)
   - Suggestions for deeper understanding
8. User can retry or pick another concept

## New Files

### API Route: `src/app/api/feynman/extract/route.ts`
- Input: `{ content: string, subjectName: string }`
- Output: `{ concepts: Array<{ id: string, name: string, difficulty: "basic"|"intermediate"|"advanced" }> }`
- Uses Gemini to extract key concepts from notes content

### API Route: `src/app/api/feynman/evaluate/route.ts`
- Input: `{ concept: string, originalContent: string, userExplanation: string, subjectName: string }`
- Output: `{ score: number, correct: string[], missed: string[], wrong: string[], suggestions: string[], detailedFeedback: string }`
- Uses Gemini to compare user explanation vs source material

### Component: `src/components/study/feynman-mode.tsx`
- Props: `{ content: string, subjectName: string, subjectId: string, classId: string }`
- States: concept-selection → writing → evaluating → results
- Stores session results in Firestore for mastery tracking

### Hook: `src/lib/hooks/useFeynmanSessions.ts`
- Firestore path: `users/{uid}/feynmanSessions/{sessionId}`
- Fields: `{ subjectId, classSessionId, concept, score, attempts, createdAt }`
- Used by mastery dashboard to track comprehension

### Types: Add to `src/types/index.ts`
```typescript
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
```

## UI Design
- Full-screen overlay (sheet) when activated
- Step indicator at top (1. Elegir concepto → 2. Explicar → 3. Resultados)
- Results use color-coded cards: green/yellow/red sections
- Circular score gauge at the top of results
- "Reintentar" and "Otro concepto" buttons at bottom
