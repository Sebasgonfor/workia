"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { SubjectMastery } from "@/types";

interface SubjectInfo {
  id: string;
  name: string;
  color: string;
  emoji: string;
}

export function useMasteryData(subjects: SubjectInfo[]) {
  const { user } = useAuth();
  const [mastery, setMastery] = useState<SubjectMastery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || subjects.length === 0) {
      setMastery([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const results: SubjectMastery[] = [];

        for (const subject of subjects) {
          // Flashcard mastery
          let flashcardMastery = 0;
          let flashcardCount = 0;
          try {
            const fcRef = collection(db, "users", user.uid, "flashcards");
            const fcQ = query(fcRef, where("subjectId", "==", subject.id));
            const fcSnap = await getDocs(fcQ);
            if (fcSnap.size > 0) {
              let totalEase = 0;
              fcSnap.docs.forEach((d) => {
                totalEase += d.data().easeFactor || 2.5;
              });
              flashcardCount = fcSnap.size;
              // easeFactor ranges 1.3–3.0+, normalize to 0-100
              const avgEase = totalEase / fcSnap.size;
              flashcardMastery = Math.min(100, Math.round(((avgEase - 1.3) / (3.0 - 1.3)) * 100));
            }
          } catch { /* skip */ }

          // Quiz mastery
          let quizMastery = 0;
          let quizCount = 0;
          try {
            const qaRef = collection(db, "users", user.uid, "quizAttempts");
            const qaQ = query(qaRef, where("subjectId", "==", subject.id));
            const qaSnap = await getDocs(qaQ);
            if (qaSnap.size > 0) {
              let totalScore = 0;
              qaSnap.docs.forEach((d) => {
                totalScore += d.data().score || 0;
              });
              quizCount = qaSnap.size;
              quizMastery = Math.round(totalScore / qaSnap.size);
            }
          } catch { /* skip */ }

          // Feynman mastery
          let feynmanMastery = 0;
          let feynmanCount = 0;
          try {
            const fRef = collection(db, "users", user.uid, "feynmanSessions");
            const fQ = query(fRef, where("subjectId", "==", subject.id));
            const fSnap = await getDocs(fQ);
            if (fSnap.size > 0) {
              let totalScore = 0;
              fSnap.docs.forEach((d) => {
                totalScore += d.data().score || 0;
              });
              feynmanCount = fSnap.size;
              feynmanMastery = Math.round(totalScore / fSnap.size);
            }
          } catch { /* skip */ }

          // Socratic mastery
          let socraticMastery = 0;
          let socraticCount = 0;
          try {
            const sRef = collection(db, "users", user.uid, "socraticSessions");
            const sQ = query(sRef, where("subjectId", "==", subject.id));
            const sSnap = await getDocs(sQ);
            if (sSnap.size > 0) {
              let mastered = 0;
              sSnap.docs.forEach((d) => {
                if (d.data().mastered) mastered++;
              });
              socraticCount = sSnap.size;
              socraticMastery = Math.round((mastered / sSnap.size) * 100);
            }
          } catch { /* skip */ }

          const totalItems = flashcardCount + quizCount + feynmanCount + socraticCount;
          const weights = { fc: 0.25, quiz: 0.25, feynman: 0.3, socratic: 0.2 };
          const overall = totalItems === 0
            ? 0
            : Math.round(
                flashcardMastery * weights.fc +
                quizMastery * weights.quiz +
                feynmanMastery * weights.feynman +
                socraticMastery * weights.socratic
              );

          results.push({
            subjectId: subject.id,
            subjectName: subject.name,
            subjectColor: subject.color,
            subjectEmoji: subject.emoji,
            flashcardMastery,
            quizMastery,
            feynmanMastery,
            socraticMastery,
            overallMastery: overall,
            totalStudyItems: totalItems,
            conceptsToReview: [],
          });
        }

        setMastery(results);
      } catch (err) {
        console.error("useMasteryData error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, subjects]);

  return { mastery, loading };
}
