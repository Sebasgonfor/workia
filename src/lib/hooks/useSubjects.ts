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
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Subject } from "@/types";

export function useSubjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubjects([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "subjects"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date(),
        })) as Subject[];
        setSubjects(data);
        setLoading(false);
      },
      (error) => {
        console.error("useSubjects snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addSubject = useCallback(
    async (data: Pick<Subject, "name" | "color" | "emoji"> & { cycleId?: string | null }) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "subjects"), {
        cycleId: null,
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const updateSubject = useCallback(
    async (id: string, data: Partial<Pick<Subject, "name" | "color" | "emoji" | "cycleId">>) => {
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid, "subjects", id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const deleteSubject = useCallback(
    async (id: string) => {
      if (!user) return;
      const batch = writeBatch(db);
      // Delete entries from each class
      const classesRef = collection(db, "users", user.uid, "subjects", id, "classes");
      const classesSnap = await getDocs(classesRef);
      for (const classDoc of classesSnap.docs) {
        const entriesRef = collection(classDoc.ref, "entries");
        const entriesSnap = await getDocs(entriesRef);
        entriesSnap.docs.forEach((d) => batch.delete(d.ref));
        const classDocsRef = collection(classDoc.ref, "documents");
        const classDocsSnap = await getDocs(classDocsRef);
        classDocsSnap.docs.forEach((d) => batch.delete(d.ref));
        batch.delete(classDoc.ref);
      }
      // Delete tasks linked to this subject
      const tasksRef = collection(db, "users", user.uid, "tasks");
      const tasksQ = query(tasksRef, where("subjectId", "==", id));
      const tasksSnap = await getDocs(tasksQ);
      tasksSnap.docs.forEach((d) => batch.delete(d.ref));
      // Delete the subject itself
      batch.delete(doc(db, "users", user.uid, "subjects", id));
      await batch.commit();
    },
    [user]
  );

  return { subjects, loading, addSubject, updateSubject, deleteSubject };
}
