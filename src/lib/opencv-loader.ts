/**
 * Lazy loader for OpenCV.js from CDN.
 * Only loads when explicitly called (camera open or gallery processing).
 * Never loads on page mount to avoid freezing the main thread.
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

    // Already loaded from a previous call
    const existing = (window as any).cv;
    if (existing && existing.Mat) {
      resolve(existing);
      return;
    }

    const script = document.createElement("script");
    script.src = OPENCV_CDN;
    script.async = true;

    script.onload = () => {
      // OpenCV.js sets window.cv — poll until it's fully initialized
      const check = () => {
        const cv = (window as any).cv;
        if (cv && cv.Mat) {
          resolve(cv);
        } else if (cv && cv.onRuntimeInitialized !== undefined) {
          // WASM still compiling, wait for callback
          cv.onRuntimeInitialized = () => resolve((window as any).cv);
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    };

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
