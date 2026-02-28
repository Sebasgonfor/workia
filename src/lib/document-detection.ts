/**
 * Pure JavaScript document detection & perspective correction.
 * No dependencies — instant loading, no WASM, no CDN.
 *
 * Pipeline: grayscale → blur → Canny → dilate → find contours → largest quad → warp
 */

export interface Point {
  x: number;
  y: number;
}

// ─── Internal: Image Processing ───

function grayscaleFromCanvas(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const n = canvas.width * canvas.height;
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    gray[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  }
  return gray;
}

function gaussianBlur5x5(src: Uint8Array, w: number, h: number): Uint8Array {
  const k = [1, 4, 6, 4, 1];
  const temp = new Uint8Array(w * h);
  const dst = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let i = -2; i <= 2; i++) {
        const sx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i;
        sum += src[row + sx] * k[i + 2];
      }
      temp[row + x] = sum >> 4;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let i = -2; i <= 2; i++) {
        const sy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i;
        sum += temp[sy * w + x] * k[i + 2];
      }
      dst[y * w + x] = sum >> 4;
    }
  }

  return dst;
}

function canny(
  gray: Uint8Array,
  w: number,
  h: number,
  lowT: number,
  highT: number
): Uint8Array {
  const size = w * h;
  const mag = new Float32Array(size);
  const dir = new Uint8Array(size);

  // Sobel gradients + magnitude + quantized direction
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const tl = gray[(y - 1) * w + (x - 1)];
      const tc = gray[(y - 1) * w + x];
      const tr = gray[(y - 1) * w + (x + 1)];
      const ml = gray[y * w + (x - 1)];
      const mr = gray[y * w + (x + 1)];
      const bl = gray[(y + 1) * w + (x - 1)];
      const bc = gray[(y + 1) * w + x];
      const br = gray[(y + 1) * w + (x + 1)];

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;

      mag[idx] = Math.sqrt(gx * gx + gy * gy);

      let angle = Math.atan2(gy, gx);
      if (angle < 0) angle += Math.PI;

      if (angle < 0.3927 || angle >= 2.7489) dir[idx] = 0;
      else if (angle < 1.1781) dir[idx] = 1;
      else if (angle < 1.9635) dir[idx] = 2;
      else dir[idx] = 3;
    }
  }

  // Non-maximum suppression
  const nms = new Float32Array(size);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const m = mag[idx];
      let n1: number, n2: number;

      switch (dir[idx]) {
        case 0:
          n1 = mag[y * w + (x - 1)];
          n2 = mag[y * w + (x + 1)];
          break;
        case 1:
          n1 = mag[(y - 1) * w + (x + 1)];
          n2 = mag[(y + 1) * w + (x - 1)];
          break;
        case 2:
          n1 = mag[(y - 1) * w + x];
          n2 = mag[(y + 1) * w + x];
          break;
        default:
          n1 = mag[(y - 1) * w + (x - 1)];
          n2 = mag[(y + 1) * w + (x + 1)];
          break;
      }

      if (m >= n1 && m >= n2) nms[idx] = m;
    }
  }

  // Double threshold + hysteresis (BFS)
  const edges = new Uint8Array(size);
  const queue: number[] = [];

  for (let i = 0; i < size; i++) {
    if (nms[i] >= highT) {
      edges[i] = 255;
      queue.push(i);
    } else if (nms[i] >= lowT) {
      edges[i] = 128;
    }
  }

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const x = idx % w;
    const y = (idx - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const nidx = ny * w + nx;
        if (edges[nidx] === 128) {
          edges[nidx] = 255;
          queue.push(nidx);
        }
      }
    }
  }

  for (let i = 0; i < size; i++) {
    if (edges[i] !== 255) edges[i] = 0;
  }

  return edges;
}

function dilate3x3(
  src: Uint8Array,
  w: number,
  h: number,
  iterations: number
): Uint8Array {
  let current = src;
  let next: Uint8Array;

  for (let iter = 0; iter < iterations; iter++) {
    next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let max = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy,
              nx = x + dx;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
              const v = current[ny * w + nx];
              if (v > max) max = v;
            }
          }
        }
        next[y * w + x] = max;
      }
    }
    current = next;
  }

  return current;
}

// ─── Internal: Contour Finding ───

