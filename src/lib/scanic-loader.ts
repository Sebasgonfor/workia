/**
 * Client-side document corner detection.
 * Calls the /api/digitalize/detect endpoint (Gemini AI) to locate
 * the 4 corners of a document in an image.
 */

export interface CornerPoints {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

/**
 * Detect document corners by sending the image to the Gemini AI detect endpoint.
 * Returns corner coordinates in the original image pixel space, or null if
 * no document is found.
 */
export const detectCorners = async (
  canvas: HTMLCanvasElement
): Promise<CornerPoints | null> => {
  try {
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
    );

    const fd = new FormData();
    fd.append("image", blob, "detect.jpg");
    fd.append("width", String(canvas.width));
    fd.append("height", String(canvas.height));

    const res = await fetch("/api/digitalize/detect", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.corners ?? null;
  } catch (err) {
    console.error("Corner detection failed:", err);
    return null;
  }
};
