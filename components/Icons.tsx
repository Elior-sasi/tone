import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 24): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false,
});

export const IconVideo = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="2.5" y="5.5" width="13" height="13" rx="3" /><path d="m15.5 10 5-3v10l-5-3" /></svg>
);
export const IconMusic = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
);
export const IconLink = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>
);
export const IconGear = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
);
/** Points right - the "back" direction in an RTL interface. */
export const IconBack = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={2.5}><path d="m9 5 7 7-7 7" /></svg>
);
export const IconPlay = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} fill="currentColor" stroke="none"><path d="M8 5.1v13.8a1 1 0 0 0 1.5.9l10.8-6.9a1 1 0 0 0 0-1.7L9.5 4.2A1 1 0 0 0 8 5.1Z" /></svg>
);
export const IconPause = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} fill="currentColor" stroke="none"><rect x="6" y="4.5" width="4.2" height="15" rx="1.3" /><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.3" /></svg>
);
export const IconShare = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3v12" /><path d="m7.5 7.5 4.5-4.5 4.5 4.5" /><path d="M8 11H6.5A2.5 2.5 0 0 0 4 13.5v5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-5a2.5 2.5 0 0 0-2.5-2.5H16" /></svg>
);
export const IconDownload = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3v12" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" /></svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={3}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={2.4}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconLoop = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m17 2 3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="m7 22-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></svg>
);
export const IconScissors = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" /></svg>
);
export const IconLock = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
);
export const IconInfo = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.6v.1" strokeWidth={2.8} /></svg>
);
export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconAlert = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17v.1" strokeWidth={2.8} /></svg>
);
export const IconStepBack = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M11 17 6 12l5-5" /><path d="M18 17l-5-5 5-5" /></svg>
);
export const IconStepFwd = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="m13 17 5-5-5-5" /><path d="m6 17 5-5-5-5" /></svg>
);
export const IconAddHome = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></svg>
);
export const IconPhone = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="6.5" y="2.5" width="11" height="19" rx="2.8" /><path d="M11 18.5h2" /></svg>
);

/** Brand mark - same artwork as the app icon (scripts/icon-svg.mjs). */
export const BrandMark = ({ size = 40, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden focusable={false} {...p}>
    <rect width="512" height="512" rx="115" fill="#7CCBF5" />
    <circle cx="256" cy="256" r="236" fill="#9ED9F8" opacity=".55" />
    <g stroke="#FF8A1F" strokeLinecap="round" strokeWidth="30">
      <path d="M70 226V286" /><path d="M122 176V336" /><path d="M390 176V336" /><path d="M442 226V286" />
    </g>
    <g fill="#0B0F14">
      <ellipse cx="226" cy="338" rx="62" ry="46" transform="rotate(-22 226 338)" />
      <rect x="266" y="140" width="26" height="206" rx="10" />
      <path d="M279 140C300 196 372 196 364 268C360 300 346 312 338 318C352 282 344 244 292 232Z" />
    </g>
  </svg>
);
