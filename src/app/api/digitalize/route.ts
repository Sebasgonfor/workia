import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const filter = (formData.get("filter") as string) || "auto";
    const files = formData.getAll("images") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    const processedImages: { base64: string; width: number; height: number }[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      let pipeline = sharp(buffer);

      const metadata = await pipeline.metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 1200;

      switch (filter) {
        case "document":
          pipeline = sharp(buffer)
            .greyscale()
            .normalize()
            .sharpen({ sigma: 1.5 })
            .threshold(140);
          break;

        case "grayscale":
          pipeline = sharp(buffer)
            .greyscale()
            .normalize()
            .sharpen({ sigma: 1.0 })
            .gamma(1.2);
          break;

        case "enhanced":
          pipeline = sharp(buffer)
            .normalize()
            .sharpen({ sigma: 1.5 })
            .modulate({ brightness: 1.05, saturation: 1.1 });
          break;

        case "auto":
          pipeline = sharp(buffer)
            .normalize()
            .sharpen({ sigma: 1.2 })
            .gamma(1.1);
          break;

        case "original":
        default:
          pipeline = sharp(buffer);
          break;
      }

      const processed = await pipeline
        .jpeg({ quality: 90 })
        .toBuffer();

      const base64 = `data:image/jpeg;base64,${processed.toString("base64")}`;
      processedImages.push({ base64, width, height });
    }

    return NextResponse.json({ images: processedImages });
  } catch (err) {
    console.error("Digitalize route error:", err);
    return NextResponse.json(
      { error: "Image processing failed" },
      { status: 500 }
    );
  }
}
