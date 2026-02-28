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

    const prompt = CORNER_DETECTION_PROMPT
      .replace("{width}", String(width))
      .replace("{height}", String(height));

    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
      { text: prompt },
    ]);

    const text = result.response.text();
    const parsed = JSON.parse(text);

    if (!parsed.found || !parsed.corners) return null;

    const { topLeft, topRight, bottomRight, bottomLeft } = parsed.corners;
    const corners = [topLeft, topRight, bottomRight, bottomLeft];

    for (const c of corners) {
      if (
        typeof c.x !== "number" ||
        typeof c.y !== "number" ||
        c.x < 0 || c.y < 0 ||
        c.x > width || c.y > height
      ) {
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

    const MAX_PROCESS_DIM = 2000;
    const processedImages: { base64: string; width: number; height: number }[] = [];

    for (const file of files) {
      const arrayBuf = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuf);

      // Step 1: Resize + auto-rotate via EXIF
      const prepBuffer = await sharp(inputBuffer)
        .rotate()
        .resize(MAX_PROCESS_DIM, MAX_PROCESS_DIM, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 95 })
        .toBuffer();

      const meta = await sharp(prepBuffer).metadata();
      const imgW = meta.width!;
      const imgH = meta.height!;

      // Step 2: Detect document corners with Gemini
      const b64ForGemini = prepBuffer.toString("base64");
      const corners = await detectCorners(b64ForGemini, imgW, imgH);

      let documentBuffer: Buffer;

      if (corners) {
        // Step 3: Perspective correction
        const outDims = calculateOutputDimensions(corners);
        const outW = Math.max(outDims.width, 200);
        const outH = Math.max(outDims.height, 200);

        const rawData = await sharp(prepBuffer)
          .raw()
          .toBuffer({ resolveWithObject: true });

        const channels = rawData.info.channels;
        const warpedPixels = perspectiveWarp(
          rawData.data, imgW, imgH, corners, outW, outH, channels
        );

        documentBuffer = await sharp(warpedPixels, {
          raw: { width: outW, height: outH, channels },
        })
          .jpeg({ quality: 95 })
          .toBuffer();
      } else {
        documentBuffer = prepBuffer;
      }

      // Step 4: Apply enhancement filter
      // CLAHE (Contrast Limited Adaptive Histogram Equalization) is the key:
      // - Equalizes contrast within local tiles → inherently reduces shadow impact
      // - Each tile gets its own histogram stretch → dark shadowed areas get brightened
      // - maxSlope limits over-amplification of noise
      // More tiles (higher width/height) = gentler effect
      let finalBuffer: Buffer;

      switch (filter) {
        case "document": {
          // B&W clean document scan
          // CLAHE with moderate tiles handles shadows by equalizing each region
          // linear(a, b) = a*pixel + b → increases contrast and pushes paper to white
          finalBuffer = await sharp(documentBuffer)
            .greyscale()
            .normalize()
            .clahe({ width: 8, height: 8, maxSlope: 5 })
            .linear(1.4, -40)
            .sharpen(1.5)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "grayscale": {
          // Clean grayscale
          finalBuffer = await sharp(documentBuffer)
            .greyscale()
            .normalize()
            .clahe({ width: 10, height: 10, maxSlope: 3 })
            .sharpen(1)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "enhanced": {
          // Vivid color with shadow reduction
          finalBuffer = await sharp(documentBuffer)
            .normalize()
            .clahe({ width: 10, height: 10, maxSlope: 3 })
            .sharpen(1.5)
            .modulate({ brightness: 1.03, saturation: 1.1 })
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "auto": {
          // Clean readable scan with natural colors
          finalBuffer = await sharp(documentBuffer)
            .normalize()
            .clahe({ width: 10, height: 10, maxSlope: 3 })
            .sharpen(1.2)
            .modulate({ brightness: 1.02 })
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "original":
        default:
          // Only perspective correction, no enhancement
          finalBuffer = await sharp(documentBuffer)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
      }

      const info = await sharp(finalBuffer).metadata();
      const base64 = `data:image/jpeg;base64,${finalBuffer.toString("base64")}`;
      processedImages.push({
        base64,
        width: info.width!,
        height: info.height!,
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
