"use client";

import { useId } from "react";

export type FileKind = "pdf" | "docx" | "pptx" | "txt";

export const MATERIAL_FORMATS: readonly { kind: FileKind; app: string }[] = [
  { kind: "pdf", app: "PDF" },
  { kind: "docx", app: "Word" },
  { kind: "pptx", app: "PowerPoint" },
  { kind: "txt", app: "Texto plano" },
];

const SIZE = "w-7 h-7 shrink-0";

/** White letter tile that sits on the front-left of Fluent-style app icons. */
function LetterTile({ id, from, to, letter }: { id: string; from: string; to: string; letter: "W" | "P" }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="1" y="8" width="17" height="17" rx="2.5" fill={`url(#${id})`} />
      {letter === "W" ? (
        <path
          d="M4.6 12.2h1.9l1.2 6.4 1.4-6.4h1.7l1.4 6.4 1.2-6.4h1.9l-2.1 8.6h-1.8l-1.4-6.2-1.4 6.2H6.7z"
          fill="#fff"
        />
      ) : (
        <path
          d="M6.4 12.2h3.6c2 0 3.3 1.1 3.3 2.9s-1.3 3-3.3 3H8.3v2.7H6.4zm1.9 1.6v2.7h1.5c.9 0 1.5-.5 1.5-1.35s-.6-1.35-1.5-1.35z"
          fill="#fff"
        />
      )}
    </>
  );
}

function WordIcon() {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={SIZE} aria-hidden="true">
      <rect x="8" y="3" width="23" height="7" rx="2" fill="#41A5EE" />
      <rect x="8" y="9.5" width="23" height="7" fill="#2B7CD3" />
      <rect x="8" y="16" width="23" height="7" fill="#185ABD" />
      <path d="M8 22.5h23V27a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#103F91" />
      <LetterTile id={`${id}-t`} from="#2368C4" to="#1A509B" letter="W" />
    </svg>
  );
}

function PowerPointIcon() {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={SIZE} aria-hidden="true">
      <circle cx="18" cy="16" r="13" fill="#ED6C47" />
      <path d="M18 3a13 13 0 0 1 13 13H18z" fill="#FF8F6B" />
      <path d="M18 16h13a13 13 0 0 1-13 13z" fill="#D35230" />
      <LetterTile id={`${id}-t`} from="#CA4C28" to="#C5391A" letter="P" />
    </svg>
  );
}

function PdfIcon() {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={SIZE} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E9ECF1" />
        </linearGradient>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F2464B" />
          <stop offset="1" stopColor="#C4161C" />
        </linearGradient>
      </defs>
      <path d="M8 2h14l8 8v18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill={`url(#${id}-p)`} stroke="#D3D8E0" strokeWidth="0.75" />
      <path d="M22 2v6a2 2 0 0 0 2 2h6z" fill="#D3D8E0" />
      <rect x="1" y="14" width="22" height="11" rx="2.5" fill={`url(#${id}-t)`} />
      <text x="12" y="22.6" textAnchor="middle" fontSize="7.4" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
        PDF
      </text>
    </svg>
  );
}

function TextIcon() {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={SIZE} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8CD0F5" />
          <stop offset="1" stopColor="#4AA9E0" />
        </linearGradient>
      </defs>
      <rect x="5" y="4" width="22" height="26" rx="3" fill={`url(#${id}-p)`} />
      <rect x="5" y="25" width="22" height="5" rx="2" fill="#8A5A3B" />
      {[9, 13, 17, 21].map((y) => (
        <rect key={y} x="9" y={y} width="14" height="1.6" rx="0.8" fill="#fff" opacity="0.9" />
      ))}
      {[10, 14, 18, 22].map((x) => (
        <rect key={x} x={x - 0.8} y="1.5" width="1.6" height="5" rx="0.8" fill="#3C84B8" />
      ))}
    </svg>
  );
}

/** Fluent-style app icon for a class material file type. */
export function FileKindIcon({ kind }: { kind: FileKind }) {
  switch (kind) {
    case "docx":
      return <WordIcon />;
    case "pptx":
      return <PowerPointIcon />;
    case "pdf":
      return <PdfIcon />;
    default:
      return <TextIcon />;
  }
}

/** Canva has no native format; users export to PDF or PPTX. */
export function CanvaIcon() {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={SIZE} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-c`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#00C4CC" />
          <stop offset="0.55" stopColor="#5A5CF2" />
          <stop offset="1" stopColor="#8B3DFF" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill={`url(#${id}-c)`} />
      <path
        d="M20.6 19.4c-1 1.3-2.6 2.3-4.4 2.3-2.6 0-4.1-2-3.5-4.9.7-3.3 3.3-5.7 5.9-5.7 1.4 0 2.1.7 2.1 1.6 0 1-.8 1.6-1.4 1.6-.4 0-.5-.2-.4-.6.2-.9-.2-1.4-.8-1.4-1.4 0-2.9 1.9-3.3 4.1-.4 2 .3 3.2 1.8 3.2 1.2 0 2.3-.6 3.3-1.6z"
        fill="#fff"
      />
    </svg>
  );
}
