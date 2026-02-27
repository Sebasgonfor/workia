import { NextRequest, NextResponse } from "next/server";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const filename = req.nextUrl.searchParams.get("filename") || "document";
  const mode = req.nextUrl.searchParams.get("mode"); // "inline" for preview

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Only allow downloads from Cloudinary
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("cloudinary.com")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json({ error: "Download failed" }, { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();

    // Cloudinary raw uploads often return application/octet-stream.
    // Detect proper MIME type from the filename extension.
    let contentType =
      response.headers.get("content-type") || "application/octet-stream";

    if (contentType === "application/octet-stream") {
      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext && MIME_TYPES[ext]) {
        contentType = MIME_TYPES[ext];
      }
    }

    const disposition = mode === "inline" ? "inline" : "attachment";
    const asciiName = filename.replace(/[^\x20-\x7E]/g, "_");
    const encodedName = encodeURIComponent(filename).replace(/'/g, "%27");

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": arrayBuffer.byteLength.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
