"use client";
import { IconAlert, IconCheck, IconVideo } from "../Icons";
import { Button, ProgressBar, TopBar } from "../ui";
import { fmtBytes } from "@/lib/format";
import type { ImportEvent } from "@/lib/remote";

/* ---------------- shared step list ---------------- */
export type Step = { key: string; label: string; state: "done" | "active" | "pending" };

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-1.5 mt-5 text-start">
      {steps.map((s) => (
        <li key={s.key} className={`flex items-center gap-3 min-h-9 ${s.state === "pending" ? "text-ink-3" : "text-ink"}`} aria-current={s.state === "active" ? "step" : undefined}>
          <span className="grid place-items-center h-7 w-7 flex-none rounded-full" aria-hidden="true">
            {s.state === "done" && <span className="grid place-items-center h-7 w-7 rounded-full bg-success text-white"><IconCheck size={15} /></span>}
            {s.state === "active" && <span className="h-5 w-5 rounded-full border-[3px] border-orange border-t-transparent spin" />}
            {s.state === "pending" && <span className="h-2.5 w-2.5 rounded-full bg-ink-3/40" />}
          </span>
          <span className={s.state === "active" ? "font-bold" : "font-medium"}>{s.label}</span>
          <span className="sr-only">{s.state === "done" ? "הושלם" : s.state === "active" ? "בתהליך" : "ממתין"}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------------- Import from URL ---------------- */
export function Importing({ url, event, onCancel }: { url: string; event: ImportEvent | null; onCancel: () => void }) {
  let host = url;
  try { host = new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname; } catch {}
  const stage = event?.stage ?? "checking";
  const order = ["checking", "downloading", "analyzing"];
  const idx = order.indexOf(stage);
  const steps: Step[] = [
    { key: "checking", label: "בודק את הקישור…", state: idx > 0 ? "done" : "active" },
    { key: "downloading", label: "מוריד את הסרטון…", state: idx > 1 ? "done" : idx === 1 ? "active" : "pending" },
    { key: "analyzing", label: "מכין לעריכה…", state: idx === 2 ? "active" : "pending" },
  ];
  const dl = event?.stage === "downloading" ? event : null;
  const ratio = dl && dl.total > 0 ? dl.received / dl.total : null;
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopBar onBack={onCancel} backLabel="ביטול" />
      <div className="flex-1 flex flex-col justify-center w-full max-w-[28rem] mx-auto px-5 pb-16">
        <div className="glass rounded-[2rem] p-6 text-center" role="status" aria-live="polite">
          <div className="mx-auto grid place-items-center h-16 w-16 rounded-3xl bg-sky text-on-accent pulse-soft"><IconVideo size={30} /></div>
          <h1 className="mt-4 text-[1.35rem] font-bold">מייבאים את הסרטון</h1>
          <p className="mt-1 text-ink-3 text-[0.9rem] ltr truncate">{host}</p>
          <div className="mt-5"><ProgressBar ratio={stage === "downloading" ? ratio : null} label="התקדמות הייבוא" /></div>
          {dl && (
            <p className="mt-2 text-[0.85rem] text-ink-2 tabular">
              {fmtBytes(dl.received)}{dl.total ? ` מתוך ${fmtBytes(dl.total)}` : ""}
            </p>
          )}
          <Steps steps={steps} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Loading a picked file ---------------- */
export function Loading({ name, previewUrl, isVideo }: { name: string; previewUrl: string | null; isVideo: boolean }) {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopBar />
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-[28rem] mx-auto px-5 pb-20" role="status" aria-live="polite">
        <div className="relative w-full aspect-video rounded-[1.6rem] overflow-hidden bg-black/80 shadow-lift">
          {previewUrl && isVideo && (
            <video src={`${previewUrl}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover opacity-80" aria-hidden="true" />
          )}
          <div className="absolute inset-0 grid place-items-center">
            <span className="h-11 w-11 rounded-full border-4 border-white/90 border-t-transparent spin" aria-hidden="true" />
          </div>
        </div>
        <h1 className="mt-6 text-[1.3rem] font-bold">{isVideo ? "טוען את הסרטון…" : "טוען את הקובץ…"}</h1>
        <p className="mt-1 text-ink-3 text-[0.9rem] max-w-full truncate" dir="auto">{name}</p>
      </div>
    </div>
  );
}

/* ---------------- Processing ---------------- */
export type ProcState = {
  mode: "device" | "server";
  stage: "engine" | "upload" | "cut" | "extract" | "create" | "done";
  ratio: number | null;
  showEngine: boolean;
};

export function Processing({ state, onCancel }: { state: ProcState; onCancel: () => void }) {
  const { mode, stage, ratio } = state;
  const order =
    mode === "server"
      ? (["upload", "extract", "create", "done"] as const)
      : ((state.showEngine ? ["engine", "cut", "extract", "create", "done"] : ["cut", "extract", "create", "done"]) as readonly string[]);
  const labels: Record<string, string> = {
    engine: "מכין את מנוע ההמרה…",
    upload: "מעלה את הקובץ לעיבוד…",
    cut: "חותך את הקטע…",
    extract: mode === "server" ? "חותך ומחלץ את האודיו…" : "מחלץ את האודיו…",
    create: "יוצר את הצלצול…",
    done: "מוכן!",
  };
  const idx = order.indexOf(stage);
  const steps: Step[] = order.map((k, i) => ({ key: k, label: labels[k], state: i < idx || stage === "done" ? "done" : i === idx ? "active" : "pending" }));
  const flow = ["וידאו", "✂️", "🎵", "📱"];
  const flowIdx = stage === "done" ? 3 : stage === "create" ? 2 : stage === "extract" ? 2 : stage === "cut" ? 1 : 0;
  const pct = ratio != null ? Math.round(ratio * 100) : null;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopBar onBack={onCancel} backLabel="ביטול" />
      <div className="flex-1 flex flex-col justify-center w-full max-w-[28rem] mx-auto px-5 pb-16">
        <div className="glass rounded-[2rem] p-6 text-center" role="status" aria-live="polite">
          <div className="flex items-center justify-center gap-2 text-[1.35rem] font-bold" aria-hidden="true">
            {flow.map((f, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className={`transition-all duration-300 ${i <= flowIdx ? "opacity-100 scale-110" : "opacity-35"} ${i === flowIdx ? "pulse-soft" : ""} ${i === 0 ? "text-[1rem] px-2 py-0.5 rounded-lg bg-sky text-on-accent" : ""}`}>{f}</span>
                {i < flow.length - 1 && <span className="text-ink-3 text-[1rem]">←</span>}
              </span>
            ))}
          </div>
          <h1 className="mt-5 text-[1.4rem] font-bold">יוצרים את הצלצול שלך…</h1>
          <div className="mt-5"><ProgressBar ratio={ratio} label={labels[stage]} /></div>
          <p className="mt-2 h-5 text-[0.85rem] text-ink-2 tabular">{pct != null ? `${pct}%` : ""}</p>
          <Steps steps={steps} />
          {mode === "server" && <p className="mt-4 text-[0.8rem] text-ink-3">העיבוד מתבצע בשרת. הקובץ נמחק מיד בסיום.</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Friendly error ---------------- */
export function ErrorScreen({ title, body, tip, onBack, primary, secondary }: {
  title: string; body: string; tip?: string;
  onBack: () => void;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <TopBar onBack={onBack} />
      <div className="flex-1 flex flex-col justify-center w-full max-w-[28rem] mx-auto px-5 pb-16">
        <div className="glass rounded-[2rem] p-6 text-center" role="alert">
          <div className="mx-auto grid place-items-center h-16 w-16 rounded-3xl bg-orange-soft text-ink pop"><IconAlert size={30} /></div>
          <h1 className="mt-4 text-[1.4rem] font-bold">{title}</h1>
          <p className="mt-2 text-ink-2 leading-relaxed">{body}</p>
          {tip && <p className="mt-3 text-[0.9rem] rounded-[1rem] bg-sky-soft text-ink p-3 leading-relaxed">{tip}</p>}
          <div className="mt-6 flex flex-col gap-2.5">
            {primary && <Button variant="accent" size="lg" full onClick={primary.onClick}>{primary.label}</Button>}
            {secondary && <Button variant="glass" size="lg" full onClick={secondary.onClick}>{secondary.label}</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
