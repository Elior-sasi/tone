"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clamp, fmtTime } from "@/lib/format";
import type { Envelope } from "@/lib/waveform";

export type Handle = "start" | "end" | "move";

type Props = {
  duration: number;
  start: number;
  end: number;
  current: number;
  maxLen: number;
  minLen: number;
  envelope: Envelope | null;
  envelopeState: "loading" | "ready" | "none";
  frames: string[] | null;
  onChange: (start: number, end: number, handle: Handle) => void;
  onSeek: (t: number, scrubbing: boolean) => void;
  onDragState: (dragging: boolean) => void;
};

/* ---------- selection rules ---------- */
export function moveStart(ns: number, s: number, e: number, dur: number, max: number, min: number): [number, number] {
  ns = clamp(ns, 0, Math.max(0, dur - min));
  let ne = e;
  const atMax = e - s >= max - 0.05;
  if (atMax && ns > s) ne = ns + max; // spec: window stays at max length when start moves forward
  if (ne - ns > max) ne = ns + max;
  if (ne - ns < min) ne = ns + min;
  if (ne > dur) { ne = dur; ns = Math.min(ns, ne - min); }
  return [Math.max(0, ns), ne];
}
export function moveEnd(ne: number, s: number, e: number, dur: number, max: number, min: number): [number, number] {
  ne = clamp(ne, Math.min(min, dur), dur);
  let ns = s;
  if (ne - ns > max) ns = ne - max;
  if (ne - ns < min) ns = ne - min;
  if (ns < 0) { ns = 0; ne = Math.max(ne, Math.min(min, dur)); }
  return [ns, ne];
}
export function moveWindow(ns: number, s: number, e: number, dur: number): [number, number] {
  const len = e - s;
  ns = clamp(ns, 0, Math.max(0, dur - len));
  return [ns, ns + len];
}

function viewFor(start: number, end: number, duration: number): [number, number] {
  if (duration <= 40) return [0, duration];
  const span = Math.min(duration, Math.max(45, (end - start) * 1.6));
  const c = (start + end) / 2;
  const vs = clamp(c - span / 2, 0, duration - span);
  return [vs, vs + span];
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#000";
}

