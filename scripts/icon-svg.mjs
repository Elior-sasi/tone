// Single source of truth for the app icon artwork.
export const NOTE = `
  <g fill="#0B0F14">
    <ellipse cx="226" cy="338" rx="62" ry="46" transform="rotate(-22 226 338)"/>
    <rect x="266" y="140" width="26" height="206" rx="10"/>
    <path d="M279 140 C 300 196, 372 196, 364 268 C 360 300, 346 312, 338 318 C 352 282, 344 244, 292 232 Z"/>
  </g>`;
export const BARS = `
  <g stroke="#FF8A1F" stroke-linecap="round" stroke-width="30">
    <path d="M70 226 V286"/><path d="M122 176 V336"/>
    <path d="M390 176 V336"/><path d="M442 226 V286"/>
  </g>`;
export function iconSvg({ size = 512, pad = 0, rounded = false, bg = "#7CCBF5" } = {}) {
  const s = 512 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${s} ${s}">
  <rect x="${-pad}" y="${-pad}" width="${s}" height="${s}" ${rounded ? 'rx="115"' : ""} fill="${bg}"/>
  <circle cx="256" cy="256" r="236" fill="#9ED9F8" opacity=".55"/>
  ${BARS}${NOTE}
</svg>`;
}
