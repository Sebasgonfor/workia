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
import type { ClassDocument } from "@/types";

export function useClassDocuments(subjectId: string | null, classId: string | null) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ClassDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectId || !classId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(
        db, "users", user.uid, "subjects", subjectId, "classes", classId, "documents"
      ),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          subjectId,
          classSessionId: classId,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as ClassDocument[];
        setDocuments(data);
        setLoading(false);
      },
      (error) => {
        console.error("useClassDocuments snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId, classId]);

  const addDocument = useCallback(
    async (data: Omit<ClassDocument, "id" | "createdAt" | "subjectId" | "classSessionId">) => {
      if (!user || !subjectId || !classId) return;
      await addDoc(
        collection(
          db, "users", user.uid, "subjects", subjectId, "classes", classId, "documents"
        ),
        {
          ...data,
          subjectId,
          classSessionId: classId,
          createdAt: serverTimestamp(),
        }
      );
    },
    [user, subjectId, classId]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      if (!user || !subjectId || !classId) return;
      await deleteDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "classes", classId, "documents", id)
      );
    },
    [user, subjectId, classId]
  );

  return { documents, loading, addDocument, deleteDocument };
}
