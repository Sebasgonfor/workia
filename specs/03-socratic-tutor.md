# SPEC 03: Socratic Tutor

## Goal
Instead of explaining directly, the AI asks guiding questions that lead the student to understand the concept themselves. Tracks comprehension through the dialogue.

## User Flow
1. From class board, user taps "Tutor Socrático"
2. User selects or types a topic they want to understand
3. AI responds ONLY with guiding questions (never gives the answer directly)
4. Multi-turn conversation where AI adapts questions based on responses
5. When student demonstrates understanding, AI confirms and provides a summary
6. Session is scored and saved for mastery tracking

## New Files

### API Route: `src/app/api/socratic/route.ts`
- Streaming endpoint (like notes-chat)
- Input: `{ subjectName, classTitle, notesContent, topic, messages, currentDate }`
- System instruction: NEVER answer directly, only ask questions
- Special ending: when student shows mastery, respond with ````mastery\n{score, summary}\n```

### Component: `src/components/study/socratic-tutor.tsx`
- Props: `{ subjectId, classId, subjectName, classTitle, notesContent }`
- Chat-like UI with distinct styling (different from regular chat)
- Purple/indigo theme to differentiate from regular AI chat
- Topic input at start
- Mastery detection: parses ````mastery``` blocks
- Session auto-saved when mastery is achieved

### Types: Add to `src/types/index.ts`
```typescript
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
```

## System Prompt Rules
1. NEVER give direct answers - only ask guiding questions
2. Start with broad questions, narrow down based on student responses
3. If student is completely lost, give a small hint then ask again
4. If student gives wrong answer, ask them to reconsider with a targeted question
5. After 3-5 correct consecutive answers, declare mastery
6. Keep questions relevant to the notes content provided
7. Use LaTeX for formulas, keep questions concise
