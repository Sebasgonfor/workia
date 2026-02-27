"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { MermaidChart } from "./mermaid-chart";

// ── Types ──

type NoteColorType = "formula" | "def" | "warn" | "ex" | "ai";

interface NoteSegment {
  type: "md" | NoteColorType;
  content: string;
}

// ── Color config ──

const COLOR_CONFIG: Record<NoteColorType, {
  bg: string; headerBg: string; border: string; text: string; label: string; emoji: string;
}> = {
  formula: { bg: "rgba(139,92,246,0.06)", headerBg: "rgba(139,92,246,0.18)", border: "#8b5cf6", text: "#8b5cf6", label: "Fórmula",    emoji: "🔮" },
  def:     { bg: "rgba(16,185,129,0.06)",  headerBg: "rgba(16,185,129,0.18)",  border: "#10b981", text: "#10b981", label: "Definición", emoji: "📗" },
  warn:    { bg: "rgba(245,158,11,0.06)",  headerBg: "rgba(245,158,11,0.18)",  border: "#f59e0b", text: "#b87800", label: "Importante", emoji: "⚠️" },
  ex:      { bg: "rgba(59,130,246,0.06)",  headerBg: "rgba(59,130,246,0.18)",  border: "#3b82f6", text: "#3b82f6", label: "Ejemplo",    emoji: "💡" },
  ai:      { bg: "rgba(236,72,153,0.06)",  headerBg: "rgba(236,72,153,0.18)",  border: "#ec4899", text: "#ec4899", label: "IA",         emoji: "✨" },
};

const COLOR_TAGS: NoteColorType[] = ["formula", "def", "warn", "ex", "ai"];

// ── Segment parser ──

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

// ── TOC helpers ──

const slugify = (text: string): string =>
  text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/^-|-$/g, "");

export const extractTOC = (
  content: string
): { level: 2 | 3; text: string; id: string }[] => {
  const toc: { level: 2 | 3; text: string; id: string }[] = [];
  for (const line of content.split("\n")) {
    const h3 = line.match(/^### (.+)/);
    const h2 = !h3 && line.match(/^## (.+)/);
    if (h2) toc.push({ level: 2, text: h2[1].trim(), id: slugify(h2[1].trim()) });
    if (h3) toc.push({ level: 3, text: h3[1].trim(), id: slugify(h3[1].trim()) });
  }
  return toc;
};

// ── Keyword preprocessing ──
// <nc-kw>word</nc-kw> → [word](nc-kw:) → caught by custom `a` renderer → colored span

const preprocessKeywords = (text: string): string =>
  text.replace(/<nc-kw>(.*?)<\/nc-kw>/g, "[$1](nc-kw:)");

// ── React node text extractor (for heading IDs) ──

const getNodeText = (node: React.ReactNode): string => {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (React.isValidElement(node))
    return getNodeText((node.props as { children?: React.ReactNode }).children);
  return "";
};

// ── Markdown renderers ──

const mdCodeRenderer = ({ className, children }: { className?: string; children?: React.ReactNode }) => {
  const lang = /language-(\w+)/.exec(className || "")?.[1];
  const codeStr = String(children).replace(/\n$/, "");
  if (lang === "mermaid") return <MermaidChart code={codeStr} />;
  return <code className={className}>{children}</code>;
};

const mdPreRenderer = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

// ── MdBlock: full markdown → headings + keywords + diagrams ──

interface MdBlockProps {
  content: string;
  className?: string;
  subjectColor?: string;
  textColor?: string;
}

const MdBlock = ({ content, className = "", subjectColor = "#6366f1", textColor }: MdBlockProps) => {
  const processed = useMemo(() => preprocessKeywords(content), [content]);

  return (
    <div
      className={`markdown-math prose dark:prose-invert prose-sm max-w-none ${className}`}
      style={textColor ? { color: textColor } : undefined}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code: mdCodeRenderer as never,
          pre: mdPreRenderer as never,
          // Keyword colored span
          a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
            if (href === "nc-kw:")
              return <span style={{ color: subjectColor, fontWeight: 600 }}>{children}</span>;
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          // H1 — large title
          h1: ({ children }: { children?: React.ReactNode }) => (
            <h1
              id={slugify(getNodeText(children))}
              style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: "1.5rem", marginBottom: "0.5rem", lineHeight: 1.3, scrollMarginTop: "80px" }}
            >
              {children}
            </h1>
          ),
          // H2 — section title + dashed subject-color separator
          h2: ({ children }: { children?: React.ReactNode }) => (
            <>
              <h2
                id={slugify(getNodeText(children))}
                style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "1.25rem", marginBottom: "0.1rem", lineHeight: 1.3, scrollMarginTop: "80px" }}
              >
                {children}
              </h2>
              <hr style={{ border: "none", borderTop: `1.5px dashed ${subjectColor}55`, marginTop: "0.2rem", marginBottom: "0.75rem" }} />
            </>
          ),
          // H3 — subsection in subject color
          h3: ({ children }: { children?: React.ReactNode }) => (
            <h3
              id={slugify(getNodeText(children))}
              style={{ fontSize: "0.95rem", fontWeight: 700, color: subjectColor, marginTop: "1rem", marginBottom: "0.2rem", lineHeight: 1.3, scrollMarginTop: "80px" }}
            >
              {children}
            </h3>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
};

// ── Public component ──

interface MarkdownMathProps {
  content: string;
  className?: string;
  inline?: boolean;
  subjectColor?: string;
}

export function MarkdownMath({ content, className = "", inline = false, subjectColor = "#6366f1" }: MarkdownMathProps) {
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

  // Fast path: no color tags
  if (segments.length === 1 && segments[0].type === "md") {
    return <MdBlock content={content} className={className} subjectColor={subjectColor} />;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {segments.map((seg, i) => {
        if (seg.type === "md") {
          return seg.content.trim()
            ? <MdBlock key={i} content={seg.content} subjectColor={subjectColor} />
            : null;
        }
        const cfg = COLOR_CONFIG[seg.type];
        return (
          <div
            key={i}
            style={{ border: `1px solid ${cfg.border}30`, borderRadius: "0.75rem", overflow: "hidden" }}
          >
            {/* Card header */}
            <div style={{ backgroundColor: cfg.headerBg, padding: "0.4rem 0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: cfg.text, letterSpacing: "0.05em" }}>
                {cfg.emoji} {cfg.label.toUpperCase()}
              </span>
              <span style={{ fontSize: "9px", fontWeight: 700, color: cfg.text, backgroundColor: `${cfg.border}25`, padding: "0.1rem 0.5rem", borderRadius: "9999px", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                {seg.type}
              </span>
            </div>
            {/* Card body — text in type color */}
            <div style={{ backgroundColor: cfg.bg, padding: "0.6rem 0.75rem" }}>
              <MdBlock content={seg.content} textColor={cfg.text} subjectColor={subjectColor} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
