// Fetches the standalone yt-dlp binary (no Python needed) into ./bin during the
// Vercel / Docker build. Skipped elsewhere. Never fails the build.
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dst = join(root, "bin", "yt-dlp");
const wanted = process.env.VERCEL || process.env.YTDLP_DOWNLOAD === "1";
if (!wanted) { console.log("[yt-dlp] not a deploy build, skipping"); process.exit(0); }
if (process.platform !== "linux") { console.log("[yt-dlp] not linux, skipping"); process.exit(0); }
if (existsSync(dst)) { console.log("[yt-dlp] already present"); process.exit(0); }

const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
try {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, buf);
  chmodSync(dst, 0o755);
  console.log(`[yt-dlp] downloaded ${(buf.length / 1e6).toFixed(1)}MB`);
} catch (e) {
  console.warn("[yt-dlp] download failed - link import will only handle direct media links:", e?.message || e);
}
