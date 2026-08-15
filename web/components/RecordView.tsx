'use client';

/**
 * The submission record pane.
 *
 * Composition follows how a reviewer actually works:
 *   who / where / when  ->  can I act on this  ->  the science  ->  what
 *   validation found  ->  the decision  ->  history  ->  machine provenance.
 *
 * Every scientific field here is display-only. There are no edit controls
 * anywhere: corrections are made by the collector as a new revision, never by a
 * reviewer mutating submitted science. Entered and canonical values are printed
 * exactly as stored — the console never converts.
 */
import Link from 'next/link';
import { Fragment, useCallback, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';

import { Icon, type IconName } from '@/components/icons';
import LocationDiagram from '@/components/LocationDiagram';
import ReviewActions from '@/components/ReviewActions';
import {
  Badge,
  Disclosure,
  EmptyState,
  FlagSummary,
  IdRow,
  Panel,
  QualityBlock,
  SEVERITY_META,
  SEVERITY_ORDER,
  StatusBadge,
  Uuid,
  severityMeta,
  splitCounts,
} from '@/components/ui';
import {
  EMPTY,
  formatBoolean,
  formatBytes,
  formatEastern,
  formatEasternDate,
  formatEasternTime,
  formatNumber,
  formatText,
  formatUnit,
  humanizeCode,
  humanizeSentence,
} from '@/lib/format';
import type {
  AuditDoc,
  MeasurementDoc,
  Nullable,
  RevisionDoc,
  SubmissionDetail,
  ValidationFlagDoc,
} from '@/lib/types';

const ACTOR_LABELS: Record<string, string> = {
  COLLECTOR: 'Collector',
  VALIDATION_SERVICE: 'Validation service',
  QC_REVIEWER: 'QC reviewer',
  PUBLISHING_SERVICE: 'Publishing service',
};

/** Audit events that represent a human decision, marked on the timeline. */
const DECISION_EVENTS = /REVIEW|APPROV|REJECT|CORRECTION/i;

/* ------------------------------------------------------------- fragments */

function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Fact({
  icon,
  label,
  value,
  sub,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="fact">
      <span className="fact-icon" aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
      <span className="fact-body">
        <span className="fact-label">{label}</span>
        <span className="fact-value">{value}</span>
        {sub != null && sub !== EMPTY ? <span className="fact-sub">{sub}</span> : null}
      </span>
    </div>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => undefined);
  }, []);
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={copy}
      aria-label={copied ? 'Link copied' : 'Copy a link to this record'}
      title={copied ? 'Link copied' : 'Copy a link to this record'}
    >
      <Icon name={copied ? 'check' : 'copy'} size={16} />
    </button>
  );
}

/* ---------------------------------------------------------- scientific -- */

/**
 * Entered and canonical readings on equal typographic footing, so the reviewer
 * can check the stored conversion at a glance instead of parsing a sentence.
 */
function Temperature({ revision }: { revision: RevisionDoc | null }) {
  if (!revision || revision.temp_entered_value == null || !revision.temp_entered_unit) {
    return <p className="muted">No water temperature was recorded on this revision.</p>;
  }
  const enteredCelsius = revision.temp_entered_unit === 'C';
  const derivedValue = enteredCelsius ? revision.temp_f : revision.temp_c;
  const derivedUnit = enteredCelsius ? 'F' : 'C';
  return (
    <div className="temp-panel">
      <div className="temp-figures">
        <div>
          <span className="figure-label">Entered</span>
          <span className="figure">
            {formatNumber(revision.temp_entered_value)}
            <span className="figure-unit">°{revision.temp_entered_unit}</span>
          </span>
        </div>
        <Icon name="chevronRight" size={18} className="temp-arrow" />
        <div className="figure-canonical">
          <span className="figure-label">Canonical</span>
          <span className="figure">
            {formatNumber(derivedValue)}
            <span className="figure-unit">°{derivedUnit}</span>
          </span>
        </div>
      </div>
      <p className="temp-note">
        <Icon name="info" size={14} />
        <span>
          Both readings are stored on the revision exactly as submitted. The console displays them; it never converts.
        </span>
      </p>
    </div>
  );
}

