import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, copyFile, mkdir, rename } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ffmpegPath } from "./ffmpeg";
import { isPublicIp } from "./fetch-guard";

let ready: Promise<string | null> | null = null;

/** Locates the bundled yt-dlp and copies it somewhere executable (Vercel's /var/task is read-only). */
export function ytdlpBinary(): Promise<string | null> {
  if (ready) return ready;
  ready = (async () => {
    if (process.env.YTDLP_PATH && existsSync(process.env.YTDLP_PATH)) return process.env.YTDLP_PATH;
    const bundled = join(/*turbopackIgnore: true*/ process.cwd(), "bin", "yt-dlp");
    if (!existsSync(bundled)) return null;
    const dir = join(tmpdir(), "tzur-bin");
    const exe = join(dir, "yt-dlp");
    if (!existsSync(exe)) {
      await mkdir(dir, { recursive: true });
      await copyFile(bundled, exe);
    }
    await chmod(exe, 0o755);
    return exe;
  })().catch(() => null);
  return ready;
}

/** yt-dlp fetches the URL itself, so make sure the host is not internal (SSRF). */
export async function assertPublicHost(u: URL) {
  const host = u.hostname;
  const ips = net.isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (!ips.length || ips.some((ip) => !isPublicIp(ip))) throw new Error("blocked_address");
}

export type YtdlpResult = { path: string; title?: string; size: number };
export class YtdlpError extends Error {
  constructor(public kind: "unavailable" | "blocked" | "too_large" | "failed", public detail = "") { super(kind); }
}

export async function ytdlpDownload(
  url: URL,
  dir: string,
  maxBytes: number,
  onProgress: (received: number, total: number) => void,
  signal: AbortSignal,
): Promise<YtdlpResult> {
  const bin = await ytdlpBinary();
  if (!bin) throw new YtdlpError("unavailable");
  await assertPublicHost(url);

  const args = [
    "--no-playlist", "--no-warnings", "--no-part", "--no-mtime", "--newline", "--progress",
    "--no-simulate", "--restrict-filenames",
    "--max-filesize", String(maxBytes),
    "--socket-timeout", "20",
    // one file that already has sound - no merge step, keeps it fast
    "-f", "b[acodec!=none][height<=720]/b[acodec!=none]/ba/b",
    "--ffmpeg-location", ffmpegPath(),
    "--cache-dir", join(tmpdir(), "yt-dlp-cache"),
    "--progress-template", "download:P %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s",
    "--print", "after_move:F %(filepath)s",
    "--print", "after_move:T %(title)s",
    "-o", join(dir, "dl.%(ext)s"),
    "--", url.href,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(/*turbopackIgnore: true*/ bin, args, { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, HOME: tmpdir() } });
    const onAbort = () => child.kill("SIGKILL");
    signal.addEventListener("abort", onAbort);
    let file = "", title: string | undefined, stderr = "", out = "", received = 0;

    const onLine = (line: string) => {
      if (line.startsWith("P ")) {
        const [, d, t, e] = line.split(" ");
        received = Number(d) || received;
        onProgress(received, Number(t) || Number(e) || 0);
      } else if (line.startsWith("F ")) file = line.slice(2).trim();
      else if (line.startsWith("T ")) title = line.slice(2).trim();
    };
    child.stdout.on("data", (d) => {
      out += d.toString();
      let i: number;
      while ((i = out.indexOf("\n")) >= 0) { onLine(out.slice(0, i).trim()); out = out.slice(i + 1); }
    });
    child.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-8000); });
    child.on("error", (e) => { signal.removeEventListener("abort", onAbort); reject(new YtdlpError("unavailable", String(e))); });
    child.on("close", async (code) => {
      signal.removeEventListener("abort", onAbort);
      if (out.trim()) onLine(out.trim());
      if (signal.aborted) return reject(new Error("aborted"));
      if (code === 0 && file && existsSync(/*turbopackIgnore: true*/ file)) {
        const dest = join(dir, "media");
        try { await rename(/*turbopackIgnore: true*/ file, dest); } catch (e) { return reject(new YtdlpError("failed", String(e))); }
        return resolve({ path: dest, title, size: received });
      }
      console.warn("[yt-dlp]", code, stderr.slice(-1500));
      if (/max-filesize|larger than max/i.test(stderr)) return reject(new YtdlpError("too_large"));
      if (/sign in to confirm|not a bot|429|too many requests|login required|rate-limit/i.test(stderr)) return reject(new YtdlpError("blocked", stderr));
      reject(new YtdlpError("failed", stderr));
    });
  });
}
