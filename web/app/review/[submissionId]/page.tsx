'use client';

/**
 * /review/[submissionId] — full read-only scientific record for one submission,
 * plus the three review actions.
 *
 * Every scientific field on this page is display-only. There are no edit
 * controls anywhere: corrections are made by the collector as a new revision,
 * never by a reviewer mutating submitted science.
 *
 * Reading order is deliberate and matches how a reviewer actually works:
 *   who/where/when  ->  is it reviewable  ->  the science  ->  what validation
 *   found  ->  the decision  ->  history  ->  machine provenance.
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import AuthGate from '@/components/AuthGate';
import ReviewActions from '@/components/ReviewActions';
import {
  Badge,
  FlagSummary,
  Glyph,
  QualityMeter,
  SEVERITY_META,
  Section,
  StatusBadge,
  Uuid,
  ValuePair,
  severityMeta,
} from '@/components/ui';
import { fetchSubmissionDetail } from '@/lib/data';
import {
  EMPTY,
  formatBoolean,
  formatBytes,
  formatEastern,
  formatEasternDate,
  formatEasternTime,
  formatNumber,
  formatText,
  humanizeCode,
  humanizeSentence,
} from '@/lib/format';
import type {
  AuditDoc,
  FlagSeverity,
  MeasurementDoc,
  Nullable,
  RevisionDoc,
  SubmissionDetail,
  ValidationFlagDoc,
} from '@/lib/types';

const SEVERITY_ORDER: FlagSeverity[] = ['ERROR', 'PLAUSIBILITY_WARNING', 'ENVIRONMENTAL_ALERT', 'INFO'];

const ACTOR_LABELS: Record<string, string> = {
  COLLECTOR: 'Collector',
  VALIDATION_SERVICE: 'Validation service',
  QC_REVIEWER: 'QC reviewer',
  PUBLISHING_SERVICE: 'Publishing service',
};

/** Audit events that represent a human decision, marked on the timeline. */
const DECISION_EVENTS = /REVIEW|APPROV|REJECT|CORRECTION/i;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

/* ------------------------------------------------------------ scientific */

/**
 * Entered temperature plus the stored counterpart; never recomputed here.
 * Both readings get equal typographic footing so the reviewer can check the
 * conversion at a glance instead of parsing a sentence.
 */
function Temperature({ revision }: { revision: RevisionDoc | null }) {
  if (!revision || revision.temp_entered_value == null || !revision.temp_entered_unit) {
    return <p className="inline-empty">No water temperature was recorded on this revision.</p>;
  }
  const enteredCelsius = revision.temp_entered_unit === 'C';
  const derivedValue = enteredCelsius ? revision.temp_f : revision.temp_c;
  const derivedUnit = enteredCelsius ? 'F' : 'C';
  return (
    <div className="temp-panel">
      <ValuePair
        enteredValue={revision.temp_entered_value}
        enteredUnit={null}
        enteredSuffix={`°${revision.temp_entered_unit}`}
        canonicalValue={derivedValue}
        canonicalUnit={null}
        canonicalSuffix={`°${derivedUnit}`}
      />
      <p className="small muted" style={{ maxWidth: '46ch' }}>
        Both readings are stored on the revision as submitted. The console displays them; it never converts.
      </p>
    </div>
  );
}

