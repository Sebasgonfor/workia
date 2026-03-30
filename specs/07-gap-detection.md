# SPEC 07: Gap Detection & Progressive Quizzes

## Goal
AI analyzes student's notes and identifies knowledge gaps. Progressive quizzes adapt difficulty based on performance.

## Gap Detection

### API Route: `src/app/api/gaps/detect/route.ts`
- Input: `{ content: string, subjectName: string, existingConcepts?: string[] }`
- Output: `{ gaps: Array<{ topic: string, description: string, severity: "critical"|"moderate"|"minor", suggestion: string }> }`
- AI analyzes notes for incomplete explanations, missing prerequisites, or concepts mentioned but not explained

### Component: `src/components/study/gap-detector.tsx`
- Props: `{ content: string, subjectName: string }`
- Shows gaps as cards sorted by severity
- Each gap card has: topic, description, severity badge, and "Profundizar" action
- "Profundizar" opens the Socratic Tutor on that specific gap topic

## Progressive Quizzes

### API Route: `src/app/api/quiz/progressive/route.ts`
- Input: `{ content, subjectName, difficulty: "recognition"|"recall"|"application", previousResults? }`
- Output: Same quiz format but with difficulty-appropriate questions
- Recognition (easy): MCQ with obvious distractors
- Recall (medium): Short answer / fill-in-the-blank style MCQ
- Application (hard): Scenario-based problems requiring concept application

### Enhanced Quiz Component
- Modify existing quiz flow to support progressive difficulty
- After completing a quiz, suggest next difficulty level based on score:
  - Score ≥ 80%: advance to next level
  - Score 50-79%: retry same level
  - Score < 50%: go down one level
- Visual level indicator: 🟢 Recognition → 🟡 Recall → 🔴 Application

### Types: Add to `src/types/index.ts`
```typescript
export interface KnowledgeGap {
  topic: string;
  description: string;
  severity: "critical" | "moderate" | "minor";
  suggestion: string;
}

export type QuizDifficulty = "recognition" | "recall" | "application";
```
