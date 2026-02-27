import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Dynamic import to avoid bundling issues with native module
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

    const MAX_DIMENSION = 2400; // Cap camera photos to reasonable size
    const processedImages: {
      base64: string;
      width: number;
      height: number;
    }[] = [];

    for (const file of files) {
      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // Get metadata from a fresh instance
      const metadata = await sharp(buffer).metadata();
      const origW = metadata.width || 800;
      const origH = metadata.height || 1200;

      // Resize if larger than MAX_DIMENSION (common with camera photos)
      const needsResize =
        origW > MAX_DIMENSION || origH > MAX_DIMENSION;

      // Start fresh pipeline for processing
      let pipeline = sharp(buffer).rotate(); // auto-rotate based on EXIF

      if (needsResize) {
        pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      switch (filter) {
        case "document":
          pipeline = pipeline
            .greyscale()
            .normalize()
            .sharpen(1.5)
            .threshold(140);
          break;

        case "grayscale":
          pipeline = pipeline
            .greyscale()
            .normalize()
            .sharpen(1.0)
            .gamma(1.2);
          break;

        case "enhanced":
          pipeline = pipeline
            .normalize()
            .sharpen(1.5)
            .modulate({ brightness: 1.05, saturation: 1.1 });
          break;

        case "auto":
          pipeline = pipeline
            .normalize()
            .sharpen(1.2)
            .gamma(1.1);
          break;

        case "original":
        default:
          // Just rotate + resize, no filters
          break;
      }

      const processed = await pipeline
        .jpeg({ quality: 85 })
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
    const message =
      err instanceof Error ? err.message : "Unknown error";
    console.error("Digitalize route error:", message, err);
    return NextResponse.json(
      { error: `Image processing failed: ${message}` },
      { status: 500 }
    );
  }
}
