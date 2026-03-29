"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { SubjectGradeRecord } from "@/types";

export function useGrades() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<SubjectGradeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGrades([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "grades"),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          subjectId: d.id,
          ...d.data(),
          updatedAt: (d.data().updatedAt as Timestamp)?.toDate() || new Date(),
        })) as SubjectGradeRecord[];
        setGrades(data);
        setLoading(false);
      },
      (error) => {
        console.error("useGrades snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const saveGrades = useCallback(
    async (
      subjectId: string,
      data: Pick<SubjectGradeRecord, "corte1" | "corte2" | "corte3">
    ) => {
      if (!user) return;
      await setDoc(
        doc(db, "users", user.uid, "grades", subjectId),
        { ...data, updatedAt: serverTimestamp() },
        { merge: true }
      );
    },
    [user]
  );

  return { grades, loading, saveGrades };
}