function MeasurementsTable({ measurements }: { measurements: MeasurementDoc[] }) {
  if (measurements.length === 0) {
    return <p className="inline-empty">No measurement records on this revision.</p>;
  }
  return (
    <div className="table-scroll">
      <table className="table-zebra stack-table">
        <caption className="sr-only">
          Measurements recorded on this revision, showing the value as entered and the canonical value stored for
          validation.
        </caption>
        <thead>
          <tr>
            <th scope="col">Parameter</th>
            <th scope="col">Value</th>
            <th scope="col">Method &amp; instrument</th>
            <th scope="col">Qualifier</th>
            <th scope="col">Notes</th>
            <th scope="col">Entered at</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((measurement) => (
            <tr key={measurement.measurement_id}>
              <th scope="row" style={{ fontWeight: 400 }}>
                <span className="param-name">
                  {formatText(measurement.display_name ?? measurement.parameter_code)}
                </span>
                <span className="param-code">
                  <Uuid value={measurement.parameter_code} label="Parameter code" chars={24} />
                </span>
              </th>
              <td data-label="Value">
                <ValuePair
                  enteredValue={measurement.entered_value}
                  enteredUnit={measurement.entered_unit_code}
                  canonicalValue={measurement.value}
                  canonicalUnit={measurement.unit_code}
                />
              </td>
              <td data-label="Method">
                <span className="measure-meta">
                  <strong>{formatText(measurement.method_name)}</strong>
                </span>
                <span className="measure-meta">{formatText(measurement.instrument_name)}</span>
              </td>
              <td data-label="Qualifier">
                {measurement.qualifier ? (
                  <Badge tone="neutral">{measurement.qualifier}</Badge>
                ) : (
                  <span className="faint">{EMPTY}</span>
                )}
              </td>
              <td className="small" data-label="Notes">
                {formatText(measurement.notes)}
              </td>
              <td className="datestack" data-label="Entered at">
                <span className="cell-primary small">{formatEasternDate(measurement.entered_at)}</span>
                <span className="cell-secondary">{formatEasternTime(measurement.entered_at)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------- validation */

function FlagCard({ flag }: { flag: ValidationFlagDoc }) {
  const meta = severityMeta(flag.severity);
  const hasProvenance = Boolean(flag.rule_code || flag.category || flag.flag_id);
  return (
    <div className={`flag flag-${flag.severity}`}>
      <div className="flag-message">
        <span className={`flag-glyph flag-glyph-${flag.severity}`} aria-hidden="true">
          {meta?.glyph ?? '•'}
        </span>
        <span>
          <span className="sr-only">{meta?.word ?? formatText(flag.severity)}: </span>
          {formatText(flag.message)}
        </span>
      </div>
      <div className="flag-meta">
        {flag.parameter_code ? <span>Parameter: {flag.parameter_code}</span> : null}
        <span>Raised {formatEastern(flag.created_at)}</span>
        {flag.resolved ? (
          <Badge tone="ok" glyph="✓">
            Resolved
          </Badge>
        ) : null}
      </div>
      {hasProvenance ? (
        <details className="flag-provenance">
          <summary>Rule provenance</summary>
          <dl className="fields" style={{ marginTop: 8 }}>
            <Field label="Rule code">
              <span className="mono">{formatText(flag.rule_code)}</span>
            </Field>
            <Field label="Category">{formatText(flag.category)}</Field>
            <Field label="Flag ID">
              <Uuid value={flag.flag_id} label="Flag ID" chars={28} />
            </Field>
            <Field label="Severity">
              <span className="mono">{formatText(flag.severity)}</span>
            </Field>
          </dl>
        </details>
      ) : null}
    </div>
  );
}

function FlagList({ flags }: { flags: ValidationFlagDoc[] }) {
  if (flags.length === 0) {
    return (
      <div className="empty-state">
        <strong>No validation flags on this revision.</strong>
        Every rule in the active validation profile passed.
      </div>
    );
  }

  const unknown = flags.filter((flag) => !SEVERITY_ORDER.includes(flag.severity));

  return (
    <>
      {SEVERITY_ORDER.map((severity) => {
        const group = flags.filter((flag) => flag.severity === severity);
        if (group.length === 0) return null;
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
          <div className="flag-group" key={severity}>
            <h3 className="flag-group-head">
              <Badge tone={tone} glyph={meta.glyph}>
                {meta.label}
              </Badge>
              <span className="muted">
                {group.length} {group.length === 1 ? 'flag' : 'flags'}
              </span>
            </h3>
            <p className="flag-group-note">{meta.note}</p>
            {group.map((flag) => (
              <FlagCard key={flag.flag_id} flag={flag} />
            ))}
          </div>
        );
      })}

      {/* Anything with an unrecognised severity must still be visible. */}
      {unknown.length > 0 ? (
        <div className="flag-group">
          <h3 className="flag-group-head">
            <Badge tone="neutral">Other flags</Badge>
            <span className="muted">{unknown.length}</span>
          </h3>
          <p className="flag-group-note">
            These flags use a severity this console does not recognise. They are shown exactly as stored.
          </p>
          {unknown.map((flag) => (
            <div className="flag" key={flag.flag_id}>
              <div className="flag-message">
                <span>{formatText(flag.message)}</span>
              </div>
              <div className="flag-meta">
                <Badge tone="neutral">{formatText(flag.severity)}</Badge>
                <span className="mono">{formatText(flag.rule_code)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Score({ label, value }: { label: string; value: Nullable<number> }) {
  return <Field label={label}>{formatNumber(value)}</Field>;
}

/* ---------------------------------------------------------------- history */

function AuditTimeline({ audit }: { audit: AuditDoc[] }) {
  if (audit.length === 0) {
    return <p className="inline-empty">No audit events recorded.</p>;
  }
  return (
    <ol className="timeline">
      {audit.map((event) => {
        const isDecision = DECISION_EVENTS.test(String(event.event_type ?? ''));
        const actor = event.actor_type ? (ACTOR_LABELS[event.actor_type] ?? humanizeSentence(event.actor_type)) : null;
        return (
          <li key={event.audit_id} className={isDecision ? 'timeline-decision' : undefined}>
            <div className="timeline-head">
              <span>{humanizeSentence(event.event_type)}</span>
              <span className="timeline-time">{formatEastern(event.occurred_at)}</span>
            </div>
            <div className="timeline-meta">
              {actor ? <span>{actor}</span> : null}
              {event.actor_id ? <Uuid value={event.actor_id} label="Actor ID" /> : null}
              {event.previous_state || event.new_state ? (
                <span className="timeline-transition">
                  <span>{humanizeCode(event.previous_state)}</span>
                  <span aria-hidden="true">→</span>
                  <span className="sr-only">changed to</span>
                  <strong>{humanizeCode(event.new_state)}</strong>
                </span>
              ) : null}
              {event.revision_id ? <Uuid value={event.revision_id} label="Revision ID" /> : null}
            </div>
            {event.reason ? <p className="timeline-reason">{event.reason}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ page */

function Detail({ detail, session }: { detail: SubmissionDetail; session: { user: import('firebase/auth').User } }) {
  const { submission, site, currentRevision, measurements, flags, attachments, revisions, audit } = detail;
  const validation = currentRevision?.validation ?? null;

  // Display-only split: the engine stores environmental alerts inside
  // `warning_flag_count` and again as their own subtotal. Showing both raw
  // numbers would count the alerts twice.
  const alertCount = validation?.environmental_alert_count ?? 0;
  const combinedWarnings = validation?.warning_flag_count ?? submission.warning_flag_count ?? 0;
  const counts = {
    errors: validation?.error_flag_count ?? submission.error_flag_count ?? 0,
    warnings: Math.max(0, combinedWarnings - alertCount),
    alerts: alertCount,
    info: validation?.info_flag_count ?? submission.info_flag_count ?? 0,
  };

  const blocking = validation?.blocking;
  const siteTitle = site?.site_name_display ?? submission.site_id ?? 'Submission';
  const siteContext = [
    site?.site_code,
    site?.county ? `${site.county} County` : null,
    site?.watershed_name ?? null,
  ]
    .filter((part): part is string => Boolean(part && String(part).trim().length > 0))
    .join(' · ');

  const totalRevisions = revisions.length;

  return (
    <>
      <p className="breadcrumb">
        <Link href="/review">← Review queue</Link>
      </p>

      <header className="record-header">
        <div className="record-title-row">
          <div>
            <p className="eyebrow">Submission record</p>
            <h1>{siteTitle}</h1>
            {siteContext ? <p className="record-subtitle">{siteContext}</p> : null}
          </div>
          <div className="record-status-stack">
            <StatusBadge status={submission.status} large />
            {blocking == null ? (
              <Badge tone="neutral" large>
                Reviewability unknown
              </Badge>
            ) : blocking ? (
              <Badge tone="error" glyph="✕" large>
                Blocked by validation errors
              </Badge>
            ) : (
              <Badge tone="ok" glyph="✓" large>
                Ready for review
              </Badge>
            )}
          </div>
        </div>

        <dl className="record-facts">
          <div>
            <dt>Collected</dt>
            <dd>
              {formatEasternDate(currentRevision?.collected_at)}
              <small>{formatEasternTime(currentRevision?.collected_at)}</small>
            </dd>
          </div>
          <div>
            <dt>Collector</dt>
            <dd>
              {formatText(currentRevision?.data_collected_by)}
              <small>
                <Uuid value={submission.collector_user_id} label="Collector user ID" />
              </small>
            </dd>
          </div>
          <div>
            <dt>Revision</dt>
            <dd>
              {submission.current_revision_no ?? EMPTY}
              <small>
                {totalRevisions > 0 ? `of ${totalRevisions} on record` : 'current revision'}
              </small>
            </dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>
              {formatEasternDate(submission.submitted_at)}
              <small>{formatEasternTime(submission.submitted_at)}</small>
            </dd>
          </div>
          <div>
            <dt>Test type</dt>
            <dd>
              {formatText(currentRevision?.test_type)}
              <small>{formatText(currentRevision?.method_name)}</small>
            </dd>
          </div>
        </dl>
      </header>

      <Section
        title="Review status"
        note={validation?.validated_at ? <>Validated {formatEastern(validation.validated_at)}</> : null}
        className={blocking ? 'priority-card priority-blocking' : 'priority-card'}
      >
        <p className="status-summary">
          {blocking == null ? (
            <Badge tone="neutral" large>
              Validation state unknown
            </Badge>
          ) : blocking ? (
            <Badge tone="error" glyph="✕" large>
              Blocking — approval not available
            </Badge>
          ) : (
            <Badge tone="ok" glyph="✓" large>
              Reviewable — no blocking errors
            </Badge>
          )}
          <FlagSummary {...counts} />
        </p>

        <div className="stat-row">
          <div className="stat">
            <span className="stat-label">Overall quality</span>
            <QualityMeter value={validation?.overall_quality_score ?? submission.overall_quality_score} />
          </div>
          <div className="stat">
            <span className="stat-label">Anomaly score</span>
            <span className="stat-value">{formatNumber(validation?.anomaly_score ?? submission.anomaly_score)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Measurements</span>
            <span className="stat-value">{measurements.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Validation flags</span>
            <span className="stat-value">{flags.length}</span>
          </div>
        </div>
      </Section>

      <div className="grid-3">
        <Section title="Site and collection">
          <dl className="fields fields-stacked">
            <Field label="Site">{formatText(site?.site_name_display ?? submission.site_id)}</Field>
            <Field label="Site code">{formatText(site?.site_code)}</Field>
            <Field label="County">{formatText(site?.county)}</Field>
            <Field label="Watershed">{formatText(site?.watershed_name)}</Field>
            <Field label="Collected by">{formatText(currentRevision?.data_collected_by)}</Field>
            <Field label="Collected at">{formatEastern(currentRevision?.collected_at)}</Field>
            <Field label="Time recorded">
              {currentRevision?.time_known === false || currentRevision?.time_imputed ? (
                <Badge tone="warning" glyph="!">
                  {currentRevision?.time_imputed ? 'Estimated by the app' : 'Not known precisely'}
                </Badge>
              ) : (
                <Badge tone="ok" glyph="✓">
                  Recorded by the collector
                </Badge>
              )}
            </Field>
            <Field label="Weather">{formatText(currentRevision?.weather_condition)}</Field>
          </dl>
          <div className="provenance-block">
            <dl className="fields">
              <Field label="Site ID">
                <Uuid value={submission.site_id} label="Site ID" chars={16} />
              </Field>
              <Field label="Time known">{formatBoolean(currentRevision?.time_known)}</Field>
              <Field label="Time imputed">{formatBoolean(currentRevision?.time_imputed)}</Field>
            </dl>
          </div>
        </Section>

        <Section title="Method">
          <dl className="fields fields-stacked">
            <Field label="Test type">
              {formatText(currentRevision?.test_type)}
              {currentRevision?.test_type_other ? ` — ${currentRevision.test_type_other}` : ''}
            </Field>
            <Field label="Method">{formatText(currentRevision?.method_name)}</Field>
            <Field label="Instrument">
              {formatText(currentRevision?.instrument_name)}
              {currentRevision?.instrument_other ? ` — ${currentRevision.instrument_other}` : ''}
            </Field>
            <Field label="Revision state">{humanizeCode(currentRevision?.revision_status)}</Field>
            <Field label="Created">{formatEastern(submission.created_at)}</Field>
            <Field label="Submitted">{formatEastern(submission.submitted_at)}</Field>
            <Field label="Last updated">{formatEastern(submission.updated_at)}</Field>
          </dl>
          <div className="provenance-block">
            <dl className="fields">
              <Field label="Submission ID">
                <Uuid value={submission.submission_id} label="Submission ID" chars={16} />
              </Field>
              <Field label="Revision ID">
                <Uuid value={submission.current_revision_id} label="Revision ID" chars={16} />
              </Field>
              <Field label="Event ID">
                <Uuid value={submission.event_id} label="Event ID" chars={16} />
              </Field>
            </dl>
          </div>
        </Section>

        <Section title="Location">
          <dl className="fields fields-stacked">
            <Field label="Coordinates">
              <span className="mono">
                {formatNumber(currentRevision?.latitude, 6)}, {formatNumber(currentRevision?.longitude, 6)}
              </span>
            </Field>
            <Field label="GPS accuracy">
              {currentRevision?.gps_accuracy_m == null ? EMPTY : `${formatNumber(currentRevision.gps_accuracy_m, 1)} m`}
            </Field>
            <Field label="Distance from site">
              {currentRevision?.site_distance_m == null ? (
                EMPTY
              ) : (
                <>
                  {formatNumber(currentRevision.site_distance_m, 1)} m{' '}
                  {site?.site_tolerance_m != null ? (
                    currentRevision.site_distance_m <= site.site_tolerance_m ? (
                      <Badge tone="ok" glyph="✓">
                        Within tolerance
                      </Badge>
                    ) : (
                      <Badge tone="warning" glyph="!">
                        Outside tolerance
                      </Badge>
                    )
                  ) : null}
                </>
              )}
            </Field>
            <Field label="Site tolerance">
              {site?.site_tolerance_m == null ? EMPTY : `${formatNumber(site.site_tolerance_m, 1)} m`}
            </Field>
            <Field label="Catalogued site position">
              {site?.latitude == null || site?.longitude == null ? (
                EMPTY
              ) : (
                <span className="mono">
                  {formatNumber(site.latitude, 6)}, {formatNumber(site.longitude, 6)}
                </span>
              )}
            </Field>
          </dl>
        </Section>
      </div>

      <hr className="section-divider" />

      <Section title="Water temperature">
        <Temperature revision={currentRevision} />
      </Section>

      <Section
        title="Measurements"
        note={
          measurements.length > 0
            ? `${measurements.length} parameter${measurements.length === 1 ? '' : 's'}`
            : null
        }
      >
        <MeasurementsTable measurements={measurements} />
      </Section>

      <Section title="Collector field notes">
        {currentRevision?.field_notes_original ? (
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentRevision.field_notes_original}</p>
        ) : (
          <p className="inline-empty">No field notes were recorded.</p>
        )}
      </Section>

      <hr className="section-divider" />

      <Section
        title="Validation findings"
        note={
          flags.length > 0 ? `${flags.length} flag${flags.length === 1 ? '' : 's'} on this revision` : 'No flags'
        }
      >
        <FlagList flags={flags} />
      </Section>

      <Section
        title="Quality components"
        note="Each component is scored 0–100 by the validation engine."
      >
        <dl className="fields">
          <Score label="Overall quality" value={validation?.overall_quality_score ?? submission.overall_quality_score} />
          <Score label="Anomaly" value={validation?.anomaly_score ?? submission.anomaly_score} />
          <Score label="Completeness" value={validation?.completeness_score} />
          <Score label="Location quality" value={validation?.location_quality_score} />
          <Score label="Method quality" value={validation?.method_quality_score} />
          <Score label="Validation quality" value={validation?.validation_quality_score} />
          <Score label="Temporal quality" value={validation?.temporal_quality_score} />
          <Score label="Historical quality" value={validation?.historical_quality_score} />
          <Score label="Historical weight" value={validation?.historical_effective_weight} />
        </dl>
      </Section>

      <hr className="section-divider" />

      <ReviewActions
        user={session.user}
        submissionId={submission.submission_id}
        expectedRevisionId={submission.current_revision_id ?? null}
        reviewable={submission.status === 'PENDING_REVIEW'}
        currentStatus={submission.status}
      />

      <hr className="section-divider" />

      <Section
        title="Revision history"
        note={totalRevisions > 0 ? `${totalRevisions} revision${totalRevisions === 1 ? '' : 's'}` : null}
      >
        <div className="table-scroll">
          <table className="table-zebra stack-table">
            <caption className="sr-only">Every revision filed against this submission, oldest first.</caption>
            <thead>
              <tr>
                <th scope="col">Revision</th>
                <th scope="col">State</th>
                <th scope="col">Collected</th>
                <th scope="col">Submitted</th>
                <th scope="col">Temperature</th>
                <th scope="col">Method &amp; instrument</th>
                <th scope="col">Revision ID</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((revision) => (
                <tr key={revision.revision_id}>
                  <th scope="row" style={{ fontWeight: 400 }}>
                    <span className="cell-primary">Rev {revision.revision_no ?? EMPTY}</span>
                    {revision.revision_id === submission.current_revision_id ? (
                      <Badge tone="brand">Current</Badge>
                    ) : null}
                  </th>
                  <td data-label="State">{humanizeCode(revision.revision_status)}</td>
                  <td className="datestack" data-label="Collected">
                    <span className="cell-primary small">{formatEasternDate(revision.collected_at)}</span>
                    <span className="cell-secondary">{formatEasternTime(revision.collected_at)}</span>
                  </td>
                  <td className="datestack" data-label="Submitted">
                    <span className="cell-primary small">{formatEasternDate(revision.submitted_at)}</span>
                    <span className="cell-secondary">{formatEasternTime(revision.submitted_at)}</span>
                  </td>
                  <td data-label="Temperature">
                    {revision.temp_entered_value == null
                      ? EMPTY
                      : `${formatNumber(revision.temp_entered_value)}°${revision.temp_entered_unit ?? ''}`}
                  </td>
                  <td className="small" data-label="Method">
                    <span className="measure-meta">
                      <strong>{formatText(revision.method_name)}</strong>
                    </span>
                    <span className="measure-meta">{formatText(revision.instrument_name)}</span>
                  </td>
                  <td data-label="Revision ID">
                    <Uuid value={revision.revision_id} label="Revision ID" chars={12} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Audit history"
        note={audit.length > 0 ? `${audit.length} event${audit.length === 1 ? '' : 's'}` : null}
      >
        <AuditTimeline audit={audit} />
      </Section>

      <hr className="section-divider" />

      <Section title="Prior review decision">
        {submission.review_decision ? (
          <dl className="fields">
            <Field label="Decision">
              <Badge
                tone={
                  submission.review_decision === 'APPROVE'
                    ? 'ok'
                    : submission.review_decision === 'REJECT'
                      ? 'error'
                      : 'warning'
                }
              >
                {humanizeCode(submission.review_decision)}
              </Badge>
            </Field>
            <Field label="Decided">{formatEastern(submission.reviewed_at)}</Field>
            <Field label="Reviewer">
              <Uuid value={submission.reviewer_user_id} label="Reviewer user ID" chars={16} />
            </Field>
            <Field label="Reviewed revision">
              <Uuid value={submission.reviewed_revision_id} label="Reviewed revision ID" chars={16} />
            </Field>
            <Field label="Comment">
              {submission.review_comment ? submission.review_comment : <span className="faint">{EMPTY}</span>}
            </Field>
          </dl>
        ) : (
          <p className="inline-empty">This submission has not been reviewed before.</p>
        )}
      </Section>

      <Section title="Attachments" note="Legacy records only — the current apps do not capture files.">
        {attachments.length === 0 ? (
          <p className="inline-empty">No attachments on this revision.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="table-zebra stack-table">
                <thead>
                  <tr>
                    <th scope="col">Kind</th>
                    <th scope="col">Caption</th>
                    <th scope="col">Type</th>
                    <th scope="col">Size</th>
                    <th scope="col">Created</th>
                    <th scope="col">Storage path</th>
                  </tr>
                </thead>
                <tbody>
                  {attachments.map((attachment) => (
                    <tr key={attachment.attachment_id}>
                      <td>
                        <Badge tone="neutral">{formatText(attachment.kind)}</Badge>
                      </td>
                      <td data-label="Caption">{formatText(attachment.caption)}</td>
                      <td className="small" data-label="Type">{formatText(attachment.content_type)}</td>
                      <td className="small" data-label="Size">{formatBytes(attachment.size_bytes)}</td>
                      <td className="small" data-label="Created">{formatEastern(attachment.created_at)}</td>
                      <td className="mono" data-label="Storage path">{formatText(attachment.storage_path)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 14 }}>
              Files are not rendered here. Open the listed path in the Firebase Storage console to inspect the original.
            </p>
          </>
        )}
      </Section>

      <Section title="Technical provenance">
        <dl className="fields">
          <Field label="Submission ID">
            <span className="mono">{formatText(submission.submission_id)}</span>
          </Field>
          <Field label="Event ID">
            <span className="mono">{formatText(submission.event_id)}</span>
          </Field>
          <Field label="Current revision ID">
            <span className="mono">{formatText(submission.current_revision_id)}</span>
          </Field>
          <Field label="Collector user ID">
            <span className="mono">{formatText(submission.collector_user_id)}</span>
          </Field>
          <Field label="Workflow state">
            <span className="mono">{formatText(submission.status)}</span>
          </Field>
          <Field label="Schema version">
            {formatText(currentRevision?.schema_version ?? submission.schema_version)}
          </Field>
          <Field label="Mobile app version">
            {formatText(currentRevision?.mobile_app_version ?? submission.mobile_app_version)}
          </Field>
          <Field label="Validation rules">
            {formatText(validation?.validation_rules_version ?? submission.validation_rules_version)}
          </Field>
          <Field label="Quality algorithm">
            {formatText(validation?.quality_algorithm_version ?? submission.quality_algorithm_version)}
          </Field>
        </dl>
      </Section>
    </>
  );
}

function DetailLoader({ session }: { session: { user: import('firebase/auth').User; role: string } }) {
  const params = useParams<{ submissionId: string }>();
  const submissionId = typeof params?.submissionId === 'string' ? decodeURIComponent(params.submissionId) : '';

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!submissionId) {
      setState('missing');
      return;
    }
    setState('loading');
    try {
      const result = await fetchSubmissionDetail(submissionId);
      if (!result) {
        setState('missing');
        return;
      }
      setDetail(result);
      setState('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this submission.');
      setState('error');
    }
  }, [submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'loading') {
    return (
      <p className="loading-state" role="status" aria-live="polite">
        Loading submission…
      </p>
    );
  }

  if (state === 'missing') {
    return (
      <div className="card centered-state">
        <div className="card-body">
          <h1>Not found</h1>
          <p className="muted">
            No submission with id <code className="mono">{submissionId}</code> is readable with your account.
          </p>
          <p>
            <Link href="/review">← Back to the review queue</Link>
          </p>
        </div>
      </div>
    );
  }

  if (state === 'error' || !detail) {
    return (
      <>
        <div className="notice notice-error" role="alert">
          <Glyph char="✕" />
          <span>{error ?? 'Could not load this submission.'}</span>
        </div>
        <p>
          <Link href="/review">← Back to the review queue</Link>
        </p>
      </>
    );
  }

  return <Detail detail={detail} session={session} />;
}

export default function SubmissionDetailPage() {
  return <AuthGate>{(session) => <DetailLoader session={session} />}</AuthGate>;
}
