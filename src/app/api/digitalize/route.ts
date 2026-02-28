import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  perspectiveWarp,
  calculateOutputDimensions,
  type Point,
} from "@/app/api/_utils/perspective";
import { parseGeminiResponse } from "@/app/api/_utils/parse-gemini-json";

export const runtime = "nodejs";
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

// ── Corner detection via Gemini (fallback) ──

interface CornersData {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

const detectCornersWithGemini = async (
  base64: string,
  mimeType: string,
  width: number,
  height: number
): Promise<CornersData | null> => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `Analyze this ${width}x${height}px image. Find the 4 corners of the main document/paper.
Return JSON: { "corners": { "topLeft": {"x":N,"y":N}, "topRight": {"x":N,"y":N}, "bottomRight": {"x":N,"y":N}, "bottomLeft": {"x":N,"y":N} } | null }`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType } },
    ]);

    const parsed = parseGeminiResponse(result.response.text()) as { corners: CornersData | null };
    return parsed?.corners ?? null;
  } catch {
    return null;
  }
};

// ── Enhancement helpers ──

/**
 * Lambertian shadow removal: estimate background illumination via blur,
 * then divide out to normalize lighting.
 */
const removeShadows = async (
  sharp: (...args: Parameters<typeof import("sharp")>) => ReturnType<typeof import("sharp")>,
  buffer: Buffer,
  channels: number,
  blurSigma: number = 51
): Promise<{ data: Buffer; width: number; height: number }> => {
  const [{ data: px, info }, { data: bg }] = await Promise.all([
    sharp(buffer).raw().toBuffer({ resolveWithObject: true }),
    sharp(buffer)
      .greyscale()
      .blur(blurSigma)
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  const total = info.width * info.height;
  const ch = info.channels;
  const out = Buffer.alloc(px.length);

  for (let p = 0; p < total; p++) {
    const gain = Math.min(255 / (bg[p] || 1), 3.0);
    for (let c = 0; c < ch; c++) {
      const idx = p * ch + c;
      out[idx] = Math.min(255, Math.max(0, Math.round(px[idx] * gain)));
    }
  }

  return { data: out, width: info.width, height: info.height };
};

/**
 * Document whitening curve: push near-white pixels to pure white.
 * Adaptive gamma that whitens paper background while preserving ink.
 */
const applyWhiteningCurve = (pixels: Buffer, aggressive = false): Buffer => {
  const threshold = aggressive ? 180 : 200;
  const result = Buffer.alloc(pixels.length);

  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (v > threshold) {
      // Push toward 255 with gamma curve
      const t = (v - threshold) / (255 - threshold);
      const gamma = aggressive ? 0.3 : 0.5;
      result[i] = Math.round(threshold + (255 - threshold) * Math.pow(t, gamma));
    } else {
      result[i] = v;
    }
  }

  return result;
};

/**
 * POST /api/digitalize
 *
 * Professional document enhancement pipeline.
 * Receives images with optional corner data, applies perspective correction
 * and scanner-grade enhancement filters.
 */
export async function POST(req: NextRequest) {
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;

    const formData = await req.formData();
    const filter = (formData.get("filter") as string) || "auto";
    const files = formData.getAll("images") as File[];
    const cornersRaw = formData.get("corners") as string | null;

    // Parse corners array — one entry per image, null = needs server detection
    let cornersArray: (CornersData | null)[] = [];
    if (cornersRaw) {
      try {
        cornersArray = JSON.parse(cornersRaw);
      } catch {
        cornersArray = [];
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    const MAX_DIM = 2500;
    const processedImages: {
      base64: string;
      width: number;
      height: number;
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuf = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuf);

      // Step 1: Resize + auto-rotate
      let workBuffer = await sharp(inputBuffer)
        .rotate()
        .resize(MAX_DIM, MAX_DIM, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 95 })
        .toBuffer();

      // Step 2: Perspective correction
      const imageCorners = cornersArray[i] || null;
      const meta = await sharp(workBuffer).metadata();
      const imgW = meta.width!;
      const imgH = meta.height!;

      if (imageCorners) {
        // Apply perspective warp using provided corners
        const srcCorners: Point[] = [
          imageCorners.topLeft,
          imageCorners.topRight,
          imageCorners.bottomRight,
          imageCorners.bottomLeft,
        ];
        const { width: outW, height: outH } =
          calculateOutputDimensions(srcCorners);

        if (outW > 100 && outH > 100) {
          const { data: rawPixels, info: rawInfo } = await sharp(workBuffer)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

          const warped = perspectiveWarp(
            rawPixels,
            rawInfo.width,
            rawInfo.height,
            srcCorners,
            outW,
            outH,
            rawInfo.channels
          );

          workBuffer = await sharp(warped, {
            raw: { width: outW, height: outH, channels: rawInfo.channels },
          })
            .jpeg({ quality: 95 })
            .toBuffer();
        }
      } else {
        // Try Gemini fallback for corner detection
        const base64 = inputBuffer.toString("base64");
        const mimeType = file.type || "image/jpeg";
        const detected = await detectCornersWithGemini(
          base64,
          mimeType,
          imgW,
          imgH
        );

        if (detected) {
          const srcCorners: Point[] = [
            detected.topLeft,
            detected.topRight,
            detected.bottomRight,
            detected.bottomLeft,
          ];
          const { width: outW, height: outH } =
            calculateOutputDimensions(srcCorners);

          if (outW > 100 && outH > 100) {
            const { data: rawPixels, info: rawInfo } = await sharp(workBuffer)
              .removeAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });

            const warped = perspectiveWarp(
              rawPixels,
              rawInfo.width,
              rawInfo.height,
              srcCorners,
              outW,
              outH,
              rawInfo.channels
            );

            workBuffer = await sharp(warped, {
              raw: { width: outW, height: outH, channels: rawInfo.channels },
            })
              .jpeg({ quality: 95 })
              .toBuffer();
          }
        }
      }

      // Step 3: Apply enhancement filter
      let finalBuffer: Buffer;

      switch (filter) {
        case "auto": {
          // CamScanner-like: shadow removal + whitening + text boosting
          const shadow = await removeShadows(sharp, workBuffer, 3, 41);

          const whitened = applyWhiteningCurve(shadow.data);

          const wMeta = await sharp(workBuffer).metadata();
          const wW = shadow.width || wMeta.width!;
          const wH = shadow.height || wMeta.height!;
          const wCh = wMeta.channels || 3;

          finalBuffer = await sharp(whitened, {
            raw: { width: wW, height: wH, channels: wCh },
          })
            .sharpen({ sigma: 1.5, m1: 1.5, m2: 0.7 })
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "document": {
          // Clean B&W: aggressive shadow removal + threshold
          const grayBuf = await sharp(workBuffer).greyscale().toBuffer();
          const shadow = await removeShadows(sharp, grayBuf, 1, 51);
          const whitened = applyWhiteningCurve(shadow.data, true);

          finalBuffer = await sharp(whitened, {
            raw: { width: shadow.width, height: shadow.height, channels: 1 },
          })
            .threshold(210)
            .sharpen(0.5)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "grayscale": {
          // Grayscale with shadow removal + contrast normalization
          const grayBuf = await sharp(workBuffer).greyscale().toBuffer();
          const shadow = await removeShadows(sharp, grayBuf, 1, 41);

          finalBuffer = await sharp(shadow.data, {
            raw: { width: shadow.width, height: shadow.height, channels: 1 },
          })
            .normalize()
            .sharpen({ sigma: 1.5, m1: 1.5, m2: 0.7 })
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "enhanced": {
          // Vivid color: light shadow removal + saturation boost
          const shadow = await removeShadows(sharp, workBuffer, 3, 41);
          const wMeta2 = await sharp(workBuffer).metadata();
          const eW = shadow.width || wMeta2.width!;
          const eH = shadow.height || wMeta2.height!;
          const eCh = wMeta2.channels || 3;

          finalBuffer = await sharp(shadow.data, {
            raw: { width: eW, height: eH, channels: eCh },
          })
            .modulate({ saturation: 1.2 })
            .sharpen({ sigma: 1.5, m1: 2.0, m2: 0.7 })
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "original":
        default:
          finalBuffer = await sharp(workBuffer)
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
