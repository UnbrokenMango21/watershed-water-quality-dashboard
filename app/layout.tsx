import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Watershed Water Quality Dashboard",
  description: "Public-facing watershed water quality dashboard with dynamic parameter charts and site mapping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
