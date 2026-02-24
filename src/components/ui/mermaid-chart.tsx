"use client";

import { useEffect, useRef, useState } from "react";

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

// Counter-based ID: guaranteed safe CSS identifier, no special chars
let _mermaidCounter = 0;
const nextMermaidId = () => `workia_m${++_mermaidCounter}`;

let _loadPromise: Promise<void> | null = null;

function loadMermaid(): Promise<void> {
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));

    // Already fully initialized
    if (window.mermaid?._workiaInit) return resolve();

    const init = () => {
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

    // Script already in DOM — if window.mermaid exists it's ready, otherwise wait
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${MERMAID_CDN}"]`
    );
    if (existing) {
      if (window.mermaid) {
        init();
      } else {
        existing.addEventListener("load", init, { once: true });
        existing.addEventListener("error", () => reject(new Error("Mermaid load failed")), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = MERMAID_CDN;
    script.async = true;
    script.addEventListener("load", init, { once: true });
    script.addEventListener("error", () => reject(new Error("Mermaid CDN unreachable")), { once: true });
    document.head.appendChild(script);
  });

  // Reset so a future call retries on failure
  _loadPromise.catch(() => { _loadPromise = null; });
  return _loadPromise;
}

interface MermaidChartProps {
  code: string;
}

/** Clean common AI-generation issues before passing to Mermaid */
function sanitizeMermaid(raw: string): string {
  return raw
    .trim()
    // Strip surrounding backtick fences if the model included them
    .replace(/^```(?:mermaid)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    // Unescape JSON-escaped newlines/tabs that may survive markdown parsing
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "  ")
    // Unescape LaTeX-style escaped parens inside node labels: \( → ( and \) → )
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    // Remove LaTeX dollar-sign math from labels (e.g. $R^3$ → R3)
    .replace(/\$([^$]+)\$/g, (_, m: string) => m.replace(/[\\{}^_]/g, ""))
    // Superscript notation: R^2 → R2, R^3 → R3 (carets break Mermaid labels)
    .replace(/\^(\w+)/g, "$1")
    // Smart/curly quotes → straight
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    // En/em dashes → regular hyphen (safe in labels)
    .replace(/[\u2013\u2014]/g, "-")
    // Remove zero-width spaces and other invisible chars
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .trim();
}

export function MermaidChart({ code }: MermaidChartProps) {
  // Stable counter-based ID: no special characters, guaranteed CSS-safe
  const uid = useRef(nextMermaidId()).current;
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cleanCode, setCleanCode] = useState("");
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const run = async () => {
      try {
        await loadMermaid();
        const cleaned = sanitizeMermaid(code);
        setCleanCode(cleaned);

        const renderPromise = window.mermaid!.render(uid, cleaned);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8000)
        );
        const result = await Promise.race([renderPromise, timeoutPromise]);
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
        // Retry once with re-init in case mermaid state got corrupted
        try {
          window.mermaid?.initialize({
            startOnLoad: false,
            theme: "dark",
            fontFamily: "inherit",
            securityLevel: "loose",
            suppressErrorRendering: true,
          });
          const cleaned = sanitizeMermaid(code);
          const result = await window.mermaid!.render(`${uid}_r`, cleaned);
          const isSyntaxError =
            result.svg.includes("Syntax error") ||
            result.svg.includes("mermaid-error") ||
            result.svg.includes("syntax-error");
          if (isSyntaxError) setError(true);
          else setSvg(result.svg);
        } catch {
          setError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    run();
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
