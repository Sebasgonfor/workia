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
import type { Digitalization } from "@/types";

export function useDigitalizations() {
  const { user } = useAuth();
  const [digitalizations, setDigitalizations] = useState<Digitalization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDigitalizations([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "digitalizations"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (d.data().updatedAt as Timestamp)?.toDate() || new Date(),
        })) as Digitalization[];
        setDigitalizations(data);
        setLoading(false);
      },
      (error) => {
        console.error("useDigitalizations snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addDigitalization = useCallback(
    async (data: Omit<Digitalization, "id" | "createdAt" | "updatedAt">) => {
      if (!user) return null;
      const ref = await addDoc(
        collection(db, "users", user.uid, "digitalizations"),
        {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      return ref.id;
    },
    [user]
  );

  const deleteDigitalization = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(
        doc(db, "users", user.uid, "digitalizations", id)
      );
    },
    [user]
  );

  return { digitalizations, loading, addDigitalization, deleteDigitalization };
}
