import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/digitalize
 *
 * Receives pre-processed images (already perspective-corrected by OpenCV.js on the client)
 * and applies enhancement filters using Sharp's background subtraction technique.
 *
 * Images arrive as FormData with:
 * - "images": one or more image files
 * - "filter": "auto" | "document" | "grayscale" | "enhanced" | "original"
 */
export async function POST(req: NextRequest) {
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default;

    const formData = await req.formData();
    const filter = (formData.get("filter") as string) || "auto";
    const files = formData.getAll("images") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    const MAX_DIM = 2000;
    const processedImages: { base64: string; width: number; height: number }[] =
      [];

    for (const file of files) {
      const arrayBuf = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuf);

      // Resize + auto-rotate (images are already perspective-corrected by client)
      const prepBuffer = await sharp(inputBuffer)
        .rotate()
        .resize(MAX_DIM, MAX_DIM, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 95 })
        .toBuffer();

      // Apply enhancement filter
      // All modes (except original) use BACKGROUND SUBTRACTION:
      // 1. Estimate background via heavy Gaussian blur
      // 2. Divide each pixel by its local background → normalizes uneven lighting
      // 3. Paper becomes ~255 (white), text becomes dark, shadows are eliminated
      let finalBuffer: Buffer;

      switch (filter) {
        case "document": {
          // Clean B&W scan: background subtraction + threshold
          const grayBuf = await sharp(prepBuffer).greyscale().toBuffer();

          const [{ data: px, info: gi }, { data: bg }] = await Promise.all([
            sharp(grayBuf).raw().toBuffer({ resolveWithObject: true }),
            sharp(grayBuf).blur(50).raw().toBuffer({ resolveWithObject: true }),
          ]);

          const w = gi.width;
          const h = gi.height;
          const norm = Buffer.alloc(px.length);

          for (let i = 0; i < px.length; i++) {
            const b = bg[i] || 1;
            norm[i] = Math.min(
              255,
              Math.max(0, Math.round((px[i] / b) * 255))
            );
          }

          finalBuffer = await sharp(norm, {
            raw: { width: w, height: h, channels: 1 },
          })
            .threshold(210)
            .sharpen(0.5)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "grayscale": {
          // Clean grayscale: background subtraction without threshold
          const grayBuf = await sharp(prepBuffer).greyscale().toBuffer();

          const [{ data: px, info: gi }, { data: bg }] = await Promise.all([
            sharp(grayBuf).raw().toBuffer({ resolveWithObject: true }),
            sharp(grayBuf).blur(40).raw().toBuffer({ resolveWithObject: true }),
          ]);

          const w = gi.width;
          const h = gi.height;
          const norm = Buffer.alloc(px.length);

          for (let i = 0; i < px.length; i++) {
            const b = bg[i] || 1;
            norm[i] = Math.min(
              255,
              Math.max(0, Math.round((px[i] / b) * 240))
            );
          }

          finalBuffer = await sharp(norm, {
            raw: { width: w, height: h, channels: 1 },
          })
            .normalize()
            .sharpen(1)
            .jpeg({ quality: 88 })
            .toBuffer();
          break;
        }

        case "enhanced": {
          // Vivid color: gain-map background normalization + saturation
          const [{ data: colorPx, info: ci }, { data: bgPx }] =
            await Promise.all([
              sharp(prepBuffer).raw().toBuffer({ resolveWithObject: true }),
              sharp(prepBuffer)
                .greyscale()
                .blur(40)
                .raw()
                .toBuffer({ resolveWithObject: true }),
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
          const [{ data: colorPx, info: ci }, { data: bgPx }] =
            await Promise.all([
              sharp(prepBuffer).raw().toBuffer({ resolveWithObject: true }),
              sharp(prepBuffer)
                .greyscale()
                .blur(40)
                .raw()
                .toBuffer({ resolveWithObject: true }),
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
          finalBuffer = await sharp(prepBuffer)
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
