"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Lets a page auto-open its own "create" sheet when it's reached via a
 * `?new=1` query param (used by the mobile "Crear" quick-launcher so tapping
 * an item both navigates AND opens the form in one tap, instead of landing
 * on the list and making the user tap "+" again).
 *
 * Fires `open` once, then strips the param from the URL so navigating back
 * or refreshing doesn't reopen it. Reads `window.location` directly instead
 * of next/navigation's `useSearchParams` — that hook opts the whole page out
 * of static rendering unless wrapped in a <Suspense> boundary, which none of
 * these pages need for anything else.
 */
export function useAutoOpenCreate(open: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;
    firedRef.current = true;
    open();
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
