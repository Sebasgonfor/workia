/** Workia logo: brand square with a stroked "W" (stroked so it can be drawn
 *  in the splash intro). Same geometry as src/app/icon.svg. */
export const WORKIA_W_PATH = "M12.5 15.5 L18 33 L24 20.5 L30 33 L35.5 15.5";

export function WorkiaMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <rect width="48" height="48" rx="13" className="wk-mark-bg" />
      <path
        d={WORKIA_W_PATH}
        className="wk-mark-w"
        fill="none"
        stroke="white"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
