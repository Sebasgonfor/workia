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
import type { ScheduleSlot } from "@/types";

export function useSchedule() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSlots([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "schedule"),
      orderBy("dayOfWeek", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (d.data().updatedAt as Timestamp)?.toDate() || new Date(),
        })) as ScheduleSlot[];
        setSlots(data);
        setLoading(false);
      },
      (error) => {
        console.error("useSchedule snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addSlot = useCallback(
    async (data: Omit<ScheduleSlot, "id" | "createdAt" | "updatedAt">) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "schedule"), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const updateSlot = useCallback(
    async (id: string, data: Partial<Omit<ScheduleSlot, "id" | "createdAt" | "updatedAt">>) => {
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid, "schedule", id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const deleteSlot = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "users", user.uid, "schedule", id));
    },
    [user]
  );

  return { slots, loading, addSlot, updateSlot, deleteSlot };
}
