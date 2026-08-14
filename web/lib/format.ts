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
