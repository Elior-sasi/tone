"use client";
import { AppError, type ErrorCode } from "./errors";
import type { ConvertOptions } from "./engine";

export type RemoteMedia = { id: string; name: string; duration: number; hasVideo: boolean; size: number; url: string };

export type ImportEvent =
  | { stage: "checking" }
  | { stage: "downloading"; received: number; total: number }
  | { stage: "analyzing" };

export class ImportError extends AppError {
  tip?: string;
  constructor(code: ErrorCode, tip?: string) { super(code); this.tip = tip; }
}

/** POST /api/import - reads the NDJSON progress stream. */
export async function importUrl(url: string, onEvent: (e: ImportEvent) => void, signal: AbortSignal): Promise<RemoteMedia> {
  let res: Response;
  try {
    res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }), signal });
  } catch (e) {
    if (signal.aborted) throw new AppError("cancelled");
    throw new AppError("network");
  }
  if (!res.ok || !res.body) throw new AppError(res.status >= 500 ? "server_unavailable" : "import_failed");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.type === "stage") onEvent(msg);
        else if (msg.type === "done") return msg.media as RemoteMedia;
        else if (msg.type === "error") throw new ImportError(msg.code in { invalid_url: 1, unsupported_provider: 1, too_large: 1, no_audio: 1, network: 1 } ? msg.code : "import_failed", msg.tip);
      }
      if (done) break;
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (signal.aborted) throw new AppError("cancelled");
    throw new AppError("network");
  }
  throw new AppError("network");
}

export async function fetchRemotePeaks(id: string): Promise<{ peaks: Float32Array; rate: number } | null> {
  try {
    const res = await fetch(`/api/media/${id}/peaks`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return { peaks: new Float32Array(buf, 0, Math.floor(buf.byteLength / 4)), rate: Number(res.headers.get("x-peaks-rate")) || 50 };
  } catch {
    return null;
  }
}

export function releaseRemote(id: string) {
  try { fetch(`/api/media/${id}`, { method: "DELETE", keepalive: true }); } catch {}
}

export async function serverAvailable(): Promise<boolean> {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    return r.ok && (await r.json()).ffmpeg === true;
  } catch {
    return false;
  }
}

function query(o: ConvertOptions, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({
    start: o.start.toFixed(3), duration: o.duration.toFixed(3), format: o.format, bitrate: String(o.bitrate),
    normalize: o.normalize ? "1" : "0", fade: o.fade ? "1" : "0", title: o.title || "", ...extra,
  });
  return q.toString();
}

async function errorFromResponse(xhrStatus: number, body: any): Promise<AppError> {
  const code = body?.code as ErrorCode | undefined;
  if (code) return AppError.fromEngine(code);
  return new AppError(xhrStatus >= 500 ? "server_unavailable" : "failed");
}

/**
 * Server-side conversion. Uses XHR so upload progress is real.
 * onUpload(ratio) is called while the file uploads (device fallback only).
 */
export function convertOnServer(
  o: ConvertOptions,
  source: { id: string } | { file: File },
  onUpload: (ratio: number) => void,
  onProcessing: () => void,
  signal: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const isRemote = "id" in source;
    xhr.open("POST", `/api/convert?${query(o, isRemote ? { id: source.id } : {})}`);
    xhr.responseType = "blob";
    if (!isRemote) {
      xhr.setRequestHeader("content-type", "application/octet-stream");
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onUpload(e.loaded / e.total); };
      xhr.upload.onload = () => onProcessing();
    } else {
      onProcessing();
    }
    xhr.onload = async () => {
      if (xhr.status === 200) return resolve(xhr.response as Blob);
      let body: any = null;
      try { body = JSON.parse(await (xhr.response as Blob).text()); } catch {}
      reject(await errorFromResponse(xhr.status, body));
    };
    xhr.onerror = () => reject(new AppError("network"));
    xhr.onabort = () => reject(new AppError("cancelled"));
    signal.addEventListener("abort", () => xhr.abort());
    xhr.send(isRemote ? null : source.file);
  });
}
