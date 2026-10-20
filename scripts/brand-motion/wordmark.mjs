// Lifts the "Watershed Watch" glyph outlines from the archived horizontal wordmark master.
// The master reads "PA Watershed Watch"; its "P" and "A" contours are dropped and the remaining
// outlines are shifted left so "W" starts where "P" did. Glyph shapes and spacing are unchanged.
import fs from "node:fs";

const TOKEN = /([MLQZ])|(-?\d*\.?\d+)/g;

/** Splits an absolute M/L/Q/Z path into subpaths of [command, ...numbers] tuples. */
export function parseSubpaths(d) {
  const subpaths = [];
  let current = null;
  let command = null;
  let numbers = [];
  const flush = () => {
    if (command === null) return;
    current.push([command, ...numbers]);
    numbers = [];
  };
  for (const [, cmd, num] of d.matchAll(TOKEN)) {
    if (cmd) {
      flush();
      command = cmd;
      if (cmd === "M") { current = []; subpaths.push(current); }
    } else {
      numbers.push(Number(num));
    }
  }
  flush();
  return subpaths;
}

export function bbox(subpaths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const sub of subpaths) for (const [, ...n] of sub) for (let i = 0; i < n.length; i += 2) {
    minX = Math.min(minX, n[i]); maxX = Math.max(maxX, n[i]);
    minY = Math.min(minY, n[i + 1]); maxY = Math.max(maxY, n[i + 1]);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function transform(subpaths, { dx = 0, dy = 0, scale = 1 } = {}) {
  return subpaths.map((sub) => sub.map(([cmd, ...n]) => [cmd, ...n.map((v, i) => (i % 2 === 0 ? v * scale + dx : v * scale + dy))]));
}

export function serialize(subpaths, decimals = 2) {
  const f = (v) => Number(v.toFixed(decimals)).toString();
  return subpaths.map((sub) => sub.map(([cmd, ...n]) => cmd + n.map(f).join(" ")).join("")).join("");
}

/** Returns the corrected wordmark outlines in the master's coordinate space. */
export function loadCorrectedWordmark(masterPath, firstWatershedContourMinX) {
  const svg = fs.readFileSync(masterPath, "utf8");
  const d = svg.match(/<path id="wordmark"[^>]*\sd="([^"]+)"/)?.[1];
  if (!d) throw new Error(`No #wordmark path in ${masterPath}`);
  const all = parseSubpaths(d);
  // Contours that start left of the "W" in "Watershed" belong to "P" and "A".
  const legacyStart = bbox(all).minX;
  const kept = all.filter((sub) => bbox([sub]).minX >= firstWatershedContourMinX);
  if (all.length - kept.length !== 4) throw new Error(`Expected to drop the 4 contours of "PA", dropped ${all.length - kept.length}`);
  const dropped = all.length - kept.length;
  const keptStart = bbox(kept).minX;
  const shifted = transform(kept, { dx: legacyStart - keptStart });
  return { subpaths: shifted, dropped, legacyStart, removedAdvance: keptStart - legacyStart };
}
