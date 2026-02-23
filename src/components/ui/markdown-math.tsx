"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MarkdownMathProps {
  content: string;
  className?: string;
  inline?: boolean;
}

export function MarkdownMath({ content, className = "", inline = false }: MarkdownMathProps) {
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

  return (
    <div className={`markdown-math prose prose-invert prose-sm max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
