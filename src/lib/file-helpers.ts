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
 * Fetch a file as a Blob with cascading strategies:
 *   1. Direct fetch from Cloudinary (CORS)
 *   2. Server-side proxy (/api/download)
 * Returns a Blob with the correct MIME type.
 */
export async function fetchFileBlob(
  url: string,
  filename: string,
  mimeOverride?: string,
): Promise<Blob> {
  const mime = mimeOverride || resolveMime(filename);

  // Strategy 1: Direct fetch from Cloudinary (uses CORS)
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      return new Blob([buf], { type: mime });
    }
  } catch {
    // CORS blocked or network error — fall through to proxy
  }

  // Strategy 2: Server-side proxy
  const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
  const res = await fetch(proxyUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Proxy download failed: ${res.status}`);
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
 *   2. window.open (browser handles it, no filename control)
 */
export async function downloadFile(url: string, filename: string, fileType?: string): Promise<void> {
  try {
    const blob = await fetchFileBlob(url, filename, fileType);
    triggerBlobDownload(blob, filename);
  } catch {
    // Ultimate fallback: open the Cloudinary URL directly in a new tab
    window.open(url, "_blank");
  }
}
