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

function sm2(easeFactor: number, interval: number, repetitions: number, quality: number) {
  let ef = easeFactor;
  let iv = interval;
  let rep = repetitions;

  if (quality >= 3) {
    if (rep === 0) iv = 1;
    else if (rep === 1) iv = 6;
    else iv = Math.round(iv * ef);
    rep += 1;
  } else {
    rep = 0;
    iv = 1;
  }

  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + iv);
  nextReview.setHours(0, 0, 0, 0);

  return { easeFactor: ef, interval: iv, repetitions: rep, nextReview };
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
      const result = sm2(card.easeFactor, card.interval, card.repetitions, quality);
      await updateDoc(doc(db, "users", user.uid, "flashcards", id), {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
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
