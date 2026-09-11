"use client";

import { auth } from "@/lib/firebase";

/**
 * Header `Authorization: Bearer <idToken>` para las rutas de servidor que
 * necesitan saber qué usuario llama (BYOK, tutor de voz). Devuelve `{}`
 * si no hay sesión — la ruta cae al comportamiento de siempre (key del
 * servidor) en vez de fallar.
 */
export async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}
