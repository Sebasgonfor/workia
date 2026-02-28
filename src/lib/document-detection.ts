/**
 * Document detection using Scanic WASM (~100KB).
 * Replaces the previous pure-JS pipeline (Canny + contour finding).
 *
 * Scanic handles: edge detection + perspective correction via WASM.
 * This module wraps Scanic and provides the public API used by
 * camera-scanner.tsx and digitalizar/page.tsx.
 */

import { detectCorners, type CornerPoints } from "@/lib/scanic-loader";

export interface Point {
  x: number;
  y: number;
}

export interface DocumentCorners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/**
 * Convert Scanic CornerPoints to a plain DocumentCorners object.
 */
const toDocumentCorners = (corners: CornerPoints): DocumentCorners => ({
  topLeft: { x: corners.topLeft.x, y: corners.topLeft.y },
  topRight: { x: corners.topRight.x, y: corners.topRight.y },
  bottomRight: { x: corners.bottomRight.x, y: corners.bottomRight.y },
  bottomLeft: { x: corners.bottomLeft.x, y: corners.bottomLeft.y },
});

/**
 * Detect document corners in an image using Scanic WASM.
 * Returns DocumentCorners or null if no document found.
 */
export const detectDocument = async (
  image: HTMLImageElement | HTMLCanvasElement
): Promise<DocumentCorners | null> => {
  const corners = await detectCorners(image);
  if (!corners) return null;
  return toDocumentCorners(corners);
};

/**
 * Convert an image source to a canvas at a given max dimension.
 */
export const imageToCanvas = (
  source: HTMLImageElement | HTMLCanvasElement,
  maxDim = 2000
): HTMLCanvasElement => {
  let w: number;
  let h: number;

  if (source instanceof HTMLImageElement) {
    w = source.naturalWidth || source.width;
    h = source.naturalHeight || source.height;
  } else {
    w = source.width;
    h = source.height;
  }

  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
};

/**
 * Capture a canvas frame as a Blob + preview.
 */
export const canvasToResult = async (
  canvas: HTMLCanvasElement
): Promise<{ blob: Blob; preview: string; width: number; height: number }> => {
  const preview = canvas.toDataURL("image/jpeg", 0.92);
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
  );
  return { blob, preview, width: canvas.width, height: canvas.height };
};
