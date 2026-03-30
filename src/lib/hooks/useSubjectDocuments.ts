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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { SubjectDocument } from "@/types";

export function useSubjectDocuments(subjectId: string | null) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<SubjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "subjects", subjectId, "documents"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          subjectId,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as SubjectDocument[];
        setDocuments(data);
        setLoading(false);
      },
      (error) => {
        console.error("useSubjectDocuments snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId]);

  const addDocument = useCallback(
    async (data: Omit<SubjectDocument, "id" | "createdAt" | "subjectId">) => {
      if (!user || !subjectId) return;
      await addDoc(
        collection(db, "users", user.uid, "subjects", subjectId, "documents"),
        {
          ...data,
          subjectId,
          createdAt: serverTimestamp(),
        }
      );
    },
    [user, subjectId]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      if (!user || !subjectId) return;
      await deleteDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "documents", id)
      );
    },
    [user, subjectId]
  );

  return { documents, loading, addDocument, deleteDocument };
}
