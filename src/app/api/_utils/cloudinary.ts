/**
 * Generate a signed Cloudinary delivery URL.
 *
 * Cloudinary accounts with restricted/authenticated access return 401 for
 * unsigned raw resource URLs.  This function adds a short SHA-1 signature
 * (the `s--XXXXXXXX--` path segment) so the CDN accepts the request.
 *
 * Algorithm (matches Cloudinary's default SHA-1 / 8-char mode):
 *   1. Extract the path portion after `/upload/`
 *   2. SHA-1( path + apiSecret )
 *   3. base64-url encode → take first 8 characters
 *   4. Insert `s--{sig}--/` right after `/upload/`
 */
export async function signCloudinaryUrl(
  url: string,
  apiSecret: string,
): Promise<string> {
  const parsed = new URL(url);
  const pathname = parsed.pathname;

  const uploadIdx = pathname.indexOf("/upload/");
  if (uploadIdx === -1) return url; // Not a standard upload URL

  // Already signed — don't double-sign
  if (/\/s--[A-Za-z0-9_-]{8}--\//.test(pathname)) return url;

  // Full path after /upload/ — kept intact for building the signed URL (version must stay)
  const pathAfterUpload = pathname.substring(uploadIdx + "/upload/".length);

  // Cloudinary signs only the public_id, without the version prefix (e.g. "v1234567890/")
  const signInput = pathAfterUpload.replace(/^v\d+\//, "");

  const encoder = new TextEncoder();
  const data = encoder.encode(signInput + apiSecret);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);

  // Convert to base64url
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const binary = hashArray.map((b) => String.fromCharCode(b)).join("");
  const base64 = btoa(binary);
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_");
  const signature = base64url.substring(0, 8);

  // Insert s--{signature}-- right after /upload/, keeping the version and public_id intact
  const prefix = pathname.substring(0, uploadIdx + "/upload/".length);
  const signedPath = `${prefix}s--${signature}--/${pathAfterUpload}`;

  return `${parsed.origin}${signedPath}${parsed.search}`;
}