function findContours(edges: Uint8Array, w: number, h: number): Point[][] {
  const visited = new Uint8Array(w * h);
  const contours: Point[][] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (edges[idx] !== 255 || visited[idx]) continue;

      // BFS to find connected component, collect boundary pixels
      const boundary: Point[] = [];
      const stack = [idx];
      visited[idx] = 1;

      while (stack.length > 0) {
        const cidx = stack.pop()!;
        const cx = cidx % w;
        const cy = (cidx - cx) / w;

        let onBoundary = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx,
              ny = cy + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
              onBoundary = true;
            } else {
              const nidx = ny * w + nx;
              if (edges[nidx] === 255) {
                if (!visited[nidx]) {
                  visited[nidx] = 1;
                  stack.push(nidx);
                }
              } else {
                onBoundary = true;
              }
            }
          }
        }

        if (onBoundary) {
          boundary.push({ x: cx, y: cy });
        }
      }

      if (boundary.length >= 30) {
        contours.push(boundary);
      }
    }
  }

  return contours;
}

// ─── Internal: Convex Hull (Andrew's Monotone Chain) ───

function crossProduct(O: Point, A: Point, B: Point): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

function convexHull(points: Point[]): Point[] {
  if (points.length <= 3) return points;

  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const n = pts.length;

  const lower: Point[] = [];
  for (let i = 0; i < n; i++) {
    while (
      lower.length >= 2 &&
      crossProduct(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <=
        0
    ) {
      lower.pop();
    }
    lower.push(pts[i]);
  }

  const upper: Point[] = [];
  for (let i = n - 1; i >= 0; i--) {
    while (
      upper.length >= 2 &&
      crossProduct(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <=
        0
    ) {
      upper.pop();
    }
    upper.push(pts[i]);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ─── Internal: Polygon Approximation (Douglas-Peucker) ───

function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [first, last];
}

function approxPolyClosed(hull: Point[], epsilon: number): Point[] {
  if (hull.length <= 3) return hull;

  // Find the point farthest from hull[0] to split the closed curve
  let maxDist = 0;
  let splitIdx = 0;
  for (let i = 1; i < hull.length; i++) {
    const dx = hull[i].x - hull[0].x;
    const dy = hull[i].y - hull[0].y;
    const d = dx * dx + dy * dy;
    if (d > maxDist) {
      maxDist = d;
      splitIdx = i;
    }
  }

  const curve1 = hull.slice(0, splitIdx + 1);
  const curve2 = hull.slice(splitIdx).concat([hull[0]]);

  const approx1 = douglasPeucker(curve1, epsilon);
  const approx2 = douglasPeucker(curve2, epsilon);

  return approx1.slice(0, -1).concat(approx2.slice(0, -1));
}

// ─── Internal: Polygon Utilities ───

function polygonArea(pts: Point[]): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function isConvexPoly(pts: Point[]): boolean {
  const n = pts.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const c = pts[(i + 2) % n];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cr) > 1) {
      const s = cr > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return sign !== 0;
}

function arcLength(pts: Point[]): number {
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    len += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
  }
  return len;
}

// ─── Internal: Homography + Perspective Warp ───

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-10) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    if (Math.abs(aug[i][i]) > 1e-10) x[i] /= aug[i][i];
  }
  return x;
}

function computeHomography(
  src: Point[],
  dst: Point[]
): number[] {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x: xs, y: ys } = src[i];
    const { x: xd, y: yd } = dst[i];
    A.push([xs, ys, 1, 0, 0, 0, -xs * xd, -ys * xd]);
    b.push(xd);
    A.push([0, 0, 0, xs, ys, 1, -xs * yd, -ys * yd]);
    b.push(yd);
  }

  return solveLinearSystem(A, b);
  // Returns [h0..h7], h8 = 1
}

// ─── Exported API ───

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Order 4 corners as [topLeft, topRight, bottomRight, bottomLeft].
 */
export function orderCorners(corners: Point[]): [Point, Point, Point, Point] {
  const sums = corners.map((p) => p.x + p.y);
  const diffs = corners.map((p) => p.x - p.y);

  return [
    corners[sums.indexOf(Math.min(...sums))],
    corners[diffs.indexOf(Math.max(...diffs))],
    corners[sums.indexOf(Math.max(...sums))],
    corners[diffs.indexOf(Math.min(...diffs))],
  ];
}

