/**
 * Shared presentational primitives for the QC Console.
 *
 * These components carry no behaviour and read no data — they exist so that a
 * status, a severity, an identifier or a scientific value looks and reads the
 * same everywhere in the console.
 *
 * Accessibility contract for this file: severity and status are never
 * communicated by colour alone. Every severity has a distinct glyph *and* a
 * word, and every glyph is aria-hidden so a screen reader hears the word only
 * once.
 */
import type { ReactNode } from 'react';

import { EMPTY, formatNumber, formatUnit, humanizeCode, qualityPercent, shortId } from '@/lib/format';
import type { FlagSeverity, Nullable, SubmissionStatus } from '@/lib/types';

/* -------------------------------------------------------------- severity */

export interface SeverityMeta {
  /** Plural heading used above a group of flags. */
  label: string;
  /** Singular word used inside a badge. */
  word: string;
  badgeClass: string;
  /** Distinct per severity, so shape/character alone distinguishes them. */
  glyph: string;
  /** Plain-language explanation of what this severity means for review. */
  note: string;
}

export const SEVERITY_META: Record<FlagSeverity, SeverityMeta> = {
  ERROR: {
    label: 'Errors',
    word: 'error',
    badgeClass: 'badge-error',
    glyph: '✕',
    note: 'The record breaks a validation rule. These block approval until the collector files a corrected revision.',
  },
  PLAUSIBILITY_WARNING: {
    label: 'Plausibility warnings',
    word: 'warning',
    badgeClass: 'badge-warning',
    glyph: '!',
    note: 'The value is possible but unusual. Use your judgement — a warning does not block approval.',
  },
  ENVIRONMENTAL_ALERT: {
    label: 'Environmental alerts',
    word: 'environmental alert',
    badgeClass: 'badge-alert',
    glyph: '≈',
    note: 'The data looks valid, and it is describing a notable condition in the water. This is a finding about the watershed, not a problem with the submission.',
  },
  INFO: {
    label: 'Info',
    word: 'info note',
    badgeClass: 'badge-neutral',
    glyph: 'i',
    note: 'Context recorded by the validation service. No reviewer action is implied.',
  },
};

export function severityMeta(severity: Nullable<string>): SeverityMeta | null {
  if (!severity) return null;
  return SEVERITY_META[severity as FlagSeverity] ?? null;
}

/** The small coloured mark that precedes a severity word. Decorative only. */
export function Glyph({ char, className = '' }: { char: string; className?: string }) {
  return (
    <span className={`glyph ${className}`.trim()} aria-hidden="true">
      {char}
    </span>
  );
}

/* ---------------------------------------------------------------- badges */

export function Badge({
  tone = 'neutral',
  glyph,
  children,
  large = false,
  title,
}: {
  tone?: 'neutral' | 'ok' | 'error' | 'warning' | 'alert' | 'brand';
  glyph?: string;
  children: ReactNode;
  large?: boolean;
  title?: string;
}) {
  const classes = ['badge', `badge-${tone}`, large ? 'badge-lg' : ''].filter(Boolean).join(' ');
  return (
    <span className={classes} title={title}>
      {glyph ? <Glyph char={glyph} /> : null}
      {children}
    </span>
  );
}

type Tone = 'neutral' | 'ok' | 'error' | 'warning' | 'alert' | 'brand';

const STATUS_TONE: Record<SubmissionStatus, Tone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'neutral',
  VALIDATING: 'neutral',
  PENDING_REVIEW: 'brand',
  NEEDS_CORRECTION: 'warning',
  RESUBMITTED: 'brand',
  APPROVED: 'ok',
  REJECTED: 'error',
  PUBLISHING: 'neutral',
  PUBLISH_FAILED: 'error',
  PUBLISHED: 'ok',
};

/**
 * Workflow state, shown in words. The raw enum stays available as a tooltip so
 * the console still speaks the same language as the database when someone needs
 * it to.
 */
export function StatusBadge({ status, large = false }: { status: Nullable<string>; large?: boolean }) {
  if (!status) return <Badge tone="neutral">Unknown status</Badge>;
  const tone = STATUS_TONE[status as SubmissionStatus] ?? 'neutral';
  return (
    <Badge tone={tone} large={large} title={status}>
      <span className="sr-only">Workflow status: </span>
      {humanizeCode(status)}
    </Badge>
  );
}

/* ----------------------------------------------------------- identifiers */

/**
 * A technical identifier rendered as quiet, compact monospace. The full value
 * is always reachable (tooltip + screen-reader label); only its visual weight
 * is reduced.
 */
export function Uuid({
  value,
  label,
  block = false,
  chars = 8,
}: {
  value: Nullable<string>;
  label: string;
  block?: boolean;
  chars?: number;
}) {
  const full = value == null ? '' : String(value);
  if (full.trim().length === 0) {
    return <span className="faint">{EMPTY}</span>;
  }
  return (
    <span className={block ? 'uuid uuid-block' : 'uuid'} title={`${label}: ${full}`}>
      <span className="sr-only">{label}: </span>
      {shortId(full, chars)}
    </span>
  );
}

