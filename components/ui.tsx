"use client";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { BrandMark, IconBack, IconClose, IconGear } from "./Icons";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "accent" | "sky" | "glass" | "ghost" | "ink";
  size?: "lg" | "md" | "sm";
  full?: boolean;
};

export function Button({ variant = "glass", size = "md", full, className = "", children, ...rest }: BtnProps) {
  const v = {
    accent: "bg-orange text-on-accent shadow-lift font-bold",
    sky: "bg-sky text-on-accent font-bold shadow-soft",
    glass: "glass text-ink font-semibold",
    ghost: "text-ink font-semibold bg-transparent hover:bg-surface-2",
    ink: "bg-ink text-bg font-bold shadow-soft",
  }[variant];
  const s = {
    lg: "min-h-[3.6rem] px-6 text-[1.08rem] rounded-[1.4rem] gap-2.5",
    md: "min-h-[3rem] px-5 text-[1rem] rounded-[1.1rem] gap-2",
    sm: "min-h-[2.75rem] min-w-[2.75rem] px-3.5 text-[0.92rem] rounded-[0.9rem] gap-1.5",
  }[size];
  return (
    <button
      type="button"
      className={`pressable inline-flex items-center justify-center select-none disabled:opacity-45 disabled:pointer-events-none ${v} ${s} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TopBar({ onBack, onSettings, title = true, backLabel = "חזרה" }: { onBack?: () => void; onSettings?: () => void; title?: boolean; backLabel?: string }) {
  return (
    <header className="safe-top sticky top-0 z-30 px-3">
      <div className="flex items-center justify-between h-12 gap-2">
        <div className="w-[5.5rem] flex justify-start">
          {onBack && (
            <button type="button" onClick={onBack} aria-label={backLabel} className="pressable flex items-center gap-0.5 min-h-11 min-w-11 px-2 -ms-1 rounded-xl text-sky-ink font-semibold">
              <IconBack size={22} />
              <span>{backLabel}</span>
            </button>
          )}
        </div>
        {title && (
          <div className="flex items-center gap-2 font-bold text-[1.05rem]" aria-hidden="true">
            <BrandMark size={24} />
            <span>צור-tone</span>
          </div>
        )}
        <div className="w-[5.5rem] flex justify-end">
          {onSettings && (
            <button type="button" onClick={onSettings} aria-label="הגדרות" className="pressable grid place-items-center min-h-11 min-w-11 rounded-full glass text-ink">
              <IconGear size={21} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 min-h-12 py-1">
      <div className="min-w-0">
        <div id={`${id}-l`} className="font-semibold">{label}</div>
        {description && <div id={`${id}-d`} className="text-[0.85rem] text-ink-3">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={description ? `${id}-d` : undefined}
        onClick={() => onChange(!checked)}
        className="switch pressable"
      />
    </div>
  );
}

export function ProgressBar({ ratio, label }: { ratio: number | null; label: string }) {
  const pct = ratio == null ? null : Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct ?? undefined}
      aria-valuetext={pct == null ? "בתהליך" : `${pct}%`}
      className={`h-2.5 w-full rounded-full bg-track overflow-hidden ${pct == null ? "indeterminate" : ""}`}
      dir="ltr"
    >
      {pct != null && <div className="h-full rounded-full bg-orange transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const el = ref.current;
    el?.querySelector<HTMLElement>("[data-autofocus], button, [href], input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('button, [href], input, select, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute("disabled"));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px] fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        className="relative w-full max-w-[34rem] max-h-[88dvh] overflow-y-auto no-scrollbar rounded-t-[2rem] glass !bg-surface-solid/95 sheet-up safe-bottom"
      >
        <div className="sticky top-0 z-10 pt-2.5 pb-1 bg-surface-solid/90 backdrop-blur-xl">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-ink-3/35" aria-hidden="true" />
          <div className="flex items-center justify-between px-5 pt-2">
            <h2 id={`${id}-t`} className="text-[1.25rem] font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="סגור" className="pressable grid place-items-center min-h-11 min-w-11 rounded-full bg-surface-2 text-ink">
              <IconClose size={18} />
            </button>
          </div>
        </div>
        <div className="px-5 pb-3 pt-2">{children}</div>
      </div>
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`glass rounded-[1.75rem] ${className}`}>{children}</div>;
}