function MeasurementsTable({ measurements }: { measurements: MeasurementDoc[] }) {
  if (measurements.length === 0) {
    return (
      <div className="panel-body">
        <p className="muted">No measurement records on this revision.</p>
      </div>
    );
  }
  return (
    <div className="table-scroll">
      <table className="dtable stack-table">
        <caption className="sr-only">
          Measurements on this revision, showing the value exactly as entered beside the canonical value stored for
          validation.
        </caption>
        <thead>
          <tr>
            <th scope="col">Parameter</th>
            <th scope="col">Entered</th>
            <th scope="col">Canonical</th>
            <th scope="col">Method &amp; instrument</th>
            <th scope="col">Entered at</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((measurement) => {
            const enteredUnit = formatUnit(measurement.entered_unit_code);
            const canonicalUnit = formatUnit(measurement.unit_code);
            const identical =
              measurement.entered_value != null &&
              measurement.value != null &&
              measurement.entered_value === measurement.value &&
              enteredUnit === canonicalUnit;
            return (
              <Fragment key={measurement.measurement_id}>
                <tr>
                  <th scope="row">
                    <span className="cell-strong">
                      {formatText(measurement.display_name ?? measurement.parameter_code)}
                    </span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                      <Uuid value={measurement.parameter_code} label="Parameter code" chars={26} />
                      {measurement.qualifier ? <Badge tone="neutral">{measurement.qualifier}</Badge> : null}
                    </span>
                  </th>
                  <td data-label="Entered">
                    <span className="mvalue">
                      {formatNumber(measurement.entered_value)}
                      <span className="mvalue-unit">{enteredUnit}</span>
                    </span>
                  </td>
                  <td data-label="Canonical">
                    {identical ? (
                      <span className="mvalue-same">Same as entered</span>
                    ) : (
                      <span className="mvalue mvalue-canonical">
                        {formatNumber(measurement.value)}
                        <span className="mvalue-unit">{canonicalUnit}</span>
                      </span>
                    )}
                  </td>
                  <td data-label="Method">
                    <span className="cell-sub" style={{ color: 'var(--text-secondary)' }}>
                      {formatText(measurement.method_name)}
                    </span>
                    <span className="cell-sub">{formatText(measurement.instrument_name)}</span>
                  </td>
                  <td data-label="Entered at" className="nowrap">
                    <span className="cell-sub" style={{ color: 'var(--text-secondary)' }}>
                      {formatEasternDate(measurement.entered_at)}
                    </span>
                    <span className="cell-sub">{formatEasternTime(measurement.entered_at)}</span>
                  </td>
                </tr>
                {measurement.notes ? (
                  <tr className="note-row">
                    <td colSpan={5}>
                      <span className="note-body">
                        <Icon name="notes" size={13} />
                        <span>{measurement.notes}</span>
                      </span>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------- validation -- */

function Finding({ flag }: { flag: ValidationFlagDoc }) {
  const meta = severityMeta(flag.severity);
  return (
    <div className={`finding finding-${flag.severity}`}>
      <div className="finding-msg">
        <Icon
          name={meta?.icon ?? 'info'}
          size={15}
          strokeWidth={2}
          className={`finding-icon-${flag.severity}`}
        />
        <span>
          <span className="sr-only">{meta?.word ?? formatText(flag.severity)}: </span>
          {formatText(flag.message)}
        </span>
      </div>
      <div className="finding-meta">
        {flag.parameter_code ? <span>Parameter: {flag.parameter_code}</span> : null}
        <span>Raised {formatEastern(flag.created_at)}</span>
        {flag.resolved ? (
          <Badge tone="ok" icon="checkCircle">
            Resolved
          </Badge>
        ) : null}
      </div>
      <details className="mini">
        <summary>
          Rule provenance
          <Icon name="chevronDown" size={12} className="disclosure-chevron" />
        </summary>
        <dl className="kv kv-wide" style={{ marginTop: 8 }}>
          <KV label="Rule code">
            <span className="mono">{formatText(flag.rule_code)}</span>
          </KV>
          <KV label="Category">{formatText(flag.category)}</KV>
          <KV label="Severity">
            <span className="mono">{formatText(flag.severity)}</span>
          </KV>
          <KV label="Flag ID">
            <Uuid value={flag.flag_id} label="Flag ID" chars={28} />
          </KV>
        </dl>
      </details>
    </div>
  );
}

function Findings({ flags }: { flags: ValidationFlagDoc[] }) {
  if (flags.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState icon="checkCircle" title="No validation flags on this revision">
          Every rule in the active validation profile passed.
        </EmptyState>
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
        return (
          <div className="finding-group" key={severity}>
            <div className="finding-group-head">
              <Badge tone={meta.tone} icon={meta.icon}>
                {meta.label}
              </Badge>
              <span className="small muted">
                {group.length} {group.length === 1 ? 'flag' : 'flags'}
              </span>
            </div>
            <p className="finding-group-note">{meta.note}</p>
            {group.map((flag) => (
              <Finding key={flag.flag_id} flag={flag} />
            ))}
          </div>
        );
      })}

      {/* Anything with an unrecognised severity must still be visible. */}
      {unknown.length > 0 ? (
        <div className="finding-group">
          <div className="finding-group-head">
            <Badge tone="neutral">Other flags</Badge>
            <span className="small muted">{unknown.length}</span>
          </div>
          <p className="finding-group-note">
            These use a severity this console does not recognise. They are shown exactly as stored.
          </p>
          {unknown.map((flag) => (
            <div className="finding" key={flag.flag_id}>
              <div className="finding-msg">
                <span>{formatText(flag.message)}</span>
              </div>
              <div className="finding-meta">
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

/* ------------------------------------------------------------- history -- */

function AuditTimeline({ audit }: { audit: AuditDoc[] }) {
  if (audit.length === 0) return <p className="muted">No audit events recorded.</p>;
  return (
    <ol className="timeline">
      {audit.map((event) => {
        const isDecision = DECISION_EVENTS.test(String(event.event_type ?? ''));
        const actor = event.actor_type ? (ACTOR_LABELS[event.actor_type] ?? humanizeSentence(event.actor_type)) : null;
        return (
          <li key={event.audit_id} className={isDecision ? 'is-decision' : undefined}>
            <div className="tl-head">
              <span className="tl-title">{humanizeSentence(event.event_type)}</span>
              <span className="tl-time">{formatEastern(event.occurred_at)}</span>
            </div>
            <div className="tl-meta">
              {actor ? <span>{actor}</span> : null}
              {event.actor_id ? <Uuid value={event.actor_id} label="Actor ID" /> : null}
              {event.previous_state || event.new_state ? (
                <span className="tl-transition">
                  <span>{humanizeCode(event.previous_state)}</span>
                  <Icon name="chevronRight" size={11} />
                  <span className="sr-only">changed to</span>
                  <strong>{humanizeCode(event.new_state)}</strong>
                </span>
              ) : null}
              {event.revision_id ? <Uuid value={event.revision_id} label="Revision ID" /> : null}
            </div>
            {event.reason ? <p className="tl-reason">{event.reason}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ================================================================= page == */

export default function RecordView({ detail, user }: { detail: SubmissionDetail; user: User }) {
  const { submission, site, currentRevision, measurements, flags, attachments, revisions, audit } = detail;
  const validation = currentRevision?.validation ?? null;

  const counts = splitCounts(
    validation?.warning_flag_count ?? submission.warning_flag_count,
    validation?.environmental_alert_count,
    validation?.error_flag_count ?? submission.error_flag_count,
    validation?.info_flag_count ?? submission.info_flag_count,
  );

  const blocking = validation?.blocking;
  const siteTitle = site?.site_name_display ?? submission.site_id ?? 'Submission';
  const context = [site?.site_code, site?.county ? `${site.county} County` : null, site?.watershed_name ?? null].filter(
    (part): part is string => Boolean(part && String(part).trim().length > 0),
  );

  const withinTolerance =
    site?.site_tolerance_m != null &&
    currentRevision?.site_distance_m != null &&
    currentRevision.site_distance_m <= site.site_tolerance_m;

  return (
    <div className="record-inner">
      <Link href="/review" className="record-back">
        <Icon name="back" size={15} />
        Review queue
      </Link>

      <header className="record-head">
        <div className="record-titles">
          <div className="record-title-line">
            <h1>{siteTitle}</h1>
            <StatusBadge status={submission.status} large />
            {blocking == null ? (
              <Badge tone="neutral" large>
                Reviewability unknown
              </Badge>
            ) : blocking ? (
              <Badge tone="error" icon="xCircle" large>
                Blocked by errors
              </Badge>
            ) : (
              <Badge tone="ok" icon="checkCircle" large>
                Ready for review
              </Badge>
            )}
          </div>
          {context.length > 0 ? (
            <p className="record-sub">
              {context.map((part, index) => (
                <span key={part}>
                  {index > 0 ? <span className="sep"> · </span> : null}
                  {part}
                </span>
              ))}
            </p>
          ) : null}
        </div>
        <div className="record-tools">
          <CopyLinkButton />
        </div>
      </header>

      {/* The six facts a reviewer needs before reading anything else. */}
      <div className="factbar">
        <Fact
          icon="calendar"
          label="Collected"
          value={formatEasternDate(currentRevision?.collected_at)}
          sub={formatEasternTime(currentRevision?.collected_at)}
        />
        <Fact
          icon="user"
          label="Collector"
          value={formatText(currentRevision?.data_collected_by)}
          sub={<Uuid value={submission.collector_user_id} label="Collector user ID" />}
        />
        <Fact
          icon="layers"
          label="Revision"
          value={submission.current_revision_no ?? EMPTY}
          sub={revisions.length > 0 ? `of ${revisions.length} on record` : undefined}
        />
        <Fact
          icon="upload"
          label="Submitted"
          value={formatEasternDate(submission.submitted_at)}
          sub={formatEasternTime(submission.submitted_at)}
        />
        <Fact
          icon="flask"
          label="Test type"
          value={formatText(currentRevision?.test_type)}
          sub={currentRevision?.test_type_other ?? undefined}
        />
        <Fact
          icon="tool"
          label="Instrument"
          value={formatText(currentRevision?.instrument_name)}
          sub={currentRevision?.method_name ?? undefined}
        />
      </div>

      <div className="summary-grid">
        <Panel
          title="Review status"
          icon="shield"
          className={blocking ? 'panel-accent-error' : 'panel-accent-ok'}
          note={validation?.validated_at ? formatEasternDate(validation.validated_at) : undefined}
        >
          <div className="status-line">
            <Icon
              name={blocking == null ? 'info' : blocking ? 'xCircle' : 'checkCircle'}
              size={20}
              strokeWidth={1.9}
              className={
                blocking == null
                  ? 'status-line-icon status-line-icon-unknown'
                  : blocking
                    ? 'status-line-icon status-line-icon-error'
                    : 'status-line-icon status-line-icon-ok'
              }
            />
            <span className="status-line-text">
              <strong>
                {blocking == null
                  ? 'Validation state unknown'
                  : blocking
                    ? 'Blocking — approval unavailable'
                    : 'Reviewable — no blocking errors'}
              </strong>
              <span>Validated {formatEastern(validation?.validated_at)}</span>
            </span>
          </div>

          <QualityBlock value={validation?.overall_quality_score ?? submission.overall_quality_score} />

          <hr className="panel-divider" />

          <div style={{ marginBottom: 12 }}>
            <FlagSummary counts={counts} />
          </div>

          <div className="metric-row">
            <div className="metric">
              <span className="metric-label">Measurements</span>
              <span className="metric-value">{measurements.length}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Flags</span>
              <span className="metric-value">{flags.length}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Anomaly</span>
              <span className="metric-value">
                {formatNumber(validation?.anomaly_score ?? submission.anomaly_score)}
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Site &amp; collection" icon="mapPin">
          <dl className="kv">
            <KV label="Site">{formatText(site?.site_name_display ?? submission.site_id)}</KV>
            <KV label="Site code">{formatText(site?.site_code)}</KV>
            <KV label="County">{formatText(site?.county)}</KV>
            <KV label="Watershed">{formatText(site?.watershed_name)}</KV>
            <KV label="Collected by">{formatText(currentRevision?.data_collected_by)}</KV>
            <KV label="Collected at">{formatEastern(currentRevision?.collected_at)}</KV>
            <KV label="Weather">{formatText(currentRevision?.weather_condition)}</KV>
            <KV label="Time recorded">
              {currentRevision?.time_known === false || currentRevision?.time_imputed ? (
                <Badge tone="warning" icon="alert">
                  {currentRevision?.time_imputed ? 'Estimated by app' : 'Not precise'}
                </Badge>
              ) : (
                <Badge tone="ok" icon="checkCircle">
                  Collector-recorded
                </Badge>
              )}
            </KV>
          </dl>
        </Panel>

        <Panel title="Method &amp; provenance" icon="tool">
          <dl className="kv">
            <KV label="Test type">{formatText(currentRevision?.test_type)}</KV>
            <KV label="Method">{formatText(currentRevision?.method_name)}</KV>
            <KV label="Instrument">
              {formatText(currentRevision?.instrument_name)}
              {currentRevision?.instrument_other ? ` — ${currentRevision.instrument_other}` : ''}
            </KV>
            <KV label="Revision state">{humanizeCode(currentRevision?.revision_status)}</KV>
            <KV label="Created">{formatEastern(submission.created_at)}</KV>
            <KV label="Last updated">{formatEastern(submission.updated_at)}</KV>
          </dl>
          <div style={{ marginTop: 12 }}>
            <IdRow label="Submission ID" value={submission.submission_id} />
            <IdRow label="Revision ID" value={submission.current_revision_id} />
            <IdRow label="Event ID" value={submission.event_id} />
          </div>
        </Panel>

      </div>

      <div className="record-body">
        <main className="record-main">
          <Panel title="Water temperature" icon="thermometer">
            <Temperature revision={currentRevision} />
          </Panel>

          <Panel
            title="Measurements"
            icon="flask"
            flush
            note={
              measurements.length > 0
                ? `${measurements.length} parameter${measurements.length === 1 ? '' : 's'}`
                : undefined
            }
          >
            <MeasurementsTable measurements={measurements} />
          </Panel>

          <Panel
            title="Validation findings"
            icon="alert"
            flush
            note={flags.length > 0 ? `${flags.length} flag${flags.length === 1 ? '' : 's'}` : 'No flags'}
          >
            <Findings flags={flags} />
          </Panel>

          <Panel title="Quality components" icon="shield" flush note="Scored 0–100 by the validation engine">
            <div className="qc-strip">
              {(
                [
                  ['Overall', validation?.overall_quality_score ?? submission.overall_quality_score],
                  ['Completeness', validation?.completeness_score],
                  ['Location', validation?.location_quality_score],
                  ['Method', validation?.method_quality_score],
                  ['Validation', validation?.validation_quality_score],
                  ['Temporal', validation?.temporal_quality_score],
                  ['Historical', validation?.historical_quality_score],
                  ['Anomaly', validation?.anomaly_score ?? submission.anomaly_score],
                ] as [string, Nullable<number>][]
              ).map(([label, value]) => (
                <div className="qc-item" key={label}>
                  <span className="qc-label" title={label}>
                    {label}
                  </span>
                  <span className="qc-value">{formatNumber(value)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Revision history"
            icon="layers"
            flush
            note={revisions.length > 0 ? `${revisions.length} revision${revisions.length === 1 ? '' : 's'}` : undefined}
          >
            <div className="table-scroll">
              <table className="dtable stack-table">
                <caption className="sr-only">Every revision filed against this submission, oldest first.</caption>
                <thead>
                  <tr>
                    <th scope="col">Revision</th>
                    <th scope="col">State</th>
                    <th scope="col">Collected</th>
                    <th scope="col">Submitted</th>
                    <th scope="col">Temp.</th>
                    <th scope="col">Method &amp; instrument</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((revision) => (
                    <tr key={revision.revision_id}>
                      <th scope="row">
                        <span className="cell-strong">Rev {revision.revision_no ?? EMPTY}</span>
                        {revision.revision_id === submission.current_revision_id ? (
                          <span style={{ display: 'inline-block', margin: '3px 0' }}>
                            <Badge tone="brand">Current</Badge>
                          </span>
                        ) : null}
                        <span style={{ display: 'block', marginTop: 2 }}>
                          <Uuid value={revision.revision_id} label="Revision ID" chars={10} />
                        </span>
                      </th>
                      <td data-label="State">{humanizeCode(revision.revision_status)}</td>
                      <td data-label="Collected" className="nowrap">
                        <span className="cell-sub" style={{ color: 'var(--text-secondary)' }}>
                          {formatEasternDate(revision.collected_at)}
                        </span>
                        <span className="cell-sub">{formatEasternTime(revision.collected_at)}</span>
                      </td>
                      <td data-label="Submitted" className="nowrap">
                        <span className="cell-sub" style={{ color: 'var(--text-secondary)' }}>
                          {formatEasternDate(revision.submitted_at)}
                        </span>
                        <span className="cell-sub">{formatEasternTime(revision.submitted_at)}</span>
                      </td>
                      <td data-label="Temperature" className="nowrap">
                        {revision.temp_entered_value == null
                          ? EMPTY
                          : `${formatNumber(revision.temp_entered_value)}°${revision.temp_entered_unit ?? ''}`}
                      </td>
                      <td data-label="Method">
                        <span className="cell-sub" style={{ color: 'var(--text-secondary)' }}>
                          {formatText(revision.method_name)}
                        </span>
                        <span className="cell-sub">{formatText(revision.instrument_name)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Audit history"
            icon="audit"
            note={audit.length > 0 ? `${audit.length} event${audit.length === 1 ? '' : 's'}` : undefined}
          >
            <AuditTimeline audit={audit} />
          </Panel>
        </main>

        <aside className="record-aside">
          <ReviewActions
            user={user}
            submissionId={submission.submission_id}
            expectedRevisionId={submission.current_revision_id ?? null}
            reviewable={submission.status === 'PENDING_REVIEW'}
            currentStatus={submission.status}
          />

          <Panel title="Collector field notes" icon="notes">
            {currentRevision?.field_notes_original ? (
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentRevision.field_notes_original}</p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                No field notes were recorded.
              </p>
            )}
          </Panel>

          <Panel
            title="Location"
            icon="mapPin"
            note={
              currentRevision?.site_distance_m != null && site?.site_tolerance_m != null ? (
                withinTolerance ? (
                  <Badge tone="ok" icon="checkCircle">
                    In tolerance
                  </Badge>
                ) : (
                  <Badge tone="warning" icon="alert">
                    Out of tolerance
                  </Badge>
                )
              ) : undefined
            }
          >
            <LocationDiagram
              siteLat={site?.latitude}
              siteLon={site?.longitude}
              sampleLat={currentRevision?.latitude}
              sampleLon={currentRevision?.longitude}
              toleranceM={site?.site_tolerance_m}
              gpsAccuracyM={currentRevision?.gps_accuracy_m}
              distanceM={currentRevision?.site_distance_m}
            />
            <dl className="kv kv-wide" style={{ marginTop: 12 }}>
              <KV label="Coordinates">
                <span className="mono">
                  {formatNumber(currentRevision?.latitude, 6)}, {formatNumber(currentRevision?.longitude, 6)}
                </span>
              </KV>
              <KV label="GPS accuracy">
                {currentRevision?.gps_accuracy_m == null
                  ? EMPTY
                  : `${formatNumber(currentRevision.gps_accuracy_m, 1)} m`}
              </KV>
              <KV label="Distance from site">
                {currentRevision?.site_distance_m == null
                  ? EMPTY
                  : `${formatNumber(currentRevision.site_distance_m, 1)} m`}
              </KV>
              <KV label="Site tolerance">
                {site?.site_tolerance_m == null ? EMPTY : `${formatNumber(site.site_tolerance_m, 1)} m`}
              </KV>
              <KV label="Catalogued site">
                {site?.latitude == null || site?.longitude == null ? (
                  EMPTY
                ) : (
                  <span className="mono">
                    {formatNumber(site.latitude, 6)}, {formatNumber(site.longitude, 6)}
                  </span>
                )}
              </KV>
            </dl>
          </Panel>
        </aside>
      </div>

      <div className="record-footer">
        <Disclosure
          title="Prior review decision"
          icon="history"
          note={submission.review_decision ? humanizeCode(submission.review_decision) : 'Not reviewed before'}
        >
          {submission.review_decision ? (
            <dl className="kv kv-wide">
              <KV label="Decision">
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
              </KV>
              <KV label="Decided">{formatEastern(submission.reviewed_at)}</KV>
              <KV label="Reviewer">
                <Uuid value={submission.reviewer_user_id} label="Reviewer user ID" chars={16} />
              </KV>
              <KV label="Reviewed revision">
                <Uuid value={submission.reviewed_revision_id} label="Reviewed revision ID" chars={16} />
              </KV>
              <KV label="Comment">
                {submission.review_comment ? submission.review_comment : <span className="faint">{EMPTY}</span>}
              </KV>
            </dl>
          ) : (
            <p className="muted">This submission has not been reviewed before.</p>
          )}
        </Disclosure>

        <Disclosure
          title="Attachments"
          icon="file"
          note={attachments.length === 0 ? 'None on this revision' : `${attachments.length} file(s)`}
        >
          {attachments.length === 0 ? (
            <p className="muted">
              No attachments on this revision. The current field apps do not capture files; this section exists for
              legacy records.
            </p>
          ) : (
            <>
              <div className="table-scroll">
                <table className="stack-table">
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
                        <th scope="row">
                          <Badge tone="neutral">{formatText(attachment.kind)}</Badge>
                        </th>
                        <td data-label="Caption">{formatText(attachment.caption)}</td>
                        <td data-label="Type" className="small">
                          {formatText(attachment.content_type)}
                        </td>
                        <td data-label="Size" className="small">
                          {formatBytes(attachment.size_bytes)}
                        </td>
                        <td data-label="Created" className="small">
                          {formatEastern(attachment.created_at)}
                        </td>
                        <td data-label="Storage path" className="mono">
                          {formatText(attachment.storage_path)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ marginTop: 12 }}>
                Files are not rendered here. Open the listed path in the Firebase Storage console to inspect the
                original.
              </p>
            </>
          )}
        </Disclosure>

        <Disclosure title="Technical provenance" icon="shield" note="Identifiers and versions">
          <div className="summary-grid" style={{ marginBottom: 0 }}>
            <div>
              <IdRow label="Submission ID" value={submission.submission_id} />
              <IdRow label="Event ID" value={submission.event_id} />
              <IdRow label="Revision ID" value={submission.current_revision_id} />
              <IdRow label="Collector UID" value={submission.collector_user_id} />
              <IdRow label="Site ID" value={submission.site_id} />
            </div>
            <dl className="kv kv-wide">
              <KV label="Workflow state">
                <span className="mono">{formatText(submission.status)}</span>
              </KV>
              <KV label="Schema version">
                {formatText(currentRevision?.schema_version ?? submission.schema_version)}
              </KV>
              <KV label="Mobile app version">
                {formatText(currentRevision?.mobile_app_version ?? submission.mobile_app_version)}
              </KV>
              <KV label="Validation rules">
                {formatText(validation?.validation_rules_version ?? submission.validation_rules_version)}
              </KV>
              <KV label="Quality algorithm">
                {formatText(validation?.quality_algorithm_version ?? submission.quality_algorithm_version)}
              </KV>
              <KV label="Historical weight">{formatNumber(validation?.historical_effective_weight)}</KV>
              <KV label="Time known">{formatBoolean(currentRevision?.time_known)}</KV>
              <KV label="Time imputed">{formatBoolean(currentRevision?.time_imputed)}</KV>
            </dl>
          </div>
        </Disclosure>
      </div>
    </div>
  );
}
