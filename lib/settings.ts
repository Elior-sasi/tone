"use client";
import { useCallback, useEffect, useState } from "react";

export type Settings = {
  bitrate: 128 | 160 | 192;
  normalize: boolean;
  fade: boolean;
  processing: "auto" | "device" | "server";
};

export const DEFAULT_SETTINGS: Settings = { bitrate: 160, normalize: true, fade: true, processing: "auto" };
const KEY = "tzur-tone:settings";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  return [settings, update] as const;
}
