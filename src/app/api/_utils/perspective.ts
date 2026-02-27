/**
 * Perspective correction via homography.
 * Detects document corners → maps quadrilateral to rectangle using inverse pixel mapping.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Solve an NxN linear system Ax = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
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

/**
 * Compute 3x3 homography matrix that maps src[i] → dst[i].
 * Returns the 3x3 matrix as a flat array [h00,h01,h02,h10,h11,h12,h20,h21,1].
 */
export function computeHomography(
  src: Point[],
  dst: Point[]
): number[][] {
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

  const h = solveLinearSystem(A, b);

  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1],
  ];
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Calculate output dimensions from the detected corners.
 * Uses the max of opposite edges to determine width/height.
 */
export function calculateOutputDimensions(corners: Point[]): {
  width: number;
  height: number;
} {
  const [tl, tr, br, bl] = corners;
  const topW = dist(tl, tr);
  const bottomW = dist(bl, br);
  const leftH = dist(tl, bl);
  const rightH = dist(tr, br);

  return {
    width: Math.round(Math.max(topW, bottomW)),
    height: Math.round(Math.max(leftH, rightH)),
  };
}

/**
 * Apply perspective warp using inverse mapping + bilinear interpolation.
 *
 * @param srcPixels - Raw pixel buffer (RGB, 3 channels per pixel)
 * @param srcW - Source image width
 * @param srcH - Source image height
 * @param srcCorners - 4 corners detected in the source image [TL, TR, BR, BL]
 * @param outW - Output width
 * @param outH - Output height
 * @returns Raw RGB pixel buffer of the warped image
 */
export function perspectiveWarp(
  srcPixels: Buffer,
  srcW: number,
  srcH: number,
  srcCorners: Point[],
  outW: number,
  outH: number,
  channels: number = 3
): Buffer {
  // Destination corners = perfect rectangle
  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];

  // Homography from destination → source (inverse mapping)
  const H = computeHomography(dstCorners, srcCorners);

  const outPixels = Buffer.alloc(outW * outH * channels, 255);

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      // Map (dx, dy) in destination to (sx, sy) in source
      const w = H[2][0] * dx + H[2][1] * dy + H[2][2];
      if (Math.abs(w) < 1e-10) continue;

      const sx = (H[0][0] * dx + H[0][1] * dy + H[0][2]) / w;
      const sy = (H[1][0] * dx + H[1][1] * dy + H[1][2]) / w;

      // Bilinear interpolation
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      if (x0 < 0 || x1 >= srcW || y0 < 0 || y1 >= srcH) continue;

      const fx = sx - x0;
      const fy = sy - y0;

      const outIdx = (dy * outW + dx) * channels;
      for (let c = 0; c < channels; c++) {
        const v00 = srcPixels[(y0 * srcW + x0) * channels + c];
        const v10 = srcPixels[(y0 * srcW + x1) * channels + c];
        const v01 = srcPixels[(y1 * srcW + x0) * channels + c];
        const v11 = srcPixels[(y1 * srcW + x1) * channels + c];

        outPixels[outIdx + c] = Math.round(
          v00 * (1 - fx) * (1 - fy) +
            v10 * fx * (1 - fy) +
            v01 * (1 - fx) * fy +
            v11 * fx * fy
        );
      }
    }
  }

  return outPixels;
}
