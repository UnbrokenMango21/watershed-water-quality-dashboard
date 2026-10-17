import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./site.css";

const publicSans = localFont({
  src: "./fonts/PublicSans-Variable-latin.woff2",
  weight: "400 700",
  variable: "--pww-font-sans-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Watershed Watch", template: "%s | Watershed Watch" },
  description:
    "Water quality readings from Central Pennsylvania streams, collected in the field and reviewed by a person before they are published.",
  applicationName: "Watershed Watch",
  icons: { icon: "/brand/watershed-watch-mark.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#F6F3EC" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={publicSans.variable}>
      <head>
        {/* The dashboard's map tiles and public views come from these hosts. */}
        <link rel="preconnect" href="https://services.arcgisonline.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://services9.arcgis.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
