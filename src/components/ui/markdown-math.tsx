"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MarkdownMathProps {
  content: string;
  className?: string;
}

export function MarkdownMath({ content, className = "" }: MarkdownMathProps) {
  return (
    <div className={`markdown-math prose prose-invert prose-sm max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
