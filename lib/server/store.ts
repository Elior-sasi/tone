import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Temporary storage only. Nothing is kept longer than TTL_MS.
export const TTL_MS = Number(process.env.MEDIA_TTL_MINUTES || 20) * 60_000;
export const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB || 500) * 1024 * 1024;
export const ROOT = join(process.env.TZUR_TMP_DIR || tmpdir(), "tzur-tone");

export type MediaMeta = {
  id: string;
  name: string;
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  size: number;
  mime: string;
  createdAt: number;
};

const ID_RE = /^[a-f0-9-]{36}$/;
export const isValidId = (id: string) => ID_RE.test(id);

export async function newJobDir(): Promise<{ id: string; dir: string }> {
  await mkdir(ROOT, { recursive: true });
  const id = randomUUID();
  const dir = join(ROOT, id);
  await mkdir(dir, { recursive: true });
  scheduleSweep();
  return { id, dir };
}

export const jobDir = (id: string) => join(ROOT, id);
export const mediaPath = (id: string) => join(ROOT, id, "media");

export async function saveMeta(meta: MediaMeta) {
  await writeFile(join(jobDir(meta.id), "meta.json"), JSON.stringify(meta));
}

export async function loadMeta(id: string): Promise<MediaMeta | null> {
  if (!isValidId(id)) return null;
  try {
    const meta = JSON.parse(await readFile(join(jobDir(id), "meta.json"), "utf8")) as MediaMeta;
    if (Date.now() - meta.createdAt > TTL_MS) { await removeJob(id); return null; }
    return meta;
  } catch {
    return null;
  }
}

export async function removeJob(id: string) {
  await rm(jobDir(id), { recursive: true, force: true }).catch(() => {});
}

let lastSweep = 0;
export async function sweep() {
  lastSweep = Date.now();
  let entries: string[] = [];
  try { entries = await readdir(ROOT); } catch { return; }
  await Promise.all(entries.map(async (e) => {
    try {
      const s = await stat(join(ROOT, e));
      if (Date.now() - s.mtimeMs > TTL_MS) await rm(join(ROOT, e), { recursive: true, force: true });
    } catch {}
  }));
}

let timer: NodeJS.Timeout | null = null;
function scheduleSweep() {
  if (Date.now() - lastSweep > 60_000) void sweep();
  if (!timer) {
    timer = setInterval(() => void sweep(), 60_000);
    timer.unref?.();
  }
}
