import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { requireUserId, AuthError } from "@/lib/firebase-admin";
import { getUserGeminiKey } from "@/lib/ai/user-key";

/**
 * Emite un ephemeral token de Gemini Live API para el usuario autenticado.
 * El cliente usa ese token (no la key real) para abrir el WebSocket de voz
 * directo con Gemini — así la key BYOK del usuario nunca sale del servidor.
 *
 * Solo disponible si el usuario tiene su propia key guardada: el tutor de
 * voz consume cuota de audio, cara, y no se ofrece contra la key
 * compartida del servidor (ver specs/08-voice-agent-byok.md).
 */
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof AuthError ? err.message : "No autenticado" },
      { status: 401 }
    );
  }

  const apiKey = await getUserGeminiKey(userId).catch(() => null);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Conecta tu API key de Gemini en Perfil para usar el tutor de voz" },
      { status: 403 }
    );
  }

  try {
    // Ephemeral tokens: soportado solo en v1alpha por ahora.
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // El usuario puede tardar en dar permiso de mic / conectar; 30 min
        // de margen para abrir la sesión, luego la sesión misma vive el
        // tiempo que dure la conversación.
        newSessionExpireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        expireTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    });

    if (!token.name) throw new Error("Gemini no devolvió un token");

    return NextResponse.json({ token: token.name, expiresAt: token.expireTime });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `No se pudo crear el token de voz: ${message}` },
      { status: 502 }
    );
  }
}
