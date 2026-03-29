"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Flashcard } from "@/types";

// ── FSRS Algorithm ──

interface FSRSState {
  stability: number;    // S: how many days the memory lasts
  difficulty: number;   // D: how hard the card is (1-10)
  reps: number;         // number of consecutive successful reviews
  lastReview: Date;
}

interface FSRSResult {
  stability: number;
  difficulty: number;
  reps: number;
  interval: number;
  nextReview: Date;
}

// Initial stability values by rating (Again=1, Hard=2, Good=3, Easy=4)
const INITIAL_STABILITY = [0.4, 0.9, 2.3, 5.5];

// Stability multipliers by rating for successful recall
const STABILITY_MULTIPLIERS = [0, 0.5, 2.5, 7.0];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fsrs(
  stability: number,
  difficulty: number,
  reps: number,
  lastReview: Date,
  rating: number // 1=Again, 2=Hard, 3=Good, 4=Easy
): FSRSResult {
  // Map quality (0,3,4,5) from old SM-2 scale to FSRS (1,2,3,4)
  let fsrsRating: number;
  if (rating === 0) fsrsRating = 1;       // Again
  else if (rating === 3) fsrsRating = 2;   // Hard
  else if (rating === 4) fsrsRating = 3;   // Good
  else fsrsRating = 4;                      // Easy

  let newS: number;
  let newD: number;
  let newReps: number;

  if (reps === 0) {
    // First review
    newS = INITIAL_STABILITY[fsrsRating - 1];
    newD = clamp(5 - (fsrsRating - 3), 1, 10);
    newReps = fsrsRating >= 2 ? 1 : 0;
  } else {
    // Subsequent reviews
    newD = clamp(difficulty + (fsrsRating - 3) * 0.1, 1, 10);

    if (fsrsRating === 1) {
      // Lapse - forgot the card
      newS = Math.max(0.5, stability * 0.3);
      newReps = 0;
    } else {
      // Successful recall
      const multiplier = STABILITY_MULTIPLIERS[fsrsRating - 1];
      newS = stability * (1 + multiplier * Math.pow(newD, -0.5) * Math.pow(stability, -0.2));
      newReps = reps + 1;
    }
  }

  // Calculate interval (days until next review)
  // With desired retention = 0.9, interval ≈ stability
  const interval = Math.max(1, Math.round(newS));

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  nextReview.setHours(0, 0, 0, 0);

  return {
    stability: newS,
    difficulty: newD,
    reps: newReps,
    interval,
    nextReview,
  };
}

export function useFlashcards(subjectId?: string | null) {
  const { user } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFlashcards([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, "users", user.uid, "flashcards");
    const q = subjectId
      ? query(ref, where("subjectId", "==", subjectId), orderBy("nextReview", "asc"))
      : query(ref, orderBy("nextReview", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          nextReview: (d.data().nextReview as Timestamp)?.toDate() || new Date(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as Flashcard[];
        setFlashcards(data);
        setLoading(false);
      },
      (error) => {
        console.error("useFlashcards snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId]);

  const addFlashcard = useCallback(
    async (data: Omit<Flashcard, "id" | "createdAt" | "easeFactor" | "interval" | "repetitions" | "nextReview">) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "flashcards"), {
        subjectId: data.subjectId,
        subjectName: data.subjectName,
        noteId: data.noteId,
        question: data.question,
        answer: data.answer,
        type: data.type,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: Timestamp.fromDate(new Date()),
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const addFlashcards = useCallback(
    async (cards: Omit<Flashcard, "id" | "createdAt" | "easeFactor" | "interval" | "repetitions" | "nextReview">[]) => {
      if (!user) return;
      const batch = writeBatch(db);
      const ref = collection(db, "users", user.uid, "flashcards");
      for (const data of cards) {
        const docRef = doc(ref);
        batch.set(docRef, {
          subjectId: data.subjectId,
          subjectName: data.subjectName,
          noteId: data.noteId,
          question: data.question,
          answer: data.answer,
          type: data.type,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReview: Timestamp.fromDate(new Date()),
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    },
    [user]
  );

  const reviewFlashcard = useCallback(
    async (id: string, quality: number) => {
      if (!user) return;
      const card = flashcards.find((f) => f.id === id);
      if (!card) return;

      // Use FSRS with backward compatibility
      // Map old SM-2 fields: easeFactor→stability (initially), interval stays, repetitions→reps
      const stability = card.interval > 0 ? card.interval : (card.easeFactor || 2.5);
      const difficulty = card.easeFactor ? clamp((3.0 - card.easeFactor) * 5 + 5, 1, 10) : 5;
      const lastReview = card.nextReview || new Date();

      const result = fsrs(stability, difficulty, card.repetitions, lastReview, quality);

      await updateDoc(doc(db, "users", user.uid, "flashcards", id), {
        easeFactor: result.stability,  // Store stability in easeFactor field for backward compat
        interval: result.interval,
        repetitions: result.reps,
        nextReview: Timestamp.fromDate(result.nextReview),
      });
    },
    [user, flashcards]
  );

  const deleteFlashcard = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "users", user.uid, "flashcards", id));
    },
    [user]
  );

  const dueCards = flashcards.filter((f) => f.nextReview <= new Date());

  return { flashcards, dueCards, loading, addFlashcard, addFlashcards, reviewFlashcard, deleteFlashcard };
}
