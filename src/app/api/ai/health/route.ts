import { NextResponse } from "next/server";
import { describeConfig, generateText } from "@/lib/ai";

/**
 * Diagnóstico de la configuración de IA.
 *   GET /api/ai/health        → qué proveedor/modelo está activo
 *   GET /api/ai/health?ping=1 → además hace una llamada real al modelo de texto
 */
export async function GET(req: Request) {
  const config = describeConfig();
  const ping = new URL(req.url).searchParams.get("ping");

  if (!ping) return NextResponse.json({ config });

  try {
    // Sin maxOutputTokens: los modelos con razonamiento gastan presupuesto
    // pensando y devolverían vacío con un tope bajo.
    const reply = await generateText("Responde exactamente: OK", { noFallback: true });
    return NextResponse.json({ config, ping: { ok: true, reply: reply.trim() } });
  } catch (err) {
    return NextResponse.json(
      { config, ping: { ok: false, error: err instanceof Error ? err.message : String(err) } },
      { status: 503 }
    );
  }
}
