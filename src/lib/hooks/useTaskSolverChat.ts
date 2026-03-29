"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  addDoc,
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
import type { TaskSolverMessage } from "@/types";

export function useTaskSolverChat(taskId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TaskSolverMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !taskId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "taskSolvers", taskId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as TaskSolverMessage[];
        setMessages(data);
        setLoading(false);
      },
      (error) => {
        console.error("useTaskSolverChat snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, taskId]);

  const addMessage = useCallback(
    async (role: "user" | "assistant", content: string) => {
      if (!user || !taskId) return;
      await addDoc(collection(db, "users", user.uid, "taskSolvers", taskId, "messages"), {
        taskId,
        role,
        content,
        createdAt: serverTimestamp(),
      });
    },
    [user, taskId]
  );

  const clearChat = useCallback(async () => {
    if (!user || !taskId) return;
    const batch = writeBatch(db);
    const messagesRef = collection(db, "users", user.uid, "taskSolvers", taskId, "messages");
    const snap = await getDocs(messagesRef);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }, [user, taskId]);

  return { messages, loading, addMessage, clearChat };
}
