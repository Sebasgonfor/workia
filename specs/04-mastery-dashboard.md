# SPEC 04: Mastery Dashboard

## Goal
Single view showing mastery level across all topics using data from flashcards, quizzes, Feynman sessions, and Socratic sessions. Color-coded from red to green.

## Data Sources
1. **Flashcard reviews**: SM-2 data (easeFactor, repetitions, interval)
2. **Quiz attempts**: scores per subject
3. **Feynman sessions**: comprehension scores per concept
4. **Socratic sessions**: mastery flags per topic

## New Files

### Page: `src/app/dominio/page.tsx`
- New route `/dominio` (mastery)
- Fetches all mastery data across subjects
- Displays aggregated mastery metrics

### Hook: `src/lib/hooks/useMasteryData.ts`
- Aggregates data from multiple Firestore collections:
  - `users/{uid}/flashcards` → group by subject, calc avg easeFactor
  - `users/{uid}/quizAttempts` → group by subject, calc avg score
  - `users/{uid}/feynmanSessions` → group by subject, calc avg score
  - `users/{uid}/socraticSessions` → group by subject, count mastered
- Returns: `MasteryData[]` per subject with computed mastery percentage

### Types: Add to `src/types/index.ts`
```typescript
export interface SubjectMastery {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  subjectEmoji: string;
  flashcardMastery: number;    // 0-100, from avg easeFactor
  quizMastery: number;         // 0-100, from avg quiz scores
  feynmanMastery: number;      // 0-100, from avg feynman scores
  socraticMastery: number;     // 0-100, from % topics mastered
  overallMastery: number;      // weighted average
  totalStudyItems: number;
  conceptsToReview: string[];  // low-scoring concepts
}
```

## UI Design

### Header Section
- Overall mastery percentage in large circular gauge
- "Tu dominio general" label
- Streak indicator (days studied in a row)

### Subject Cards
- One card per subject with subject color accent
- Circular mini-gauge showing overall mastery %
- Breakdown bars: Flashcards | Quizzes | Feynman | Socrático
- Color: red (<40%), yellow (40-70%), green (>70%)
- Tap to expand: shows concepts needing review

### Bottom Stats
- Total flashcards reviewed today
- Concepts mastered this week
- Suggested next study action

## Navigation
- Add "Dominio" to bottom nav (replace or add alongside existing items)
- Icon: `Trophy` or `BarChart3` from lucide-react
