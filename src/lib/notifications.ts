import type { Task } from "@/types";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function getNotificationPermission(): NotificationPermission | null {
  if (!isNotificationSupported()) return null;
  return Notification.permission;
}

function formatDueLabel(date: Date): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return "vencida";
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "manana";
  return `en ${diffDays} dias`;
}

export function showTaskNotification(task: Task) {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  try {
    new Notification("Recordatorio: " + task.title, {
      body: `Vence ${formatDueLabel(task.dueDate)}${task.subjectName ? ` — ${task.subjectName}` : ""}`,
      icon: "/icons/icon-192x192.png",
      tag: `task-${task.id}`,
      silent: false,
    });
  } catch {
    // Service worker context or notification blocked
  }
}

const NOTIFIED_KEY = "workia_notified_tasks";

function getNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw) as { ids: string[]; date: string };
    // Reset daily
    const today = new Date().toISOString().split("T")[0];
    if (data.date !== today) return new Set();
    return new Set(data.ids);
  } catch {
    return new Set();
  }
}

function saveNotifiedIds(ids: Set<string>) {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ ids: Array.from(ids), date: today }));
}

export function checkAndNotifyTasks(tasks: Task[]) {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  tomorrow.setHours(0, 0, 0, 0);

  const upcoming = tasks.filter(
    (t) => t.status !== "completed" && t.dueDate <= tomorrow
  );

  if (upcoming.length === 0) return;

  const notified = getNotifiedIds();
  let changed = false;

  for (const task of upcoming) {
    if (notified.has(task.id)) continue;
    showTaskNotification(task);
    notified.add(task.id);
    changed = true;
  }

  if (changed) saveNotifiedIds(notified);
}
