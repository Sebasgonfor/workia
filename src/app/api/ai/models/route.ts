import { NextRequest, NextResponse } from "next/server";
import { listModels } from "@/lib/ai/list-models";
import { isProviderId } from "@/lib/ai/catalog";

/** GET /api/ai/models?provider=groq → modelos que ese proveedor ofrece ahora mismo. */
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");

  if (!isProviderId(provider)) {
    return NextResponse.json({ error: "Proveedor no válido" }, { status: 400 });
  }

  try {
    const models = await listModels(provider);
    return NextResponse.json({ provider, models });
  } catch (err) {
    return NextResponse.json(
      {
        provider,
        models: [],
        error: err instanceof Error ? err.message : "No se pudo consultar el proveedor",
      },
      { status: 502 }
    );
  }
}
