"use client";

import { useState, useEffect, useCallback } from "react";
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { DynamicBoard } from "@/types";

export function useDynamicBoard(subjectId: string | null, classId: string | null) {
  const { user } = useAuth();
  const [board, setBoard] = useState<DynamicBoard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectId || !classId) {
      setBoard(null);
      setLoading(false);
      return;
    }

    const docRef = doc(
      db,
      "users", user.uid,
      "subjects", subjectId,
      "classes", classId,
      "dynamicBoard", "main"
    );

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setBoard({
            id: snap.id,
            subjectId: subjectId,
            classSessionId: classId,
            content: data.content || "",
            sourceImages: data.sourceImages || [],
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
          });
        } else {
          setBoard(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("useDynamicBoard error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId, classId]);

  const saveBoard = useCallback(
    async (content: string, newSourceImages: string[] = []) => {
      if (!user || !subjectId || !classId) return;
      const docRef = doc(
        db,
        "users", user.uid,
        "subjects", subjectId,
        "classes", classId,
        "dynamicBoard", "main"
      );
      const existing = board?.sourceImages || [];
      const merged = Array.from(new Set([...existing, ...newSourceImages]));
      await setDoc(
        docRef,
        {
          content,
          sourceImages: merged,
          updatedAt: serverTimestamp(),
          ...(board ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );
    },
    [user, subjectId, classId, board]
  );

  const clearBoard = useCallback(async () => {
    if (!user || !subjectId || !classId) return;
    const docRef = doc(
      db,
      "users", user.uid,
      "subjects", subjectId,
      "classes", classId,
      "dynamicBoard", "main"
    );
    await setDoc(docRef, {
      content: "",
      sourceImages: [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }, [user, subjectId, classId]);

  return { board, loading, saveBoard, clearBoard };
}
