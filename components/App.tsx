"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Home from "./screens/Home";
import Editor, { type Source } from "./screens/Editor";
import Success, { type Result } from "./screens/Success";
import { VIDEO_ACCEPT } from "./screens/Home";
import { ErrorScreen, Importing, Loading, Processing, type ProcState } from "./screens/Flow";
import { InstallSheet, IphoneHelpSheet, SettingsSheet } from "./Sheets";
import { AppError, MESSAGES } from "@/lib/errors";
import { getEngine, type ConvertOptions, type EngineEvent } from "@/lib/engine";
import { AUDIO_EXT, MAX_CLIP, MAX_UPLOAD, VIDEO_EXT, extOf, sanitizeName } from "@/lib/format";
import { convertOnServer, fetchRemotePeaks, importUrl, ImportError, releaseRemote, serverAvailable, type ImportEvent } from "@/lib/remote";
import { useSettings } from "@/lib/settings";
import { isIOS, isIPhone, isStandalone, makeShareableFile } from "@/lib/device";
import { localEnvelope, type Envelope } from "@/lib/waveform";
import { makeFrames } from "@/lib/frames";

type Screen =
  | { name: "home" }
  | { name: "importing"; url: string }
  | { name: "loading" }
  | { name: "edit" }
  | { name: "processing" }
  | { name: "success" }
  | { name: "error"; title: string; body: string; tip?: string; back: "home" | "edit"; retry?: "import" | "create" };

const INSTALL_DISMISS_KEY = "tzur-tone:install-dismissed";

/** Reads the duration of a local file (handles WebM files that report Infinity). */
function probeLocal(url: string, isVideo: boolean): Promise<{ duration: number; hasPicture: boolean }> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(isVideo ? "video" : "audio") as HTMLVideoElement;
    el.preload = "metadata";
    el.muted = true;
    (el as any).playsInline = true;
    const done = (ok: boolean) => {
      clearTimeout(timer);
      const d = el.duration, pic = isVideo && el.videoWidth > 0;
      el.removeAttribute("src"); el.load();
      if (ok && isFinite(d) && d > 0) resolve({ duration: d, hasPicture: pic });
      else reject(new AppError("cant_play"));
    };
    const timer = setTimeout(() => done(false), 20000);
    el.onloadedmetadata = () => {
      if (isFinite(el.duration) && el.duration > 0) return done(true);
      // WebM from MediaRecorder: seek far to force the real duration.
      el.ondurationchange = () => { if (isFinite(el.duration) && el.duration > 0) { el.ondurationchange = null; el.currentTime = 0; done(true); } };
      el.currentTime = 1e7;
    };
    el.onerror = () => done(false);
    el.src = url;
  });
}

function measureAudio(url: string, fallback: number): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    const t = setTimeout(() => resolve(fallback), 3000);
    a.preload = "metadata";
    a.onloadedmetadata = () => { clearTimeout(t); resolve(isFinite(a.duration) && a.duration > 0 ? a.duration : fallback); };
    a.onerror = () => { clearTimeout(t); resolve(fallback); };
    a.src = url;
  });
}

