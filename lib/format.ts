export const MAX_CLIP = 29.8; // seconds - just under iOS's 30 s ringtone limit
export const MIN_CLIP = 1;
export const MAX_UPLOAD = 500 * 1024 * 1024;

export const VIDEO_EXT = ["mp4", "mov", "m4v", "webm"];
export const AUDIO_EXT = ["mp3", "m4a", "aac", "wav"];

/** 12.4 -> "00:12.4", 3725.2 -> "1:02:05.2" */
export function fmtTime(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const tenths = Math.round(t * 10);
  const total = Math.floor(tenths / 10);
  const d = tenths % 10;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}.${d}` : `${mm}:${ss}.${d}`;
}

export function fmtSeconds(t: number): string {
  return (Math.round(t * 10) / 10).toFixed(1);
}

export function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

/** Clean a user/title string into a safe file name. */
export function sanitizeName(raw: string): string {
  const cleaned = (raw || "")
    .normalize("NFC")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*‎‏‪-‮]/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .trim();
  return cleaned || "צלצול חדש";
}

export function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
