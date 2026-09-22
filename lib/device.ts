"use client";

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac - detect touch.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function isIPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

/** Returns a File that the Web Share API accepts, or null if file sharing isn't supported. */
export function makeShareableFile(blob: Blob, baseName: string, ext: "m4a" | "mp3"): File | null {
  if (typeof navigator === "undefined" || !navigator.canShare) return null;
  const types = ext === "mp3" ? ["audio/mpeg", "audio/mp3"] : ["audio/mp4", "audio/x-m4a", "audio/m4a"];
  for (const type of types) {
    const f = new File([blob], `${baseName}.${ext}`, { type, lastModified: Date.now() });
    try { if (navigator.canShare({ files: [f] })) return f; } catch {}
  }
  return null;
}
