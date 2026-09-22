"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Timeline, { moveEnd, moveStart, type Handle } from "../Timeline";
import { IconLoop, IconMusic, IconPause, IconPlay, IconStepBack, IconStepFwd } from "../Icons";
import { Button, TopBar } from "../ui";
import { MAX_CLIP, MIN_CLIP, clamp, fmtSeconds, fmtTime } from "@/lib/format";
import type { Envelope } from "@/lib/waveform";

export type Source =
  | { kind: "file"; file: File; url: string; name: string; isVideo: boolean; duration: number }
  | { kind: "remote"; id: string; url: string; name: string; isVideo: boolean; duration: number; size: number };

type Props = {
  source: Source;
  start: number;
  end: number;
  onSel: (start: number, end: number) => void;
  name: string;
  onName: (n: string) => void;
  envelope: Envelope | null;
  envelopeState: "loading" | "ready" | "none";
  frames: string[] | null;
  onBack: () => void;
  onSettings: () => void;
  onCreate: () => void;
  onMediaError: () => void;
};

export default function Editor(p: Props) {
  const { source, start, end, onSel } = p;
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [current, setCurrent] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loop, setLoop] = useState(false);
  const [hasPicture, setHasPicture] = useState(source.isVideo);
  const raf = useRef(0);
  const seekState = useRef<{ busy: boolean; next: number | null }>({ busy: false, next: null });
  const sel = useRef({ start, end, previewing, loop });
  sel.current = { start, end, previewing, loop };

  const dur = source.duration;
  const len = end - start;

  /* ---------- smooth seeking: never queue more than one pending seek ---------- */
  const seekTo = useCallback((t: number) => {
    const m = media.current;
    if (!m) return;
    t = clamp(t, 0, Math.max(0, dur - 0.01));
    setCurrent(t);
    const s = seekState.current;
    if (s.busy) { s.next = t; return; }
    s.busy = true;
    m.currentTime = t;
  }, [dur]);

  useEffect(() => {
    const m = media.current;
    if (!m) return;
    const onSeeked = () => {
      const s = seekState.current;
      if (s.next != null) { const n = s.next; s.next = null; m.currentTime = n; }
      else s.busy = false;
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setPreviewing(false); };
    const onMeta = () => {
      if (source.isVideo) setHasPicture((m as HTMLVideoElement).videoWidth > 0);
      m.currentTime = sel.current.start;
    };
    m.addEventListener("seeked", onSeeked);
    m.addEventListener("play", onPlay);
    m.addEventListener("pause", onPause);
    m.addEventListener("loadedmetadata", onMeta);
    if (m.readyState >= 1) onMeta();
    return () => {
      m.removeEventListener("seeked", onSeeked);
      m.removeEventListener("play", onPlay);
      m.removeEventListener("pause", onPause);
      m.removeEventListener("loadedmetadata", onMeta);
      m.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- playback clock (also enforces the preview's end) ---------- */
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const m = media.current;
      if (!m) return;
      const t = m.currentTime;
      const s = sel.current;
      if (s.previewing && t >= s.end - 0.02) {
        if (s.loop) { m.currentTime = s.start; setCurrent(s.start); }
        else { m.pause(); m.currentTime = s.start; setCurrent(s.start); setPreviewing(false); return; }
      } else setCurrent(t);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const stopPreview = () => {
    if (sel.current.previewing) { media.current?.pause(); setPreviewing(false); }
  };

  const onTimeline = (s: number, e: number, h: Handle) => {
    stopPreview();
    if (playing) media.current?.pause();
    onSel(s, e);
    seekTo(h === "end" ? e : s); // the picture follows the handle in real time
  };

  const togglePlay = () => {
    const m = media.current!;
    if (!m.paused) { m.pause(); return; }
    setPreviewing(false);
    if (m.currentTime >= dur - 0.05) m.currentTime = 0;
    void m.play().catch(() => {});
  };

  const preview = () => {
    const m = media.current!;
    if (previewing && !m.paused) { m.pause(); return; }
    setPreviewing(true);
    sel.current.previewing = true;
    m.currentTime = start;
    setCurrent(start);
    void m.play().catch(() => setPreviewing(false));
  };

  const nudge = (d: number) => {
    media.current?.pause();
    seekTo(current + d);
  };

  const nudgeStart = (d: number) => { const r = moveStart(start + d, start, end, dur, MAX_CLIP, MIN_CLIP); stopPreview(); onSel(r[0], r[1]); seekTo(r[0]); };
  const nudgeEnd = (d: number) => { const r = moveEnd(end + d, start, end, dur, MAX_CLIP, MIN_CLIP); stopPreview(); onSel(r[0], r[1]); seekTo(r[1]); };
  const startHere = () => { const r = moveStart(current, start, end, dur, MAX_CLIP, MIN_CLIP); onSel(r[0], r[1]); };
  const endHere = () => { const r = moveEnd(current, start, end, dur, MAX_CLIP, MIN_CLIP); onSel(r[0], r[1]); };

  const Mediatag = source.isVideo ? "video" : "audio";

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopBar onBack={p.onBack} onSettings={p.onSettings} />

      <div className="flex-1 w-full max-w-[40rem] mx-auto px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        {/* Player */}
        <div className="relative rounded-[1.6rem] overflow-hidden shadow-lift bg-black">
          <Mediatag
            ref={media as any}
            src={source.url + (source.kind === "file" ? "#t=0.001" : "")}
            playsInline
            preload="metadata"
            onError={p.onMediaError}
            onClick={togglePlay}
            className={source.isVideo && hasPicture ? "block w-full max-h-[36dvh] min-h-[10rem] object-contain bg-black" : "hidden"}
            aria-label="נגן"
          />
          {(!source.isVideo || !hasPicture) && (
            <div className="h-[10.5rem] flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-sky to-[#b9e4fb] text-on-accent" onClick={togglePlay}>
              <div className={`grid place-items-center h-16 w-16 rounded-3xl bg-white/50 ${playing ? "pulse-soft" : ""}`}><IconMusic size={32} /></div>
              <div className="font-bold px-6 text-center line-clamp-1">{p.name}</div>
            </div>
          )}
          <div className="absolute bottom-2.5 start-2.5 rounded-full bg-black/55 text-white text-[0.78rem] font-semibold px-2.5 py-1 tabular ltr backdrop-blur-md" aria-hidden="true">
            {fmtTime(current)}
          </div>
        </div>

        {/* Transport - media controls are not mirrored */}
        <div className="flex items-center justify-center gap-3 mt-4" dir="ltr">
          <Button variant="glass" size="sm" onClick={() => nudge(-0.1)} aria-label="דלג 0.1 שנייה אחורה" className="!rounded-full !min-w-[3.25rem] !min-h-[3.25rem]">
            <IconStepBack size={18} /><span className="text-[0.78rem] tabular">0.1</span>
          </Button>
          <Button variant="ink" onClick={togglePlay} aria-label={playing && !previewing ? "השהה" : "נגן"} className="!rounded-full !h-16 !w-16 !px-0">
            {playing && !previewing ? <IconPause size={26} /> : <IconPlay size={26} className="translate-x-[1px]" />}
          </Button>
          <Button variant="glass" size="sm" onClick={() => nudge(0.1)} aria-label="דלג 0.1 שנייה קדימה" className="!rounded-full !min-w-[3.25rem] !min-h-[3.25rem]">
            <span className="text-[0.78rem] tabular">0.1</span><IconStepFwd size={18} />
          </Button>
        </div>

        {/* Selection */}
        <section aria-labelledby="sel-title" className="glass rounded-[1.75rem] p-4 mt-4">
          <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
            <h2 id="sel-title" className="text-[1.15rem] font-bold">בחר את הקטע שלך</h2>
            <div className="text-[1.05rem] font-bold tabular ltr" aria-live="polite" aria-label={`מ־${fmtTime(start)} עד ${fmtTime(end)}`}>
              {fmtTime(start)} - {fmtTime(end)}
            </div>
          </div>

          <Timeline
            duration={dur}
            start={start}
            end={end}
            current={current}
            maxLen={MAX_CLIP}
            minLen={MIN_CLIP}
            envelope={p.envelope}
            envelopeState={p.envelopeState}
            frames={p.frames}
            onChange={onTimeline}
            onSeek={(t) => { stopPreview(); if (playing) media.current?.pause(); seekTo(t); }}
            onDragState={() => {}}
          />

          <p className="text-center mt-1 text-[1rem] font-bold">
            <span className="tabular">{fmtSeconds(len)}</span> שניות
            {len >= MAX_CLIP - 0.05 && <span className="ms-2 text-[0.8rem] font-semibold text-ink-3">(המקסימום לצלצול)</span>}
          </p>

          {/* Precise start / end */}
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            {([
              { label: "התחלה", v: start, nudgeFn: nudgeStart, here: startHere, hereLabel: "קבע התחלה במיקום הנגן" },
              { label: "סיום", v: end, nudgeFn: nudgeEnd, here: endHere, hereLabel: "קבע סיום במיקום הנגן" },
            ] as const).map((row) => (
              <div key={row.label} className="rounded-[1.25rem] bg-surface-2 border border-hairline p-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[0.85rem] font-semibold text-ink-2">{row.label}</span>
                  <span className="font-bold tabular ltr">{fmtTime(row.v)}</span>
                </div>
                <div className="flex gap-1.5 mt-2" dir="ltr">
                  <Button size="sm" variant="glass" className="flex-1 !px-1" onClick={() => row.nudgeFn(-0.1)} aria-label={`${row.label}: 0.1 שנייה אחורה`}>−0.1</Button>
                  <Button size="sm" variant="glass" className="flex-1 !px-1" onClick={() => row.nudgeFn(0.1)} aria-label={`${row.label}: 0.1 שנייה קדימה`}>+0.1</Button>
                </div>
                <button type="button" onClick={row.here} aria-label={row.hereLabel} className="pressable w-full min-h-11 mt-1.5 rounded-[0.9rem] text-[0.85rem] font-semibold text-sky-ink">
                  כאן לפי הנגן
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Preview */}
        <section className="flex gap-2.5 mt-4" aria-label="השמעה">
          <Button variant="sky" size="lg" className="flex-1" onClick={preview} aria-pressed={previewing}>
            {previewing ? <IconPause size={22} /> : <IconPlay size={22} />}
            {previewing ? "עצור" : "השמע את הצלצול"}
          </Button>
          <button
            type="button"
            onClick={() => setLoop((l) => !l)}
            aria-pressed={loop}
            aria-label="השמע בלופ"
            className={`pressable flex items-center gap-1.5 min-h-[3.6rem] px-4 rounded-[1.4rem] font-semibold border-2 ${loop ? "bg-orange-soft border-orange text-ink" : "glass border-transparent text-ink-2"}`}
          >
            <IconLoop size={20} />
            <span className="text-[0.9rem]">בלופ</span>
            {loop && <span className="sr-only">פעיל</span>}
          </button>
        </section>

        {/* Name */}
        <section className="glass rounded-[1.75rem] p-4 mt-4">
          <label htmlFor="ring-name" className="font-bold block mb-2">שם הצלצול</label>
          <input
            id="ring-name"
            type="text"
            value={p.name}
            onChange={(e) => p.onName(e.target.value)}
            placeholder="צלצול חדש"
            maxLength={60}
            dir="auto"
            enterKeyHint="done"
            className="w-full min-h-[3.2rem] rounded-[1.1rem] bg-surface-solid border border-hairline px-4 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:ring-sky/60"
          />
        </section>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pt-3 safe-bottom glass !border-x-0 !border-b-0 rounded-t-[1.75rem]">
        <div className="max-w-[40rem] mx-auto flex items-center gap-3">
          <div className="flex-none text-center leading-tight min-w-[4.5rem]" aria-live="polite">
            <div className="text-[0.75rem] text-ink-3 font-semibold">משך</div>
            <div className="text-[1.05rem] font-extrabold tabular">{fmtSeconds(len)} <span className="text-[0.8rem] font-bold">שניות</span></div>
          </div>
          <Button variant="accent" size="lg" className="flex-1" onClick={() => { media.current?.pause(); p.onCreate(); }} aria-label={`צור צלצול באורך ${fmtSeconds(len)} שניות`}>
            <span aria-hidden="true">🎵</span> צור צלצול
          </Button>
        </div>
      </div>
    </div>
  );
}
