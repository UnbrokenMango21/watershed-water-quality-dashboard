import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const publicSans = localFont({
  src: "./fonts/PublicSans-Variable-latin.woff2",
  weight: "400 700",
  variable: "--pww-font-sans-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Watershed Watch | Water quality, in context",
  description:
    "Explore watershed monitoring from field collection through scientific review to approved public water-quality records.",
  applicationName: "Watershed Watch",
  icons: { icon: "/brand/pww-mark-master.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#F6F3EC" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={publicSans.variable}>
      <body>{children}</body>
    </html>
  );
}
