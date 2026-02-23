"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef, ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { useTasks } from "@/lib/hooks";
import { checkAndNotifyTasks } from "@/lib/notifications";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { tasks } = useTasks();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  // Check for upcoming task notifications once per session
  useEffect(() => {
    if (notifiedRef.current || tasks.length === 0) return;
    notifiedRef.current = true;
    // Small delay to avoid notification on immediate load
    const timer = setTimeout(() => checkAndNotifyTasks(tasks), 2000);
    return () => clearTimeout(timer);
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
