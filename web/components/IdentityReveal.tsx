'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { REVEAL_SVG, REVEAL_TIMING, type RevealLayout } from '../lib/reveal.generated';

const PLAYED_KEY = 'ww-reveal-played';

/**
 * The Watershed Watch mark drawn by the shared reveal (app/reveal.css, generated from
 * brand/motion/source/motion-spec.json). It appears only after the shared 200 ms grace period, plays
 * once per browser session and is shown settled with reduced motion. It never delays the page: the
 * caller removes it as soon as the real work it accompanies has finished.
 */
export function IdentityReveal({ layout = 'mark', className }: { layout?: RevealLayout; className?: string }) {
  const id = `wwr${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const markup = useMemo(() => REVEAL_SVG[layout].replaceAll('__ID__', id), [layout, id]);
  const [visible, setVisible] = useState(false);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let played = false;
      try { played = window.sessionStorage.getItem(PLAYED_KEY) === '1'; } catch { /* storage unavailable */ }
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!played && !reduceMotion) {
        setPlay(true);
        try { window.sessionStorage.setItem(PLAYED_KEY, '1'); } catch { /* storage unavailable */ }
      }
      setVisible(true);
    }, REVEAL_TIMING.showAfterMs);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <span
      className={['wwr', className].filter(Boolean).join(' ')}
      data-play={play ? 'true' : undefined}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