export default function App() {
  const [settings, updateSettings] = useSettings();
  const [screen, setScreenState] = useState<Screen>({ name: "home" });
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [source, setSource] = useState<Source | null>(null);
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [name, setName] = useState("");
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [envState, setEnvState] = useState<"loading" | "ready" | "none">("loading");
  const [frames, setFrames] = useState<string[] | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [mp3, setMp3] = useState<{ state: "idle" | "working" | "ready" | "error"; url?: string }>({ state: "idle" });
  const [proc, setProc] = useState<ProcState>({ mode: "device", stage: "cut", ratio: null, showEngine: false });
  const [importEvent, setImportEvent] = useState<ImportEvent | null>(null);
  const [sheet, setSheet] = useState<null | "settings" | "iphone" | "install">(null);
  const [env, setEnv] = useState({ iphone: false, ios: false, standalone: false, installDismissed: true });
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const abortRef = useRef<AbortController | null>(null);
  const lastUrl = useRef("");
  const depth = useRef(0);
  const skipPops = useRef(0);

  /* ---------- environment ---------- */
  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === "1"; } catch {}
    setEnv({ iphone: isIPhone(), ios: isIOS(), standalone: isStandalone(), installDismissed: dismissed });
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  /* ---------- navigation (in-app history so iOS swipe-back works) ---------- */
  const show = useCallback((s: Screen, d: "fwd" | "back") => {
    setDir(d);
    setScreenState(s);
    window.scrollTo({ top: 0 });
  }, []);
  const push = useCallback((s: Screen) => {
    depth.current += 1;
    history.pushState({ tz: depth.current }, "");
    show(s, "fwd");
  }, [show]);
  const replace = useCallback((s: Screen, d: "fwd" | "back" = "fwd") => show(s, d), [show]);

  const cleanupSource = useCallback(() => {
    setSource((src) => {
      if (src?.kind === "file") URL.revokeObjectURL(src.url);
      if (src?.kind === "remote") releaseRemote(src.id);
      return null;
    });
    setEnvelope(null);
    setFrames(null);
  }, []);

  const clearResult = useCallback(() => {
    setResult((r) => { if (r) URL.revokeObjectURL(r.url); return null; });
    setMp3((m) => { if (m.url) URL.revokeObjectURL(m.url); return { state: "idle" }; });
  }, []);

  const cancelWork = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const eng = getEngine();
    if (eng.busy) eng.terminate();
  }, []);

  const goHome = useCallback(() => {
    cancelWork();
    clearResult();
    cleanupSource();
    if (depth.current > 0) {
      skipPops.current += 1;
      history.go(-depth.current);
      depth.current = 0;
    }
    show({ name: "home" }, "back");
  }, [cancelWork, clearResult, cleanupSource, show]);

  /** What "back" means on each screen. */
  const doBack = useCallback(() => {
    const s = screenRef.current;
    switch (s.name) {
      case "importing":
      case "loading":
        cancelWork(); cleanupSource(); show({ name: "home" }, "back"); break;
      case "edit":
        cleanupSource(); clearResult(); show({ name: "home" }, "back"); break;
      case "processing":
        cancelWork(); show({ name: "edit" }, "back"); break;
      case "success":
        clearResult(); show({ name: "edit" }, "back"); break;
      case "error":
        if (s.back === "home") { cleanupSource(); show({ name: "home" }, "back"); }
        else show({ name: "edit" }, "back");
        break;
    }
  }, [cancelWork, cleanupSource, clearResult, show]);

  useEffect(() => {
    const onPop = () => {
      if (skipPops.current > 0) { skipPops.current -= 1; return; }
      depth.current = Math.max(0, depth.current - 1);
      setSheet(null);
      doBack();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [doBack]);

  const back = useCallback(() => {
    if (depth.current > 0) history.back();
    else doBack();
  }, [doBack]);

  const fail = useCallback((e: unknown, backTo: "home" | "edit", retry?: "import" | "create") => {
    const err = AppError.from(e);
    if (err.code === "cancelled") return;
    const retryable = !["unsupported_provider", "invalid_url", "no_audio", "too_large", "unsupported_type", "cant_play"].includes(err.code);
    replace({ name: "error", title: err.title, body: err.body, tip: (e as ImportError)?.tip, back: backTo, retry: retryable ? retry : undefined });
  }, [replace]);

  /* ---------- open a source ---------- */
  const initSelection = (duration: number) => {
    setSel({ start: 0, end: Math.min(duration, MAX_CLIP) });
  };

  const openFile = useCallback(async (file: File) => {
    const ext = extOf(file.name);
    const isVideo = file.type.startsWith("video/") || VIDEO_EXT.includes(ext);
    const isAudio = file.type.startsWith("audio/") || AUDIO_EXT.includes(ext);
    if (!isVideo && !isAudio) { push({ name: "error", ...MESSAGES.unsupported_type, back: "home" }); return; }
    if (file.size > MAX_UPLOAD) { push({ name: "error", ...MESSAGES.too_large, back: "home" }); return; }

    clearResult();
    cleanupSource();
    const url = URL.createObjectURL(file);
    const src: Source = { kind: "file", file, url, name: file.name, isVideo, duration: 0 };
    setSource(src);
    if (screenRef.current.name === "error") replace({ name: "loading" });
    else push({ name: "loading" });
    try {
      const { duration, hasPicture } = await probeLocal(url, isVideo);
      if (screenRef.current.name !== "loading") return;
      const ready: Source = { ...src, duration, isVideo: isVideo && hasPicture };
      setSource(ready);
      setName(sanitizeName(file.name));
      initSelection(duration);
      replace({ name: "edit" });
    } catch (e) {
      if (screenRef.current.name === "loading") fail(e, "home");
    }
  }, [push, replace, fail, clearResult, cleanupSource]);

  const openUrl = useCallback(async (url: string) => {
    lastUrl.current = url;
    clearResult();
    cleanupSource();
    setImportEvent(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (screenRef.current.name === "error") replace({ name: "importing", url });
    else push({ name: "importing", url });
    try {
      const m = await importUrl(url, setImportEvent, ctrl.signal);
      if (ctrl.signal.aborted) { releaseRemote(m.id); return; }
      const src: Source = { kind: "remote", id: m.id, url: m.url, name: m.name, isVideo: m.hasVideo, duration: m.duration, size: m.size };
      setSource(src);
      setName(sanitizeName(m.name));
      initSelection(m.duration);
      replace({ name: "edit" });
    } catch (e) {
      if (!ctrl.signal.aborted) fail(e, "home", "import");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, [push, replace, fail, clearResult, cleanupSource]);

  /* ---------- waveform + filmstrip (progressive, never blocks editing) ---------- */
  const srcKey = source ? (source.kind === "file" ? source.url : source.id) + ":" + source.duration : "";
  useEffect(() => {
    if (!source || !source.duration) return;
    let alive = true;
    setEnvelope(null);
    setEnvState("loading");
    const job = source.kind === "file" ? localEnvelope(source.file, source.duration) : fetchRemotePeaks(source.id);
    job.then((e) => { if (alive) { setEnvelope(e); setEnvState(e ? "ready" : "none"); } }).catch(() => alive && setEnvState("none"));

    let framesTimer: ReturnType<typeof setTimeout> | undefined;
    if (source.isVideo && source.duration > 40) {
      framesTimer = setTimeout(() => {
        makeFrames(source.url, source.duration, 8, () => alive).then((f) => { if (alive && f) setFrames(f); });
      }, 400);
    }
    // Warm up the conversion engine in the background for local files.
    let warm: ReturnType<typeof setTimeout> | undefined;
    if (source.kind === "file" && settings.processing !== "server") {
      warm = setTimeout(() => { getEngine().load().catch(() => {}); }, 1500);
    }
    return () => { alive = false; clearTimeout(framesTimer); clearTimeout(warm); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey]);

  /* ---------- create the ringtone ---------- */
  const buildOptions = (format: "m4a" | "mp3"): ConvertOptions => {
    const duration = Math.min(MAX_CLIP, Math.round((sel.end - sel.start) * 1000) / 1000);
    return {
      start: Math.round(sel.start * 1000) / 1000,
      duration,
      format,
      bitrate: format === "mp3" ? 192 : settings.bitrate,
      normalize: settings.normalize,
      fade: settings.fade,
      title: sanitizeName(name),
    };
  };

  const convert = async (format: "m4a" | "mp3", ctrl: AbortController, onProc?: (p: Partial<ProcState>) => void): Promise<Blob> => {
    const src = source!;
    const opts = buildOptions(format);
    const viaServer = (s: { id: string } | { file: File }) => {
      onProc?.({ mode: "server", stage: "id" in s ? "extract" : "upload", ratio: "id" in s ? null : 0 });
      return convertOnServer(opts, s, (r) => onProc?.({ stage: "upload", ratio: r }), () => onProc?.({ stage: "extract", ratio: null }), ctrl.signal);
    };
    if (src.kind === "remote") return viaServer({ id: src.id });
    if (settings.processing === "server") return viaServer({ file: src.file });

    const engine = getEngine();
    onProc?.({ mode: "device", showEngine: !engine.isLoaded, stage: engine.isLoaded ? "cut" : "engine", ratio: engine.isLoaded ? null : 0 });
    const onEvent = (e: EngineEvent) => {
      if (ctrl.signal.aborted) return;
      if (e.type === "engine-download") onProc?.({ stage: "engine", ratio: e.loaded / e.total });
      else if (e.type === "stage") onProc?.({ stage: e.stage === "cut" ? "cut" : "create", ratio: null });
      else if (e.type === "progress") onProc?.({ stage: "extract", ratio: e.ratio });
    };
    try {
      return await engine.convert(src.file, opts, onEvent);
    } catch (e) {
      const err = AppError.from(e);
      if (ctrl.signal.aborted || err.code === "cancelled" || err.code === "no_audio") throw err;
      if (settings.processing === "auto" && (await serverAvailable())) return viaServer({ file: src.file });
      throw err;
    }
  };

  const create = async (fromError = false) => {
    if (!source) return;
    cancelWork();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    clearResult();
    setProc({ mode: "device", stage: "cut", ratio: null, showEngine: false });
    if (fromError) replace({ name: "processing" });
    else push({ name: "processing" });
    try {
      const blob = await convert("m4a", ctrl, (p) => setProc((s) => ({ ...s, ...p })));
      if (ctrl.signal.aborted) return;
      setProc((s) => ({ ...s, stage: "create", ratio: null }));
      const url = URL.createObjectURL(blob);
      const opts = buildOptions("m4a");
      const duration = await measureAudio(url, opts.duration);
      const base = sanitizeName(name);
      const res: Result = { blob, url, file: makeShareableFile(blob, base, "m4a"), duration, ext: "m4a", name: base };
      setProc((s) => ({ ...s, stage: "done", ratio: 1 }));
      await new Promise((r) => setTimeout(r, 450));
      if (ctrl.signal.aborted) { URL.revokeObjectURL(url); return; }
      setResult(res);
      replace({ name: "success" });
    } catch (e) {
      if (!ctrl.signal.aborted) fail(e, "edit", "create");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };

  const makeMp3 = async () => {
    if (!source) return;
    const ctrl = new AbortController();
    setMp3({ state: "working" });
    try {
      const blob = await convert("mp3", ctrl);
      setMp3({ state: "ready", url: URL.createObjectURL(blob) });
    } catch {
      setMp3({ state: "error" });
    }
  };

  /* ---------- render ---------- */
  const anim = dir === "fwd" ? "enter-fwd" : "enter-back";
  const openSettings = () => setSheet("settings");
  const showInstallChip = env.ios && !env.standalone && !env.installDismissed && screen.name === "home";

  let body: React.ReactNode = null;
  switch (screen.name) {
    case "home":
      body = (
        <Home
          onFile={openFile}
          onUrl={openUrl}
          onSettings={openSettings}
          showInstall={showInstallChip}
          onInstall={() => setSheet("install")}
          onDismissInstall={() => { try { localStorage.setItem(INSTALL_DISMISS_KEY, "1"); } catch {} setEnv((e) => ({ ...e, installDismissed: true })); }}
          videoInputRef={videoInputRef}
        />
      );
      break;
    case "importing":
      body = <Importing url={screen.url} event={importEvent} onCancel={back} />;
      break;
    case "loading":
      body = <Loading name={source?.name || ""} previewUrl={source?.kind === "file" ? source.url : null} isVideo={!!source?.isVideo} />;
      break;
    case "edit":
      body = source && (
        <Editor
          source={source}
          start={sel.start}
          end={sel.end}
          onSel={(start, end) => setSel({ start, end })}
          name={name}
          onName={setName}
          envelope={envelope}
          envelopeState={envState}
          frames={frames}
          onBack={back}
          onSettings={openSettings}
          onCreate={() => create()}
          onMediaError={() => fail(new AppError("cant_play"), "home")}
        />
      );
      break;
    case "processing":
      body = <Processing state={proc} onCancel={back} />;
      break;
    case "success":
      body = result && (
        <Success
          result={result}
          isIPhone={env.iphone}
          onBack={back}
          onNew={goHome}
          onSettings={openSettings}
          onHelp={() => setSheet("iphone")}
          mp3={mp3}
          onMakeMp3={makeMp3}
        />
      );
      break;
    case "error": {
      const retry =
        screen.retry === "import" ? { label: "נסה שוב", onClick: () => openUrl(lastUrl.current) }
        : screen.retry === "create" ? { label: "נסה שוב", onClick: () => create(true) }
        : undefined;
      const pickOther = { label: screen.back === "edit" ? "חזרה לעריכה" : "בחר קובץ מהמכשיר", onClick: () => {
        if (screen.back === "edit") back();
        else pickerRef.current?.click(); // direct tap -> file picker (Safari needs the gesture)
      } };
      body = (
        <ErrorScreen
          title={screen.title}
          body={screen.body}
          tip={screen.tip}
          onBack={back}
          primary={retry ?? pickOther}
          secondary={retry ? pickOther : { label: "למסך הבית", onClick: goHome }}
        />
      );
      break;
    }
  }

  return (
    <>
      <main key={screen.name} className={anim}>{body}</main>
      <input
        ref={pickerRef}
        type="file"
        accept={VIDEO_ACCEPT + ",audio/*,.mp3,.m4a,.aac,.wav"}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) openFile(f); }}
      />

      <SettingsSheet
        open={sheet === "settings"}
        onClose={() => setSheet(null)}
        settings={settings}
        update={updateSettings}
        installed={env.standalone}
        onInstall={() => setSheet("install")}
        onHelp={() => setSheet("iphone")}
      />
      <IphoneHelpSheet open={sheet === "iphone"} onClose={() => setSheet(null)} />
      <InstallSheet
        open={sheet === "install"}
        onClose={() => setSheet(null)}
        isIOS={env.ios}
        installed={env.standalone}
        canPrompt={!!installPrompt}
        onPrompt={async () => {
          try { installPrompt.prompt(); await installPrompt.userChoice; } catch {}
          setInstallPrompt(null);
          setSheet(null);
        }}
      />
    </>
  );
}
