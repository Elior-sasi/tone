"use client";
import { useEffect, useRef, useState } from "react";
import { BrandMark, IconAddHome, IconClose, IconLink, IconLock, IconVideo } from "../Icons";
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
  const urlRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  useEffect(() => { if (linkOpen) urlRef.current?.focus(); }, [linkOpen]);
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
        <section className="flex-1 flex flex-col items-center justify-center text-center pt-[12px] pb-[24px] min-h-[180px]">
          <div className="pop">
            <BrandMark size={84} className="drop-shadow-[0_18px_30px_rgba(30,120,190,0.35)] rounded-[1.4rem]" />
          </div>
          <h1 className="mt-[16px] text-[min(2.35rem,44px)] leading-none font-extrabold tracking-tight">
            צור-tone
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

        {/* Import - one main action, link is secondary */}
        <section aria-labelledby="import-title" className={`flex flex-col gap-3 mb-4 rounded-[2rem] transition-shadow ${dragOver ? "ring-4 ring-orange" : ""}`}>
          <h2 id="import-title" className="sr-only">ייבוא מדיה</h2>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            aria-label="בחר וידאו או קובץ אודיו מהמכשיר"
            className="pressable flex flex-col items-center justify-center gap-[10px] rounded-[28px] bg-sky text-on-accent py-[20px] px-[16px] shadow-lift text-center"
          >
            <span className="grid place-items-center h-[52px] w-[52px] rounded-[16px] bg-white/45" aria-hidden="true"><IconVideo size={28} /></span>
            <span className="text-[1.3rem] leading-tight font-extrabold">בחר וידאו או שיר</span>
          </button>
          <input ref={videoInputRef} type="file" accept={VIDEO_ACCEPT + "," + AUDIO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} />

          {!linkOpen ? (
            <Button variant="glass" size="lg" full onClick={() => setLinkOpen(true)} aria-expanded={false}>
              <IconLink size={20} /> יש לי קישור
            </Button>
          ) : (
            <form
              noValidate
              onSubmit={(e) => { e.preventDefault(); if (url.trim()) onUrl(url.trim()); }}
              className="glass rounded-[1.75rem] p-3 flex flex-col gap-2.5 enter-up"
            >
              <label htmlFor="url" className="sr-only">קישור לסרטון או לקובץ אודיו</label>
              <input
                id="url"
                ref={urlRef}
                type="url"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                dir="auto"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="הדבק כאן קישור…"
                className="w-full min-h-[3.4rem] rounded-[1.1rem] bg-surface-solid border border-hairline px-4 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-4 focus:ring-sky/60"
              />
              <Button type="submit" variant="ink" size="lg" full disabled={!url.trim()}>
                ייבא
              </Button>
            </form>
          )}
        </section>

        <p className="safe-bottom flex items-center justify-center gap-1.5 text-[0.85rem] text-ink-2 text-center">
          <IconLock size={15} className="flex-none" />
          <span>הקבצים שלך משמשים רק ליצירת הצלצול.</span>
        </p>
      </div>
    </div>
  );
}
