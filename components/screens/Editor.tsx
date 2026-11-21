"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Timeline, { moveEnd, moveStart, type Handle } from "../Timeline";
import { IconChevronDown, IconMusic, IconPause, IconPlay, IconPencil } from "../Icons";
import { Button, Switch, TopBar } from "../ui";
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
  const [fine, setFine] = useState(false);
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

  const nudgeStart = (d: number) => { const r = moveStart(start + d, start, end, dur, MAX_CLIP, MIN_CLIP); stopPreview(); onSel(r[0], r[1]); seekTo(r[0]); };
  const nudgeEnd = (d: number) => { const r = moveEnd(end + d, start, end, dur, MAX_CLIP, MIN_CLIP); stopPreview(); onSel(r[0], r[1]); seekTo(r[1]); };
  const startHere = () => { const r = moveStart(current, start, end, dur, MAX_CLIP, MIN_CLIP); onSel(r[0], r[1]); };
  const endHere = () => { const r = moveEnd(current, start, end, dur, MAX_CLIP, MIN_CLIP); onSel(r[0], r[1]); };

  const Mediatag = source.isVideo ? "video" : "audio";
  const freePlaying = playing && !previewing;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopBar onBack={p.onBack} onSettings={p.onSettings} />

      <div className="flex-1 w-full max-w-[40rem] mx-auto px-4 pb-6">
        {/* Player - tap to play / pause */}
        <div className="relative rounded-[1.6rem] overflow-hidden shadow-lift bg-black">
          <Mediatag
            ref={media as any}
            src={source.url + (source.kind === "file" ? "#t=0.001" : "")}
            playsInline
            preload="metadata"
            onError={p.onMediaError}
            className={source.isVideo && hasPicture ? "block w-full max-h-[34dvh] min-h-[9rem] object-contain bg-black" : "hidden"}
            aria-hidden="true"
          />
          {(!source.isVideo || !hasPicture) && (
            <div className="h-[9rem] grid place-items-center bg-gradient-to-br from-sky to-[#b9e4fb] text-on-accent">
              <div className={`grid place-items-center h-16 w-16 rounded-3xl bg-white/50 ${playing ? "pulse-soft" : ""}`}><IconMusic size={32} /></div>
            </div>
          )}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={freePlaying ? "השהה" : "נגן מהמיקום הנוכחי"}
            className="absolute inset-0 grid place-items-center"
          >
            {!freePlaying && (
              <span className="grid place-items-center h-[64px] w-[64px] rounded-full bg-black/45 text-white backdrop-blur-md" aria-hidden="true">
                <IconPlay size={28} className="translate-x-[2px]" />
              </span>
            )}
          </button>
          <div className="absolute bottom-2.5 start-2.5 rounded-full bg-black/55 text-white text-[0.85rem] font-semibold px-2.5 py-1 tabular ltr backdrop-blur-md pointer-events-none" aria-hidden="true">
            {fmtTime(current)}
          </div>
        </div>

        {/* Name - inline, no extra card */}
        <label className="mt-3 flex items-center gap-2 min-h-[3.2rem] rounded-[1.1rem] bg-surface-solid border border-hairline px-4 focus-within:ring-4 focus-within:ring-sky/60">
          <span className="sr-only">שם הצלצול</span>
          <IconPencil size={18} className="flex-none text-ink-3" />
          <input
            type="text"
            value={p.name}
            onChange={(e) => p.onName(e.target.value)}
            placeholder="שם הצלצול"
            maxLength={60}
            dir="auto"
            enterKeyHint="done"
            className="flex-1 min-w-0 bg-transparent font-bold text-ink placeholder:text-ink-3 focus:outline-none"
          />
        </label>

        {/* Selection */}
        <section aria-labelledby="sel-title" className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2.5 px-1">
            <h2 id="sel-title" className="text-[1.1rem] font-bold">גרור לבחירת הקטע</h2>
            <div className="text-[1rem] font-bold tabular whitespace-nowrap" aria-live="polite">
              <span className="ltr">{fmtSeconds(len)}</span> שנ׳
              {len >= MAX_CLIP - 0.05 && <span className="sr-only"> - המקסימום לצלצול</span>}
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

          {/* Fine tuning - hidden until needed */}
          <button
            type="button"
            onClick={() => setFine((f) => !f)}
            aria-expanded={fine}
            aria-controls="fine-panel"
            className="pressable mt-2 w-full flex items-center justify-between gap-3 min-h-12 px-4 py-2 rounded-[1.1rem] glass font-semibold text-start"
          >
            <span className="flex flex-wrap items-center gap-x-2 min-w-0">
              <span className="whitespace-nowrap">כוונון מדויק</span>
              <span className="text-ink-3 font-medium tabular ltr text-[0.9rem] whitespace-nowrap">{fmtTime(start)} - {fmtTime(end)}</span>
            </span>
            <IconChevronDown size={20} className={`flex-none transition-transform ${fine ? "rotate-180" : ""}`} />
          </button>

          {fine && (
            <div id="fine-panel" className="glass rounded-[1.25rem] mt-2 p-2 flex flex-col gap-1 enter-up">
              {([
                { label: "התחלה", v: start, nudgeFn: nudgeStart, here: startHere },
                { label: "סיום", v: end, nudgeFn: nudgeEnd, here: endHere },
              ] as const).map((row) => (
                <div key={row.label} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 p-1">
                  <div className="flex-[1_0_auto] flex items-baseline gap-2 ps-1">
                    <span className="text-[0.85rem] font-semibold text-ink-2">{row.label}</span>
                    <span className="font-bold tabular ltr whitespace-nowrap">{fmtTime(row.v)}</span>
                  </div>
                  <div className="flex-[1_1_12rem] min-w-0 flex gap-1.5" dir="ltr">
                    <Button size="sm" variant="glass" className="flex-1 min-w-0 !px-1 tabular whitespace-nowrap" onClick={() => row.nudgeFn(-0.1)} aria-label={`${row.label}: 0.1 שנייה אחורה`}>−0.1</Button>
                    <Button size="sm" variant="glass" className="flex-1 min-w-0 !px-1 tabular whitespace-nowrap" onClick={() => row.nudgeFn(0.1)} aria-label={`${row.label}: 0.1 שנייה קדימה`}>+0.1</Button>
                    <Button size="sm" variant="ghost" className="flex-1 min-w-0 !px-1 text-sky-ink whitespace-nowrap" onClick={row.here} aria-label={`קבע ${row.label} במיקום הנגן`}>כאן</Button>
                  </div>
                </div>
              ))}
              <div className="border-t border-hairline mt-1 px-2">
                <Switch checked={loop} onChange={setLoop} label="השמעה בלופ" description="ההשמעה חוזרת על הקטע שוב ושוב" />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Bottom action bar: listen + create */}
      <div className="sticky bottom-0 z-30 px-3 pt-3 safe-bottom glass !border-x-0 !border-b-0 rounded-t-[1.75rem]">
        <div className="max-w-[40rem] mx-auto flex flex-wrap-reverse items-center gap-2.5">
          <Button
            variant="sky"
            size="lg"
            className="flex-[1_0_auto] !px-4 whitespace-nowrap"
            onClick={preview}
            aria-pressed={previewing}
            aria-label={previewing ? "עצור השמעה" : "השמע את הקטע שנבחר"}
          >
            {previewing ? <IconPause size={22} /> : <IconPlay size={22} />}
            <span>{previewing ? "עצור" : "השמע"}</span>
          </Button>
          <Button variant="accent" size="lg" className="flex-[3_0_auto] whitespace-nowrap" onClick={() => { media.current?.pause(); p.onCreate(); }} aria-label={`צור צלצול באורך ${fmtSeconds(len)} שניות`}>
            צור צלצול
          </Button>
        </div>
      </div>
    </div>
  );
}
