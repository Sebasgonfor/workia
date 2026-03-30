# SPEC 05: Lecture-to-Study-Kit Pipeline

## Goal
One-click generation: from any class notes, generate a complete study kit containing summary, flashcards, quiz, key concepts mind map, and a study plan.

## User Flow
1. From class board, user taps "Generar Kit de Estudio"
2. Loading screen shows progress for each component
3. Results displayed in a tabbed interface:
   - Tab 1: Resumen (condensed summary)
   - Tab 2: Flashcards (auto-generated, ready to add)
   - Tab 3: Quiz (auto-generated, ready to take)
   - Tab 4: Conceptos Clave (extracted key concepts with relationships)
4. User can save individual components or the entire kit

## New Files

### API Route: `src/app/api/study-kit/generate/route.ts`
- Input: `{ content: string, subjectName: string, subjectDocuments?: DocRef[] }`
- Output: `{ summary, flashcards[], quiz, keyConcepts[] }`
- Single Gemini call that generates ALL components at once
- Uses structured JSON output

### Component: `src/components/study/study-kit-generator.tsx`
- Props: `{ content: string, subjectName: string, subjectId: string, classId: string, subjectDocuments }`
- States: idle → generating → results
- Tabbed results view
- "Guardar todo" button that saves flashcards and quiz to Firestore

### Types: Add to `src/types/index.ts`
```typescript
export interface StudyKit {
  summary: string;                    // Markdown summary
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
```

## UI Design
- Bottom sheet that opens full screen
- Progress indicator showing which components are being generated
- Tabs with icons: 📝 Resumen | 🃏 Flashcards | ❓ Quiz | 🔑 Conceptos
- Each tab has a "Guardar" action
- Summary tab renders markdown with MarkdownMath component
- Flashcards tab shows preview cards with swipe
- Quiz tab shows question count and "Empezar" button
- Concepts tab shows chips with relationships
