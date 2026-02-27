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

/**
 * Remove shadows using divide-by-background technique.
 * Creates a heavily blurred version (background estimate), then divides
 * the original by it to normalize lighting.
 */
async function removeShadows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharp: any,
  imageBuffer: Buffer,
  strength: number = 220
): Promise<Buffer> {
  // Get image info
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width!;
  const h = meta.height!;

  // Get raw pixels of original
  const origRaw = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Get raw pixels of heavily blurred version (background light estimate)
  const blurRadius = Math.max(31, Math.round(Math.min(w, h) / 15));
  // blur sigma must be 0.3-1000, radius is derived; use sigma for flexibility
  const blurSigma = blurRadius / 2;
  const blurRaw = await sharp(imageBuffer)
    .blur(blurSigma)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = origRaw.info.channels;
  const pixels = Buffer.alloc(origRaw.data.length);

  // Divide original by background: output = clamp(orig / blur * strength, 0, 255)
  for (let i = 0; i < origRaw.data.length; i++) {
    const bg = Math.max(blurRaw.data[i], 1); // avoid division by zero
    const val = Math.round((origRaw.data[i] / bg) * strength);
    pixels[i] = Math.min(255, Math.max(0, val));
  }

  // Convert back to image
  return sharp(pixels, { raw: { width: w, height: h, channels } })
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
      let prepBuffer = await sharp(inputBuffer)
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

      // Step 4: Shadow removal (for all modes except "original")
      let cleanBuffer: Buffer;
      if (filter !== "original") {
        cleanBuffer = await removeShadows(sharp, documentBuffer, 210);
      } else {
        cleanBuffer = documentBuffer;
      }

      // Step 5: Apply filter-specific enhancement
      let pipeline = sharp(cleanBuffer);

      switch (filter) {
        case "document":
          // Clean B&W document: grayscale + gentle contrast + sharpen
          // No hard threshold — use linear contrast to make paper white and text dark
          pipeline = pipeline
            .greyscale()
            .normalize()
            .linear(1.3, 15) // boost contrast, brighten paper
            .sharpen(1.5);
          break;

        case "grayscale":
          // Clean grayscale with readable contrast
          pipeline = pipeline
            .greyscale()
            .normalize()
            .gamma(0.9) // slightly brighten
            .sharpen(1);
          break;

        case "enhanced":
          // Color-enhanced scan
          pipeline = pipeline
            .normalize()
            .sharpen(1.5)
            .modulate({ brightness: 1.05, saturation: 1.1 });
          break;

        case "auto":
          // Smart auto: clean, bright, readable
          pipeline = pipeline
            .normalize()
            .gamma(0.9)
            .sharpen(1.2)
            .modulate({ brightness: 1.03 });
          break;

        case "original":
        default:
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
