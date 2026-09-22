import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { classifyFFmpeg, convertArgs, parseConvertParams, runFFmpeg } from "@/lib/server/ffmpeg";
import { MAX_BYTES, loadMeta, mediaPath, newJobDir, removeJob } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const err = (code: string, status = 422) =>
  new Response(JSON.stringify({ code }), { status, headers: { "content-type": "application/json" } });

/**
 * Two modes:
 *  - ?id=<imported media id>&start=..&duration=..   -> cuts the file already on the server
 *  - raw file body (application/octet-stream) + same query params -> server-side fallback
 *    for devices that can't run ffmpeg.wasm. The upload is deleted right after processing.
 * Responds with the finished audio file.
 */
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const params = parseConvertParams(q);
  if (!params) return err("failed", 400);

  const importedId = q.get("id");
  let workDir: string | null = null;
  let input: string;
  let cleanupId: string | null = null;

  try {
    if (importedId) {
      const meta = await loadMeta(importedId);
      if (!meta) return err("import_failed", 404);
      input = mediaPath(importedId);
      const { id, dir } = await newJobDir();
      workDir = dir; cleanupId = id;
    } else {
      const len = Number(req.headers.get("content-length") || 0);
      if (len > MAX_BYTES) return err("too_large", 413);
      if (!req.body) return err("failed", 400);
      const { id, dir } = await newJobDir();
      workDir = dir; cleanupId = id;
      input = join(dir, "upload");
      let received = 0;
      const limiter = new Transform({
        transform(chunk, _e, cb) {
          received += chunk.length;
          if (received > MAX_BYTES) return cb(new Error("too_large"));
          cb(null, chunk);
        },
      });
      try {
        await pipeline(Readable.fromWeb(req.body as any), limiter, createWriteStream(input));
      } catch (e: any) {
        return err(e?.message === "too_large" ? "too_large" : "network", e?.message === "too_large" ? 413 : 400);
      }
    }

    const ext = params.format === "mp3" ? "mp3" : "m4a";
    const out = join(workDir!, `out.${ext}`);
    const r = await runFFmpeg(convertArgs(input, out, params), { timeoutMs: 120_000 });
    if (r.code !== 0) {
      console.warn("[convert]", r.stderr.slice(-2000));
      return err(classifyFFmpeg(r.stderr));
    }
    const data = await readFile(out);
    if (data.byteLength < 1000) return err("no_audio");
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": ext === "mp3" ? "audio/mpeg" : "audio/mp4",
        "content-length": String(data.byteLength),
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.warn("[convert]", e);
    return err("failed", 500);
  } finally {
    if (cleanupId) await removeJob(cleanupId);
  }
}
