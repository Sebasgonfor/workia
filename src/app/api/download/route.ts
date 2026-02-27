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

function getMimeFromFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext ? MIME_TYPES[ext] ?? null : null;
}

/**
 * Signs a Cloudinary URL for strict-mode accounts that require signed delivery URLs.
 * Inserts s--{signature}-- after the delivery type in the path.
 * Signature = first 8 chars of SHA-1("/{versionAndPublicId}" + apiSecret).
 */
async function signCloudinaryUrl(originalUrl: string, apiSecret: string): Promise<string> {
  try {
    const urlObj = new URL(originalUrl);
    // Pathname: /{cloudName}/{resourceType}/{deliveryType}/{...versionAndPublicId}
    const pathParts = urlObj.pathname.split("/");
    // pathParts[0] = ''
    // pathParts[1] = cloudName
    // pathParts[2] = resourceType (raw, image, video)
    // pathParts[3] = deliveryType (upload, authenticated)
    // pathParts[4..] = optional version + public_id
    if (pathParts.length < 5) return originalUrl;

    const restParts = pathParts.slice(4); // everything after deliveryType
    const toSignPath = "/" + restParts.join("/");
    const toSign = toSignPath + apiSecret;

    const encoder = new TextEncoder();
    const msgBuffer = encoder.encode(toSign);
    const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const signature = hexHash.substring(0, 8);

    // Insert s--{signature}-- after the deliveryType segment
    const signedParts = [
      ...pathParts.slice(0, 4),
      `s--${signature}--`,
      ...restParts,
    ];
    urlObj.pathname = signedParts.join("/");
    return urlObj.toString();
  } catch {
    return originalUrl;
  }
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

  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  try {
    // Always attempt with a signed URL first (required for accounts with strict CDN access control)
    const fetchUrl =
      apiSecret ? await signCloudinaryUrl(url, apiSecret) : url;

    let response = await fetch(fetchUrl);

    // If signed URL also fails, fall back to the original unsigned URL
    if (!response.ok && fetchUrl !== url) {
      response = await fetch(url);
    }

    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "Download failed" }, { status: response.status });
    }

    // Cloudinary raw uploads return application/octet-stream - detect real type
    let contentType =
      response.headers.get("content-type") || "application/octet-stream";
    if (contentType === "application/octet-stream") {
      contentType = getMimeFromFilename(filename) || contentType;
    }

    const disposition = mode === "inline" ? "inline" : "attachment";
    const asciiName = filename.replace(/[^\x20-\x7E]/g, "_");
    const encodedName = encodeURIComponent(filename).replace(/'/g, "%27");

    // Stream the response body directly instead of buffering the whole file
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Download proxy error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
