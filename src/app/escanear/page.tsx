"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EscanearRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/materias");
  }, [router]);
  return null;
}
