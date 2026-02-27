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

/**
 * Shadow removal using morphological closing + illumination normalization.
 * This is the standard technique used by CamScanner, OpenCV, and document scanning apps:
 *   1. Estimate background illumination via morphological closing (dilate → erode)
 *   2. Divide original by background to flatten lighting
 *   3. Normalize result to full 0-255 range
 *
 * The closing operation removes text/foreground while preserving shadow gradients,
 * giving us a pure illumination map. Dividing by it cancels out shadows.
 */
async function removeShadows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharp: any,
  imageBuffer: Buffer
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width!;
  const h = meta.height!;

  // Step 1: Morphological closing = dilate then erode
  // Large kernel to bridge over text while keeping shadow structure
  // Kernel size proportional to image size (similar to OpenCV's 150x150 for ~2000px images)
  const morphSize = Math.max(15, Math.round(Math.min(w, h) / 14));

  const backgroundBuffer = await sharp(imageBuffer)
    .greyscale()
    .dilate(morphSize)  // Expand bright areas → fills in text gaps
    .erode(morphSize)   // Shrink back → background estimate without text
    .blur(Math.max(5, Math.round(morphSize / 3))) // Smooth the estimate
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Step 2: Get original grayscale pixels
  const originalBuffer = await sharp(imageBuffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Step 3: Divide original by background to normalize illumination
  const pixelCount = w * h;
  const result = Buffer.alloc(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const orig = originalBuffer.data[i];
    const bg = Math.max(backgroundBuffer.data[i], 1);
    // Standard formula: output = orig * 255 / bg
    // This makes paper white and text dark regardless of shadow
    const val = Math.round((orig / bg) * 255);
    result[i] = Math.min(255, Math.max(0, val));
  }

  return sharp(result, { raw: { width: w, height: h, channels: 1 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/**
 * Color-preserving shadow removal for enhanced/auto modes.
 * Applies the illumination correction per-channel.
 */
async function removeShadowsColor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharp: any,
  imageBuffer: Buffer
): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width!;
  const h = meta.height!;

  const morphSize = Math.max(15, Math.round(Math.min(w, h) / 14));

  // Background estimate from grayscale version
  const bgBuffer = await sharp(imageBuffer)
    .greyscale()
    .dilate(morphSize)
    .erode(morphSize)
    .blur(Math.max(5, Math.round(morphSize / 3)))
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Original in RGB
  const origBuffer = await sharp(imageBuffer)
    .toColorspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = 3;
  const pixelCount = w * h;
  const result = Buffer.alloc(pixelCount * channels);

  for (let i = 0; i < pixelCount; i++) {
    const bg = Math.max(bgBuffer.data[i], 1);
    const scale = 255 / bg; // illumination correction factor

    for (let c = 0; c < channels; c++) {
      const orig = origBuffer.data[i * channels + c];
      const val = Math.round(orig * scale);
      result[i * channels + c] = Math.min(255, Math.max(0, val));
    }
  }

  return sharp(result, { raw: { width: w, height: h, channels } })
    .jpeg({ quality: 95 })
    .toBuffer();
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

      // Step 4: Apply filter with shadow removal
      let finalBuffer: Buffer;

      switch (filter) {
        case "document": {
          // CamScanner-style B&W: shadow removal + clean contrast
          const shadowFree = await removeShadows(sharp, documentBuffer);
          finalBuffer = await sharp(shadowFree)
            .normalize()
            .linear(1.2, 10)
            .sharpen(1.5)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "grayscale": {
          // Clean grayscale with shadow removal
          const shadowFree = await removeShadows(sharp, documentBuffer);
          finalBuffer = await sharp(shadowFree)
            .normalize()
            .sharpen(1)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "enhanced": {
          // Color-preserved shadow removal + vivid enhancement
          const shadowFree = await removeShadowsColor(sharp, documentBuffer);
          finalBuffer = await sharp(shadowFree)
            .normalize()
            .sharpen(1.5)
            .modulate({ brightness: 1.03, saturation: 1.1 })
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "auto": {
          // Color-preserved shadow removal + clean look
          const shadowFree = await removeShadowsColor(sharp, documentBuffer);
          finalBuffer = await sharp(shadowFree)
            .normalize()
            .sharpen(1)
            .modulate({ brightness: 1.02 })
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "original":
        default:
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
