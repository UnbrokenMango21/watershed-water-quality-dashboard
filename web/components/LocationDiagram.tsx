'use client';

/**
 * A small, dependency-free spatial summary of where the sample was taken
 * relative to the catalogued site.
 *
 * This is deliberately *not* a slippy map: no tiles, no API key, no new
 * dependency, nothing that can break a deploy. It answers the only spatial
 * question a QC reviewer actually asks — "did they stand where the site says
 * they should have stood, and how confident was the GPS?" — using the
 * coordinates already stored on the revision.
 *
 * Nothing here is recomputed for the record: the stored `site_distance_m` is
 * what the console reports. The geometry below is purely for drawing.
 */
import { formatNumber } from '@/lib/format';
import type { Nullable } from '@/lib/types';

const W = 248;
const H = 146;
const CX = W / 2;
const CY = H / 2;
const R = 56; // radius, in px, of the plotted area

/** Metres per degree, good enough for a diagram at watershed scale. */
const M_PER_DEG = 111_320;

export default function LocationDiagram({
  siteLat,
  siteLon,
  sampleLat,
  sampleLon,
  toleranceM,
  gpsAccuracyM,
  distanceM,
}: {
  siteLat: Nullable<number>;
  siteLon: Nullable<number>;
  sampleLat: Nullable<number>;
  sampleLon: Nullable<number>;
  toleranceM: Nullable<number>;
  gpsAccuracyM: Nullable<number>;
  distanceM: Nullable<number>;
}) {
  if (sampleLat == null || sampleLon == null) return null;

  const hasSite = siteLat != null && siteLon != null;
  const latRad = ((hasSite ? (siteLat as number) : sampleLat) * Math.PI) / 180;

  // Offset of the sample from the catalogued site, in metres.
  const dNorth = hasSite ? (sampleLat - (siteLat as number)) * M_PER_DEG : 0;
  const dEast = hasSite ? (sampleLon - (siteLon as number)) * M_PER_DEG * Math.cos(latRad) : 0;
  const offset = Math.hypot(dNorth, dEast);

  const tolerance = toleranceM ?? 0;
  const accuracy = gpsAccuracyM ?? 0;

  // Fit the largest thing we need to draw, with headroom, into R pixels.
  const span = Math.max(tolerance, offset, accuracy, 5) * 1.45;
  const scale = R / span;

  const px = CX + dEast * scale;
  const py = CY - dNorth * scale;

  const toleranceR = tolerance * scale;
  const accuracyR = Math.max(accuracy * scale, 3);
  const withinTolerance = toleranceM != null && distanceM != null && distanceM <= toleranceM;

  // A round-ish number for the scale bar, ~1/3 of the drawn span.
  const rough = span / 3;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const barMetres = Math.max(1, Math.round(rough / magnitude) * magnitude);
  const barPx = barMetres * scale;

  return (
    <figure className="location-figure">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(distanceM, toleranceM, gpsAccuracyM)}>
        <defs>
          <pattern id="loc-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0v16" fill="none" stroke="var(--border-soft)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="var(--surface)" />
        <rect x="0" y="0" width={W} height={H} fill="url(#loc-grid)" />

        {/* Site tolerance: the radius the collector was meant to stay inside. */}
        {toleranceR > 0 ? (
          <circle
            cx={CX}
            cy={CY}
            r={toleranceR}
            fill={withinTolerance ? 'var(--ok-bg)' : 'var(--warning-bg)'}
            fillOpacity="0.75"
            stroke={withinTolerance ? 'var(--ok)' : 'var(--warning)'}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}

        {/* Catalogued site position. */}
        {hasSite ? (
          <g stroke="var(--text-faint)" strokeWidth="1.4" strokeLinecap="round">
            <path d={`M${CX - 5} ${CY}h10`} />
            <path d={`M${CX} ${CY - 5}v10`} />
          </g>
        ) : null}

        {/* Line from the site to where the sample was actually taken. */}
        {hasSite && offset > 0.5 ? (
          <path
            d={`M${CX} ${CY}L${px} ${py}`}
            stroke="var(--brand-600)"
            strokeWidth="1.2"
            strokeDasharray="2 3"
          />
        ) : null}

        {/* GPS accuracy halo, then the sample point itself. */}
        <circle cx={px} cy={py} r={accuracyR} fill="var(--brand-600)" fillOpacity="0.14" />
        <circle cx={px} cy={py} r="4.5" fill="var(--brand-600)" stroke="var(--surface)" strokeWidth="1.6" />

        {/* Scale bar. */}
        <g stroke="var(--text-faint)" strokeWidth="1" strokeLinecap="round">
          <path d={`M12 ${H - 13}h${Math.max(barPx, 12)}`} />
          <path d={`M12 ${H - 16}v6`} />
          <path d={`M${12 + Math.max(barPx, 12)} ${H - 16}v6`} />
        </g>
        <text
          x={12 + Math.max(barPx, 12) + 6}
          y={H - 10}
          fill="var(--text-faint)"
          fontSize="9"
          fontFamily="var(--sans)"
        >
          {barMetres} m
        </text>

        <text x={W - 10} y="15" fill="var(--text-faint)" fontSize="9" textAnchor="end" fontFamily="var(--sans)">
          N ↑
        </text>
      </svg>
      <figcaption>
        {hasSite ? 'Sample position relative to the catalogued site' : 'Sample position and GPS accuracy'}
      </figcaption>
    </figure>
  );
}

function describe(
  distanceM: Nullable<number>,
  toleranceM: Nullable<number>,
  gpsAccuracyM: Nullable<number>,
): string {
  const parts: string[] = [];
  if (distanceM != null) parts.push(`${formatNumber(distanceM, 1)} metres from the catalogued site position`);
  if (toleranceM != null) parts.push(`site tolerance ${formatNumber(toleranceM, 1)} metres`);
  if (gpsAccuracyM != null) parts.push(`GPS accuracy ${formatNumber(gpsAccuracyM, 1)} metres`);
  return parts.length > 0 ? `Location diagram: ${parts.join(', ')}.` : 'Location diagram.';
}
