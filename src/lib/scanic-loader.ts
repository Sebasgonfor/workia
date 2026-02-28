/**
 * Lazy loader for Scanic WASM document detection library.
 * Caches the scanner instance for reuse across multiple scans.
 */

import type { Scanner, ScannerResult, CornerPoints } from "scanic";

let scannerInstance: Scanner | null = null;
let initPromise: Promise<Scanner> | null = null;

export type { ScannerResult, CornerPoints };

/**
 * Get or initialize the cached Scanic scanner instance.
 * Safe to call multiple times — only initializes once.
 */
export const getScanner = async (): Promise<Scanner> => {
  if (scannerInstance) return scannerInstance;

  if (!initPromise) {
    initPromise = (async () => {
      const { Scanner } = await import("scanic");
      const scanner = new Scanner({
        mode: "detect",
        output: "canvas",
        maxProcessingDimension: 1000,
      });
      await scanner.initialize();
      scannerInstance = scanner;
      return scanner;
    })();
  }

  return initPromise;
};

/**
 * Detect document corners using Scanic.
 * Returns corner points or null if no document found.
 */
export const detectCorners = async (
  image: HTMLImageElement | HTMLCanvasElement | ImageData
): Promise<CornerPoints | null> => {
  try {
    const scanner = await getScanner();
    const result = await scanner.scan(image, { mode: "detect" });

    if (!result.success || !result.corners) return null;
    return result.corners;
  } catch (err) {
    console.error("Scanic detection failed:", err);
    return null;
  }
};
