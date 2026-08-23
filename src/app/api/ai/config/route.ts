import { NextRequest, NextResponse } from "next/server";
import { getConfiguredProviders } from "@/lib/ai";
import {
  AI_SELECTION_COOKIE,
  PROVIDERS,
  parseSelection,
  validateSelection,
  type AiSelection,
} from "@/lib/ai/catalog";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Lo que hay configurado por env, como fallback visible en la UI. */
function envDefaults() {
  return {
    textProvider: process.env.AI_TEXT_PROVIDER || "gemini",
    textModel: process.env.AI_TEXT_MODEL || "",
    visionProvider: process.env.AI_VISION_PROVIDER || "gemini",
    visionModel: process.env.AI_VISION_MODEL || "",
  };
}

/** GET → catálogo, qué proveedores tienen key, y la selección activa. */
export async function GET(req: NextRequest) {
  const configured = getConfiguredProviders();
  const raw = req.cookies.get(AI_SELECTION_COOKIE)?.value;

  let saved: Partial<AiSelection> = {};
  if (raw) {
    try {
      saved = parseSelection(JSON.parse(raw));
    } catch {
      saved = {};
    }
  }

  const defaults = envDefaults();

  return NextResponse.json({
    providers: PROVIDERS.map((p) => ({ ...p, hasKey: configured[p.id] ?? false })),
    defaults,
    saved,
    active: { ...defaults, ...saved },
  });
}

/** POST → guarda la selección en cookie (prioridad sobre las env vars). */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { selection, invalid } = validateSelection(body);

  // Todo o nada: guardar solo la mitad dejaría un proveedor con el modelo de otro.
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Valor no válido en: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }
  if (Object.keys(selection).length === 0) {
    return NextResponse.json(
      { error: "No se envió ningún proveedor o modelo" },
      { status: 400 }
    );
  }

  const configured = getConfiguredProviders();
  for (const key of ["textProvider", "visionProvider"] as const) {
    const provider = selection[key];
    if (provider && !configured[provider]) {
      return NextResponse.json(
        { error: `El proveedor "${provider}" no tiene su API key configurada en el servidor` },
        { status: 400 }
      );
    }
  }

  const res = NextResponse.json({ ok: true, saved: selection });
  res.cookies.set(AI_SELECTION_COOKIE, JSON.stringify(selection), {
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return res;
}

/** DELETE → vuelve a lo que digan las env vars. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true, defaults: envDefaults() });
  res.cookies.delete(AI_SELECTION_COOKIE);
  return res;
}
