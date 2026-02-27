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
};

/**
 * Resolve the best MIME type for a file, using extension as fallback.
 */
export function resolveMime(filename: string, storedType?: string): string {
  if (storedType && storedType !== "application/octet-stream") return storedType;
  const ext = filename.split(".").pop()?.toLowerCase();
  return (ext && MIME_TYPES[ext]) || "application/octet-stream";
}

/**
 * Request a signed Cloudinary URL from our server.
 * Cloudinary accounts with restricted access require signed URLs.
 */
export async function getSignedUrl(url: string): Promise<string> {
  const res = await fetch(
    `/api/file-url?url=${encodeURIComponent(url)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("Failed to get signed URL");
  const data = await res.json();
  return data.url;
}

/**
 * Fetch a file as a Blob with cascading strategies:
 *   1. Get signed URL → direct fetch from Cloudinary (CORS)
 *   2. Server-side proxy (/api/download, signs internally)
 * Returns a Blob with the correct MIME type.
 */
export async function fetchFileBlob(
  url: string,
  filename: string,
  mimeOverride?: string,
): Promise<Blob> {
  const mime = mimeOverride || resolveMime(filename);

  // Strategy 1: Get signed URL and fetch directly from Cloudinary
  try {
    const signedUrl = await getSignedUrl(url);
    const res = await fetch(signedUrl, { cache: "no-store" });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      return new Blob([buf], { type: mime });
    }
  } catch {
    // Direct fetch failed — fall through to proxy
  }

  // Strategy 2: Server-side proxy (signs the URL internally)
  const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
  const res = await fetch(proxyUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`All fetch strategies failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Blob([buf], { type: mime });
}

/**
 * Trigger a browser file download from a Blob.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Small delay before revoking to ensure the download starts
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Download a file with cascading fallbacks:
 *   1. fetchFileBlob → triggerBlobDownload (controlled filename)
 *   2. Signed URL in new tab (browser handles it)
 *   3. Original URL in new tab (last resort)
 */
export async function downloadFile(
  url: string,
  filename: string,
  fileType?: string,
): Promise<void> {
  try {
    const blob = await fetchFileBlob(url, filename, fileType);
    triggerBlobDownload(blob, filename);
  } catch {
    // Fallback: open signed URL in new tab
    try {
      const signedUrl = await getSignedUrl(url);
      window.open(signedUrl, "_blank");
    } catch {
      // Last resort: original URL
      window.open(url, "_blank");
    }
  }
}
