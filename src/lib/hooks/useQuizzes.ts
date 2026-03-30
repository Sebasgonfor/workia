"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Quiz, QuizAttempt } from "@/types";

export function useQuizzes(subjectId?: string | null) {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setQuizzes([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, "users", user.uid, "quizzes");
    const q = subjectId
      ? query(ref, where("subjectId", "==", subjectId), orderBy("createdAt", "desc"))
      : query(ref, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
      })) as Quiz[];
      setQuizzes(data);
      setLoading(false);
    }, (error) => {
      console.error("useQuizzes snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, subjectId]);

  const addQuiz = useCallback(
    async (data: Omit<Quiz, "id" | "createdAt">): Promise<string | null> => {
      if (!user) return null;
      const ref = await addDoc(collection(db, "users", user.uid, "quizzes"), {
        ...data,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    [user]
  );

  const deleteQuiz = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "users", user.uid, "quizzes", id));
    },
    [user]
  );

  const addAttempt = useCallback(
    async (data: Omit<QuizAttempt, "id" | "completedAt">) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "quizAttempts"), {
        ...data,
        completedAt: serverTimestamp(),
      });
    },
    [user]
  );

  return { quizzes, loading, addQuiz, deleteQuiz, addAttempt };
}

export async function fetchQuizById(userId: string, quizId: string): Promise<Quiz | null> {
  const snap = await getDoc(doc(db, "users", userId, "quizzes", quizId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
    createdAt: (snap.data().createdAt as Timestamp)?.toDate() || new Date(),
  } as Quiz;
}
