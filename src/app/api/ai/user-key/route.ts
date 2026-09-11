import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { requireUserId, AuthError } from "@/lib/firebase-admin";
import {
  getUserKeyStatus,
  saveUserGeminiKey,
  deleteUserGeminiKey,
} from "@/lib/ai/user-key";

/** Formato de las API keys de Google AI Studio: "AIza" + 35 chars alfanuméricos/-_/. */
function looksLikeGeminiKey(key: unknown): key is string {
  return typeof key === "string" && /^AIza[A-Za-z0-9_-]{35}$/.test(key);
}

/** Ping real contra Gemini: la única forma fiable de saber si una key sirve. */
async function validateKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      config: { maxOutputTokens: 5 },
    });
    if (res.text === undefined && !res.candidates?.length) {
      return { ok: false, error: "La key no devolvió respuesta" };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Key rechazada por Gemini: ${message}` };
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const status = await getUserKeyStatus(userId);
    return NextResponse.json(status);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: "No se pudo leer el estado de la key" }, { status: 500 });
  }
}

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const apiKey = (body as { apiKey?: unknown })?.apiKey;
  if (!looksLikeGeminiKey(apiKey)) {
    return NextResponse.json(
      { error: "Eso no parece una API key de Gemini válida (debe empezar con \"AIza\")" },
      { status: 400 }
    );
  }

  const validation = await validateKey(apiKey);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    await saveUserGeminiKey(userId, apiKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo guardar la key" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    await deleteUserGeminiKey(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    return NextResponse.json({ error: "No se pudo borrar la key" }, { status: 500 });
  }
}
