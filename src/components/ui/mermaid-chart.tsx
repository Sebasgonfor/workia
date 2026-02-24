"use client";

import { useEffect, useRef, useState, useId } from "react";

const MERMAID_CDN =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: object) => void;
      render: (id: string, definition: string) => Promise<{ svg: string }>;
      _workiaInit?: boolean;
    };
  }
}

function loadMermaid(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));

    if (window.mermaid && window.mermaid._workiaInit) return resolve();

    const existing = document.querySelector(`script[src="${MERMAID_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Script load failed")));
      return;
    }

    const script = document.createElement("script");
    script.src = MERMAID_CDN;
    script.async = true;
    script.onload = () => {
      window.mermaid?.initialize({
        startOnLoad: false,
        theme: "dark",
        fontFamily: "inherit",
        securityLevel: "loose",
        suppressErrorRendering: true,
      });
      if (window.mermaid) window.mermaid._workiaInit = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Mermaid CDN"));
    document.head.appendChild(script);
  });
}

interface MermaidChartProps {
  code: string;
}

/** Clean common AI-generation issues before passing to Mermaid */
function sanitizeMermaid(raw: string): string {
  return raw
    .trim()
    // Unescape JSON-escaped newlines/tabs that may survive markdown parsing
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "  ")
    // Smart/curly quotes → straight
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    // En/em dashes → regular hyphen (safe in labels)
    .replace(/[\u2013\u2014]/g, "-")
    // Remove zero-width spaces and other invisible chars
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    // Strip surrounding backtick fences if the model included them
    .replace(/^```(?:mermaid)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

export function MermaidChart({ code }: MermaidChartProps) {
  const uid = useId().replace(/:/g, "m");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cleanCode, setCleanCode] = useState("");
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    loadMermaid()
      .then(async () => {
        try {
          const cleaned = sanitizeMermaid(code);
          setCleanCode(cleaned);
          const result = await window.mermaid!.render(uid, cleaned);
          // Mermaid v11 renders syntax errors as SVG with "Syntax error" text
          // instead of throwing — detect and treat as error
          const isSyntaxError =
            result.svg.includes("Syntax error") ||
            result.svg.includes("mermaid-error") ||
            result.svg.includes("syntax-error");
          if (isSyntaxError) {
            setError(true);
          } else {
            setSvg(result.svg);
          }
        } catch {
          setError(true);
        } finally {
          setLoading(false);
        }
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [code, uid]);

  if (loading) {
    return (
      <div className="h-20 rounded-xl bg-secondary/50 animate-pulse my-2 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Cargando diagrama...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-secondary/50 border border-border my-2 overflow-hidden">
        <div className="px-3 py-1.5 border-b border-border flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Diagrama (código)</span>
        </div>
        <pre className="text-xs p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {cleanCode || code}
        </pre>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl bg-secondary/20 border border-border p-3 my-2 [&_svg]:max-w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="Diagrama generado"
    />
  );
}
