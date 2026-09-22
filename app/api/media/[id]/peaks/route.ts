import { loadMeta, mediaPath } from "@/lib/server/store";
import { runFFmpeg } from "@/lib/server/ffmpeg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns a mean-absolute amplitude envelope (float32 LE) for the waveform.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meta = await loadMeta(id);
  if (!meta) return new Response("not found", { status: 404 });
  const rate = Math.max(20, Math.min(200, Math.floor(400_000 / Math.max(1, meta.duration))));
  const r = await runFFmpeg([
    "-i", mediaPath(id), "-vn", "-sn", "-dn", "-map", "0:a:0",
    "-af", `aformat=channel_layouts=mono,aeval=abs(val(0)),aresample=${rate}`,
    "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1",
  ], { captureStdout: true, timeoutMs: 90_000 });
  if (r.code !== 0) return new Response("failed", { status: 422 });
  return new Response(new Uint8Array(r.stdout), {
    headers: { "content-type": "application/octet-stream", "x-peaks-rate": String(rate), "cache-control": "private, max-age=600" },
  });
}
