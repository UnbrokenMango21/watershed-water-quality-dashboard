"use client";

import { useEffect, useRef, useState } from "react";
import { IdentityReveal } from "@/components/brand/IdentityReveal";
import { REVEAL_TIMING } from "@/lib/brand/reveal.generated";
import type { MapPhase } from "./useDashboardMap";

/** Where the approved public records stand, as reported by the dashboard's data source. */
export type RecordsPhase = "loading" | "ready" | "empty" | "error";

type Stage = "waiting" | "showing" | "exiting" | "gone";
const PLAYED_KEY = "ww-reveal-played";

function readPlayed() {
  try { return window.sessionStorage.getItem(PLAYED_KEY) === "1"; } catch { return false; }
}
function markPlayed() {
  try { window.sessionStorage.setItem(PLAYED_KEY, "1"); } catch { /* storage unavailable: the reveal may replay */ }
}

/**
 * Covers only the map region while the map is genuinely not usable. Nothing appears for the first
 * 200 ms, so a fast or cached map never flashes a loader. The mark draws once per browser session;
 * after that, and with reduced motion, it is shown settled. The veil lifts as soon as the map has drawn
 * and the approved-record request has settled (with data, empty or failed). After the timeout it lifts
 * regardless and leaves a small notice with a retry, so it can never hold the page.
 */
export function MapLoadVeil({ mapPhase, records, onRetry }: { mapPhase: MapPhase; records: RecordsPhase; onRetry: () => void }) {
  const [stage, setStage] = useState<Stage>("waiting");
  const [play, setPlay] = useState(false);
  const [slow, setSlow] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const playDecided = useRef(false);

  const failed = mapPhase === "error";
  const settled = mapPhase === "ready" && records !== "loading";
  const lifting = stage === "exiting" || stage === "gone";

  useEffect(() => {
    setSlow(false);
    setTimedOut(false);
    const timers = [
      window.setTimeout(() => setStage((current) => (current === "waiting" ? "showing" : current)), REVEAL_TIMING.showAfterMs),
      window.setTimeout(() => setSlow(true), REVEAL_TIMING.slowAfterMs),
      window.setTimeout(() => setTimedOut(true), REVEAL_TIMING.timeoutMs),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [attempt]);

  // A failure is shown at once, without waiting for the 200 ms grace period.
  useEffect(() => {
    if (failed && stage === "waiting") setStage("showing");
  }, [failed, stage]);

  useEffect(() => {
    if (stage !== "showing" || playDecided.current) return;
    playDecided.current = true;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && !readPlayed()) {
      setPlay(true);
      markPlayed();
    }
  }, [stage]);

  useEffect(() => {
    if (lifting || failed || !(settled || timedOut)) return;
    setStage("exiting");
  }, [failed, lifting, settled, timedOut]);

  useEffect(() => {
    if (stage !== "exiting") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setStage("gone"), reduceMotion ? 0 : REVEAL_TIMING.exitFadeMs + 40);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const retry = () => {
    onRetry();
    setAttempt((value) => value + 1);
    if (stage === "gone") return;
    setStage("showing");
  };

  if (stage === "gone") {
    if (settled) return null;
    return (
      <div className="map-notice" role="status" data-map-notice={failed ? "error" : "slow"}>
        <span>{failed ? "The map couldn't load." : "The map is taking longer than usual."}</span>
        <button type="button" onClick={retry}>Try again</button>
      </div>
    );
  }

  const status = failed ? "The map couldn't load"
    : mapPhase === "loading" ? "Loading the map"
      : mapPhase === "drawing" || settled ? "Drawing the map"
        : "Checking for approved records";

  return (
    <div className="map-veil" data-stage={stage} data-veil-state={failed ? "error" : slow ? "slow" : "loading"} data-play={play ? "true" : "false"} aria-hidden={stage === "exiting" ? true : undefined}>
      <div className="map-veil-inner" hidden={stage === "waiting"}>
        <IdentityReveal layout="mark" play={play && !failed} className="map-veil-mark" />
        <p className="map-veil-status" role="status" aria-live="polite">{status}</p>
        {failed ? (
          <>
            <p className="map-veil-note">Check your connection and try again. The site list still works without the map.</p>
            <button type="button" className="map-veil-retry" onClick={retry}>Try again</button>
          </>
        ) : slow ? (
          <p className="map-veil-note">This is taking longer than usual. On a slow connection the map can take a little while.</p>
        ) : null}
      </div>
    </div>
  );
}
