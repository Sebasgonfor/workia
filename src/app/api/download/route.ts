import { NextRequest, NextResponse } from "next/server";
import { signCloudinaryUrl } from "@/app/api/_utils/cloudinary";

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

function getMimeFromFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? MIME_TYPES[ext] ?? null : null;
}

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
    // Sign the URL so Cloudinary accepts the request (required for raw resources)
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const fetchUrl = apiSecret ? await signCloudinaryUrl(url, apiSecret) : url;

    const response = await fetch(fetchUrl);
    if (!response.ok || !response.body) {
      return NextResponse.json(
        { error: "Download failed" },
        { status: response.status },
      );
    }

    // Cloudinary raw uploads return application/octet-stream — detect real type
    let contentType =
      response.headers.get("content-type") || "application/octet-stream";
    if (contentType === "application/octet-stream") {
      contentType = getMimeFromFilename(filename) || contentType;
    }

    const disposition = mode === "inline" ? "inline" : "attachment";
    const asciiName = filename.replace(/[^\x20-\x7E]/g, "_");
    const encodedName = encodeURIComponent(filename).replace(/'/g, "%27");

    // Stream the response body directly
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Download proxy error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
