/**
 * Lazy loader for OpenCV.js from jsDelivr CDN.
 * Uses @techstark/opencv-js which is well-maintained and gzip-compressed (~3-4MB transfer).
 * Only loads when explicitly called (camera open or gallery processing).
 */

let cvPromise: Promise<any> | null = null;

const OPENCV_CDN =
  "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.12.0-release.1/dist/opencv.js";

const LOAD_TIMEOUT_MS = 30_000;

export function loadOpenCV(): Promise<any> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise<any>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("OpenCV.js requires a browser environment"));
      return;
    }

    // Already loaded from a previous call
    const existing = (window as any).cv;
    if (existing && existing.Mat) {
      resolve(existing);
      return;
    }

    const timeout = setTimeout(() => {
      cvPromise = null;
      reject(new Error("OpenCV.js load timeout"));
    }, LOAD_TIMEOUT_MS);

    const script = document.createElement("script");
    script.src = OPENCV_CDN;
    script.async = true;

    script.onload = () => {
      // OpenCV.js sets window.cv — poll until it's fully initialized
      const check = () => {
        const cv = (window as any).cv;
        if (cv && cv.Mat) {
          clearTimeout(timeout);
          resolve(cv);
        } else if (cv && cv.onRuntimeInitialized !== undefined) {
          // WASM still compiling, wait for callback
          const prev = cv.onRuntimeInitialized;
          cv.onRuntimeInitialized = () => {
            prev?.();
            clearTimeout(timeout);
            resolve((window as any).cv);
          };
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    };

    script.onerror = () => {
      clearTimeout(timeout);
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
