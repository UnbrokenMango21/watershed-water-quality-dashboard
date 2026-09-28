import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';

import './brand-tokens.css';
import './globals.css';

// Brand typefaces, self-hosted (SIL OFL 1.1; licenses in ./fonts). Latin subsets from Google Fonts.
const publicSans = localFont({ src: './fonts/PublicSans-Variable-latin.woff2', weight: '400 700', variable: '--pww-font-sans-face', display: 'swap' });
const plexMono = localFont({
  src: [
    { path: './fonts/IBMPlexMono-Regular-latin.woff2', weight: '400' },
    { path: './fonts/IBMPlexMono-Medium-latin.woff2', weight: '500' },
  ],
  variable: '--pww-font-mono-face',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PA Watershed Watch | Quality Review',
  description: 'Quality-control review interface for Central PA Watershed field observations.',
  icons: { icon: '/brand/pww-mark-master.svg' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F3EC' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1A17' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme="system" lets the brand tokens follow the reviewer's light/dark preference.
    <html lang="en" data-theme="system" className={`${publicSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
