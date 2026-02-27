import { NextRequest, NextResponse } from "next/server";
import { signCloudinaryUrl } from "@/app/api/_utils/cloudinary";

/**
 * Returns a signed Cloudinary URL that the client can use directly
 * (in <img>, <iframe>, window.open, fetch, etc.).
 *
 * GET /api/file-url?url=<cloudinary_url>
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Only sign Cloudinary URLs
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("cloudinary.com")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiSecret) {
    // If no secret configured, return original URL (unsigned)
    return NextResponse.json({ url }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const signedUrl = await signCloudinaryUrl(url, apiSecret);
    return NextResponse.json({ url: signedUrl }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to sign URL" }, { status: 500 });
  }
}
