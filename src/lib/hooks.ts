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
import type { Subject, ClassSession } from "@/types";

// ── Subjects ──

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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
        updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date(),
      })) as Subject[];
      setSubjects(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addSubject = useCallback(
    async (data: Pick<Subject, "name" | "color" | "emoji">) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "subjects"), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const updateSubject = useCallback(
    async (id: string, data: Partial<Pick<Subject, "name" | "color" | "emoji">>) => {
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
      // Delete all classes in this subject first
      const classesRef = collection(db, "users", user.uid, "subjects", id, "classes");
      const classesSnap = await getDocs(classesRef);
      const batch = writeBatch(db);
      classesSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "users", user.uid, "subjects", id));
      await batch.commit();
    },
    [user]
  );

  return { subjects, loading, addSubject, updateSubject, deleteSubject };
}

// ── Classes ──

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

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    });

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
      await deleteDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "classes", id)
      );
    },
    [user, subjectId]
  );

  return { classes, loading, addClass, updateClass, deleteClass };
}
