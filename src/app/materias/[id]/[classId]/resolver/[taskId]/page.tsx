"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  Trash2,
  BookOpen,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarkdownMath } from "@/components/ui/markdown-math";
import {
  useSubjects,
  useClasses,
  useBoardEntries,
  useTasks,
  useSubjectDocuments,
  useTaskSolverChat,
} from "@/lib/hooks";
import { TASK_TYPES, TASK_PRIORITIES } from "@/types";
import { toast } from "sonner";

const RESOLVE_PROMPT =
  "Resuelve esta tarea de manera completa y detallada. Usa todos los apuntes y documentos disponibles.";

export default function TaskSolverPage() {
  const params = useParams();
  const router = useRouter();
  const subjectId = params.id as string;
  const classId = params.classId as string;
  const taskId = params.taskId as string;

  const { subjects } = useSubjects();
  const { classes } = useClasses(subjectId);
  const { entries } = useBoardEntries(subjectId, classId);
  const { tasks } = useTasks();
  const { documents: subjectDocuments } = useSubjectDocuments(subjectId);
  const { messages, loading: chatLoading, addMessage, clearChat } =
    useTaskSolverChat(taskId);

  const subject = useMemo(
    () => subjects.find((s) => s.id === subjectId),
    [subjects, subjectId]
  );
  const classSession = useMemo(
    () => classes.find((c) => c.id === classId),
    [classes, classId]
  );
  const task = useMemo(
    () => tasks.find((t) => t.id === taskId),
    [tasks, taskId]
  );
  const classNotes = useMemo(
    () => entries.filter((e) => e.type === "notes").map((e) => e.content),
    [entries]
  );

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(120);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const color = subject?.color || "#6366f1";
  const typeData = TASK_TYPES.find((t) => t.value === task?.type);
  const priorityData = TASK_PRIORITIES.find((p) => p.value === task?.priority);

  // Measure header height after render
  useEffect(() => {
    if (!headerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
    });
    observer.observe(headerRef.current);
    setHeaderHeight(headerRef.current.offsetHeight);
    return () => observer.disconnect();
  }, [task]);

  // Scroll to bottom on new messages or while streaming
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  const sendMessage = useCallback(
    async (userContent: string) => {
      if (!task || isStreaming) return;
      const trimmed = userContent.trim();
      if (!trimmed) return;

      setInput("");
      setIsStreaming(true);
      setStreamingText("");

      try {
        await addMessage("user", trimmed);

        const allMessages = [
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user" as const, content: trimmed },
        ];

        abortRef.current = new AbortController();

        const response = await fetch("/api/task-solver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            task: {
              title: task.title,
              description: task.description,
              type: task.type,
              priority: task.priority,
              dueDate: task.dueDate.toISOString().split("T")[0],
              assignedDate: task.assignedDate.toISOString().split("T")[0],
            },
            classTitle: classSession?.title || "",
            subjectName: subject?.name || "",
            subjectDocuments: subjectDocuments.map((d) => ({
              url: d.url,
              fileType: d.fileType,
              name: d.name,
            })),
            classNotes,
            messages: allMessages,
          }),
        });

        if (!response.ok) throw new Error("Error al conectar con la IA");

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setStreamingText(fullText);
        }

        await addMessage("assistant", fullText);
        setStreamingText("");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast.error("Error al obtener respuesta de la IA");
        setStreamingText("");
      } finally {
        setIsStreaming(false);
      }
    },
    [
      task,
      isStreaming,
      messages,
      addMessage,
      classSession,
      subject,
      subjectDocuments,
      classNotes,
    ]
  );

  const handleSend = () => {
    if (input.trim()) sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = async () => {
    if (isStreaming) {
      abortRef.current?.abort();
      setStreamingText("");
      setIsStreaming(false);
    }
    await clearChat();
    toast.success("Conversación borrada");
  };

  const allDisplayMessages = [
    ...messages,
    ...(streamingText
      ? [
          {
            id: "streaming",
            role: "assistant" as const,
            content: streamingText,
            createdAt: new Date(),
            taskId,
          },
        ]
      : []),
  ];

  if (!task && !chatLoading) {
    return (
      <AppShell hideBottomNav={true}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <p className="text-muted-foreground text-sm">Tarea no encontrada</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-primary text-sm font-medium"
          >
            Volver
          </button>
        </div>
      </AppShell>
    );
  }

  const hasInput = messages.length > 0 || isStreaming;

  return (
    <AppShell hideBottomNav={true}>
      {/* Fixed header */}
      <div
        ref={headerRef}
        className="fixed top-0 inset-x-0 z-20 px-4 pt-2 pb-2.5 border-b border-border bg-background"
        style={{ backgroundImage: `linear-gradient(135deg, ${color}18 0%, transparent 60%)` }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-muted-foreground mb-1 active:opacity-70 touch-target"
          aria-label="Volver"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{subject?.name || "Volver"}</span>
        </button>

        {task && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="text-base">{typeData?.emoji}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: priorityData?.color }}
                >
                  {priorityData?.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground">
                  {typeData?.label}
                </span>
                {classNotes.length > 0 && (
                  <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                    <BookOpen className="w-2.5 h-2.5" />
                    {classNotes.length} apunte{classNotes.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <h1 className="text-sm font-bold leading-tight line-clamp-2">
                {task.title}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {classSession?.title}
              </p>
            </div>
            {messages.length > 0 && !isStreaming && (
              <button
                onClick={handleClearChat}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 active:scale-95 transition-transform touch-target"
                aria-label="Borrar conversación"
              >
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scrollable messages — padded top/bottom to clear fixed header and input */}
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto px-4 space-y-4"
        style={{
          paddingTop: `${headerHeight + 16}px`,
          paddingBottom: hasInput ? `100px` : `24px`,
          minHeight: "100dvh",
        }}
      >
        {chatLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : allDisplayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: color + "20" }}
            >
              <Sparkles className="w-8 h-8" style={{ color }} />
            </div>
            <h2 className="text-base font-bold mb-1">Resolver con IA</h2>
            <p className="text-xs text-muted-foreground mb-2 max-w-[260px]">
              La IA analizará la tarea junto con los apuntes y documentos de la
              materia para darte una solución completa.
            </p>
            {task?.description && (
              <p className="text-xs text-muted-foreground/70 mb-5 max-w-[260px] italic line-clamp-2">
                &ldquo;{task.description}&rdquo;
              </p>
            )}
            <button
              onClick={() => sendMessage(RESOLVE_PROMPT)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-primary-foreground active:scale-[0.97] transition-transform"
              style={{ backgroundColor: color }}
              aria-label="Resolver tarea con IA"
            >
              <Sparkles className="w-4 h-4" />
              Resolver tarea
            </button>
          </div>
        ) : (
          allDisplayMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                  msg.role === "assistant" ? "bg-primary/10" : "bg-secondary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed overflow-x-auto ${
                  msg.role === "assistant"
                    ? "bg-card border border-border rounded-tl-sm w-full max-w-[92%]"
                    : "rounded-tr-sm max-w-[85%]"
                }`}
                style={
                  msg.role === "user"
                    ? { backgroundColor: color, color: "#fff" }
                    : undefined
                }
              >
                {msg.role === "assistant" ? (
                  <>
                    <MarkdownMath content={msg.content} />
                    {msg.id === "streaming" && (
                      <span className="inline-flex gap-0.5 ml-1 align-middle">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1 h-1 rounded-full bg-primary animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </span>
                    )}
                  </>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fixed input bar */}
      {hasInput && (
        <div
          className="fixed inset-x-0 z-20 px-4 pb-3 pt-2.5 border-t border-border bg-background"
          style={{ bottom: "0" }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Haz una pregunta de seguimiento..."
              disabled={isStreaming}
              rows={1}
              className="flex-1 px-3.5 py-2.5 rounded-2xl bg-secondary border border-border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              style={{ maxHeight: "120px", overflowY: "auto" }}
              aria-label="Mensaje de seguimiento"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 shrink-0"
              style={{ backgroundColor: color }}
              aria-label="Enviar mensaje"
              tabIndex={0}
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
