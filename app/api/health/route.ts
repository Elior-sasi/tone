import { runFFmpeg } from "@/lib/server/ffmpeg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let ok: boolean | null = null;

export async function GET() {
  if (ok === null) {
    try { ok = (await runFFmpeg(["-version"], { timeoutMs: 5000 })).code === 0; } catch { ok = false; }
  }
  return Response.json({ ok: true, ffmpeg: ok }, { headers: { "cache-control": "no-store" } });
}
