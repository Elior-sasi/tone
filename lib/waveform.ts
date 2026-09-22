"use client";
// Waveform envelope for local files.
// Small files: decoded natively (fast, hardware) at a very low sample rate to keep memory tiny.
// Larger files: ffmpeg.wasm streams the audio via WORKERFS (see engine.peaks).

import { getEngine } from "./engine";

export type Envelope = { peaks: Float32Array; rate: number };

const NATIVE_LIMIT = 60 * 1024 * 1024;

async function nativeEnvelope(file: File, duration: number): Promise<Envelope | null> {
  const Ctx: typeof OfflineAudioContext | undefined = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!Ctx) return null;
  const sr = 3000; // lowest rate Safari accepts; plenty for a visual envelope
  let ctx: OfflineAudioContext;
  try { ctx = new Ctx(1, 1, sr); } catch { return null; }
  const buf = await file.arrayBuffer();
  const audio: AudioBuffer = await new Promise((res, rej) => {
    const p = ctx.decodeAudioData(buf, res, rej);
    if (p && typeof (p as any).then === "function") (p as Promise<AudioBuffer>).then(res, rej);
  });
  const rate = Math.max(20, Math.min(200, Math.floor(400_000 / Math.max(1, duration))));
  const step = audio.sampleRate / rate;
  const n = Math.floor(audio.length / step);
  const out = new Float32Array(n);
  const chans = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step), b = Math.min(audio.length, Math.floor((i + 1) * step));
    let sum = 0;
    for (let j = a; j < b; j++) {
      let v = 0;
      for (const c of chans) v += Math.abs(c[j]);
      sum += v / chans.length;
    }
    out[i] = sum / Math.max(1, b - a);
  }
  return { peaks: out, rate };
}

export async function localEnvelope(file: File, duration: number): Promise<Envelope | null> {
  if (file.size <= NATIVE_LIMIT) {
    try {
      const env = await nativeEnvelope(file, duration);
      if (env && env.peaks.length) return env;
    } catch {}
  }
  if (duration > 45 * 60) return null; // not worth the CPU on very long files
  try {
    return await getEngine().peaks(file, duration);
  } catch {
    return null;
  }
}
