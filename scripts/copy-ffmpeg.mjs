// Copies the single-thread ffmpeg.wasm core into /public so it is self-hosted
// (no CDN, works offline once cached by the service worker).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/@ffmpeg/core/dist/umd");
const dst = join(root, "public/ffmpeg");
if (!existsSync(src)) { console.log("[copy-ffmpeg] @ffmpeg/core not installed yet, skipping"); process.exit(0); }
mkdirSync(dst, { recursive: true });
for (const f of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) cpSync(join(src, f), join(dst, f));
console.log("[copy-ffmpeg] copied core to public/ffmpeg");
