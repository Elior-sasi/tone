"use client";
// Client-side media engine: lazily boots ffmpeg.wasm in a Web Worker.
// Nothing here runs until the user actually opens a file.

import { AppError } from "./errors";

export type ConvertOptions = {
  start: number;
  duration: number;
  format: "m4a" | "mp3";
  bitrate: number;
  normalize: boolean;
  fade: boolean;
  title?: string;
};

export type EngineEvent =
  | { type: "engine-download"; loaded: number; total: number }
  | { type: "stage"; stage: "cut" | "finalize" }
  | { type: "progress"; ratio: number; time: number };

type Pending = {
  resolve: (v: any) => void;
  reject: (e: any) => void;
  onEvent?: (e: EngineEvent) => void;
};

const WASM_URL = "/ffmpeg/ffmpeg-core.wasm";

class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private mountedFile: File | null = null;
  private mountedPath = "";
  private wasmBlobURL: string | null = null;
  private downloadListeners = new Set<(l: number, t: number) => void>();
  busy = false;

  private call<T = any>(msg: Record<string, unknown>, onEvent?: (e: EngineEvent) => void, transfer: Transferable[] = []): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onEvent });
      this.worker!.postMessage({ ...msg, id }, transfer);
    });
  }

  private onMessage = (ev: MessageEvent) => {
    const m = ev.data;
    const p = this.pending.get(m.id);
    if (!p) return;
    if (m.type === "progress") p.onEvent?.({ type: "progress", ratio: m.ratio, time: m.time });
    else if (m.type === "stage") p.onEvent?.({ type: "stage", stage: m.stage });
    else if (m.type === "done") { this.pending.delete(m.id); p.resolve(m); }
    else if (m.type === "error") {
      this.pending.delete(m.id);
      if (m.log) console.warn("[ffmpeg]", m.log);
      p.reject(AppError.fromEngine(m.code));
    }
  };

  /** Download the wasm with real byte progress, then boot the worker. */
  private async fetchWasm(): Promise<string> {
    if (this.wasmBlobURL) return this.wasmBlobURL;
    const res = await fetch(WASM_URL);
    if (!res.ok || !res.body) throw new AppError("engine_load");
    const total = Number(res.headers.get("content-length")) || 32_000_000;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      this.downloadListeners.forEach((fn) => fn(loaded, Math.max(total, loaded)));
    }
    const blob = new Blob(chunks as BlobPart[], { type: "application/wasm" });
    this.wasmBlobURL = URL.createObjectURL(blob);
    return this.wasmBlobURL;
  }

  load(onDownload?: (loaded: number, total: number) => void): Promise<void> {
    if (onDownload) this.downloadListeners.add(onDownload);
    if (!this.ready) {
      this.ready = (async () => {
        const wasmURL = await this.fetchWasm();
        this.worker = new Worker("/ffmpeg-worker.js");
        this.worker.onmessage = this.onMessage;
        this.worker.onerror = () => this.failAll(new AppError("engine_load"));
        await this.call({ type: "load", wasmURL });
        // The compiled module lives in the worker now - release the blob.
        if (this.wasmBlobURL) { URL.revokeObjectURL(this.wasmBlobURL); this.wasmBlobURL = null; }
      })().catch((e) => {
        this.ready = null;
        this.terminate();
        throw e instanceof AppError ? e : new AppError("engine_load");
      });
    }
    return this.ready.finally(() => { if (onDownload) this.downloadListeners.delete(onDownload); });
  }

  get isLoaded() { return !!this.worker && !!this.ready; }

  private failAll(err: unknown) {
    this.pending.forEach((p) => p.reject(err));
    this.pending.clear();
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.mountedFile = null;
    this.mountedPath = "";
    this.busy = false;
    this.failAll(new AppError("cancelled"));
  }

  private async ensureMounted(file: File): Promise<string> {
    if (this.mountedFile === file && this.mountedPath) return this.mountedPath;
    // Re-wrap with a safe ASCII name. This is a reference, not a copy.
    const ext = (file.name.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
    const safe = new File([file], `input.${ext.toLowerCase()}`, { type: file.type });
    const r = await this.call<{ path: string }>({ type: "mount", file: safe });
    this.mountedFile = file;
    this.mountedPath = r.path;
    return r.path;
  }

  async peaks(file: File, duration: number): Promise<{ peaks: Float32Array; rate: number }> {
    await this.load();
    this.busy = true;
    try {
      const path = await this.ensureMounted(file);
      const rate = Math.max(20, Math.min(200, Math.floor(400_000 / Math.max(1, duration))));
      const r = await this.call<{ peaks: Float32Array; rate: number }>({ type: "peaks", path, rate, duration });
      return { peaks: r.peaks, rate: r.rate };
    } finally {
      this.busy = false;
    }
  }

  async convert(file: File, opts: ConvertOptions, onEvent?: (e: EngineEvent) => void): Promise<Blob> {
    // If a waveform job is still running, restart the worker so the user never waits for it.
    if (this.busy) this.terminate();
    await this.load((loaded, total) => onEvent?.({ type: "engine-download", loaded, total }));
    this.busy = true;
    try {
      const path = await this.ensureMounted(file);
      const r = await this.call<{ data: ArrayBuffer; ext: string }>({ type: "convert", path, opts }, onEvent);
      const mime = r.ext === "mp3" ? "audio/mpeg" : "audio/mp4";
      return new Blob([r.data], { type: mime });
    } finally {
      this.busy = false;
    }
  }
}

let engine: Engine | null = null;
export function getEngine() {
  if (!engine) engine = new Engine();
  return engine;
}
