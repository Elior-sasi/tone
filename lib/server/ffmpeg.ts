import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

let cached: string | null = null;

/** FFMPEG_PATH env -> ffmpeg-static -> system ffmpeg */
export function ffmpegPath(): string {
  if (cached) return cached;
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return (cached = process.env.FFMPEG_PATH);
  try {
    const req = createRequire(import.meta.url);
    const p = req("ffmpeg-static") as string | null;
    if (p && existsSync(p)) return (cached = p);
  } catch {}
  return (cached = "ffmpeg");
}

export type RunResult = { code: number; stderr: string; stdout: Buffer };

export function runFFmpeg(args: string[], opts: { timeoutMs?: number; captureStdout?: boolean } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(/*turbopackIgnore: true*/ ffmpegPath(), ["-hide_banner", "-nostdin", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const out: Buffer[] = [];
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    child.stdout.on("data", (d) => { if (opts.captureStdout) out.push(d); });
    const timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs ?? 120_000);
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stderr, stdout: Buffer.concat(out) });
    });
  });
}

export type ProbeInfo = { duration: number; hasAudio: boolean; hasVideo: boolean; title?: string };

/** Probe with `ffmpeg -i` (works with the ffmpeg binary alone, no ffprobe needed). */
export async function probe(path: string): Promise<ProbeInfo> {
  const r = await runFFmpeg(["-i", path], { timeoutMs: 30_000 });
  const s = r.stderr;
  const d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
  const duration = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0;
  const hasAudio = /Stream #\d+:\d+.*?: Audio:/.test(s);
  const hasVideo = /Stream #\d+:\d+.*?: Video:(?!.*(?:attached pic|mjpeg|png))/.test(s);
  const t = /^\s+title\s*:\s*(.+)$/m.exec(s);
  return { duration, hasAudio, hasVideo, title: t?.[1]?.trim() };
}

export function classifyFFmpeg(stderr: string): "no_audio" | "bad_input" | "failed" {
  if (/matches no streams|does not contain any stream/i.test(stderr)) return "no_audio";
  if (/Invalid data found|moov atom not found|Unknown format/i.test(stderr)) return "bad_input";
  return "failed";
}

export type ConvertParams = {
  start: number;
  duration: number;
  format: "m4a" | "mp3";
  bitrate: number;
  normalize: boolean;
  fade: boolean;
  title?: string;
};

export function convertArgs(input: string, output: string, p: ConvertParams): string[] {
  const filters: string[] = [];
  if (p.normalize) filters.push("loudnorm=I=-14:TP=-1.0:LRA=11");
  if (p.fade) {
    const fin = Math.min(0.04, p.duration / 10);
    const fout = Math.min(0.6, p.duration / 5);
    filters.push(`afade=t=in:st=0:d=${fin.toFixed(3)}`);
    filters.push(`afade=t=out:st=${Math.max(0, p.duration - fout).toFixed(3)}:d=${fout.toFixed(3)}`);
  }
  const args = [
    "-y", "-ss", p.start.toFixed(3), "-t", p.duration.toFixed(3), "-i", input,
    "-map", "0:a:0", "-vn", "-sn", "-dn", "-map_metadata", "-1", "-ac", "2", "-ar", "44100",
  ];
  if (filters.length) args.push("-af", filters.join(","));
  if (p.title) args.push("-metadata", `title=${p.title}`);
  if (p.format === "mp3") args.push("-c:a", "libmp3lame", "-b:a", `${p.bitrate}k`, "-id3v2_version", "3", "-t", p.duration.toFixed(3), "-f", "mp3", output);
  else args.push("-c:a", "aac", "-b:a", `${p.bitrate}k`, "-t", p.duration.toFixed(3), "-movflags", "+faststart", "-f", "ipod", output);
  return args;
}

export function parseConvertParams(src: URLSearchParams | Record<string, unknown>): ConvertParams | null {
  const get = (k: string) => (src instanceof URLSearchParams ? src.get(k) : (src[k] as any));
  const start = Number(get("start"));
  const duration = Number(get("duration"));
  if (!isFinite(start) || start < 0 || !isFinite(duration) || duration <= 0.2 || duration > 30) return null;
  const format = get("format") === "mp3" ? "mp3" : "m4a";
  const br = Number(get("bitrate"));
  const bitrate = [128, 160, 192, 256].includes(br) ? br : format === "mp3" ? 192 : 160;
  const truthy = (v: unknown) => v === true || v === "1" || v === "true";
  const title = String(get("title") ?? "").replace(/[\u0000-\u001f]/g, "").slice(0, 60) || undefined;
  return { start, duration, format, bitrate, normalize: truthy(get("normalize")), fade: truthy(get("fade")), title };
}
