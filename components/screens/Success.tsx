"use client";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconDownload, IconPause, IconPlay, IconPlus, IconShare } from "../Icons";
import { Button, TopBar } from "../ui";
import { MESSAGES } from "@/lib/errors";
import { fmtTime } from "@/lib/format";

export type Result = {
  blob: Blob;
  url: string;
  file: File | null; // shareable File, when the browser supports sharing files
  duration: number;
  ext: "m4a" | "mp3";
  name: string;
};

type Props = {
  result: Result;
  isIPhone: boolean;
  onBack: () => void;
  onNew: () => void;
  onSettings: () => void;
  onHelp: () => void;
  mp3: { state: "idle" | "working" | "ready" | "error"; url?: string };
  onMakeMp3: () => void;
};

export function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function MiniPlayer({ url, name, duration }: { url: string; name: string; duration: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(duration);
  useEffect(() => {
    const a = ref.current!;
    const up = () => setT(a.currentTime);
    const meta = () => { if (isFinite(a.duration) && a.duration > 0) setD(a.duration); };
    const on = () => setPlaying(true);
    const off = () => setPlaying(false);
    a.addEventListener("timeupdate", up);
    a.addEventListener("loadedmetadata", meta);
    a.addEventListener("play", on);
    a.addEventListener("pause", off);
    a.addEventListener("ended", off);
    return () => { a.pause(); ["timeupdate", "loadedmetadata", "play", "pause", "ended"].forEach((e) => a.removeEventListener(e, e === "timeupdate" ? up : e === "loadedmetadata" ? meta : e === "play" ? on : off)); };
  }, []);
  const toggle = () => { const a = ref.current!; if (a.paused) void a.play(); else a.pause(); };
  const pct = d ? (t / d) * 100 : 0;
  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] bg-surface-2 border border-hairline p-2.5">
      <audio ref={ref} src={url} preload="metadata" />
      <button type="button" onClick={toggle} aria-label={playing ? `השהה את ${name}` : `נגן את ${name}`} className="pressable grid place-items-center h-[48px] w-[48px] flex-none rounded-full bg-ink text-bg">
        {playing ? <IconPause size={20} /> : <IconPlay size={20} className="translate-x-[1px]" />}
      </button>
      <div className="flex-1 min-w-0" dir="ltr">
        <div className="h-1.5 rounded-full bg-track overflow-hidden"><div className="h-full bg-orange rounded-full" style={{ width: `${pct}%` }} /></div>
        <div className="flex flex-wrap justify-between gap-x-3 mt-1 text-[0.75rem] text-ink-3 tabular"><span>{fmtTime(t)}</span><span>{fmtTime(d)}</span></div>
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ["var(--orange)", "var(--sky)", "var(--ink)"];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-10 h-0" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        const r = 90 + (i % 3) * 30;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-0 h-2.5 w-1.5 rounded-sm"
            style={{
              background: colors[i % 3],
              ["--dx" as any]: `${Math.cos(a) * r}px`,
              ["--dy" as any]: `${Math.sin(a) * r * 0.8 + 40}px`,
              ["--rot" as any]: `${i * 47}deg`,
              animation: `confetti 1100ms cubic-bezier(.2,.7,.3,1) ${120 + (i % 5) * 30}ms both`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Success({ result, isIPhone, onBack, onNew, onSettings, onHelp, mp3, onMakeMp3 }: Props) {
  const [shareError, setShareError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const filename = `${result.name}.${result.ext}`;
  const canShare = !!result.file;

  // Must run synchronously inside the tap - Safari requires a direct user gesture.
  const share = () => {
    setShareError(null);
    if (!result.file) { setShareError(MESSAGES.share_blocked.body); return; }
    navigator
      .share({ files: [result.file], title: result.name })
      .catch((err: DOMException) => {
        if (err?.name === "AbortError") return; // user closed the sheet
        setShareError(MESSAGES.share_blocked.body);
      });
  };

  const save = () => {
    downloadUrl(result.url, filename);
    setSaved(true);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopBar onBack={onBack} onSettings={onSettings} backLabel="עריכה" />
      <div className="flex-1 w-full max-w-[32rem] mx-auto px-4 pb-10">
        <div className="relative text-center pt-4">
          <Confetti />
          <div className="mx-auto grid place-items-center h-20 w-20 rounded-full bg-success text-white shadow-lift pop">
            <IconCheck size={40} />
          </div>
          <h1 className="mt-4 text-[1.75rem] font-extrabold" tabIndex={-1} data-autofocus>
            {isIPhone ? <>הצלצול שלך מוכן <span aria-hidden="true">🎉</span></> : "הצלצול מוכן להורדה"}
          </h1>
        </div>

        <section className="glass rounded-[1.75rem] p-3 mt-5" aria-label="הצלצול">
          <div className="font-bold text-[1.1rem] truncate px-1.5 mb-2" dir="auto">{result.name}</div>
          <MiniPlayer url={result.url} name={result.name} duration={result.duration} />
        </section>

        <div className="flex flex-col gap-2.5 mt-5">
          {isIPhone ? (
            <>
              <Button variant="accent" size="lg" full onClick={share} aria-label="השתמש כצלצול - פותח את גיליון השיתוף">
                <IconShare size={22} /> השתמש כצלצול
              </Button>
              <p className="text-center text-[0.92rem] text-ink-2 px-2">בחלון שנפתח בחר ״השתמש כצלצול״.</p>
            </>
          ) : (
            <Button variant="accent" size="lg" full onClick={save}>
              <IconDownload size={22} /> הורד את הצלצול
            </Button>
          )}
          {shareError && (
            <p role="alert" className="rounded-[1rem] bg-orange-soft p-3 text-[0.92rem] leading-relaxed">{shareError}</p>
          )}
        </div>

        {isIPhone && (shareError || !canShare) && (
          <section className="rounded-[1.25rem] bg-sky-soft p-3.5 mt-4 enter-up" aria-labelledby="fallback">
            <h2 id="fallback" className="font-bold">דרך חלופית</h2>
            <ol className="mt-1.5 flex flex-col gap-1 list-decimal ps-6 text-[0.95rem] leading-relaxed">
              <li>לחץ ״שמור לקבצים״ למטה.</li>
              <li>באפליקציית ״קבצים״ לחץ לחיצה ארוכה על הצלצול.</li>
              <li>בחר ״שתף״ ואז ״השתמש כצלצול״.</li>
            </ol>
          </section>
        )}

        {/* Secondary actions - quiet */}
        <div className="flex flex-wrap gap-2 mt-6">
          {isIPhone ? (
            <Button variant="glass" className="flex-[1_0_auto]" onClick={save}>
              {saved ? <IconCheck size={18} /> : <IconDownload size={18} />} {saved ? "נשמר" : "שמור לקבצים"}
            </Button>
          ) : canShare ? (
            <Button variant="glass" className="flex-[1_0_auto]" onClick={share}><IconShare size={18} /> שתף</Button>
          ) : null}
          <Button variant="glass" onClick={onNew} className="flex-[1_0_auto]">
            <IconPlus size={18} /> צלצול חדש
          </Button>
        </div>

        <div className="flex flex-col items-center gap-1 mt-3">
          {isIPhone && canShare && !shareError && (
            <button type="button" onClick={onHelp} className="pressable min-h-11 px-3 font-semibold text-sky-ink">
              לא מופיע ״השתמש כצלצול״?
            </button>
          )}
          {result.ext === "m4a" && (
            mp3.state === "ready" && mp3.url ? (
              <button type="button" onClick={() => downloadUrl(mp3.url!, `${result.name}.mp3`)} className="pressable min-h-11 px-3 font-semibold text-ink-2 flex items-center gap-1.5">
                <IconDownload size={16} /> הורד MP3
              </button>
            ) : (
              <button type="button" onClick={onMakeMp3} disabled={mp3.state === "working"} aria-busy={mp3.state === "working"} className="pressable min-h-11 px-3 font-semibold text-ink-2 flex items-center gap-1.5 disabled:opacity-60">
                {mp3.state === "working" && <span className="h-4 w-4 rounded-full border-2 border-ink border-t-transparent spin" aria-hidden="true" />}
                {mp3.state === "working" ? "יוצר MP3…" : mp3.state === "error" ? "יצירת MP3 נכשלה - נסה שוב" : "צריך גם MP3?"}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
