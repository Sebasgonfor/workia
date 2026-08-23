import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

const DETECT_PROMPT = `You are a document edge detection AI. Analyze this image and find the 4 corners of the main document/paper in the image.

Return the corner coordinates as pixel positions (x, y) relative to the image dimensions.

IMPORTANT:
- The coordinates must be in the original image pixel space
- Return corners in this order: topLeft, topRight, bottomRight, bottomLeft
- If no clear document is found, return null for corners
- Be precise — the corners should be at the exact edges of the document

Return JSON:
{
  "corners": {
    "topLeft": { "x": number, "y": number },
    "topRight": { "x": number, "y": number },
    "bottomRight": { "x": number, "y": number },
    "bottomLeft": { "x": number, "y": number }
  } | null,
  "confidence": number
}`;

interface DetectResponse {
  corners: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  } | null;
  confidence: number;
}

/**
 * POST /api/digitalize/detect
 * Gemini AI fallback for document corner detection.
 * Used when Scanic client-side detection fails.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const imageWidth = Number(formData.get("width") || 0);
    const imageHeight = Number(formData.get("height") || 0);

    if (!file) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const prompt = imageWidth && imageHeight
      ? `${DETECT_PROMPT}\n\nImage dimensions: ${imageWidth}x${imageHeight}px`
      : DETECT_PROMPT;

    const parsed = await generateJSON<DetectResponse>({
      prompt,
      images: [{ data: base64, mimeType }],
    });

    if (!parsed || !parsed.corners) {
      return NextResponse.json({ corners: null });
    }

    return NextResponse.json({ corners: parsed.corners });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Detect route error:", message, err);
    return NextResponse.json(
      { error: `Detection failed: ${message}` },
      { status: 500 }
    );
  }
}
