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
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { ClassSession } from "@/types";

export function useClasses(subjectId: string | null) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectId) {
      setClasses([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "subjects", subjectId, "classes"),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          subjectId,
          date: (doc.data().date as Timestamp)?.toDate() || new Date(),
          createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date(),
        })) as ClassSession[];
        setClasses(data);
        setLoading(false);
      },
      (error) => {
        console.error("useClasses snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId]);

  const addClass = useCallback(
    async (data: { title: string; date: Date }) => {
      if (!user || !subjectId) return;
      await addDoc(
        collection(db, "users", user.uid, "subjects", subjectId, "classes"),
        {
          title: data.title,
          date: Timestamp.fromDate(data.date),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    },
    [user, subjectId]
  );

  const updateClass = useCallback(
    async (id: string, data: { title?: string; date?: Date }) => {
      if (!user || !subjectId) return;
      const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (data.title !== undefined) updateData.title = data.title;
      if (data.date !== undefined) updateData.date = Timestamp.fromDate(data.date);
      await updateDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "classes", id),
        updateData
      );
    },
    [user, subjectId]
  );

  const deleteClass = useCallback(
    async (id: string) => {
      if (!user || !subjectId) return;
      const batch = writeBatch(db);
      const entriesRef = collection(
        db, "users", user.uid, "subjects", subjectId, "classes", id, "entries"
      );
      const entriesSnap = await getDocs(entriesRef);
      entriesSnap.docs.forEach((d) => batch.delete(d.ref));
      // Delete class documents
      const docsRef = collection(
        db, "users", user.uid, "subjects", subjectId, "classes", id, "documents"
      );
      const docsSnap = await getDocs(docsRef);
      docsSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "users", user.uid, "subjects", subjectId, "classes", id));
      await batch.commit();
    },
    [user, subjectId]
  );

  return { classes, loading, addClass, updateClass, deleteClass };
}
