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
import type { ChatConversation } from "@/types";

export function useChatConversations(subjectId: string | null, classId: string | null) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectId || !classId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "subjects", subjectId, "classes", classId, "chatConversations"),
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
        })) as ChatConversation[];
        setConversations(data);
        setLoading(false);
      },
      (error) => {
        console.error("useChatConversations snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId, classId]);

  const createConversation = useCallback(
    async (): Promise<string | null> => {
      if (!user || !subjectId || !classId) return null;

      const now = new Date();
      const title = now.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }) + ", " + now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });

      const ref = await addDoc(
        collection(db, "users", user.uid, "subjects", subjectId, "classes", classId, "chatConversations"),
        {
          subjectId,
          classSessionId: classId,
          title,
          lastMessage: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      return ref.id;
    },
    [user, subjectId, classId]
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (!user || !subjectId || !classId) return;
      const batch = writeBatch(db);
      const messagesRef = collection(
        db, "users", user.uid, "subjects", subjectId, "classes", classId,
        "chatConversations", conversationId, "messages"
      );
      const snap = await getDocs(messagesRef);
      snap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "users", user.uid, "subjects", subjectId, "classes", classId, "chatConversations", conversationId));
      await batch.commit();
    },
    [user, subjectId, classId]
  );

  return { conversations, loading, createConversation, deleteConversation };
}
