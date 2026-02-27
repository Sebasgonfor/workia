"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Loader2,
  Trash2,
  ImagePlus,
  X,
  Check,
  CheckCircle2,
  Plus,
  Pencil,
  ChevronDown,
  Image as ImageIcon,
  Clock,
  MessageSquarePlus,
} from "lucide-react";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { Sheet } from "@/components/ui/sheet";
import { useNotesChat, useChatConversations } from "@/lib/hooks";
import { uploadScanImage } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { BoardEntry, Task, SubjectDocument, NotesChatMessage } from "@/types";

// ── Action parsing ──

interface TaskAction {
  action: "create_task" | "edit_task" | "delete_task" | "complete_task";
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  type?: string;
  taskId?: string;
  updates?: Record<string, string>;
}

function parseActions(text: string): { cleanText: string; actions: TaskAction[] } {
  const actionRegex = /```action\s*\n([\s\S]*?)\n```/g;
  const actions: TaskAction[] = [];
  let cleanText = text;

  let match: RegExpExecArray | null;
  while ((match = actionRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      actions.push(parsed as TaskAction);
    } catch {
      // malformed action block, ignore
    }
    cleanText = cleanText.replace(match[0], "").trim();
  }

  return { cleanText, actions };
}

// ── Action button component ──

function ActionButton({
  action,
  onExecute,
  executed,
}: {
  action: TaskAction;
  onExecute: () => void;
  executed: boolean;
}) {
  const config = {
    create_task: { icon: Plus, label: "Crear tarea", color: "#10b981" },
    edit_task: { icon: Pencil, label: "Editar tarea", color: "#3b82f6" },
    delete_task: { icon: Trash2, label: "Eliminar tarea", color: "#ef4444" },
    complete_task: { icon: CheckCircle2, label: "Completar tarea", color: "#8b5cf6" },
  }[action.action] || { icon: Sparkles, label: "Acción", color: "#6366f1" };

  const Icon = config.icon;

  return (
    <button
      onClick={onExecute}
      disabled={executed}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] disabled:opacity-60"
      style={{
        backgroundColor: executed ? "var(--secondary)" : config.color + "15",
        color: executed ? "var(--muted-foreground)" : config.color,
        borderWidth: 1,
        borderColor: executed ? "var(--border)" : config.color + "30",
      }}
    >
      {executed ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {executed ? "Hecho" : config.label}
      {action.title && !executed && (
        <span className="opacity-70 truncate max-w-[120px]">: {action.title}</span>
      )}
    </button>
  );
}

// ── Main component ──

interface NotesChatPanelProps {
  subjectId: string;
  classId: string;
  subjectName: string;
  classTitle: string;
  color: string;
  boardEntries: BoardEntry[];
  tasks: Task[];
  subjectDocuments: SubjectDocument[];
  onTaskAction: (action: TaskAction) => Promise<void>;
}

