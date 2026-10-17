import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Brand typefaces, self-hosted (SIL OFL 1.1; license in ./fonts). Latin subsets from Google Fonts.
const publicSans = localFont({ src: "./fonts/PublicSans-Variable-latin.woff2", weight: "400 700", variable: "--pww-font-sans-face", display: "swap" });

export const metadata: Metadata = {
  title: "PA Watershed Watch | Watershed Dashboard",
  description: "Public water quality monitoring dashboard",
  icons: { icon: "/brand/pww-mark-master.svg" },
};

export const viewport: Viewport = { themeColor: "#F6F3EC" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={publicSans.variable}>
      <body>{children}</body>
    </html>
  );
}