/**
 * Detect the largest quadrilateral document in a canvas image.
 * Returns 4 corners [TL, TR, BR, BL] or null if no document found.
 */
export function detectDocument(canvas: HTMLCanvasElement): Point[] | null {
  const w = canvas.width;
  const h = canvas.height;
  const imgArea = w * h;

  const gray = grayscaleFromCanvas(canvas);
  const blurred = gaussianBlur5x5(gray, w, h);
  const edges = canny(blurred, w, h, 50, 150);
  const dilated = dilate3x3(edges, w, h, 2);
  const contours = findContours(dilated, w, h);

  let bestCorners: Point[] | null = null;
  let bestArea = 0;

  for (const contour of contours) {
    const hull = convexHull(contour);
    if (hull.length < 4) continue;

    const peri = arcLength(hull);
    const approx = approxPolyClosed(hull, 0.02 * peri);

    if (approx.length === 4 && isConvexPoly(approx)) {
      const area = polygonArea(approx);
      if (area > imgArea * 0.1 && area > bestArea) {
        bestArea = area;
        bestCorners = approx;
      }
    }
  }

  if (!bestCorners) return null;
  return orderCorners(bestCorners);
}

/**
 * Apply perspective correction to extract the document as a flat rectangle.
 */
export function correctPerspective(
  canvas: HTMLCanvasElement,
  corners: Point[]
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const ordered = orderCorners(corners);

  const widthTop = distance(ordered[0], ordered[1]);
  const widthBottom = distance(ordered[3], ordered[2]);
  const heightLeft = distance(ordered[0], ordered[3]);
  const heightRight = distance(ordered[1], ordered[2]);

  const outW = Math.max(200, Math.round(Math.max(widthTop, widthBottom)));
  const outH = Math.max(200, Math.round(Math.max(heightLeft, heightRight)));

  // Inverse homography: output pixel → source pixel
  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];

  const h = computeHomography(dstCorners, ordered);

  // Source pixel data
  const srcCtx = canvas.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  const srcW = canvas.width;
  const srcH = canvas.height;

  // Output canvas
  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d")!;
  const outImgData = outCtx.createImageData(outW, outH);
  const out = outImgData.data;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const denom = h[6] * x + h[7] * y + 1;
      if (Math.abs(denom) < 1e-10) continue;

      const sx = (h[0] * x + h[1] * y + h[2]) / denom;
      const sy = (h[3] * x + h[4] * y + h[5]) / denom;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      if (x0 < 0 || x1 >= srcW || y0 < 0 || y1 >= srcH) {
        const oi = (y * outW + x) * 4;
        out[oi] = out[oi + 1] = out[oi + 2] = 255;
        out[oi + 3] = 255;
        continue;
      }

      const fx = sx - x0;
      const fy = sy - y0;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const oi = (y * outW + x) * 4;
      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      for (let c = 0; c < 4; c++) {
        out[oi + c] = Math.round(
          srcData[i00 + c] * w00 +
            srcData[i10 + c] * w10 +
            srcData[i01 + c] * w01 +
            srcData[i11 + c] * w11
        );
      }
    }
  }

  outCtx.putImageData(outImgData, 0, 0);
  return { canvas: outCanvas, width: outW, height: outH };
}

/**
 * Process a single image: detect document → correct perspective → return result.
 */
export async function processImage(
  imageSource: HTMLImageElement | HTMLCanvasElement
): Promise<{ blob: Blob; preview: string; width: number; height: number }> {
  let canvas: HTMLCanvasElement;
  if (imageSource instanceof HTMLCanvasElement) {
    canvas = imageSource;
  } else {
    canvas = document.createElement("canvas");
    canvas.width = imageSource.naturalWidth || imageSource.width;
    canvas.height = imageSource.naturalHeight || imageSource.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(imageSource, 0, 0);
  }

  const corners = detectDocument(canvas);

  if (corners) {
    const result = correctPerspective(canvas, corners);
    const preview = result.canvas.toDataURL("image/jpeg", 0.92);
    const blob = await new Promise<Blob>((resolve) =>
      result.canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
    );
    return { blob, preview, width: result.width, height: result.height };
  }

  const preview = canvas.toDataURL("image/jpeg", 0.92);
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
  );
  return { blob, preview, width: canvas.width, height: canvas.height };
}
