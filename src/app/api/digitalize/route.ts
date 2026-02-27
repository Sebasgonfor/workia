import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  perspectiveWarp,
  calculateOutputDimensions,
  type Point,
} from "@/app/api/_utils/perspective";

export const runtime = "nodejs";
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

const CORNER_DETECTION_PROMPT = `You are a document scanner AI. Analyze this image and find the document, paper, or notebook page.

Return ONLY a valid JSON object with the 4 corner coordinates of the document as PIXEL coordinates (not percentages):
{
  "found": true,
  "corners": {
    "topLeft": {"x": N, "y": N},
    "topRight": {"x": N, "y": N},
    "bottomRight": {"x": N, "y": N},
    "bottomLeft": {"x": N, "y": N}
  }
}

RULES:
- The image dimensions are {width}x{height} pixels. Coordinates must be within these bounds.
- Identify the paper/document edges precisely, even if partially obscured.
- topLeft is the corner closest to the top-left of the image, etc.
- If no clear document/paper is found, return: {"found": false}
- Return ONLY JSON, no markdown, no backticks.`;

/**
 * Detect document corners using Gemini Vision.
 */
async function detectCorners(
  imageBase64: string,
  width: number,
  height: number
): Promise<Point[] | null> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = CORNER_DETECTION_PROMPT.replace("{width}", String(width)).replace(
      "{height}",
      String(height)
    );

    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
      { text: prompt },
    ]);

    const text = result.response.text();
    const parsed = JSON.parse(text);

    if (!parsed.found || !parsed.corners) return null;

    const { topLeft, topRight, bottomRight, bottomLeft } = parsed.corners;

    // Validate corners are within bounds
    const corners = [topLeft, topRight, bottomRight, bottomLeft];
    for (const c of corners) {
      if (
        typeof c.x !== "number" ||
        typeof c.y !== "number" ||
        c.x < 0 ||
        c.y < 0 ||
        c.x > width ||
        c.y > height
      ) {
        console.error("Invalid corner coordinates:", corners);
        return null;
      }
    }

    return corners as Point[];
  } catch (err) {
    console.error("Corner detection failed:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;

    const formData = await req.formData();
    const filter = (formData.get("filter") as string) || "auto";
    const files = formData.getAll("images") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const MAX_PROCESS_DIM = 2400;
    const processedImages: { base64: string; width: number; height: number }[] = [];

    for (const file of files) {
      const arrayBuf = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuf);

      // Step 1: Resize large camera photos and auto-rotate via EXIF
      let prepBuffer = await sharp(inputBuffer)
        .rotate() // auto-rotate based on EXIF
        .resize(MAX_PROCESS_DIM, MAX_PROCESS_DIM, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 95 })
        .toBuffer();

      // Get dimensions after resize/rotate
      const meta = await sharp(prepBuffer).metadata();
      const imgW = meta.width!;
      const imgH = meta.height!;

      // Step 2: Detect document corners with Gemini
      const b64ForGemini = prepBuffer.toString("base64");
      const corners = await detectCorners(b64ForGemini, imgW, imgH);

      let warpedBuffer: Buffer;

      if (corners) {
        // Step 3: Perspective correction
        const outDims = calculateOutputDimensions(corners);
        // Ensure minimum reasonable dimensions
        const outW = Math.max(outDims.width, 200);
        const outH = Math.max(outDims.height, 200);

        // Get raw RGB pixels from the prepared image
        const rawData = await sharp(prepBuffer)
          .raw()
          .toBuffer({ resolveWithObject: true });

        const channels = rawData.info.channels;

        // Apply perspective warp
        const warpedPixels = perspectiveWarp(
          rawData.data,
          imgW,
          imgH,
          corners,
          outW,
          outH,
          channels
        );

        // Convert raw pixels back to image buffer
        warpedBuffer = await sharp(warpedPixels, {
          raw: { width: outW, height: outH, channels },
        })
          .jpeg({ quality: 95 })
          .toBuffer();
      } else {
        // No corners detected — use the prepared image as-is
        warpedBuffer = prepBuffer;
      }

      // Step 4: Apply enhancement filter
      let pipeline = sharp(warpedBuffer);

      switch (filter) {
        case "document":
          // Strong B&W document scan: CLAHE for adaptive contrast + threshold
          pipeline = pipeline
            .greyscale()
            .clahe({ width: 3, height: 3 })
            .normalize()
            .sharpen(2)
            .threshold(135);
          break;

        case "grayscale":
          // Clean grayscale with adaptive contrast
          pipeline = pipeline
            .greyscale()
            .clahe({ width: 3, height: 3 })
            .normalize()
            .sharpen(1.5)
            .gamma(1.3);
          break;

        case "enhanced":
          // Vivid color enhancement
          pipeline = pipeline
            .clahe({ width: 3, height: 3 })
            .normalize()
            .sharpen(2)
            .modulate({ brightness: 1.08, saturation: 1.15 });
          break;

        case "auto":
          // Smart auto: adaptive contrast + clean look
          pipeline = pipeline
            .clahe({ width: 3, height: 3 })
            .normalize()
            .sharpen(1.5)
            .modulate({ brightness: 1.05 });
          break;

        case "original":
        default:
          // No enhancement — just the perspective-corrected image
          break;
      }

      const processed = await pipeline
        .jpeg({ quality: 88 })
        .toBuffer({ resolveWithObject: true });

      const base64 = `data:image/jpeg;base64,${processed.data.toString("base64")}`;
      processedImages.push({
        base64,
        width: processed.info.width,
        height: processed.info.height,
      });
    }

    return NextResponse.json({ images: processedImages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Digitalize route error:", message, err);
    return NextResponse.json(
      { error: `Image processing failed: ${message}` },
      { status: 500 }
    );
  }
}
