import type { Metadata, Viewport } from "next";
import "./globals.css";

/* De fonts worden als gedeelde stylesheet geladen zodat lokale builds en
   forks geen fontdownload tijdens `next build` nodig hebben. */
/* eslint-disable @next/next/no-page-custom-font */

export const metadata: Metadata = {
  title: "Ultimate Challenges",
  description: "Gedeelde agenda voor sportuitdagingen. Doe mee of kom supporten.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edeee8" },
    { media: "(prefers-color-scheme: dark)", color: "#12150f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
