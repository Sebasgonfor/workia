"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef, ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { useTasks } from "@/lib/hooks";
import { checkAndNotifyTasks } from "@/lib/notifications";

function NotificationChecker() {
  const { tasks } = useTasks();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (notifiedRef.current || tasks.length === 0) return;
    notifiedRef.current = true;
    const timer = setTimeout(() => {
      try {
        checkAndNotifyTasks(tasks);
      } catch (e) {
        console.error("Notification check failed:", e);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [tasks]);

  return null;
}

export function AppShell({ children, hideBottomNav = false }: { children: ReactNode, hideBottomNav?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={hideBottomNav ? "" : "pb-20"}>
      {children}
      <NotificationChecker />
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
