"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { FeynmanSession, FeynmanFeedback } from "@/types";

export function useFeynmanSessions(subjectId?: string | null) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<FeynmanSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, "users", user.uid, "feynmanSessions");
    const q = subjectId
      ? query(ref, where("subjectId", "==", subjectId), orderBy("createdAt", "desc"))
      : query(ref, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as FeynmanSession[];
        setSessions(data);
        setLoading(false);
      },
      (error) => {
        console.error("useFeynmanSessions snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId]);

  const addSession = useCallback(
    async (data: {
      subjectId: string;
      classSessionId: string;
      concept: string;
      score: number;
      userExplanation: string;
      feedback: FeynmanFeedback;
    }) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "feynmanSessions"), {
        ...data,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  return { sessions, loading, addSession };
}
