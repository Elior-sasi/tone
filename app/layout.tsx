import type { Metadata, Viewport } from "next";
import "./globals.css";
import splash from "@/lib/splash.json";

export const metadata: Metadata = {
  title: "צור-tone",
  description: "הופכים רגע לצלצול. בוחרים עד 30 שניות מסרטון או משיר, ויוצרים צלצול לאייפון.",
  applicationName: "צור-tone",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "צור-tone", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef7fd" },
    { media: "(prefers-color-scheme: dark)", color: "#05080c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {splash.map(({ w, h, r }) => (
          <link
            key={`${w}x${h}@${r}`}
            rel="apple-touch-startup-image"
            href={`/splash/splash-${w * r}x${h * r}.png`}
            media={`screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`}
          />
        ))}
      </head>
      <body>
        <div className="app-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
