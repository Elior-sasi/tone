"use client";
import { useRef, useState } from "react";
import { BrandMark, IconAddHome, IconClose, IconLink, IconLock, IconMusic, IconVideo } from "../Icons";
import { Button, TopBar } from "../ui";

type Props = {
  onFile: (f: File) => void;
  onUrl: (url: string) => void;
  onSettings: () => void;
  showInstall: boolean;
  onInstall: () => void;
  onDismissInstall: () => void;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
};

export const VIDEO_ACCEPT = "video/*,.mp4,.mov,.m4v,.webm";
export const AUDIO_ACCEPT = "audio/*,.mp3,.m4a,.aac,.wav";

export default function Home({ onFile, onUrl, onSettings, showInstall, onInstall, onDismissInstall, videoInputRef }: Props) {
  const audioRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onFile(f);
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
    >
      <TopBar onSettings={onSettings} title={false} />

      <div className="flex-1 flex flex-col w-full max-w-[34rem] mx-auto px-4">
        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center text-center pt-4 pb-8 min-h-[13rem]">
          <div className="pop">
            <BrandMark size={84} className="drop-shadow-[0_18px_30px_rgba(30,120,190,0.35)] rounded-[1.4rem]" />
          </div>
          <h1 className="mt-5 text-[2.35rem] leading-none font-extrabold tracking-tight">
            <span aria-hidden="true">🎵 </span>צור-tone
          </h1>
          <p className="mt-2.5 text-[1.15rem] text-ink-2 font-medium">הופכים רגע לצלצול.</p>
        </section>

        {showInstall && (
          <div className="glass rounded-[1.25rem] flex items-center gap-2 p-1.5 ps-3 mb-3 enter-up">
            <IconAddHome size={20} className="text-sky-ink flex-none" />
            <button type="button" onClick={onInstall} className="flex-1 text-start font-semibold min-h-11 text-[0.95rem]">
              הוסף את צור-tone למסך הבית
            </button>
            <button type="button" onClick={onDismissInstall} aria-label="סגור את ההצעה" className="pressable grid place-items-center min-h-11 min-w-11 rounded-full text-ink-3">
              <IconClose size={16} />
            </button>
          </div>
        )}

        {/* Import - in the lower half, within thumb reach */}
        <section aria-labelledby="import-title" className={`glass rounded-[2rem] p-4 mb-3 transition-shadow ${dragOver ? "ring-4 ring-orange" : ""}`}>
          <h2 id="import-title" className="sr-only">ייבוא מדיה</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              aria-label="בחר וידאו - MP4, MOV, M4V או WebM"
              className="pressable flex flex-col items-center justify-center gap-2 rounded-[1.5rem] bg-sky text-on-accent min-h-[8.5rem] p-3 shadow-soft"
            >
              <span className="grid place-items-center h-14 w-14 rounded-2xl bg-white/45"><IconVideo size={30} /></span>
              <span className="text-[1.1rem] font-bold">בחר וידאו</span>
              <span className="text-[0.72rem] font-semibold opacity-75 ltr">MP4 · MOV · M4V · WebM</span>
            </button>
            <button
              type="button"
              onClick={() => audioRef.current?.click()}
              aria-label="בחר אודיו - MP3, M4A, AAC או WAV"
              className="pressable flex flex-col items-center justify-center gap-2 rounded-[1.5rem] bg-surface-solid text-ink min-h-[8.5rem] p-3 border border-hairline shadow-soft"
            >
              <span className="grid place-items-center h-14 w-14 rounded-2xl bg-orange-soft text-ink"><IconMusic size={28} /></span>
              <span className="text-[1.1rem] font-bold">בחר אודיו</span>
              <span className="text-[0.72rem] font-semibold text-ink-3 ltr">MP3 · M4A · AAC · WAV</span>
            </button>
          </div>
          <input ref={videoInputRef} type="file" accept={VIDEO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} />
          <input ref={audioRef} type="file" accept={AUDIO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} />

          <div className="flex items-center gap-3 my-4 text-ink-3 text-[0.85rem]" aria-hidden="true">
            <div className="h-px flex-1 bg-hairline" /> או <div className="h-px flex-1 bg-hairline" />
          </div>

          <form
            noValidate
            onSubmit={(e) => { e.preventDefault(); if (url.trim()) onUrl(url.trim()); }}
            className="flex flex-col gap-2.5"
          >
            <label htmlFor="url" className="font-bold flex items-center gap-2"><IconLink size={18} /> הדבק קישור</label>
            <input
              id="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              dir="auto"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="הדבק קישור לסרטון…"
              aria-describedby="url-hint"
              className="w-full min-h-[3.4rem] rounded-[1.1rem] bg-surface-solid border border-hairline px-4 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:ring-sky/60"
            />
            <p id="url-hint" className="text-[0.8rem] text-ink-3 -mt-0.5">לדוגמה: קישור ישיר לסרטון או לקובץ אודיו, או עמוד שמפרסם את הסרטון בגלוי.</p>
            <Button type="submit" variant="ink" size="lg" full disabled={!url.trim()} aria-label="ייבא סרטון מהקישור">
              ייבא סרטון
            </Button>
          </form>
        </section>

        <p className="safe-bottom flex items-center justify-center gap-1.5 text-[0.85rem] text-ink-2 text-center">
          <IconLock size={15} className="flex-none" />
          <span>הקבצים שלך משמשים רק ליצירת הצלצול.</span>
        </p>
      </div>
    </div>
  );
}
