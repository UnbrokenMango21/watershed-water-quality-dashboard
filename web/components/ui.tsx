'use client';

/**
 * Shared presentational primitives for the QC Console.
 *
 * These carry no data-fetching and no workflow logic — they exist so a status,
 * a severity, an identifier, a quality score or a panel looks and reads the
 * same everywhere in the console.
 *
 * Accessibility contract for this file: severity and status are never
 * communicated by colour alone. Every severity has a distinct icon *and* a
 * word, and every icon is aria-hidden so a screen reader hears the word once.
 */
import { useCallback, useState, type ReactNode } from 'react';

import { Icon, type IconName } from '@/components/icons';
import { EMPTY, formatNumber, humanizeCode, qualityPercent, shortId } from '@/lib/format';
import type { FlagSeverity, Nullable, SubmissionStatus } from '@/lib/types';

export type Tone = 'neutral' | 'ok' | 'error' | 'warning' | 'alert' | 'brand';

/* ================================================================ severity */

export interface SeverityMeta {
  /** Plural heading used above a group of findings. */
  label: string;
  /** Singular word used inside a badge. */
  word: string;
  tone: Tone;
  icon: IconName;
  /** Plain-language explanation of what this severity means for review. */
  note: string;
}

export const SEVERITY_META: Record<FlagSeverity, SeverityMeta> = {
  ERROR: {
    label: 'Blocking errors',
    word: 'error',
    tone: 'error',
    icon: 'xCircle',
    note: 'The record breaks a validation rule. These block approval until the collector files a corrected revision.',
  },
  PLAUSIBILITY_WARNING: {
    label: 'Plausibility warnings',
    word: 'warning',
    tone: 'warning',
    icon: 'alert',
    note: 'The value is possible but unusual for this site. Use your judgement — a warning does not block approval.',
  },
  ENVIRONMENTAL_ALERT: {
    label: 'Environmental alerts',
    word: 'environmental alert',
    tone: 'alert',
    icon: 'droplet',
    note: 'The data looks valid and is describing a notable condition in the water. This is a finding about the watershed, not a problem with the submission.',
  },
  INFO: {
    label: 'Information',
    word: 'info note',
    tone: 'neutral',
    icon: 'info',
    note: 'Context recorded by the validation service. No reviewer action is implied.',
  },
};

export const SEVERITY_ORDER: FlagSeverity[] = [
  'ERROR',
  'PLAUSIBILITY_WARNING',
  'ENVIRONMENTAL_ALERT',
  'INFO',
];

export function severityMeta(severity: Nullable<string>): SeverityMeta | null {
  if (!severity) return null;
  return SEVERITY_META[severity as FlagSeverity] ?? null;
}

/* ================================================================== badges */

