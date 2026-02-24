"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { MermaidChart } from "./mermaid-chart";

// ── Note color segment system ──

type NoteColorType = "formula" | "def" | "warn" | "ex" | "ai";

interface NoteSegment {
  type: "md" | NoteColorType;
  content: string;
}

const COLOR_CONFIG: Record<NoteColorType, { bg: string; border: string; label: string; emoji: string }> = {
  formula: { bg: "rgba(139,92,246,0.10)", border: "#8b5cf6", label: "Fórmula",    emoji: "🔮" },
  def:     { bg: "rgba(16,185,129,0.10)", border: "#10b981", label: "Definición", emoji: "📗" },
  warn:    { bg: "rgba(245,158,11,0.10)", border: "#f59e0b", label: "Importante",  emoji: "⚠️" },
  ex:      { bg: "rgba(59,130,246,0.10)", border: "#3b82f6", label: "Ejemplo",    emoji: "💡" },
  ai:      { bg: "rgba(236,72,153,0.10)", border: "#ec4899", label: "IA",          emoji: "✨" },
};

const COLOR_TAGS: NoteColorType[] = ["formula", "def", "warn", "ex", "ai"];

const parseSegments = (text: string): NoteSegment[] => {
  const pattern = new RegExp(
    `<nc-(${COLOR_TAGS.join("|")})>([\\s\\S]*?)<\\/nc-(?:${COLOR_TAGS.join("|")})>`,
    "g"
  );
  const segments: NoteSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "md", content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: match[1] as NoteColorType, content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "md", content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "md", content: text }];
};

// ── Internal markdown block ──

// Renders ```mermaid blocks as live interactive diagrams
const mdCodeRenderer = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  const lang = /language-(\w+)/.exec(className || "")?.[1];
  const codeStr = String(children).replace(/\n$/, "");
  if (lang === "mermaid") return <MermaidChart code={codeStr} />;
  return <code className={className}>{children}</code>;
};

// Unwrap <pre> wrapper so MermaidChart controls its own container
const mdPreRenderer = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

const MdBlock = ({ content, className = "" }: { content: string; className?: string }) => (
  <div className={`markdown-math prose prose-invert prose-sm max-w-none ${className}`}>
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code: mdCodeRenderer as never,
        pre: mdPreRenderer as never,
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

// ── Public component ──

interface MarkdownMathProps {
  content: string;
  className?: string;
  inline?: boolean;
}

export function MarkdownMath({ content, className = "", inline = false }: MarkdownMathProps) {
  const segments = useMemo(() => parseSegments(content), [content]);

  if (inline) {
    return (
      <span className={`markdown-math markdown-math-inline max-w-none ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{ p: ({ children }) => <span>{children}</span> }}
        >
          {content}
        </ReactMarkdown>
      </span>
    );
  }

  // Fast path: no color tags detected
  if (segments.length === 1 && segments[0].type === "md") {
    return <MdBlock content={content} className={className} />;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {segments.map((seg, i) => {
        if (seg.type === "md") {
          return seg.content.trim() ? <MdBlock key={i} content={seg.content} /> : null;
        }
        const cfg = COLOR_CONFIG[seg.type];
        return (
          <div
            key={i}
            style={{
              backgroundColor: cfg.bg,
              borderLeft: `3px solid ${cfg.border}`,
              borderRadius: "0.5rem",
              padding: "0.5rem 0.75rem",
            }}
          >
            <p
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: cfg.border,
                marginBottom: "0.2rem",
                letterSpacing: "0.05em",
              }}
            >
              {cfg.emoji} {cfg.label.toUpperCase()}
            </p>
            <MdBlock content={seg.content} />
          </div>
        );
      })}
    </div>
  );
}
