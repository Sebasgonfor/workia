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

export function MermaidChart({ code }: MermaidChartProps) {
  const uid = useId().replace(/:/g, "m");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    loadMermaid()
      .then(async () => {
        try {
          const result = await window.mermaid!.render(uid, code.trim());
          setSvg(result.svg);
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
      <pre className="text-xs bg-secondary/50 rounded-xl p-3 overflow-x-auto text-muted-foreground my-2 whitespace-pre-wrap">
        {code}
      </pre>
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
