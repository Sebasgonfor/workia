"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  getDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Subject, ClassSession, BoardEntry, Task, Flashcard, ScheduleSlot, SubjectGradeRecord, CorteGrades, Quiz, QuizAttempt, SubjectDocument } from "@/types";

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
      const batch = writeBatch(db);
      // Delete entries from each class
      const classesRef = collection(db, "users", user.uid, "subjects", id, "classes");
      const classesSnap = await getDocs(classesRef);
      for (const classDoc of classesSnap.docs) {
        const entriesRef = collection(classDoc.ref, "entries");
        const entriesSnap = await getDocs(entriesRef);
        entriesSnap.docs.forEach((d) => batch.delete(d.ref));
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
      batch.delete(doc(db, "users", user.uid, "subjects", subjectId, "classes", id));
      await batch.commit();
    },
    [user, subjectId]
  );

  return { classes, loading, addClass, updateClass, deleteClass };
}

// ── Board Entries ──

export function useBoardEntries(subjectId: string | null, classId: string | null) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<BoardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectId || !classId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(
        db, "users", user.uid, "subjects", subjectId, "classes", classId, "entries"
      ),
      orderBy("order", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          classSessionId: classId,
          subjectId,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
          updatedAt: (d.data().updatedAt as Timestamp)?.toDate() || new Date(),
        })) as BoardEntry[];
        setEntries(data);
        setLoading(false);
      },
      (error) => {
        console.error("useBoardEntries snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId, classId]);

  const addEntry = useCallback(
    async (data: { type: BoardEntry["type"]; content: string; tags: string[] }) => {
      if (!user || !subjectId || !classId) return;
      await addDoc(
        collection(
          db, "users", user.uid, "subjects", subjectId, "classes", classId, "entries"
        ),
        {
          type: data.type,
          content: data.content,
          rawContent: data.content,
          sourceImages: [],
          tags: data.tags,
          order: entries.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    },
    [user, subjectId, classId, entries.length]
  );

  const updateEntry = useCallback(
    async (id: string, data: { type?: BoardEntry["type"]; content?: string; tags?: string[] }) => {
      if (!user || !subjectId || !classId) return;
      const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (data.type !== undefined) updateData.type = data.type;
      if (data.content !== undefined) {
        updateData.content = data.content;
        updateData.rawContent = data.content;
      }
      if (data.tags !== undefined) updateData.tags = data.tags;
      await updateDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "classes", classId, "entries", id),
        updateData
      );
    },
    [user, subjectId, classId]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!user || !subjectId || !classId) return;
      await deleteDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "classes", classId, "entries", id)
      );
    },
    [user, subjectId, classId]
  );

  return { entries, loading, addEntry, updateEntry, deleteEntry };
}

// ── Tasks ──

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

// ── SM-2 Algorithm ──

function sm2(easeFactor: number, interval: number, repetitions: number, quality: number) {
  let ef = easeFactor;
  let iv = interval;
  let rep = repetitions;

  if (quality >= 3) {
    if (rep === 0) iv = 1;
    else if (rep === 1) iv = 6;
    else iv = Math.round(iv * ef);
    rep += 1;
  } else {
    rep = 0;
    iv = 1;
  }

  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + iv);
  nextReview.setHours(0, 0, 0, 0);

  return { easeFactor: ef, interval: iv, repetitions: rep, nextReview };
}

// ── Flashcards ──

