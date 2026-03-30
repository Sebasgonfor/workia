# SPEC 01: Project Architecture Restructure

## Goal
Split the monolithic `hooks.ts` (1300+ lines) into individual hook files and create a services layer for shared AI logic.

## Current State
- `src/lib/hooks.ts` contains ALL 15+ hooks in one file
- API routes duplicate Gemini initialization and content cleaning logic
- Components mix layout, study, and analytics concerns

## Target Structure
```
src/lib/
├── hooks/
│   ├── index.ts              # Re-exports all hooks
│   ├── useSubjects.ts
│   ├── useClasses.ts
│   ├── useBoardEntries.ts
│   ├── useTasks.ts
│   ├── useFlashcards.ts
│   ├── useSchedule.ts
│   ├── useGrades.ts
│   ├── useQuizzes.ts
│   ├── useSubjectDocuments.ts
│   ├── useClassDocuments.ts
│   ├── useTaskSolverChat.ts
│   ├── useDynamicBoard.ts
│   ├── useNotesChat.ts
│   ├── useChatConversations.ts
│   ├── useDigitalizations.ts
│   ├── useFeynmanSessions.ts  # NEW
│   ├── useMasteryData.ts      # NEW
│   └── useStudyKit.ts         # NEW
├── services/
│   ├── gemini.ts              # Shared Gemini client + helpers
│   └── content-cleaner.ts     # Shared content cleaning for prompts
├── firebase.ts                # Existing
├── auth-context.tsx           # Existing
└── utils.ts                   # Existing
```

## Implementation
1. Create `src/lib/hooks/` directory
2. Extract each hook into its own file (preserve exact logic)
3. Create `src/lib/hooks/index.ts` that re-exports everything
4. Create `src/lib/services/gemini.ts` with shared Gemini init
5. Create `src/lib/services/content-cleaner.ts` with shared cleaning
6. Update all imports across the codebase
7. Delete original `src/lib/hooks.ts`

## Acceptance Criteria
- All existing imports `from "@/lib/hooks"` continue to work via index re-exports
- No behavioral changes to any existing feature
- Each hook file is self-contained with its own Firebase imports
- `sm2` algorithm extracted alongside `useFlashcards.ts`
- `fetchQuizById` exported from `useQuizzes.ts`
