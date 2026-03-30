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
import type { Task } from "@/types";

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "tasks"),
      orderBy("dueDate", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          assignedDate: (d.data().assignedDate as Timestamp)?.toDate() || (d.data().createdAt as Timestamp)?.toDate() || new Date(),
          dueDate: (d.data().dueDate as Timestamp)?.toDate() || new Date(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as Task[];
        setTasks(data);
        setLoading(false);
      },
      (error) => {
        console.error("useTasks snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addTask = useCallback(
    async (data: Omit<Task, "id" | "createdAt">) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "tasks"), {
        title: data.title,
        subjectId: data.subjectId,
        subjectName: data.subjectName,
        description: data.description,
        assignedDate: Timestamp.fromDate(data.assignedDate),
        dueDate: Timestamp.fromDate(data.dueDate),
        status: data.status,
        priority: data.priority,
        type: data.type,
        sourceImageUrl: data.sourceImageUrl,
        classSessionId: data.classSessionId,
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const updateTask = useCallback(
    async (id: string, data: Partial<Omit<Task, "id" | "createdAt">>) => {
      if (!user) return;
      const updateData: Record<string, unknown> = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.subjectId !== undefined) updateData.subjectId = data.subjectId;
      if (data.subjectName !== undefined) updateData.subjectName = data.subjectName;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.assignedDate !== undefined) updateData.assignedDate = Timestamp.fromDate(data.assignedDate);
      if (data.dueDate !== undefined) updateData.dueDate = Timestamp.fromDate(data.dueDate);
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.type !== undefined) updateData.type = data.type;
      await updateDoc(doc(db, "users", user.uid, "tasks", id), updateData);
    },
    [user]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "users", user.uid, "tasks", id));
    },
    [user]
  );

  return { tasks, loading, addTask, updateTask, deleteTask };
}