export function Badge({
  tone = 'neutral',
  icon,
  children,
  large = false,
  title,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
  large?: boolean;
  title?: string;
}) {
  return (
    <span className={`badge badge-${tone}${large ? ' badge-lg' : ''}`} title={title}>
      {icon ? <Icon name={icon} size={large ? 13 : 12} strokeWidth={2} /> : null}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<SubmissionStatus, Tone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'neutral',
  VALIDATING: 'neutral',
  PENDING_REVIEW: 'warning',
  NEEDS_CORRECTION: 'warning',
  RESUBMITTED: 'brand',
  APPROVED: 'ok',
  REJECTED: 'error',
  PUBLISHING: 'neutral',
  PUBLISH_FAILED: 'error',
  PUBLISHED: 'ok',
};

const STATUS_ICON: Partial<Record<SubmissionStatus, IconName>> = {
  PENDING_REVIEW: 'clock',
  NEEDS_CORRECTION: 'history',
  APPROVED: 'checkCircle',
  REJECTED: 'ban',
  PUBLISHED: 'shield',
  PUBLISH_FAILED: 'alert',
  VALIDATING: 'refresh',
};

/**
 * Workflow state in words. The raw enum stays reachable as a tooltip so the
 * console still speaks the database's language when someone needs it to.
 */
export function StatusBadge({ status, large = false }: { status: Nullable<string>; large?: boolean }) {
  if (!status) {
    return <Badge tone="neutral">Unknown status</Badge>;
  }
  const key = status as SubmissionStatus;
  return (
    <Badge tone={STATUS_TONE[key] ?? 'neutral'} icon={STATUS_ICON[key]} large={large} title={status}>
      <span className="sr-only">Workflow status: </span>
      {humanizeCode(status)}
    </Badge>
  );
}

/* ============================================================ identifiers */

/**
 * A technical identifier rendered as quiet, compact monospace. The full value
 * stays reachable (tooltip plus screen-reader label); only its visual weight
 * is reduced.
 */
export function Uuid({
  value,
  label,
  chars = 8,
}: {
  value: Nullable<string>;
  label: string;
  chars?: number;
}) {
  const full = value == null ? '' : String(value);
  if (full.trim().length === 0) return <span className="faint">{EMPTY}</span>;
  return (
    <span className="uuid" title={`${label}: ${full}`}>
      <span className="sr-only">{label}: </span>
      {shortId(full, chars)}
    </span>
  );
}

/** A labelled, copyable identifier row for provenance panels. */
export function IdRow({ label, value }: { label: string; value: Nullable<string> }) {
  const full = value == null ? '' : String(value);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    if (!full) return;
    void navigator.clipboard
      ?.writeText(full)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => undefined);
  }, [full]);

  return (
    <div className="idrow">
      <span className="idrow-label">{label}</span>
      <span className="idrow-value" title={full || undefined}>
        {full ? shortId(full, 12) : EMPTY}
      </span>
      {full ? (
        <button
          type="button"
          className="copy-btn"
          data-copied={copied}
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}${copied ? ' (copied)' : ''}`}
          title={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}
        >
          <Icon name={copied ? 'check' : 'copy'} size={13} />
        </button>
      ) : null}
    </div>
  );
}

/* ================================================================ quality */

export function qualityBand(percent: number): 'good' | 'fair' | 'low' {
  return percent >= 80 ? 'good' : percent >= 55 ? 'fair' : 'low';
}

/**
 * Overall quality: the number reads first, the bar is a secondary cue, and the
 * band is stated in words so the meaning never depends on the colour.
 */
export function QualityBlock({ value }: { value: Nullable<number> }) {
  const percent = qualityPercent(value);
  if (percent === null) {
    return (
      <div>
        <span className="figure-label">Overall quality</span>
        <span className="quality-number faint">{EMPTY}</span>
      </div>
    );
  }
  const band = qualityBand(percent);
  return (
    <div>
      <span className="figure-label">Overall quality</span>
      <div className="quality-block">
        <span className="quality-number">{formatNumber(Math.round(percent))}</span>
        <span className="quality-scale">
          / 100 · <span className={`quality-band quality-band-${band}`}>{band === 'good' ? 'Good' : band === 'fair' ? 'Fair' : 'Low'}</span>
        </span>
      </div>
      <span className="meter" aria-hidden="true">
        <span
          className={`meter-fill${band === 'fair' ? ' meter-fill-fair' : band === 'low' ? ' meter-fill-low' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  );
}

/** The inline meter used inside a queue card. */
export function QualityInline({ value }: { value: Nullable<number> }) {
  const percent = qualityPercent(value);
  if (percent === null) return <span className="faint">{EMPTY}</span>;
  const band = qualityBand(percent);
  return (
    <span className="badge badge-neutral" title={`Overall quality ${Math.round(percent)} of 100 (${band})`}>
      <span className="sr-only">Overall quality </span>
      Q {formatNumber(Math.round(percent))}
    </span>
  );
}

/* =========================================================== flag summary */

export interface FlagCounts {
  errors: number;
  warnings: number;
  alerts: number;
  info: number;
}

/**
 * At-a-glance validation summary. Only non-zero severities get a badge, so a
 * clean record reads as one calm "No flags" rather than four zeroes.
 */
export function FlagSummary({
  counts,
  compact = false,
  hideInfo = false,
}: {
  counts: FlagCounts;
  compact?: boolean;
  hideInfo?: boolean;
}) {
  const entries: { count: number; severity: FlagSeverity }[] = [
    { count: counts.errors, severity: 'ERROR' },
    { count: counts.warnings, severity: 'PLAUSIBILITY_WARNING' },
    { count: counts.alerts, severity: 'ENVIRONMENTAL_ALERT' },
    { count: hideInfo ? 0 : counts.info, severity: 'INFO' },
  ];
  const present = entries.filter((entry) => entry.count > 0);

  if (present.length === 0) {
    return (
      <span className="badge-stack">
        <Badge tone="ok" icon="checkCircle">
          {compact ? 'Clean' : 'No flags'}
        </Badge>
      </span>
    );
  }

  return (
    <span className="badge-stack">
      {present.map(({ count, severity }) => {
        const meta = SEVERITY_META[severity];
        return (
          <Badge key={severity} tone={meta.tone} icon={meta.icon}>
            {count}
            {compact ? (
              <span className="sr-only"> {meta.word}s</span>
            ) : (
              ` ${meta.word}${count === 1 ? '' : 's'}`
            )}
          </Badge>
        );
      })}
    </span>
  );
}

/**
 * Display-only split of the stored counts.
 *
 * The validation engine stores `warning_flag_count` as plausibility warnings
 * *plus* environmental alerts (validation/engine.mjs counts them together) and
 * stores the alert subtotal separately. Printing both raw numbers side by side
 * would count the alerts twice, so the plausibility subtotal is derived here.
 * Nothing is written back — this only affects what the badges read.
 */
export function splitCounts(
  combinedWarnings: Nullable<number>,
  alerts: Nullable<number>,
  errors: Nullable<number>,
  info: Nullable<number>,
): FlagCounts {
  const alertCount = alerts ?? 0;
  return {
    errors: errors ?? 0,
    warnings: Math.max(0, (combinedWarnings ?? 0) - alertCount),
    alerts: alertCount,
    info: info ?? 0,
  };
}

/* ================================================================= panels */

export function Panel({
  title,
  icon,
  note,
  children,
  className = '',
  flush = false,
  id,
}: {
  title: string;
  icon?: IconName;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Set for tables that should touch the panel edges. */
  flush?: boolean;
  id?: string;
}) {
  return (
    <section className={`panel${flush ? ' panel-flush' : ''} ${className}`.trim()} id={id}>
      <div className="panel-head">
        <h2 className="panel-title">
          {icon ? <Icon name={icon} size={15} /> : null}
          {title}
        </h2>
        {note ? <div className="panel-note">{note}</div> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Disclosure({
  title,
  icon,
  note,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: IconName;
  note?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary>
        {icon ? <Icon name={icon} size={15} /> : null}
        {title}
        {note ? <span className="disclosure-note">{note}</span> : null}
        <Icon name="chevronDown" size={15} className="disclosure-chevron" />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

/* ================================================================ notices */

const NOTICE_ICON: Record<string, IconName> = {
  error: 'xCircle',
  warning: 'alert',
  ok: 'checkCircle',
  info: 'info',
};

export function Notice({
  kind,
  role = 'status',
  children,
}: {
  kind: 'error' | 'warning' | 'ok' | 'info';
  role?: 'status' | 'alert';
  children: ReactNode;
}) {
  return (
    <div className={`notice notice-${kind}`} role={role}>
      <Icon name={NOTICE_ICON[kind]} size={16} />
      <span>{children}</span>
    </div>
  );
}

/* ============================================================ empty state */

export function EmptyState({
  icon = 'inbox',
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div>
        <div className="empty-mark" style={{ margin: '0 auto 12px' }}>
          <Icon name={icon} size={20} />
        </div>
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}