export function useFlashcards(subjectId?: string | null) {
  const { user } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFlashcards([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, "users", user.uid, "flashcards");
    const q = subjectId
      ? query(ref, where("subjectId", "==", subjectId), orderBy("nextReview", "asc"))
      : query(ref, orderBy("nextReview", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          nextReview: (d.data().nextReview as Timestamp)?.toDate() || new Date(),
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as Flashcard[];
        setFlashcards(data);
        setLoading(false);
      },
      (error) => {
        console.error("useFlashcards snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId]);

  const addFlashcard = useCallback(
    async (data: Omit<Flashcard, "id" | "createdAt" | "easeFactor" | "interval" | "repetitions" | "nextReview">) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "flashcards"), {
        subjectId: data.subjectId,
        subjectName: data.subjectName,
        noteId: data.noteId,
        question: data.question,
        answer: data.answer,
        type: data.type,
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReview: Timestamp.fromDate(new Date()),
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const addFlashcards = useCallback(
    async (cards: Omit<Flashcard, "id" | "createdAt" | "easeFactor" | "interval" | "repetitions" | "nextReview">[]) => {
      if (!user) return;
      const batch = writeBatch(db);
      const ref = collection(db, "users", user.uid, "flashcards");
      for (const data of cards) {
        const docRef = doc(ref);
        batch.set(docRef, {
          subjectId: data.subjectId,
          subjectName: data.subjectName,
          noteId: data.noteId,
          question: data.question,
          answer: data.answer,
          type: data.type,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReview: Timestamp.fromDate(new Date()),
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    },
    [user]
  );

  const reviewFlashcard = useCallback(
    async (id: string, quality: number) => {
      if (!user) return;
      const card = flashcards.find((f) => f.id === id);
      if (!card) return;
      const result = sm2(card.easeFactor, card.interval, card.repetitions, quality);
      await updateDoc(doc(db, "users", user.uid, "flashcards", id), {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReview: Timestamp.fromDate(result.nextReview),
      });
    },
    [user, flashcards]
  );

  const deleteFlashcard = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "users", user.uid, "flashcards", id));
    },
    [user]
  );

  const dueCards = flashcards.filter((f) => f.nextReview <= new Date());

  return { flashcards, dueCards, loading, addFlashcard, addFlashcards, reviewFlashcard, deleteFlashcard };
}

// ── Schedule ──

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

// ── Grades ──

export function useGrades() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<SubjectGradeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGrades([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "grades"),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          subjectId: d.id,
          ...d.data(),
          updatedAt: (d.data().updatedAt as Timestamp)?.toDate() || new Date(),
        })) as SubjectGradeRecord[];
        setGrades(data);
        setLoading(false);
      },
      (error) => {
        console.error("useGrades snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const saveGrades = useCallback(
    async (
      subjectId: string,
      data: Pick<SubjectGradeRecord, "corte1" | "corte2" | "corte3">
    ) => {
      if (!user) return;
      await setDoc(
        doc(db, "users", user.uid, "grades", subjectId),
        { ...data, updatedAt: serverTimestamp() },
        { merge: true }
      );
    },
    [user]
  );

  return { grades, loading, saveGrades };
}

// ── Quizzes ──

export function useQuizzes(subjectId?: string | null) {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setQuizzes([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, "users", user.uid, "quizzes");
    const q = subjectId
      ? query(ref, where("subjectId", "==", subjectId), orderBy("createdAt", "desc"))
      : query(ref, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
      })) as Quiz[];
      setQuizzes(data);
      setLoading(false);
    }, (error) => {
      console.error("useQuizzes snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, subjectId]);

  const addQuiz = useCallback(
    async (data: Omit<Quiz, "id" | "createdAt">): Promise<string | null> => {
      if (!user) return null;
      const ref = await addDoc(collection(db, "users", user.uid, "quizzes"), {
        ...data,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    [user]
  );

  const deleteQuiz = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "users", user.uid, "quizzes", id));
    },
    [user]
  );

  const addAttempt = useCallback(
    async (data: Omit<QuizAttempt, "id" | "completedAt">) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "quizAttempts"), {
        ...data,
        completedAt: serverTimestamp(),
      });
    },
    [user]
  );

  return { quizzes, loading, addQuiz, deleteQuiz, addAttempt };
}

export async function fetchQuizById(userId: string, quizId: string): Promise<Quiz | null> {
  const snap = await getDoc(doc(db, "users", userId, "quizzes", quizId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
    createdAt: (snap.data().createdAt as Timestamp)?.toDate() || new Date(),
  } as Quiz;
}

// ── Subject Documents ──

export function useSubjectDocuments(subjectId: string | null) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<SubjectDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !subjectId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "subjects", subjectId, "documents"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          subjectId,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date(),
        })) as SubjectDocument[];
        setDocuments(data);
        setLoading(false);
      },
      (error) => {
        console.error("useSubjectDocuments snapshot error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, subjectId]);

  const addDocument = useCallback(
    async (data: Omit<SubjectDocument, "id" | "createdAt" | "subjectId">) => {
      if (!user || !subjectId) return;
      await addDoc(
        collection(db, "users", user.uid, "subjects", subjectId, "documents"),
        {
          ...data,
          subjectId,
          createdAt: serverTimestamp(),
        }
      );
    },
    [user, subjectId]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      if (!user || !subjectId) return;
      await deleteDoc(
        doc(db, "users", user.uid, "subjects", subjectId, "documents", id)
      );
    },
    [user, subjectId]
  );

  return { documents, loading, addDocument, deleteDocument };
}
