import sharp from "sharp";
import { writeFileSync, readFileSync } from "node:fs";
import { iconSvg } from "./icon-svg.mjs";
const out = new URL("../public/", import.meta.url).pathname;
const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(out + file);

await png(iconSvg({ size: 192 }), "icons/icon-192.png");
await png(iconSvg({ size: 512 }), "icons/icon-512.png");
await png(iconSvg({ size: 180 }), "icons/apple-touch-icon.png");
await png(iconSvg({ size: 512, pad: 70 }), "icons/maskable-512.png"); // safe-zone padding
await png(iconSvg({ size: 64, rounded: true }), "icons/favicon-64.png");
writeFileSync(out + "icons/favicon.svg", iconSvg({ size: 64, rounded: true }));

// Splash screens: brand icon + wordmark on the light background.
const list = JSON.parse(readFileSync(new URL("../lib/splash.json", import.meta.url)));
for (const { w, h, r } of list) {
  const W = w * r, H = h * r, icon = Math.round(W * 0.26);
  const ix = (W - icon) / 2, iy = H * 0.40 - icon / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF7FD"/><stop offset="1" stop-color="#E2F1FB"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <svg x="${ix}" y="${iy}" width="${icon}" height="${icon}" viewBox="0 0 512 512">
      <clipPath id="c"><rect width="512" height="512" rx="115"/></clipPath>
      <g clip-path="url(#c)">${iconSvg({ size: 512 }).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
    </svg>
    <text x="${W / 2}" y="${iy + icon + W * 0.13}" font-family="Arial, sans-serif" font-weight="700" font-size="${W * 0.085}" fill="#0B0F14" text-anchor="middle" direction="rtl">צור-tone</text>
  </svg>`;
  await png(svg, `splash/splash-${W}x${H}.png`);
}
console.log("icons + splash generated");
