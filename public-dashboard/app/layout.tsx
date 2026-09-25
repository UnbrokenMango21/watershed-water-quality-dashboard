import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PA Watershed Watch | Watershed Dashboard",
  description: "Public water quality monitoring dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
