import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { GuardError, detectProvider, findMediaInHtml, guardedGet, parseUserUrl, type GuardedResponse } from "@/lib/server/fetch-guard";
import { MAX_BYTES, mediaPath, newJobDir, removeJob, saveMeta } from "@/lib/server/store";
import { probe } from "@/lib/server/ffmpeg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MEDIA_EXT = /\.(mp4|mov|m4v|webm|mp3|m4a|aac|wav|ogg|oga|opus|flac|mkv)(\?|$)/i;

function isMedia(res: GuardedResponse) {
  const ct = String(res.headers["content-type"] || "").toLowerCase();
  if (ct.startsWith("video/") || ct.startsWith("audio/")) return true;
  if ((ct.includes("octet-stream") || !ct) && MEDIA_EXT.test(res.finalUrl.pathname)) return true;
  return false;
}

function nameFrom(res: GuardedResponse, title?: string) {
  if (title) return title;
  const cd = String(res.headers["content-disposition"] || "");
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
  const last = res.finalUrl.pathname.split("/").filter(Boolean).pop();
  if (last) { try { return decodeURIComponent(last); } catch { return last; } }
  return "";
}

async function readText(res: GuardedResponse, limit = 2 * 1024 * 1024): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of res) {
    size += c.length;
    chunks.push(c);
    if (size > limit) { res.destroy(); break; }
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(req: Request) {
  let raw = "";
  try { raw = String(((await req.json()) as any)?.url || ""); } catch {}

  const enc = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch {} };
      let jobId: string | null = null;
      try {
        const url = parseUserUrl(raw);
        const provider = detectProvider(url);
        if (provider) {
          send({ type: "error", code: "unsupported_provider", provider: provider.name, tip: provider.tip });
          return;
        }
        send({ type: "stage", stage: "checking" });
        let res = await guardedGet(url, abort.signal);
        let title: string | undefined;

        if (!isMedia(res)) {
          const ct = String(res.headers["content-type"] || "");
          if (!ct.includes("html")) { res.resume(); throw new GuardError("import_failed"); }
          const found = findMediaInHtml(await readText(res), res.finalUrl);
          if (!found) throw new GuardError("import_failed");
          title = found.title;
          res = await guardedGet(found.url, abort.signal);
          if (!isMedia(res)) { res.resume(); throw new GuardError("import_failed"); }
        }

        const total = Number(res.headers["content-length"]) || 0;
        if (total > MAX_BYTES) { res.destroy(); throw new GuardError("too_large"); }

        const job = await newJobDir();
        jobId = job.id;
        const path = mediaPath(job.id);
        let received = 0;
        let lastSent = 0;
        send({ type: "stage", stage: "downloading", received: 0, total });
        const counter = new Transform({
          transform(chunk, _e, cb) {
            received += chunk.length;
            if (received > MAX_BYTES) return cb(new GuardError("too_large"));
            const now = Date.now();
            if (now - lastSent > 200) { lastSent = now; send({ type: "stage", stage: "downloading", received, total }); }
            cb(null, chunk);
          },
        });
        await pipeline(res, counter, createWriteStream(path), { signal: abort.signal });
        send({ type: "stage", stage: "downloading", received, total: total || received });

        send({ type: "stage", stage: "analyzing" });
        const info = await probe(path);
        if (!info.duration) throw new GuardError("import_failed");
        if (!info.hasAudio) { send({ type: "error", code: "no_audio" }); await removeJob(job.id); jobId = null; return; }

        const name = nameFrom(res, title || info.title);
        const mime = String(res.headers["content-type"] || "").split(";")[0] || "application/octet-stream";
        await saveMeta({ id: job.id, name, duration: info.duration, hasVideo: info.hasVideo, hasAudio: true, size: received, mime, createdAt: Date.now() });
        send({ type: "done", media: { id: job.id, name, duration: info.duration, hasVideo: info.hasVideo, size: received, url: `/api/media/${job.id}` } });
        jobId = null;
      } catch (e) {
        const code = e instanceof GuardError ? e.code : abort.signal.aborted ? "network" : "import_failed";
        if (!(e instanceof GuardError)) console.warn("[import]", e);
        send({ type: "error", code });
      } finally {
        if (jobId) await removeJob(jobId);
        try { controller.close(); } catch {}
      }
    },
    cancel() { abort.abort(); },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
