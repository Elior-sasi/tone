import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { loadMeta, mediaPath, removeJob } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams an imported file with HTTP Range support, so the player can seek
// without the browser ever downloading the whole video.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meta = await loadMeta(id);
  if (!meta) return new Response("not found", { status: 404 });
  const path = mediaPath(id);
  const { size } = await stat(path);
  const type = meta.mime.startsWith("video/") || meta.mime.startsWith("audio/") ? meta.mime : meta.hasVideo ? "video/mp4" : "audio/mpeg";
  const range = req.headers.get("range");
  const base = { "accept-ranges": "bytes", "content-type": type, "cache-control": "private, no-store" };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? Number(m[1]) : 0;
    let end = m && m[2] ? Number(m[2]) : size - 1;
    if (m && !m[1] && m[2]) { start = Math.max(0, size - Number(m[2])); end = size - 1; }
    if (start >= size || end < start) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    end = Math.min(end, size - 1);
    const body = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers: { ...base, "content-length": String(end - start + 1), "content-range": `bytes ${start}-${end}/${size}` } });
  }
  const body = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new Response(body, { headers: { ...base, "content-length": String(size) } });
}

// The client calls this when the user leaves the editor, so the file is gone right away.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (await loadMeta(id)) await removeJob(id);
  return new Response(null, { status: 204 });
}
