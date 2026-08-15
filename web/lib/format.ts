/**
 * Display formatting helpers. Uses stdlib `Intl` / `Date` only - no date library.
 */
import type { Nullable } from './types';

export const EMPTY = '—'; // em dash

/** All collection times are shown in the watershed's local time zone. */
const EASTERN = 'America/New_York';

const easternDateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const easternDateOnly = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const easternTimeOnly = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN,
  hour: 'numeric',
  minute: '2-digit',
});

/** Firestore Timestamp | Date | epoch-millis | ISO string -> Date, or null. */
export function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const converted = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(converted.valueOf()) ? null : converted;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  }
  return null;
}

/** "Aug 13, 2026, 4:05 PM" in America/New_York, or an em dash. */
export function formatEastern(value: unknown): string {
  const date = toDate(value);
  return date ? `${easternDateTime.format(date)} ET` : EMPTY;
}

/**
 * The date half of a timestamp, e.g. "Aug 13, 2026". Pairs with
 * `formatEasternTime` so a reviewer can scan dates down a column without the
 * clock time competing for attention.
 */
export function formatEasternDate(value: unknown): string {
  const date = toDate(value);
  return date ? easternDateOnly.format(date) : EMPTY;
}

/** The clock half of a timestamp, e.g. "4:05 PM ET". */
export function formatEasternTime(value: unknown): string {
  const date = toDate(value);
  return date ? `${easternTimeOnly.format(date)} ET` : EMPTY;
}

/**
 * A short, recognisable prefix of a UUID for display. The full value is always
 * kept alongside it (title / aria-label) so nothing is actually hidden — this
 * only stops 36-character identifiers from dominating a row.
 */
export function shortId(value: Nullable<string>, length = 8): string {
  const text = value == null ? '' : String(value).trim();
  if (text.length === 0) return EMPTY;
  return text.length <= length + 1 ? text : `${text.slice(0, length)}…`;
}

/**
 * Quality scores are stored 0–100. Returns a 0–100 percentage for the meter
 * bar, defensively normalising a 0–1 fraction if one ever appears.
 */
export function qualityPercent(value: Nullable<number>): number | null {
  if (value == null || typeof value !== 'number' || Number.isNaN(value)) return null;
  const scaled = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, scaled));
}

/**
 * Human-readable elapsed time, e.g. "3d 1h", "2h 14m", "12m".
 * `now` is passed in so the caller controls the clock (and so server-rendered
 * markup never disagrees with the browser).
 */
export function formatElapsed(since: unknown, now: number): string {
  const start = toDate(since);
  if (!start) return EMPTY;

  const totalMinutes = Math.max(0, Math.floor((now - start.valueOf()) / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Numbers straight from Firestore, with an em dash for null/undefined/NaN. */
export function formatNumber(value: Nullable<number>, fractionDigits?: number): string {
  if (value == null || typeof value !== 'number' || Number.isNaN(value)) return EMPTY;
  return fractionDigits == null ? String(value) : value.toFixed(fractionDigits);
}

export function formatText(value: Nullable<string>): string {
  return value != null && String(value).trim().length > 0 ? String(value) : EMPTY;
}

const UNIT_LABELS: Record<string, string> = {
  'ph-standard': 'pH',
  'mg-o2-l': 'mg/L as O₂',
  'umol-o2-l': 'µmol/L as O₂',
  percent: '%',
  'us-cm': 'µS/cm',
  'ms-cm': 'mS/cm',
  's-m': 'S/m',
  'uS/cm': 'µS/cm',
  'mg-l': 'mg/L',
  'ug-l': 'µg/L',
  'g-l': 'g/L',
  mv: 'mV',
  v: 'V',
  'mg-n-l': 'mg/L as N',
  'ug-n-l': 'µg/L as N',
  'mg-no3-l': 'mg/L as NO₃',
  'ug-no3-l': 'µg/L as NO₃',
  'mg-p-l': 'mg/L as P',
  'ug-p-l': 'µg/L as P',
  'mg-po4-l': 'mg/L as PO₄',
  'ug-po4-l': 'µg/L as PO₄',
  'm3-s': 'm³/s',
  'l-s': 'L/s',
  'ft3-s': 'ft³/s (cfs)',
  'gal-min': 'US gal/min',
  'm3/s': 'm³/s',
};

export function formatUnit(value: Nullable<string>): string {
  return value ? (UNIT_LABELS[value] ?? value) : EMPTY;
}

export function formatBoolean(value: Nullable<boolean>): string {
  if (value == null) return EMPTY;
  return value ? 'Yes' : 'No';
}

export function formatBytes(value: Nullable<number>): string {
  if (value == null || typeof value !== 'number' || Number.isNaN(value)) return EMPTY;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/** Turn PENDING_REVIEW / REVIEW_NEEDS_CORRECTION into human-readable words. */
export function humanizeCode(value: Nullable<string>): string {
  if (!value) return EMPTY;
  return value
    .split('_')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(' ');
}

/**
 * Sentence case rather than title case: VALIDATION_COMPLETED -> "Validation
 * completed". Used for audit event names and other prose-like labels, where
 * Title Case Reads Like A Headline instead of a log entry.
 *
 * Known acronyms are preserved so "QC reviewer" does not become "Qc reviewer".
 */
const ACRONYMS = new Set(['QC', 'ID', 'GPS', 'API', 'ET', 'PH']);

export function humanizeSentence(value: Nullable<string>): string {
  if (!value) return EMPTY;
  const words = value.split('_').filter((part) => part.length > 0);
  if (words.length === 0) return EMPTY;
  return words
    .map((word, index) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper === 'PH' ? 'pH' : upper;
      const lower = word.toLowerCase();
      return index === 0 ? lower[0].toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}
