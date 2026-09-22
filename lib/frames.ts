"use client";
// Small filmstrip thumbnails for the overview bar (video only).

function once(el: HTMLMediaElement, ev: string, ms: number) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, ms);
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error("error")); };
    const cleanup = () => { clearTimeout(t); el.removeEventListener(ev, ok); el.removeEventListener("error", bad); };
    el.addEventListener(ev, ok, { once: true });
    el.addEventListener("error", bad, { once: true });
  });
}

export async function makeFrames(url: string, duration: number, count: number, alive: () => boolean): Promise<string[] | null> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("playsinline", "");
  v.src = url;
  const frames: string[] = [];
  try {
    await once(v, "loadeddata", 10000);
    const ar = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
    const h = 64, w = Math.round(h * ar);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    for (let i = 0; i < count; i++) {
      if (!alive()) return null;
      v.currentTime = Math.min(duration - 0.1, ((i + 0.5) / count) * duration);
      await once(v, "seeked", 5000);
      g.drawImage(v, 0, 0, w, h);
      frames.push(c.toDataURL("image/jpeg", 0.6));
    }
    return frames;
  } catch {
    return frames.length ? frames : null;
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}
