/**
 * Lazy loader for OpenCV.js from CDN.
 * Loads ~8MB WASM module on first call, caches for subsequent calls.
 * Only runs in browser context.
 */

let cvPromise: Promise<any> | null = null;

const OPENCV_CDN = "https://docs.opencv.org/4.9.0/opencv.js";

export function loadOpenCV(): Promise<any> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise<any>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("OpenCV.js requires a browser environment"));
      return;
    }

    // Already loaded from a previous page visit
    const existing = (window as any).cv;
    if (existing && existing.Mat) {
      resolve(existing);
      return;
    }

    // onRuntimeInitialized must be set BEFORE the script loads
    (window as any).Module = {
      onRuntimeInitialized: () => {
        resolve((window as any).cv);
      },
    };

    const script = document.createElement("script");
    script.src = OPENCV_CDN;
    script.async = true;
    script.onerror = () => {
      cvPromise = null;
      reject(new Error("Failed to load OpenCV.js"));
    };
    document.body.appendChild(script);
  });

  return cvPromise;
}

export function isOpenCVLoaded(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as any).cv &&
    !!(window as any).cv?.Mat
  );
}

export function getCV(): any {
  if (!isOpenCVLoaded()) throw new Error("OpenCV not loaded yet");
  return (window as any).cv;
}
