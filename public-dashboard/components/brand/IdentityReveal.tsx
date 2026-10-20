"use client";

import { useId, useMemo } from "react";
import { REVEAL_SVG, type RevealLayout } from "@/lib/brand/reveal.generated";

/**
 * The Watershed Watch mark or lockup, drawn by the shared reveal (styles/reveal.css). With `play` off it
 * renders settled, which is identical to the static logo; that is also the reduced-motion presentation.
 * Decorative: pair it with visible text or a label elsewhere.
 */
export function IdentityReveal({ layout, play, dark = false, className }: { layout: RevealLayout; play: boolean; dark?: boolean; className?: string }) {
  const id = `wwr${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const markup = useMemo(() => REVEAL_SVG[layout].replaceAll("__ID__", id), [layout, id]);
  return (
    <span
      className={["wwr", dark ? "wwr--dark" : "", className].filter(Boolean).join(" ")}
      data-play={play ? "true" : undefined}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
