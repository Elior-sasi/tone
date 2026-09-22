"use client";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconDownload, IconInfo, IconMusic, IconPause, IconPlay, IconPlus, IconShare } from "../Icons";
import { Button, TopBar } from "../ui";
import { MESSAGES } from "@/lib/errors";
import { fmtBytes, fmtSeconds, fmtTime } from "@/lib/format";

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
      <button type="button" onClick={toggle} aria-label={playing ? `השהה את ${name}` : `נגן את ${name}`} className="pressable grid place-items-center h-12 w-12 flex-none rounded-full bg-ink text-bg">
        {playing ? <IconPause size={20} /> : <IconPlay size={20} className="translate-x-[1px]" />}
      </button>
      <div className="flex-1 min-w-0" dir="ltr">
        <div className="h-1.5 rounded-full bg-track overflow-hidden"><div className="h-full bg-orange rounded-full" style={{ width: `${pct}%` }} /></div>
        <div className="flex justify-between mt-1 text-[0.75rem] text-ink-3 tabular"><span>{fmtTime(t)}</span><span>{fmtTime(d)}</span></div>
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

        <section className="glass rounded-[1.75rem] p-4 mt-5" aria-label="פרטי הצלצול">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-12 w-12 flex-none rounded-2xl bg-orange-soft"><IconMusic size={24} /></div>
            <div className="min-w-0">
              <div className="font-bold text-[1.1rem] truncate" dir="auto">{result.name}</div>
              <div className="text-[0.9rem] text-ink-2">
                משך: <span className="tabular">{fmtSeconds(result.duration)}</span> שניות · פורמט: <span className="ltr">{result.ext.toUpperCase()}</span> · <span className="tabular ltr">{fmtBytes(result.blob.size)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3"><MiniPlayer url={result.url} name={result.name} duration={result.duration} /></div>
        </section>

        <div className="flex flex-col gap-2.5 mt-5">
          {isIPhone ? (
            <>
              <Button variant="accent" size="lg" full onClick={share} aria-label="שתף והשתמש כצלצול - פותח את גיליון השיתוף">
                <IconShare size={22} /> שתף והשתמש כצלצול
              </Button>
              <Button variant="glass" size="lg" full onClick={save}>
                <IconDownload size={20} /> שמור לקבצים
              </Button>
            </>
          ) : (
            <>
              <Button variant="accent" size="lg" full onClick={save}>
                <IconDownload size={22} /> הורד את הצלצול
              </Button>
              {canShare && (
                <Button variant="glass" size="lg" full onClick={share}>
                  <IconShare size={20} /> שתף
                </Button>
              )}
            </>
          )}
          {shareError && (
            <p role="alert" className="rounded-[1rem] bg-orange-soft p-3 text-[0.92rem] leading-relaxed">{shareError}</p>
          )}
        </div>

        {isIPhone && (
          <section className="glass rounded-[1.75rem] p-4 mt-5" aria-labelledby="howto">
            <h2 id="howto" className="font-bold flex items-center gap-2"><IconInfo size={18} /> באייפון עם iOS 26 ומעלה:</h2>
            <ol className="mt-2 flex flex-col gap-1.5 list-decimal ps-6 text-ink-2 leading-relaxed">
              <li>לחץ על ״שתף והשתמש כצלצול״.</li>
              <li>בגיליון השיתוף חפש ״השתמש כצלצול״.</li>
              <li>אם הוא לא מופיע מיד, לחץ על ״עוד״.</li>
            </ol>
            {(saved || shareError || !canShare) ? (
              <div className="mt-4 rounded-[1.25rem] bg-sky-soft p-3.5 enter-up">
                <h3 className="font-bold">לא מופיע ״השתמש כצלצול״?</h3>
                <ol className="mt-1.5 flex flex-col gap-1 list-decimal ps-6 text-[0.95rem] leading-relaxed">
                  <li>שמור את הקובץ ב״קבצים״.</li>
                  <li>פתח את אפליקציית ״קבצים״.</li>
                  <li>לחץ לחיצה ארוכה על הצלצול.</li>
                  <li>בחר ״שתף״.</li>
                  <li>בחר ״השתמש כצלצול״.</li>
                </ol>
              </div>
            ) : (
              <button type="button" onClick={onHelp} className="pressable mt-2 min-h-11 font-semibold text-sky-ink">
                לא מופיע ״השתמש כצלצול״?
              </button>
            )}
          </section>
        )}

        <div className="flex flex-col gap-2 mt-5">
          {result.ext === "m4a" && (
            mp3.state === "ready" && mp3.url ? (
              <Button variant="ghost" full onClick={() => downloadUrl(mp3.url!, `${result.name}.mp3`)}>
                <IconDownload size={18} /> שמור גם כ־MP3
              </Button>
            ) : (
              <Button variant="ghost" full onClick={onMakeMp3} disabled={mp3.state === "working"} aria-busy={mp3.state === "working"}>
                {mp3.state === "working" ? <span className="h-4 w-4 rounded-full border-2 border-ink border-t-transparent spin" aria-hidden="true" /> : <IconMusic size={18} />}
                {mp3.state === "working" ? "יוצר MP3…" : mp3.state === "error" ? "יצירת MP3 נכשלה - נסה שוב" : "צור גם קובץ MP3 (גיבוי)"}
              </Button>
            )
          )}
          <Button variant="ghost" full onClick={onNew}>
            <IconPlus size={18} /> צלצול חדש
          </Button>
        </div>
      </div>
    </div>
  );
}
