"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
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
import type { NotesChatMessage } from "@/types";

export function useNotesChat(subjectId: string | null, classId: string | null, conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<NotesChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectId || !classId || !conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(
        db,
        "users", user.uid,
        "subjects", subjectId,
        "classes", classId,
        "chatConversations", conversationId,
        "messages"
      ),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as NotesChatMessage[];
        setMessages(data);
        setLoading(false);
      },
      (error) => {
        console.error("useNotesChat snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId, classId, conversationId]);

  const addMessage = useCallback(
    async (role: "user" | "assistant", content: string, imageUrls: string[] = []) => {
      if (!user || !subjectId || !classId || !conversationId) return;

      await addDoc(
        collection(
          db,
          "users", user.uid,
          "subjects", subjectId,
          "classes", classId,
          "chatConversations", conversationId,
          "messages"
        ),
        {
          subjectId,
          classSessionId: classId,
          role,
          content,
          imageUrls,
          createdAt: serverTimestamp(),
        }
      );

      // Update lastMessage preview on the conversation
      await updateDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "classes", classId, "chatConversations", conversationId),
        {
          lastMessage: content.slice(0, 80),
          updatedAt: serverTimestamp(),
        }
      );
    },
    [user, subjectId, classId, conversationId]
  );

  const clearChat = useCallback(async () => {
    if (!user || !subjectId || !classId || !conversationId) return;
    const batch = writeBatch(db);
    const ref = collection(
      db,
      "users", user.uid,
      "subjects", subjectId,
      "classes", classId,
      "chatConversations", conversationId,
      "messages"
    );
    const snap = await getDocs(ref);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    await updateDoc(
      doc(db, "users", user.uid, "subjects", subjectId, "classes", classId, "chatConversations", conversationId),
      { lastMessage: "", updatedAt: serverTimestamp() }
    );
  }, [user, subjectId, classId, conversationId]);

  return { messages, loading, addMessage, clearChat };
}