/* --------------------------------------------------------------- quality */

/**
 * Overall quality as a number plus a restrained bar. The bar is a secondary
 * cue: the number is always present, and the band is also stated in words for
 * screen readers.
 */
export function QualityMeter({
  value,
  small = false,
  showLabel = true,
}: {
  value: Nullable<number>;
  small?: boolean;
  showLabel?: boolean;
}) {
  const percent = qualityPercent(value);
  if (percent === null) {
    return <span className="faint">{EMPTY}</span>;
  }
  const band = percent >= 80 ? 'good' : percent >= 55 ? 'fair' : 'low';
  const fillClass = band === 'good' ? '' : band === 'fair' ? 'meter-low' : 'meter-critical';
  return (
    <span>
      <span className={small ? 'cell-primary' : 'stat-value'}>
        {formatNumber(Math.round(percent))}
        {showLabel ? <small>/ 100 · {band}</small> : <span className="sr-only"> out of 100, {band}</span>}
      </span>
      <span className={small ? 'meter meter-sm' : 'meter'} aria-hidden="true">
        <span className={`meter-fill ${fillClass}`.trim()} style={{ width: `${percent}%` }} />
      </span>
    </span>
  );
}

/* ------------------------------------------------------- scientific value */

/**
 * Entered value and canonical value side by side.
 *
 * Provenance rule: what the collector typed is shown first and loudest, and the
 * canonical value stored for validation is shown next to it. Neither value is
 * recomputed here — both come straight from the record.
 */
export function ValuePair({
  enteredValue,
  enteredUnit,
  canonicalValue,
  canonicalUnit,
  enteredSuffix,
  canonicalSuffix,
}: {
  enteredValue: Nullable<number>;
  enteredUnit: Nullable<string>;
  canonicalValue: Nullable<number>;
  canonicalUnit: Nullable<string>;
  /** Optional pre-formatted unit override (used by temperature's ° symbol). */
  enteredSuffix?: string;
  canonicalSuffix?: string;
}) {
  const enteredUnitText = enteredSuffix ?? formatUnit(enteredUnit);
  const canonicalUnitText = canonicalSuffix ?? formatUnit(canonicalUnit);
  const identical =
    enteredValue != null &&
    canonicalValue != null &&
    enteredValue === canonicalValue &&
    enteredUnitText === canonicalUnitText;

  return (
    <div className="value-pair">
      <div className="value-block">
        <span className="value-label">Entered</span>
        <span className="value-figure">
          {formatNumber(enteredValue)}
          <span className="value-unit">{enteredUnitText}</span>
        </span>
      </div>
      {identical ? (
        <p className="value-same">Canonical value is identical.</p>
      ) : (
        <div className="value-block value-block-canonical">
          <span className="value-label">Canonical</span>
          <span className="value-figure">
            {formatNumber(canonicalValue)}
            <span className="value-unit">{canonicalUnitText}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ flag counts */

/**
 * The at-a-glance validation summary. Only non-zero severities get a badge, so
 * a clean record reads as one calm "No flags" rather than four zeroes.
 */
export function FlagSummary({
  errors,
  warnings,
  alerts,
  info,
  compact = false,
}: {
  errors: Nullable<number>;
  warnings: Nullable<number>;
  alerts: Nullable<number>;
  info: Nullable<number>;
  compact?: boolean;
}) {
  const entries: { count: number; severity: FlagSeverity }[] = [
    { count: errors ?? 0, severity: 'ERROR' },
    { count: warnings ?? 0, severity: 'PLAUSIBILITY_WARNING' },
    { count: alerts ?? 0, severity: 'ENVIRONMENTAL_ALERT' },
    { count: info ?? 0, severity: 'INFO' },
  ];
  const present = entries.filter((entry) => entry.count > 0);

  if (present.length === 0) {
    return (
      <span className="badge-stack">
        <Badge tone="ok" glyph="✓">
          No flags
        </Badge>
      </span>
    );
  }

  return (
    <span className="badge-stack">
      {present.map(({ count, severity }) => {
        const meta = SEVERITY_META[severity];
        const tone =
          severity === 'ERROR'
            ? 'error'
            : severity === 'PLAUSIBILITY_WARNING'
              ? 'warning'
              : severity === 'ENVIRONMENTAL_ALERT'
                ? 'alert'
                : 'neutral';
        return (
          <Badge key={severity} tone={tone} glyph={meta.glyph}>
            {count}
            {compact ? '' : ` ${meta.word}${count === 1 ? '' : 's'}`}
            {compact ? <span className="sr-only"> {meta.word}s</span> : null}
          </Badge>
        );
      })}
    </span>
  );
}

/* --------------------------------------------------------------- sections */

/**
 * A titled card. `note` is a short right-aligned caption in the card head —
 * counts, timestamps, "3 shown", and similar.
 */
export function Section({
  title,
  note,
  children,
  className = '',
  id,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`card ${className}`.trim()} id={id}>
      <div className="card-head">
        <h2>{title}</h2>
        {note ? <div className="card-head-note">{note}</div> : null}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}
