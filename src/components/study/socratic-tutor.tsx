"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { GraduationCap, Send, X, Loader2, Trophy, Sparkles } from "lucide-react";
import { MarkdownMath } from "@/components/ui/markdown-math";
import { useSocraticSessions } from "@/lib/hooks/useSocraticSessions";
import { toast } from "sonner";

interface SocraticTutorProps {
  subjectId: string;
  classId: string;
  subjectName: string;
  classTitle: string;
  notesContent: string;
  initialTopic?: string;
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MasteryResult {
  score: number;
  summary: string;
}

export function SocraticTutor({ subjectId, classId, subjectName, classTitle, notesContent, initialTopic, onClose }: SocraticTutorProps) {
  const [topic, setTopic] = useState(initialTopic || "");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [mastery, setMastery] = useState<MasteryResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const masterySavedRef = useRef(false);
  const { addSession } = useSocraticSessions();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const sendMessage = useCallback(async (allMessages: Message[]) => {
    setStreaming(true);
    try {
      const res = await fetch("/api/socratic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectName,
          classTitle,
          notesContent,
          topic,
          messages: allMessages,
          currentDate: new Date().toISOString().split("T")[0],
        }),
      });

      if (!res.ok) throw new Error("Error del servidor");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Check for mastery block
        const masteryMatch = fullText.match(/```mastery\s*\n([\s\S]*?)\n```/);
        const displayText = masteryMatch
          ? fullText.replace(/```mastery\s*\n[\s\S]*?\n```/, "").trim()
          : fullText;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: displayText };
          return updated;
        });

        if (masteryMatch && !masterySavedRef.current) {
          masterySavedRef.current = true;
          try {
            const masteryData = JSON.parse(masteryMatch[1]);
            setMastery(masteryData);
            // Save session
            await addSession({
              subjectId,
              classSessionId: classId,
              topic,
              score: masteryData.score,
              messageCount: allMessages.length + 1,
              mastered: true,
            });
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      toast.error("Error de conexion");
    } finally {
      setStreaming(false);
    }
  }, [subjectName, classTitle, notesContent, topic, subjectId, classId, addSession]);

  const handleStart = useCallback(() => {
    if (!topic.trim()) return;
    setStarted(true);
    const initialMessages: Message[] = [{ role: "user", content: `Quiero entender: ${topic}` }];
    setMessages(initialMessages);
    sendMessage(initialMessages);
  }, [topic, sendMessage]);

  useEffect(() => {
    if (initialTopic && !started) {
      handleStart();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    const newMessages = [...messages, { role: "user" as const, content: input }];
    setMessages(newMessages);
    setInput("");
    sendMessage(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!started) handleStart();
      else handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-500/20 bg-indigo-950/30">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white">Tutor Socratico</span>
          {started && (
            <span className="text-xs text-indigo-300/60 ml-2">{topic}</span>
          )}
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Topic selection or Chat */}
      {!started ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto">
              <GraduationCap className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Tutor Socratico</h2>
              <p className="text-sm text-zinc-400">
                No te dare respuestas directas. Te guiare con preguntas hasta que domines el tema.
              </p>
            </div>
            <div>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="¿Que tema quieres dominar?"
                className="w-full p-4 rounded-xl bg-white/5 border border-indigo-500/20 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 text-center"
                autoFocus
              />
              <button
                onClick={handleStart}
                disabled={!topic.trim()}
                className="mt-4 w-full py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Comenzar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Mastery banner */}
          {mastery && (
            <div className="mx-4 mt-3 p-4 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <div>
                  <p className="text-white font-semibold">Maestria alcanzada: {mastery.score}/100</p>
                  <p className="text-sm text-indigo-200/70 mt-0.5">{mastery.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-indigo-500 text-white"
                    : "bg-white/5 border border-indigo-500/10 text-zinc-200"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="text-sm [&_p]:mb-2 [&_p:last-child]:mb-0">
                      <MarkdownMath content={msg.content} />
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {streaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-indigo-500/10 rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          {!mastery && (
            <div className="px-4 pb-4 pt-2 border-t border-white/5">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tu respuesta..."
                  rows={1}
                  className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-indigo-500/50 text-sm max-h-32"
                  disabled={streaming}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className="p-3 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