export default function Timeline(p: Props) {
  const { duration, start, end, current, maxLen, minLen, envelope, envelopeState, frames } = p;
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<null | Handle | "scrub" | "overview">(null);
  const [view, setView] = useState<[number, number]>(() => viewFor(start, end, duration));
  const viewAnim = useRef<number>(0);

  // Keep the zoomed view centered on the selection (animated), but freeze it while dragging.
  useEffect(() => {
    if (dragging && dragging !== "overview") return;
    const target = viewFor(start, end, duration);
    if (dragging === "overview") { setView(target); return; }
    cancelAnimationFrame(viewAnim.current);
    const from = view;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 260);
      const ease = 1 - Math.pow(1 - k, 3);
      setView([from[0] + (target[0] - from[0]) * ease, from[1] + (target[1] - from[1]) * ease]);
      if (k < 1) viewAnim.current = requestAnimationFrame(step);
    };
    viewAnim.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(viewAnim.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, duration, dragging]);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const [vs, ve] = view;
  const span = Math.max(0.001, ve - vs);
  const x = useCallback((t: number) => ((t - vs) / span) * width, [vs, span, width]);

  const norm = useMemo(() => {
    if (!envelope) return 1;
    const sorted = Array.from(envelope.peaks.filter((_, i) => i % 7 === 0)).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.985)] || sorted[sorted.length - 1] || 1;
  }, [envelope]);

  // Waveform drawing
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const f = () => setThemeTick((n) => n + 1);
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !width) return;
    const h = c.clientHeight;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(width * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, h);
    const inkIn = cssVar("--ink");
    const inkOut = cssVar("--ink-3");
    const mid = h / 2;
    if (!envelope) {
      g.fillStyle = inkOut;
      g.globalAlpha = 0.35;
      g.fillRect(0, mid - 1, width, 2);
      return;
    }
    const barW = 2, gap = 1.5, stepPx = barW + gap;
    const { peaks, rate } = envelope;
    for (let px = 0; px < width; px += stepPx) {
      const t0 = vs + (px / width) * span;
      const t1 = vs + ((px + stepPx) / width) * span;
      const i0 = Math.max(0, Math.floor(t0 * rate));
      const i1 = Math.min(peaks.length, Math.max(i0 + 1, Math.ceil(t1 * rate)));
      let m = 0;
      for (let i = i0; i < i1; i++) if (peaks[i] > m) m = peaks[i];
      const amp = Math.min(1, m / norm);
      const bh = Math.max(2, Math.pow(amp, 0.8) * (h - 14));
      const tc = (t0 + t1) / 2;
      const inside = tc >= start && tc <= end;
      g.globalAlpha = inside ? 0.9 : 0.4;
      g.fillStyle = inside ? inkIn : inkOut;
      const y = mid - bh / 2;
      g.beginPath();
      (g as any).roundRect ? (g as any).roundRect(px, y, barW, bh, 1) : g.rect(px, y, barW, bh);
      g.fill();
    }
  }, [envelope, width, vs, span, start, end, norm, themeTick]);

  /* ---------- pointer handling (touch + mouse + pen) ---------- */
  const drag = useRef<{ kind: Handle | "scrub" | "overview"; x0: number; s0: number; e0: number; moved: boolean; pps: number; ow: number } | null>(null);

  const tAtTrack = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return clamp(vs + ((clientX - r.left) / r.width) * span, 0, duration);
  };

  const onTrackDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const role = (e.target as HTMLElement).closest<HTMLElement>("[data-role]")?.dataset.role as Handle | undefined;
    const kind: Handle | "scrub" = role === "start" || role === "end" || role === "move" ? role : "scrub";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, x0: e.clientX, s0: start, e0: end, moved: false, pps: width / span, ow: 0 };
    setDragging(kind);
    p.onDragState(true);
    if (kind === "scrub") p.onSeek(tAtTrack(e.clientX), true);
    e.preventDefault();
  };

  const onTrackMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.kind === "overview") return;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 3) d.moved = true;
    const dt = dx / d.pps;
    if (d.kind === "scrub") { p.onSeek(tAtTrack(e.clientX), true); return; }
    let r: [number, number];
    if (d.kind === "start") r = moveStart(d.s0 + dt, d.s0, d.e0, duration, maxLen, minLen);
    else if (d.kind === "end") r = moveEnd(d.e0 + dt, d.s0, d.e0, duration, maxLen, minLen);
    else r = moveWindow(d.s0 + dt, d.s0, d.e0, duration);
    p.onChange(r[0], r[1], d.kind);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    p.onDragState(false);
    if (!d) return;
    if (d.kind === "scrub") p.onSeek(tAtTrack(e.clientX), false);
    // A tap (no drag) inside the selection just moves the playhead there.
    else if (d.kind === "move" && !d.moved) p.onSeek(tAtTrack(e.clientX), false);
  };

  // Overview (whole media) - drag the window across long videos quickly.
  const onOverviewDown = (e: React.PointerEvent) => {
    const el = overviewRef.current!;
    const r = el.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * duration;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    let s0 = start, e0 = end;
    if (t < start || t > end) {
      [s0, e0] = moveWindow(t - (end - start) / 2, start, end, duration);
      p.onChange(s0, e0, "move");
    }
    drag.current = { kind: "overview", x0: e.clientX, s0, e0, moved: false, pps: 0, ow: r.width };
    setDragging("overview");
    p.onDragState(true);
    e.preventDefault();
  };
  const onOverviewMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.kind !== "overview") return;
    const dt = ((e.clientX - d.x0) / d.ow) * duration;
    const r = moveWindow(d.s0 + dt, d.s0, d.e0, duration);
    p.onChange(r[0], r[1], "move");
  };

  /* ---------- keyboard / VoiceOver fine control ---------- */
  const onKey = (kind: Handle) => (e: React.KeyboardEvent) => {
    const big = e.shiftKey ? 1 : 0.1;
    let delta = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = big;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -big;
    else if (e.key === "PageUp") delta = 5;
    else if (e.key === "PageDown") delta = -5;
    else return;
    e.preventDefault();
    let r: [number, number];
    if (kind === "start") r = moveStart(start + delta, start, end, duration, maxLen, minLen);
    else if (kind === "end") r = moveEnd(end + delta, start, end, duration, maxLen, minLen);
    else r = moveWindow(start + delta, start, end, duration);
    p.onChange(r[0], r[1], kind);
  };

  const xs = x(start), xe = x(end), xc = x(current);
  const showOverview = duration > 40;

  const ticks = useMemo(() => {
    const n = width < 360 ? 3 : 4;
    return Array.from({ length: n + 1 }, (_, i) => vs + (span * i) / n);
  }, [vs, span, width]);

  return (
    <div className="ltr select-none" dir="ltr">
      {showOverview && (
        <div
          ref={overviewRef}
          className="relative h-11 mb-3 rounded-[0.9rem] overflow-hidden bg-track touch-none cursor-pointer"
          onPointerDown={onOverviewDown}
          onPointerMove={onOverviewMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-hidden="true"
        >
          {frames && frames.length > 0 && (
            <div className="absolute inset-0 flex">
              {frames.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={f} alt="" className="h-full flex-1 min-w-0 object-cover" draggable={false} />
              ))}
            </div>
          )}
          <div className="absolute inset-0 bg-bg/35" />
          <div className="absolute inset-y-0 bg-white/10 border-y-0" style={{ left: `${(vs / duration) * 100}%`, width: `${(span / duration) * 100}%` }} />
          <div
            className="absolute inset-y-0 rounded-[0.6rem] border-[3px] border-orange bg-orange/15"
            style={{ left: `${(start / duration) * 100}%`, width: `max(10px, ${((end - start) / duration) * 100}%)` }}
          />
          <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `${(current / duration) * 100}%` }} />
        </div>
      )}

      <div
        ref={trackRef}
        className="relative h-[5.5rem] rounded-[1.1rem] bg-surface-2 border border-hairline touch-none cursor-pointer overflow-visible"
        onPointerDown={onTrackDown}
        onPointerMove={onTrackMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-[1.1rem]" aria-hidden="true" />
        {envelopeState === "loading" && (
          <div className="absolute inset-x-0 bottom-1.5 text-center text-[0.72rem] text-ink-3 pointer-events-none" dir="rtl">טוען גל קול…</div>
        )}

        {/* dimmed outside-selection areas (pattern + shade, not color alone) */}
        <div className="absolute inset-y-0 left-0 rounded-s-[1.1rem] bg-bg/65 pointer-events-none" style={{ width: Math.max(0, xs) }} aria-hidden="true" />
        <div className="absolute inset-y-0 right-0 rounded-e-[1.1rem] bg-bg/65 pointer-events-none" style={{ width: Math.max(0, width - xe) }} aria-hidden="true" />

        {/* selection body */}
        <div
          data-role="move"
          role="slider"
          tabIndex={0}
          aria-label="מיקום הקטע"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration * 10) / 10}
          aria-valuenow={Math.round(start * 10) / 10}
          aria-valuetext={`מ־${fmtTime(start)} עד ${fmtTime(end)}`}
          onKeyDown={onKey("move")}
          className={`absolute -inset-y-[3px] border-y-[3px] border-orange cursor-grab ${dragging === "move" ? "cursor-grabbing bg-orange/10" : ""}`}
          style={{ left: xs, width: Math.max(0, xe - xs) }}
        />

        {/* start handle */}
        <div
          data-role="start"
          role="slider"
          tabIndex={0}
          aria-label="נקודת התחלה"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration * 10) / 10}
          aria-valuenow={Math.round(start * 10) / 10}
          aria-valuetext={`התחלה ${fmtTime(start)}`}
          onKeyDown={onKey("start")}
          className="absolute -inset-y-[3px] w-11 -translate-x-full flex justify-end cursor-ew-resize z-10"
          style={{ left: xs + 3 }}
        >
          <div className={`h-full w-4 rounded-l-[0.8rem] bg-orange grid place-items-center shadow-soft transition-transform ${dragging === "start" ? "scale-x-125" : ""}`}>
            <div className="h-7 w-1 rounded-full bg-on-accent/80" />
          </div>
        </div>

        {/* end handle */}
        <div
          data-role="end"
          role="slider"
          tabIndex={0}
          aria-label="נקודת סיום"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration * 10) / 10}
          aria-valuenow={Math.round(end * 10) / 10}
          aria-valuetext={`סיום ${fmtTime(end)}`}
          onKeyDown={onKey("end")}
          className="absolute -inset-y-[3px] w-11 flex justify-start cursor-ew-resize z-10"
          style={{ left: xe - 3 }}
        >
          <div className={`h-full w-4 rounded-r-[0.8rem] bg-orange grid place-items-center shadow-soft transition-transform ${dragging === "end" ? "scale-x-125" : ""}`}>
            <div className="h-7 w-1 rounded-full bg-on-accent/80" />
          </div>
        </div>

        {/* playhead */}
        {xc >= -1 && xc <= width + 1 && (
          <div className="absolute -top-2 -bottom-2 w-0 pointer-events-none z-20" style={{ left: xc }} aria-hidden="true">
            <div className="absolute inset-y-0 -left-[1px] w-[2px] rounded-full bg-ink" />
            <div className="absolute -top-1 -left-[6px] h-3 w-3 rounded-full bg-ink border-2 border-bg" />
          </div>
        )}
      </div>

      <div className="relative h-5 mt-1.5 text-[0.72rem] text-ink-3 tabular" aria-hidden="true">
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute top-0"
            style={{ left: `${(i / (ticks.length - 1)) * 100}%`, transform: `translateX(${i === 0 ? "0" : i === ticks.length - 1 ? "-100%" : "-50%"})` }}
          >
            {fmtTime(t).replace(/\.\d$/, "")}
          </span>
        ))}
      </div>
    </div>
  );
}
