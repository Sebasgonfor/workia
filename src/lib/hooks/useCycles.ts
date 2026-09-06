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
import type { Cycle, CycleKind } from "@/types";

export function useCycles() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCycles([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "cycles"),
      orderBy("order", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date(),
        })) as Cycle[];
        setCycles(data);
        setLoading(false);
      },
      (error) => {
        console.error("useCycles snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addCycle = useCallback(
    async (data: { name: string; kind: CycleKind }) => {
      if (!user) return null;
      const order = cycles.length > 0 ? Math.max(...cycles.map((c) => c.order)) + 1 : 0;
      const ref = await addDoc(collection(db, "users", user.uid, "cycles"), {
        ...data,
        order,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    },
    [user, cycles]
  );

  const updateCycle = useCallback(
    async (id: string, data: Partial<Pick<Cycle, "name" | "kind" | "order">>) => {
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid, "cycles", id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  // Deleting a cycle never touches the subjects, classes, entries or tasks
  // inside it — they just fall back to "sin ciclo" (cycleId: null).
  const deleteCycle = useCallback(
    async (id: string) => {
      if (!user) return;
      const batch = writeBatch(db);
      const subjectsRef = collection(db, "users", user.uid, "subjects");
      const subjectsQ = query(subjectsRef, where("cycleId", "==", id));
      const subjectsSnap = await getDocs(subjectsQ);
      subjectsSnap.docs.forEach((d) => batch.update(d.ref, { cycleId: null }));
      batch.delete(doc(db, "users", user.uid, "cycles", id));
      await batch.commit();
    },
    [user]
  );

  // Persists a full reordering: `orderedIds` is the new top-to-bottom order.
  const reorderCycles = useCallback(
    async (orderedIds: string[]) => {
      if (!user) return;
      const batch = writeBatch(db);
      orderedIds.forEach((id, index) => {
        batch.update(doc(db, "users", user.uid, "cycles", id), { order: index });
      });
      await batch.commit();
    },
    [user]
  );

  return { cycles, loading, addCycle, updateCycle, deleteCycle, reorderCycles };
}
