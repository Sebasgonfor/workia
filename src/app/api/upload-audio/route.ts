import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Cloudinary signature must NOT include resource_type (it is a delivery param, not an upload param)
    const paramsToSign = folder
      ? `folder=${folder}&timestamp=${timestamp}`
      : `timestamp=${timestamp}`;

    const encoder = new TextEncoder();
    const signatureString = paramsToSign + apiSecret;
    const msgBuffer = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadData.append("api_key", apiKey);
    uploadData.append("timestamp", timestamp);
    uploadData.append("signature", signature);
    uploadData.append("resource_type", "video");
    if (folder) uploadData.append("folder", folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      { method: "POST", body: uploadData }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Cloudinary audio upload error:", data);
      return NextResponse.json(
        { error: data.error?.message || "Audio upload failed" },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      duration: data.duration ?? null,
    });
  } catch (err) {
    console.error("Upload audio route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
