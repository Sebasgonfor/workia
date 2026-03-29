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
import type { SocraticSession } from "@/types";

export function useSocraticSessions(subjectId?: string | null) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SocraticSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, "users", user.uid, "socraticSessions");
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
        })) as SocraticSession[];
        setSessions(data);
        setLoading(false);
      },
      (error) => {
        console.error("useSocraticSessions snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId]);

  const addSession = useCallback(
    async (data: {
      subjectId: string;
      classSessionId: string;
      topic: string;
      score: number;
      messageCount: number;
      mastered: boolean;
    }) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "socraticSessions"), {
        ...data,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  return { sessions, loading, addSession };
}