export function NotesChatPanel({
  subjectId,
  classId,
  subjectName,
  classTitle,
  color,
  boardEntries,
  tasks,
  subjectDocuments,
  onTaskAction,
}: NotesChatPanelProps) {
  const { user } = useAuth();
  const { conversations, loading: convsLoading, createConversation, deleteConversation } =
    useChatConversations(subjectId, classId);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [creatingConv, setCreatingConv] = useState(false);

  const { messages, loading: chatLoading, addMessage, clearChat } =
    useNotesChat(subjectId, classId, activeConversationId);

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingImages, setPendingImages] = useState<{ url: string; file: File }[]>([]);
  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set());
  const [showAiDocs, setShowAiDocs] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  // Auto-select the most recent conversation, or create one if none exist
  useEffect(() => {
    if (convsLoading) return;
    if (conversations.length > 0) {
      if (!activeConversationId || !conversations.find((c) => c.id === activeConversationId)) {
        setActiveConversationId(conversations[0].id);
      }
    } else if (!creatingConv) {
      setCreatingConv(true);
      createConversation().then((id) => {
        if (id) setActiveConversationId(id);
        setCreatingConv(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, convsLoading]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Collect all source images from board entries
  const allNoteImages = useMemo(
    () => boardEntries.flatMap((e) => e.sourceImages || []).filter(Boolean),
    [boardEntries]
  );

  // Collect all images sent in chat messages
  const chatImages = useMemo(
    () => messages.flatMap((m) => m.imageUrls || []).filter(Boolean),
    [messages]
  );

  // All AI-accessible images (deduplicated)
  const allAiImages = useMemo(
    () => Array.from(new Set([...allNoteImages, ...chatImages])),
    [allNoteImages, chatImages]
  );

  const classNotes = useMemo(
    () => boardEntries.filter((e) => e.type === "notes").map((e) => e.content),
    [boardEntries]
  );

  // Scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const sendMessage = useCallback(
    async (userContent: string, imageUrls: string[] = []) => {
      if (isStreaming) return;
      const trimmed = userContent.trim();
      if (!trimmed && imageUrls.length === 0) return;

      setInput("");
      setPendingImages([]);
      setIsStreaming(true);
      setStreamingText("");

      try {
        await addMessage("user", trimmed, imageUrls);

        const allMessages = [
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            imageUrls: m.imageUrls || [],
          })),
          { role: "user" as const, content: trimmed, imageUrls },
        ];

        abortRef.current = new AbortController();

        const response = await fetch("/api/notes-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            subjectName,
            classTitle,
            classNotes,
            noteImages: allNoteImages,
            tasks: tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              type: t.type,
              priority: t.priority,
              dueDate: t.dueDate.toISOString().split("T")[0],
              assignedDate: t.assignedDate.toISOString().split("T")[0],
              status: t.status,
            })),
            subjectDocuments: subjectDocuments.map((d) => ({
              url: d.url,
              fileType: d.fileType,
              name: d.name,
            })),
            messages: allMessages,
            currentDate: new Date().toISOString().split("T")[0],
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
      isStreaming,
      messages,
      addMessage,
      subjectName,
      classTitle,
      classNotes,
      allNoteImages,
      tasks,
      subjectDocuments,
    ]
  );

  const handleSend = async () => {
    if (!input.trim() && pendingImages.length === 0) return;

    let imageUrls: string[] = [];

    // Upload pending images
    if (pendingImages.length > 0 && user) {
      try {
        const uploaded = await Promise.all(
          pendingImages.map((img, i) => uploadScanImage(user.uid, img.file, i))
        );
        imageUrls = uploaded.filter(Boolean);
      } catch {
        toast.error("Error al subir imágenes");
      }
    }

    sendMessage(input, imageUrls);
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
    setExecutedActions(new Set());
    toast.success("Conversación borrada");
  };

  const handleNewConversation = async () => {
    if (isStreaming) {
      abortRef.current?.abort();
      setStreamingText("");
      setIsStreaming(false);
    }
    const id = await createConversation();
    if (id) {
      setActiveConversationId(id);
      setExecutedActions(new Set());
      setShowHistory(false);
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    await deleteConversation(convId);
    if (activeConversationId === convId) {
      const remaining = conversations.filter((c) => c.id !== convId);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        setActiveConversationId(null);
      }
      setExecutedActions(new Set());
    }
    toast.success("Conversación eliminada");
  };

  const handleSelectConversation = (convId: string) => {
    if (isStreaming) {
      abortRef.current?.abort();
      setStreamingText("");
      setIsStreaming(false);
    }
    setActiveConversationId(convId);
    setExecutedActions(new Set());
    setShowHistory(false);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    e.target.value = "";

    const newImages = Array.from(files).slice(0, 3).map((file) => ({
      url: URL.createObjectURL(file),
      file,
    }));
    setPendingImages((prev) => [...prev, ...newImages].slice(0, 3));
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleExecuteAction = async (action: TaskAction, key: string) => {
    try {
      await onTaskAction(action);
      setExecutedActions((prev) => new Set(prev).add(key));
      const labels = {
        create_task: "Tarea creada",
        edit_task: "Tarea editada",
        delete_task: "Tarea eliminada",
        complete_task: "Tarea completada",
      };
      toast.success(labels[action.action] || "Acción realizada");
    } catch {
      toast.error("Error al ejecutar la acción");
    }
  };

  // Build display messages
  const allDisplayMessages: Array<NotesChatMessage & { isStreaming?: boolean }> = [
    ...messages,
    ...(streamingText
      ? [
          {
            id: "streaming",
            subjectId,
            classSessionId: classId,
            role: "assistant" as const,
            content: streamingText,
            imageUrls: [],
            createdAt: new Date(),
            isStreaming: true,
          },
        ]
      : []),
  ];

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 240px)", minHeight: "350px" }}>
      {/* History Sheet */}
      <Sheet open={showHistory} onClose={() => setShowHistory(false)} title="Historial de conversaciones">
        <div className="flex flex-col gap-3 px-1">
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl border-2 border-dashed text-sm font-semibold active:scale-[0.98] transition-transform"
            style={{ borderColor: color + "60", color }}
          >
            <MessageSquarePlus className="w-4 h-4" />
            Nueva conversación
          </button>

          {conversations.length === 0 && !convsLoading && (
            <p className="text-xs text-center text-muted-foreground py-4">
              No hay conversaciones todavía
            </p>
          )}

          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all active:scale-[0.99]"
                style={{
                  backgroundColor: isActive ? color + "12" : undefined,
                  borderColor: isActive ? color + "40" : "var(--border)",
                }}
              >
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => handleSelectConversation(conv.id)}
                  aria-label={`Seleccionar conversación ${conv.title}`}
                >
                  <p className="text-xs font-semibold truncate" style={{ color: isActive ? color : undefined }}>
                    {conv.title}
                  </p>
                  {conv.lastMessage && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {conv.lastMessage}
                    </p>
                  )}
                </button>
                <button
                  onClick={() => handleDeleteConversation(conv.id)}
                  className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform shrink-0"
                  aria-label="Eliminar conversación"
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </Sheet>

      {/* Chat header */}
      <div className="flex items-center justify-between px-1 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + "20" }}
          >
            <Bot className="w-4 h-4" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Chat IA</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {activeConversation?.title ?? ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && !isStreaming && (
            <button
              onClick={handleClearChat}
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform touch-target"
              aria-label="Borrar mensajes"
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={() => setShowHistory(true)}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform touch-target"
            aria-label="Ver historial"
          >
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* AI Documents section */}
      {allAiImages.length > 0 && (
        <div className="shrink-0 mx-1 mb-1">
          <button
            onClick={() => setShowAiDocs(!showAiDocs)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium active:scale-[0.99] transition-transform"
          >
            <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="flex-1 text-left text-muted-foreground">
              Documentos IA ({allAiImages.length} imagen{allAiImages.length !== 1 ? "es" : ""})
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showAiDocs ? "rotate-180" : ""}`}
            />
          </button>
          {showAiDocs && (
            <div className="mt-2 grid grid-cols-4 gap-1.5 pb-2">
              {allAiImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setPreviewImg(url)}
                  className="aspect-square rounded-lg overflow-hidden border border-border active:opacity-80 transition-opacity"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Doc ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image preview modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-end px-4 pt-safe pb-3 shrink-0">
            <button
              onClick={() => setPreviewImg(null)}
              className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center active:opacity-70"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImg}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-1 space-y-3 pb-2"
      >
        {chatLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : allDisplayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ backgroundColor: color + "20" }}
            >
              <Sparkles className="w-7 h-7" style={{ color }} />
            </div>
            <h2 className="text-sm font-bold mb-1">Asistente de apuntes</h2>
            <p className="text-xs text-muted-foreground mb-4 max-w-[260px]">
              Pregúntame sobre tus apuntes, imágenes o tareas. Puedo analizar, explicar, crear tareas y más.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-[300px]">
              {[
                "Explícame los apuntes de hoy",
                "Analiza las imágenes de clase",
                "¿Qué tareas tengo pendientes?",
                "Crea un resumen de la clase",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="px-3 py-2 rounded-xl bg-card border border-border text-[11px] font-medium text-muted-foreground active:scale-[0.97] transition-transform"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          allDisplayMessages.map((msg) => {
            const { cleanText, actions } = msg.role === "assistant"
              ? parseActions(msg.content)
              : { cleanText: msg.content, actions: [] };

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                    msg.role === "assistant" ? "bg-primary/10" : "bg-secondary"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="w-3 h-3 text-primary" />
                  ) : (
                    <User className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <div className={`min-w-0 ${msg.role === "user" ? "max-w-[85%]" : "max-w-[92%] w-full"}`}>
                  {/* User images */}
                  {msg.role === "user" && msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div className="flex gap-1.5 mb-1.5 justify-end">
                      {msg.imageUrls.map((url, i) => (
                        <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Imagen ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed overflow-x-auto ${
                      msg.role === "assistant"
                        ? "bg-card border border-border rounded-tl-sm"
                        : "rounded-tr-sm"
                    }`}
                    style={
                      msg.role === "user"
                        ? { backgroundColor: color, color: "#fff" }
                        : undefined
                    }
                  >
                    {msg.role === "assistant" ? (
                      <>
                        <MarkdownMath content={cleanText} />
                        {"isStreaming" in msg && msg.isStreaming && (
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
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  {actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {actions.map((action, i) => {
                        const key = `${msg.id}-${i}`;
                        return (
                          <ActionButton
                            key={key}
                            action={action}
                            executed={executedActions.has(key)}
                            onExecute={() => handleExecuteAction(action, key)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pending images preview */}
      {pendingImages.length > 0 && (
        <div className="flex gap-2 px-1 py-1.5 shrink-0">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removePendingImage(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 pt-2 pb-1 shrink-0 border-t border-border">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || pendingImages.length >= 3}
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-40 touch-target"
          aria-label="Adjuntar imagen"
        >
          <ImagePlus className="w-4 h-4 text-muted-foreground" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pregunta sobre tus apuntes..."
          disabled={isStreaming}
          rows={1}
          className="flex-1 px-3.5 py-2 rounded-2xl bg-secondary border border-border text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          style={{ maxHeight: "120px", overflowY: "auto" }}
          aria-label="Mensaje al asistente"
        />
        <button
          onClick={handleSend}
          disabled={(!input.trim() && pendingImages.length === 0) || isStreaming}
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 shrink-0"
          style={{ backgroundColor: color }}
          aria-label="Enviar mensaje"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
