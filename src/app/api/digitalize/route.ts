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

const CORNER_DETECTION_PROMPT = `You are a precision document edge detector. Find the exact 4 corners of the paper/document/notebook page in this image.

IMAGE DIMENSIONS: {width} x {height} pixels.

Return ONLY this JSON with PIXEL coordinates:
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
- Coordinates are PIXELS. (0,0) = top-left of image. Max = ({width},{height}).
- Find the OUTERMOST PHYSICAL EDGES of the paper where it meets the background surface.
- IMPORTANT: Place corners SLIGHTLY OUTSIDE the paper edge (a few pixels beyond) rather than inside. It is much better to include a tiny bit of background than to cut off any page content.
- For spiral notebooks: go BEYOND the spiral holes to the very outer edge of the page.
- topLeft = paper corner nearest image top-left. topRight = nearest top-right. Etc.
- All coordinates must be within image bounds (0 to {width} for x, 0 to {height} for y).
- If no clear paper/document is visible: {"found": false}
- Return ONLY valid JSON.`;

function quadArea(pts: Point[]): number {
  const [a, b, c, d] = pts;
  return 0.5 * Math.abs(
    (a.x * b.y - b.x * a.y) +
    (b.x * c.y - c.x * b.y) +
    (c.x * d.y - d.x * c.y) +
    (d.x * a.y - a.x * d.y)
  );
}

function expandCorners(
  corners: Point[],
  width: number,
  height: number,
  factor: number = 1.05
): Point[] {
  const cx = corners.reduce((s, c) => s + c.x, 0) / 4;
  const cy = corners.reduce((s, c) => s + c.y, 0) / 4;
  return corners.map((c) => ({
    x: Math.min(width, Math.max(0, Math.round(cx + (c.x - cx) * factor))),
    y: Math.min(height, Math.max(0, Math.round(cy + (c.y - cy) * factor))),
  }));
}

function isConvex(pts: Point[]): boolean {
  const n = pts.length;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const c = pts[(i + 2) % n];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 1) {
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return sign !== 0;
}

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
      .replace(/{width}/g, String(width))
      .replace(/{height}/g, String(height));

    const result = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
      { text: prompt },
    ]);

    const text = result.response.text();
    const parsed = JSON.parse(text);

    if (!parsed.found || !parsed.corners) return null;

    const { topLeft, topRight, bottomRight, bottomLeft } = parsed.corners;
    const corners: Point[] = [topLeft, topRight, bottomRight, bottomLeft];

    for (const c of corners) {
      if (
        typeof c.x !== "number" || typeof c.y !== "number" ||
        c.x < 0 || c.y < 0 || c.x > width || c.y > height
      ) {
        return null;
      }
    }

    if (quadArea(corners) < width * height * 0.15) return null;
    if (!isConvex(corners)) return null;

    // Expand corners 5% outward from centroid to avoid cutting off page edges
    return expandCorners(corners, width, height, 1.05);
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
      // All modes (except original) use BACKGROUND SUBTRACTION:
      // 1. Estimate background via heavy Gaussian blur
      // 2. Divide each pixel by its local background → normalizes uneven lighting
      // 3. Paper becomes ~255 (white), text becomes dark, shadows are eliminated
      // This is the core technique used by CamScanner and similar apps.
      let finalBuffer: Buffer;

      switch (filter) {
        case "document": {
          // Clean B&W scan: background subtraction + threshold
          // Result: pure white paper, crisp black text, no shadows, no notebook lines
          const grayBuf = await sharp(documentBuffer).greyscale().toBuffer();

          const [{ data: px, info: gi }, { data: bg }] = await Promise.all([
            sharp(grayBuf).raw().toBuffer({ resolveWithObject: true }),
            sharp(grayBuf).blur(50).raw().toBuffer({ resolveWithObject: true }),
          ]);

          const w = gi.width;
          const h = gi.height;
          const norm = Buffer.alloc(px.length);

          for (let i = 0; i < px.length; i++) {
            const b = bg[i] || 1;
            // Division normalizes lighting: paper/bg ≈ 1.0 → 255, text/bg ≈ 0.25 → 64
            norm[i] = Math.min(255, Math.max(0, Math.round((px[i] / b) * 255)));
          }

          finalBuffer = await sharp(norm, { raw: { width: w, height: h, channels: 1 } })
            .threshold(210)
            .sharpen(0.5)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "grayscale": {
          // Clean grayscale: background subtraction without threshold
          const grayBuf = await sharp(documentBuffer).greyscale().toBuffer();

          const [{ data: px, info: gi }, { data: bg }] = await Promise.all([
            sharp(grayBuf).raw().toBuffer({ resolveWithObject: true }),
            sharp(grayBuf).blur(40).raw().toBuffer({ resolveWithObject: true }),
          ]);

          const w = gi.width;
          const h = gi.height;
          const norm = Buffer.alloc(px.length);

          for (let i = 0; i < px.length; i++) {
            const b = bg[i] || 1;
            norm[i] = Math.min(255, Math.max(0, Math.round((px[i] / b) * 240)));
          }

          finalBuffer = await sharp(norm, { raw: { width: w, height: h, channels: 1 } })
            .normalize()
            .sharpen(1)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "enhanced": {
          // Vivid color: gain-map background normalization + saturation boost
          const [{ data: colorPx, info: ci }, { data: bgPx }] = await Promise.all([
            sharp(documentBuffer).raw().toBuffer({ resolveWithObject: true }),
            sharp(documentBuffer).greyscale().blur(40).raw().toBuffer({ resolveWithObject: true }),
          ]);

          const ch = ci.channels;
          const total = ci.width * ci.height;
          const out = Buffer.alloc(colorPx.length);

          for (let p = 0; p < total; p++) {
            const gain = Math.min(240 / (bgPx[p] || 1), 2.5);
            for (let c = 0; c < ch; c++) {
              const idx = p * ch + c;
              out[idx] = Math.min(255, Math.round(colorPx[idx] * gain));
            }
          }

          finalBuffer = await sharp(out, {
            raw: { width: ci.width, height: ci.height, channels: ch },
          })
            .sharpen(1.5)
            .modulate({ saturation: 1.2 })
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "auto": {
          // Clean natural scan: color gain-map normalization
          const [{ data: colorPx, info: ci }, { data: bgPx }] = await Promise.all([
            sharp(documentBuffer).raw().toBuffer({ resolveWithObject: true }),
            sharp(documentBuffer).greyscale().blur(40).raw().toBuffer({ resolveWithObject: true }),
          ]);

          const ch = ci.channels;
          const total = ci.width * ci.height;
          const out = Buffer.alloc(colorPx.length);

          for (let p = 0; p < total; p++) {
            const gain = Math.min(230 / (bgPx[p] || 1), 2.5);
            for (let c = 0; c < ch; c++) {
              const idx = p * ch + c;
              out[idx] = Math.min(255, Math.round(colorPx[idx] * gain));
            }
          }

          finalBuffer = await sharp(out, {
            raw: { width: ci.width, height: ci.height, channels: ch },
          })
            .sharpen(1.2)
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
