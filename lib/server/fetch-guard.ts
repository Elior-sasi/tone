import "server-only";
import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

// Safe outbound fetching for URL import:
// - http/https only, standard ports, no credentials in the URL
// - every resolved IP must be public (blocks SSRF to localhost / LAN / metadata endpoints),
//   checked inside the socket's DNS lookup so a rebinding trick can't slip past
// - redirects are followed manually and each hop is re-validated

export class GuardError extends Error {
  constructor(public code: "invalid_url" | "unsupported_provider" | "import_failed" | "too_large") {
    super(code);
  }
}

/** Services whose media can't be fetched through a permitted, public download path. */
const PROVIDERS: { re: RegExp; name: string; tip?: string }[] = [
  { re: /(^|\.)tiktok\.com$|(^|\.)tiktokv\.com$/, name: "TikTok", tip: "בטיקטוק: לחץ ״שתף״ ואז ״שמור סרטון״ (כשהיוצר מאפשר זאת), ואז בחר את הסרטון מכאן." },
  { re: /(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/, name: "YouTube" },
  { re: /(^|\.)instagram\.com$/, name: "Instagram" },
  { re: /(^|\.)facebook\.com$|(^|\.)fb\.watch$/, name: "Facebook" },
  { re: /(^|\.)x\.com$|(^|\.)twitter\.com$/, name: "X" },
  { re: /(^|\.)vimeo\.com$/, name: "Vimeo" },
  { re: /(^|\.)netflix\.com$|(^|\.)disneyplus\.com$|(^|\.)spotify\.com$|(^|\.)music\.apple\.com$|(^|\.)tv\.apple\.com$/, name: "שירות מוגן" },
];

export function detectProvider(u: URL) {
  const host = u.hostname.toLowerCase();
  return PROVIDERS.find((p) => p.re.test(host)) || null;
}

export function parseUserUrl(raw: string): URL {
  let s = String(raw || "").trim();
  if (!s || s.length > 2048) throw new GuardError("invalid_url");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try { u = new URL(s); } catch { throw new GuardError("invalid_url"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new GuardError("invalid_url");
  if (u.username || u.password) throw new GuardError("invalid_url");
  if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) throw new GuardError("invalid_url");
  if (!u.hostname.includes(".") && !net.isIP(u.hostname)) throw new GuardError("invalid_url");
  return u;
}

function isPublicIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a >= 224) return false;
    return true;
  }
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return false;
  if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("ff")) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return isPublicIp(mapped[1]);
  return true;
}

const guardedLookup: typeof lookup = ((hostname: string, options: any, cb: any) => {
  if (typeof options === "function") { cb = options; options = {}; }
  lookup(hostname, { ...options, all: true }, (err, addrs: any) => {
    if (err) return cb(err);
    const list = (Array.isArray(addrs) ? addrs : [{ address: addrs, family: 4 }]) as { address: string; family: number }[];
    if (!list.length || list.some((a) => !isPublicIp(a.address))) {
      return cb(Object.assign(new Error("blocked_address"), { code: "EBLOCKED" }));
    }
    if (options.all) cb(null, list);
    else cb(null, list[0].address, list[0].family);
  });
}) as any;

export type GuardedResponse = http.IncomingMessage & { finalUrl: URL };

function requestOnce(u: URL, signal: AbortSignal): Promise<http.IncomingMessage> {
  if (net.isIP(u.hostname) && !isPublicIp(u.hostname)) return Promise.reject(new GuardError("invalid_url"));
  const mod = u.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(u, {
      method: "GET",
      lookup: guardedLookup,
      signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TzurTone/1.0; +ringtone-maker)",
        accept: "video/*,audio/*,text/html;q=0.8,*/*;q=0.5",
      },
      timeout: 15_000,
    }, resolve);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function guardedGet(start: URL, signal: AbortSignal, maxRedirects = 5): Promise<GuardedResponse> {
  let u = start;
  for (let i = 0; i <= maxRedirects; i++) {
    if (detectProvider(u)) throw new GuardError("unsupported_provider");
    let res: http.IncomingMessage;
    try { res = await requestOnce(u, signal); } catch (e) {
      if (e instanceof GuardError) throw e;
      throw new GuardError("import_failed");
    }
    const status = res.statusCode || 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      u = parseUserUrl(new URL(res.headers.location, u).href);
      continue;
    }
    if (status < 200 || status >= 300) { res.resume(); throw new GuardError("import_failed"); }
    return Object.assign(res, { finalUrl: u });
  }
  throw new GuardError("import_failed");
}

/** Pull a directly playable media URL from public page metadata (og:video etc). */
export function findMediaInHtml(html: string, base: URL): { url: URL; title?: string } | null {
  const metas = [...html.matchAll(/<meta\s+[^>]*>/gi)].map((m) => m[0]);
  const attr = (tag: string, name: string) => new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];
  const byProp = (p: string) => {
    for (const t of metas) if ((attr(t, "property") || attr(t, "name"))?.toLowerCase() === p) return attr(t, "content");
    return undefined;
  };
  const title = byProp("og:title") || /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)?.[1];
  const candidates = [
    byProp("og:video:secure_url"), byProp("og:video:url"), byProp("og:video"),
    byProp("twitter:player:stream"), byProp("og:audio:secure_url"), byProp("og:audio"),
    /<(?:video|audio|source)\s[^>]*src\s*=\s*["']([^"']+)["']/i.exec(html)?.[1],
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      const url = new URL(c.replace(/&amp;/g, "&"), base);
      if (!/^https?:$/.test(url.protocol)) continue;
      if (/\.(m3u8|mpd)(\?|$)/i.test(url.pathname)) continue; // streaming manifests are not direct files
      return { url, title: title ? decodeEntities(title) : undefined };
    } catch {}
  }
  return null;
}

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}
