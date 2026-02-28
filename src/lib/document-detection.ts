/**
 * Document detection & perspective correction using OpenCV.js.
 *
 * Pipeline: grayscale → blur → Canny → dilate → findContours → largest quad → warpPerspective
 * This is the same approach used by CamScanner, Microsoft Lens, etc.
 */

export interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Order 4 corners as [topLeft, topRight, bottomRight, bottomLeft].
 * Uses sum (x+y) for TL/BR and difference (x-y) for TR/BL.
 */
export function orderCorners(corners: Point[]): [Point, Point, Point, Point] {
  const sums = corners.map((p) => p.x + p.y);
  const diffs = corners.map((p) => p.x - p.y);

  const minSumIdx = sums.indexOf(Math.min(...sums));
  const maxSumIdx = sums.indexOf(Math.max(...sums));
  const maxDiffIdx = diffs.indexOf(Math.max(...diffs));
  const minDiffIdx = diffs.indexOf(Math.min(...diffs));

  return [
    corners[minSumIdx], // Top-left (smallest x+y)
    corners[maxDiffIdx], // Top-right (largest x-y)
    corners[maxSumIdx], // Bottom-right (largest x+y)
    corners[minDiffIdx], // Bottom-left (smallest x-y)
  ];
}

/**
 * Detect the largest quadrilateral document in an image using Canny + contours.
 * Returns 4 corners or null if no document found.
 */
export function detectDocument(
  cv: any,
  src: any
): Point[] | null {
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const dilated = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Gaussian blur to reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    // 3. Canny edge detection
    cv.Canny(blurred, edges, 50, 150, 3, false);

    // 4. Dilate to close small gaps in edges
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edges, dilated, kernel, new cv.Point(-1, -1), 2);
    kernel.delete();

    // 5. Find contours
    cv.findContours(
      dilated,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    // 6. Find the largest 4-sided convex contour
    const imgArea = src.rows * src.cols;
    let maxArea = 0;
    let bestCorners: Point[] | null = null;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Must be at least 10% of image area
      if (area < imgArea * 0.1) continue;

      // Approximate contour to polygon
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      if (approx.rows === 4 && area > maxArea && cv.isContourConvex(approx)) {
        maxArea = area;
        bestCorners = [];
        for (let j = 0; j < 4; j++) {
          bestCorners.push({
            x: approx.data32S[j * 2],
            y: approx.data32S[j * 2 + 1],
          });
        }
      }

      approx.delete();
    }

    return bestCorners;
  } finally {
    gray.delete();
    blurred.delete();
    edges.delete();
    dilated.delete();
    contours.delete();
    hierarchy.delete();
  }
}

/**
 * Apply perspective correction to extract the document as a flat rectangle.
 * Returns the corrected cv.Mat (caller must delete it).
 */
export function correctPerspective(
  cv: any,
  src: any,
  corners: Point[]
): { mat: any; width: number; height: number } {
  const ordered = orderCorners(corners);

  // Calculate output dimensions from corner distances
  const widthTop = distance(ordered[0], ordered[1]);
  const widthBottom = distance(ordered[3], ordered[2]);
  const heightLeft = distance(ordered[0], ordered[3]);
  const heightRight = distance(ordered[1], ordered[2]);

  const maxWidth = Math.round(Math.max(widthTop, widthBottom));
  const maxHeight = Math.round(Math.max(heightLeft, heightRight));

  // Source corners (detected document corners)
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    ordered[0].x, ordered[0].y,
    ordered[1].x, ordered[1].y,
    ordered[2].x, ordered[2].y,
    ordered[3].x, ordered[3].y,
  ]);

  // Destination corners (perfect rectangle)
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    maxWidth - 1, 0,
    maxWidth - 1, maxHeight - 1,
    0, maxHeight - 1,
  ]);

  const M = cv.getPerspectiveTransform(srcPoints, dstPoints);
  const dst = new cv.Mat();
  const dSize = new cv.Size(maxWidth, maxHeight);

  cv.warpPerspective(
    src,
    dst,
    M,
    dSize,
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar(255, 255, 255, 255)
  );

  srcPoints.delete();
  dstPoints.delete();
  M.delete();

  return { mat: dst, width: maxWidth, height: maxHeight };
}

/**
 * Check if two sets of corners are approximately the same position (stable).
 */
export function areCornersStable(
  a: Point[],
  b: Point[],
  threshold: number = 15
): boolean {
  if (!a || !b || a.length !== 4 || b.length !== 4) return false;

  const orderedA = orderCorners(a);
  const orderedB = orderCorners(b);

  for (let i = 0; i < 4; i++) {
    if (distance(orderedA[i], orderedB[i]) > threshold) return false;
  }
  return true;
}

/**
 * Convert a cv.Mat to a JPEG base64 data URL via a temporary canvas.
 */
export function matToBase64(cv: any, mat: any, quality: number = 0.92): string {
  const canvas = document.createElement("canvas");
  cv.imshow(canvas, mat);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Convert a cv.Mat to a Blob via a temporary canvas.
 */
export function matToBlob(
  cv: any,
  mat: any,
  quality: number = 0.92
): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    cv.imshow(canvas, mat);
    canvas.toBlob(
      (blob) => resolve(blob!),
      "image/jpeg",
      quality
    );
  });
}

/**
 * Draw the detected document outline on a canvas overlay.
 */
export function drawDetectionOverlay(
  ctx: CanvasRenderingContext2D,
  corners: Point[] | null,
  canvasWidth: number,
  canvasHeight: number,
  scaleX: number = 1,
  scaleY: number = 1
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (!corners) return;

  const ordered = orderCorners(corners);
  const scaled = ordered.map((c) => ({
    x: c.x * scaleX,
    y: c.y * scaleY,
  }));

  // Semi-transparent fill
  ctx.beginPath();
  ctx.moveTo(scaled[0].x, scaled[0].y);
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(scaled[i].x, scaled[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
  ctx.fill();

  // Border
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Corner dots
  for (const c of scaled) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/**
 * Process a single image (from File or canvas) through the detection pipeline.
 * Returns the perspective-corrected image as a Blob + preview, or the original if no document found.
 */
export async function processImageWithOpenCV(
  cv: any,
  imageSource: HTMLImageElement | HTMLCanvasElement
): Promise<{ blob: Blob; preview: string; width: number; height: number }> {
  // Read image into cv.Mat
  const src = cv.imread(imageSource);

  try {
    const corners = detectDocument(cv, src);

    if (corners) {
      const { mat, width, height } = correctPerspective(cv, src, corners);
      const preview = matToBase64(cv, mat);
      const blob = await matToBlob(cv, mat);
      mat.delete();
      return { blob, preview, width, height };
    }

    // No document detected: return original
    const preview = matToBase64(cv, src);
    const blob = await matToBlob(cv, src);
    return { blob, preview, width: src.cols, height: src.rows };
  } finally {
    src.delete();
  }
}
