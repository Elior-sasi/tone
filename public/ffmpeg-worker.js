/* צור-tone - FFmpeg worker
 * Classic worker that hosts the single-thread ffmpeg.wasm core.
 * The input file is mounted with WORKERFS, so the browser reads only the
 * byte ranges FFmpeg actually needs - the video is never copied into memory.
 */
/* eslint-disable no-restricted-globals */
let core = null;
let mounted = false;
const IN_DIR = "/in";

function post(msg, transfer) {
  self.postMessage(msg, transfer || []);
}

function parseTime(line) {
  // "... time=00:00:12.34 ..."
  const m = /time=\s*(-?\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

let currentJob = null; // { id, duration, log: [] }

async function load(wasmURL) {
  if (core) return;
  importScripts("/ffmpeg/ffmpeg-core.js");
  const coreURL = new URL("/ffmpeg/ffmpeg-core.js", self.location.href).href;
  core = await self.createFFmpegCore({
    mainScriptUrlOrBlob: coreURL + "#" + btoa(JSON.stringify({ wasmURL: wasmURL, workerURL: "" })),
  });
  core.setLogger(function (e) {
    if (!currentJob) return;
    const line = e.message || "";
    currentJob.log.push(line);
    if (currentJob.log.length > 400) currentJob.log.shift();
    const t = parseTime(line);
    if (t != null && currentJob.duration > 0) {
      post({ id: currentJob.id, type: "progress", time: t, ratio: Math.max(0, Math.min(1, t / currentJob.duration)) });
    }
  });
  core.setProgress(function () {});
  try { core.FS.mkdir(IN_DIR); } catch (_) {}
}

function mount(file) {
  if (mounted) {
    try { core.FS.unmount(IN_DIR); } catch (_) {}
    mounted = false;
  }
  core.FS.mount(core.FS.filesystems.WORKERFS, { files: [file] }, IN_DIR);
  mounted = true;
  return IN_DIR + "/" + file.name;
}

function run(args, id, duration, timeoutMs) {
  currentJob = { id: id, duration: duration || 0, log: [] };
  core.setTimeout(timeoutMs || -1);
  let ret;
  try {
    core.exec.apply(core, args);
    ret = core.ret;
  } finally {
    core.reset();
  }
  const log = currentJob.log.join("\n");
  currentJob = null;
  return { ret: ret, log: log };
}

function safeUnlink(p) {
  try { core.FS.unlink(p); } catch (_) {}
}

function classify(log) {
  if (/matches no streams|does not contain any stream|Output file .* does not contain any stream|no audio/i.test(log)) return "no_audio";
  if (/Invalid data found|moov atom not found|could not find codec|Unknown format/i.test(log)) return "bad_input";
  if (/memory|OOM|Cannot enlarge memory/i.test(log)) return "memory";
  return "failed";
}

self.onmessage = async function (ev) {
  const msg = ev.data;
  const id = msg.id;
  try {
    if (msg.type === "load") {
      await load(msg.wasmURL);
      post({ id: id, type: "done" });
      return;
    }
    if (!core) throw new Error("not_loaded");

    if (msg.type === "mount") {
      const path = mount(msg.file);
      post({ id: id, type: "done", path: path });
      return;
    }

    if (msg.type === "peaks") {
      // Mean-absolute envelope at a low sample rate - cheap waveform for the timeline.
      const rate = msg.rate;
      const out = "/peaks.raw";
      const r = run([
        "-hide_banner", "-nostdin", "-i", msg.path, "-vn", "-sn", "-dn",
        "-map", "0:a:0",
        "-af", "aformat=channel_layouts=mono,aeval=abs(val(0)),aresample=" + rate,
        "-f", "f32le", "-acodec", "pcm_f32le", out,
      ], id, msg.duration, 120000);
      if (r.ret !== 0) { safeUnlink(out); throw Object.assign(new Error(classify(r.log)), { log: r.log }); }
      const data = core.FS.readFile(out);
      safeUnlink(out);
      const f32 = new Float32Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 4)).slice();
      post({ id: id, type: "done", peaks: f32, rate: rate }, [f32.buffer]);
      return;
    }

    if (msg.type === "convert") {
      const o = msg.opts;
      const ext = o.format === "mp3" ? "mp3" : "m4a";
      const out = "/out." + ext;
      const filters = [];
      if (o.normalize) filters.push("loudnorm=I=-14:TP=-1.0:LRA=11");
      if (o.fade) {
        const fin = Math.min(0.04, o.duration / 10);
        const fout = Math.min(0.6, o.duration / 5);
        filters.push("afade=t=in:st=0:d=" + fin.toFixed(3));
        filters.push("afade=t=out:st=" + Math.max(0, o.duration - fout).toFixed(3) + ":d=" + fout.toFixed(3));
      }
      const args = [
        "-hide_banner", "-nostdin",
        // Seek + cut on the INPUT side: only the selected range is read and decoded.
        "-ss", o.start.toFixed(3), "-t", o.duration.toFixed(3),
        "-i", msg.path,
        "-map", "0:a:0", "-vn", "-sn", "-dn", "-map_metadata", "-1",
        "-ac", "2", "-ar", "44100",
      ];
      if (filters.length) args.push("-af", filters.join(","));
      if (ext === "mp3") {
        args.push("-c:a", "libmp3lame", "-b:a", (o.bitrate || 192) + "k", "-id3v2_version", "3");
        if (o.title) args.push("-metadata", "title=" + o.title);
        args.push("-t", o.duration.toFixed(3), "-f", "mp3", out);
      } else {
        args.push("-c:a", "aac", "-b:a", (o.bitrate || 160) + "k");
        if (o.title) args.push("-metadata", "title=" + o.title);
        args.push("-t", o.duration.toFixed(3), "-movflags", "+faststart", "-f", "ipod", out);
      }
      post({ id: id, type: "stage", stage: "cut" });
      const r = run(args, id, o.duration, 180000);
      if (r.ret !== 0) { safeUnlink(out); throw Object.assign(new Error(classify(r.log)), { log: r.log }); }
      post({ id: id, type: "stage", stage: "finalize" });
      const data = core.FS.readFile(out);
      safeUnlink(out);
      if (!data || data.byteLength < 1000) throw new Error("no_audio");
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      post({ id: id, type: "done", data: buf, ext: ext }, [buf]);
      return;
    }

    throw new Error("unknown_command");
  } catch (err) {
    post({ id: id, type: "error", code: (err && err.message) || "failed", log: err && err.log ? String(err.log).slice(-3000) : "" });
  }
};
