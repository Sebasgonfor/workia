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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { BoardEntry } from "@/types";

export function useBoardEntries(subjectId: string | null, classId: string | null) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<BoardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectId || !classId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(
        db, "users", user.uid, "subjects", subjectId, "classes", classId, "entries"
      ),
      orderBy("order", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          classSessionId: classId,
          subjectId,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (d.data().updatedAt as Timestamp)?.toDate() || new Date(),
        })) as BoardEntry[];
        setEntries(data);
        setLoading(false);
      },
      (error) => {
        console.error("useBoardEntries snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId, classId]);

  const addEntry = useCallback(
    async (data: { type: BoardEntry["type"]; content: string; tags: string[]; sourceImages?: string[] }) => {
      if (!user || !subjectId || !classId) return;
      await addDoc(
        collection(
          db, "users", user.uid, "subjects", subjectId, "classes", classId, "entries"
        ),
        {
          type: data.type,
          content: data.content,
          rawContent: data.content,
          sourceImages: data.sourceImages || [],
          tags: data.tags,
          order: entries.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    },
    [user, subjectId, classId, entries.length]
  );

  const updateEntry = useCallback(
    async (id: string, data: { type?: BoardEntry["type"]; content?: string; tags?: string[]; sourceImages?: string[] }) => {
      if (!user || !subjectId || !classId) return;
      const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (data.type !== undefined) updateData.type = data.type;
      if (data.content !== undefined) {
        updateData.content = data.content;
        updateData.rawContent = data.content;
      }
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.sourceImages !== undefined) updateData.sourceImages = data.sourceImages;
      await updateDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "classes", classId, "entries", id),
        updateData
      );
    },
    [user, subjectId, classId]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!user || !subjectId || !classId) return;
      await deleteDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "classes", classId, "entries", id)
      );
    },
    [user, subjectId, classId]
  );

  return { entries, loading, addEntry, updateEntry, deleteEntry };
}
