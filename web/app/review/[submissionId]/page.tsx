'use client';

/**
 * /review/[submissionId] — full read-only scientific record for one submission,
 * plus the three review actions.
 *
 * Every scientific field on this page is display-only. There are no edit
 * controls anywhere: corrections are made by the collector as a new revision,
 * never by a reviewer mutating submitted science.
 */
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import AuthGate from '@/components/AuthGate';
import ReviewActions from '@/components/ReviewActions';
import { fetchSubmissionDetail } from '@/lib/data';
import {
  EMPTY,
  formatBoolean,
  formatBytes,
  formatEastern,
  formatNumber,
  formatText,
  humanizeCode,
} from '@/lib/format';
import type {
  FlagSeverity,
  MeasurementDoc,
  Nullable,
  RevisionDoc,
  SubmissionDetail,
  ValidationFlagDoc,
} from '@/lib/types';

const SEVERITY_ORDER: { severity: FlagSeverity; label: string; badge: string }[] = [
  { severity: 'ERROR', label: 'Errors', badge: 'badge-error' },
  { severity: 'PLAUSIBILITY_WARNING', label: 'Plausibility warnings', badge: 'badge-warning' },
  { severity: 'ENVIRONMENTAL_ALERT', label: 'Environmental alerts', badge: 'badge-alert' },
  { severity: 'INFO', label: 'Info', badge: '' },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** "Entered: 7.2 pH" plus a canonical line only when it actually differs. */
function MeasurementValue({ measurement }: { measurement: MeasurementDoc }) {
  const differs =
    measurement.entered_value !== measurement.value || measurement.entered_unit_code !== measurement.unit_code;
  return (
    <>
      <div>
        Entered: <strong>{formatNumber(measurement.entered_value)}</strong>{' '}
        {formatText(measurement.entered_unit_code)}
      </div>
      {differs ? (
        <div className="muted">
          Canonical: <strong>{formatNumber(measurement.value)}</strong> {formatText(measurement.unit_code)}
        </div>
      ) : null}
    </>
  );
}

/** Entered temperature plus the stored counterpart; never recomputed here. */
function Temperature({ revision }: { revision: RevisionDoc | null }) {
  if (!revision || revision.temp_entered_value == null || !revision.temp_entered_unit) {
    return <p className="muted">No temperature recorded on this revision.</p>;
  }
  const enteredCelsius = revision.temp_entered_unit === 'C';
  const derivedValue = enteredCelsius ? revision.temp_f : revision.temp_c;
  const derivedUnit = enteredCelsius ? 'F' : 'C';
  return (
    <p style={{ margin: 0 }}>
      Entered:{' '}
      <strong>
        {formatNumber(revision.temp_entered_value)}°{revision.temp_entered_unit}
      </strong>{' '}
      <span className="muted">
        → {formatNumber(derivedValue)}°{derivedUnit} (stored)
      </span>
    </p>
  );
}

function FlagList({ flags }: { flags: ValidationFlagDoc[] }) {
  if (flags.length === 0) {
    return <p className="muted">No validation flags on this revision.</p>;
  }
  return (
    <>
      {SEVERITY_ORDER.map(({ severity, label, badge }) => {
        const group = flags.filter((flag) => flag.severity === severity);
        if (group.length === 0) return null;
        return (
          <div className="flag-group" key={severity}>
            <h3>
              <span className={`badge ${badge}`}>{label}</span> <span className="muted">({group.length})</span>
            </h3>
            {group.map((flag) => (
              <div className={`flag flag-${severity}`} key={flag.flag_id}>
                <div>{formatText(flag.message)}</div>
                <div className="flag-meta">
                  <span className="mono">{formatText(flag.rule_code)}</span>
                  <span>{formatText(flag.category)}</span>
                  {flag.parameter_code ? <span>Parameter: {flag.parameter_code}</span> : null}
                  <span>{formatEastern(flag.created_at)}</span>
                  {flag.resolved ? <span className="badge badge-ok">Resolved</span> : null}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      {/* Anything with an unrecognised severity must still be visible. */}
      {flags
        .filter((flag) => !SEVERITY_ORDER.some((entry) => entry.severity === flag.severity))
        .map((flag) => (
          <div className="flag" key={flag.flag_id}>
            <div>{formatText(flag.message)}</div>
            <div className="flag-meta">
              <span className="badge">{formatText(flag.severity)}</span>
              <span className="mono">{formatText(flag.rule_code)}</span>
            </div>
          </div>
        ))}
    </>
  );
}

function Score({ label, value }: { label: string; value: Nullable<number> }) {
  return <Field label={label}>{formatNumber(value)}</Field>;
}

function Detail({ detail, session }: { detail: SubmissionDetail; session: { user: import('firebase/auth').User } }) {
  const { submission, site, currentRevision, measurements, flags, attachments, revisions, audit } = detail;
  const validation = currentRevision?.validation ?? null;

  return (
    <>
      <div className="page-head">
        <p style={{ marginBottom: 4 }}>
          <Link href="/review">← Back to queue</Link>
        </p>
        <h1>
          {site?.site_name_display ?? submission.site_id ?? 'Submission'}{' '}
          <span className="badge badge-alert">{submission.status}</span>
        </h1>
        <p>
          Revision {submission.current_revision_no ?? EMPTY} · collected{' '}
          {formatEastern(currentRevision?.collected_at)}
        </p>
      </div>

      <div className="grid-2">
        <Section title="Submission">
          <dl className="fields">
            <Field label="Submission ID">
              <span className="mono">{formatText(submission.submission_id)}</span>
            </Field>
            <Field label="Event ID">
              <span className="mono">{formatText(submission.event_id)}</span>
            </Field>
            <Field label="Revision ID">
              <span className="mono">{formatText(submission.current_revision_id)}</span>
            </Field>
            <Field label="Revision no.">{submission.current_revision_no ?? EMPTY}</Field>
            <Field label="Workflow state">
              <span className="badge badge-alert">{formatText(submission.status)}</span>
            </Field>
            <Field label="Collector UID">
              <span className="mono">{formatText(submission.collector_user_id)}</span>
            </Field>
            <Field label="Created">{formatEastern(submission.created_at)}</Field>
            <Field label="Submitted">{formatEastern(submission.submitted_at)}</Field>
            <Field label="Last updated">{formatEastern(submission.updated_at)}</Field>
            <Field label="Prior decision">
              {submission.review_decision ? (
                <>
                  <span className="badge">{submission.review_decision}</span>{' '}
                  {formatEastern(submission.reviewed_at)} by{' '}
                  <span className="mono">{formatText(submission.reviewer_user_id)}</span>
                  {submission.review_comment ? <div>{submission.review_comment}</div> : null}
                </>
              ) : (
                EMPTY
              )}
            </Field>
          </dl>
        </Section>

        <Section title="Site and collection">
          <dl className="fields">
            <Field label="Site">{formatText(site?.site_name_display ?? submission.site_id)}</Field>
            <Field label="Site code">{formatText(site?.site_code)}</Field>
            <Field label="Site ID">
              <span className="mono">{formatText(submission.site_id)}</span>
            </Field>
            <Field label="Collected at">{formatEastern(currentRevision?.collected_at)}</Field>
            <Field label="Time known">{formatBoolean(currentRevision?.time_known)}</Field>
            <Field label="Time imputed">{formatBoolean(currentRevision?.time_imputed)}</Field>
            <Field label="Test type">
              {formatText(currentRevision?.test_type)}
              {currentRevision?.test_type_other ? ` — ${currentRevision.test_type_other}` : ''}
            </Field>
            <Field label="Method">{formatText(currentRevision?.method_name)}</Field>
            <Field label="Instrument">
              {formatText(currentRevision?.instrument_name)}
              {currentRevision?.instrument_other ? ` — ${currentRevision.instrument_other}` : ''}
            </Field>
            <Field label="Weather">{formatText(currentRevision?.weather_condition)}</Field>
            <Field label="Collected by">{formatText(currentRevision?.data_collected_by)}</Field>
          </dl>
        </Section>

        <Section title="Location">
          <dl className="fields">
            <Field label="Latitude">{formatNumber(currentRevision?.latitude, 6)}</Field>
            <Field label="Longitude">{formatNumber(currentRevision?.longitude, 6)}</Field>
            <Field label="GPS accuracy">
              {currentRevision?.gps_accuracy_m == null ? EMPTY : `${formatNumber(currentRevision.gps_accuracy_m, 1)} m`}
            </Field>
            <Field label="Distance from site">
              {currentRevision?.site_distance_m == null ? EMPTY : `${formatNumber(currentRevision.site_distance_m, 1)} m`}
            </Field>
            <Field label="Site tolerance">
              {site?.site_tolerance_m == null ? EMPTY : `${formatNumber(site.site_tolerance_m, 1)} m`}
            </Field>
          </dl>
        </Section>

        <Section title="Provenance">
          <dl className="fields">
            <Field label="Schema version">{formatText(currentRevision?.schema_version ?? submission.schema_version)}</Field>
            <Field label="Mobile app version">
              {formatText(currentRevision?.mobile_app_version ?? submission.mobile_app_version)}
            </Field>
            <Field label="Data collected by">{formatText(currentRevision?.data_collected_by)}</Field>
            <Field label="Validation rules">
              {formatText(validation?.validation_rules_version ?? submission.validation_rules_version)}
            </Field>
            <Field label="Quality algorithm">
              {formatText(validation?.quality_algorithm_version ?? submission.quality_algorithm_version)}
            </Field>
            <Field label="Revision status">{formatText(currentRevision?.revision_status)}</Field>
          </dl>
        </Section>
      </div>

      <Section title="Validation outcome">
        <p style={{ marginTop: 0 }}>
          <span className={validation?.blocking ? 'badge badge-error' : 'badge badge-ok'}>
            {validation?.blocking == null ? 'Blocking: unknown' : validation.blocking ? 'Blocking' : 'Not blocking'}
          </span>{' '}
          <span className="badge badge-error">{submission.error_flag_count ?? 0} errors</span>{' '}
          <span className="badge badge-warning">{submission.warning_flag_count ?? 0} warnings</span>{' '}
          <span className="badge">{submission.info_flag_count ?? 0} info</span>{' '}
          {validation?.environmental_alert_count != null ? (
            <span className="badge badge-alert">{validation.environmental_alert_count} environmental alerts</span>
          ) : null}{' '}
          <span className="muted">validated {formatEastern(validation?.validated_at)}</span>
        </p>
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

      <Section title="Validation flags">
        <FlagList flags={flags} />
      </Section>

      <Section title="Temperature">
        <Temperature revision={currentRevision} />
      </Section>

      <Section title="Measurements">
        {measurements.length === 0 ? (
          <p className="muted">No measurement records on this revision.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Parameter</th>
                  <th scope="col">Value</th>
                  <th scope="col">Method</th>
                  <th scope="col">Instrument</th>
                  <th scope="col">Qualifier</th>
                  <th scope="col">Notes</th>
                  <th scope="col">Entered at</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((measurement) => (
                  <tr key={measurement.measurement_id}>
                    <td>
                      <strong>{formatText(measurement.display_name ?? measurement.parameter_code)}</strong>
                      <div className="mono muted">{formatText(measurement.parameter_code)}</div>
                    </td>
                    <td>
                      <MeasurementValue measurement={measurement} />
                    </td>
                    <td>{formatText(measurement.method_name)}</td>
                    <td>{formatText(measurement.instrument_name)}</td>
                    <td>{formatText(measurement.qualifier)}</td>
                    <td>{formatText(measurement.notes)}</td>
                    <td>{formatEastern(measurement.entered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Collector notes">
        {currentRevision?.field_notes_original ? (
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentRevision.field_notes_original}</p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No field notes were recorded.
          </p>
        )}
      </Section>

      <Section title="Attachments">
        {attachments.length === 0 ? (
          <p className="muted">No attachments on this revision.</p>
        ) : (
          <div className="table-scroll">
            <table>
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
                      <span className="badge">{formatText(attachment.kind)}</span>
                    </td>
                    <td>{formatText(attachment.caption)}</td>
                    <td>{formatText(attachment.content_type)}</td>
                    <td>{formatBytes(attachment.size_bytes)}</td>
                    <td>{formatEastern(attachment.created_at)}</td>
                    <td className="mono">{formatText(attachment.storage_path)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginBottom: 0, fontSize: 12 }}>
          Files are not rendered here. Open the listed path in the Firebase Storage console to inspect the original.
        </p>
      </Section>

      <Section title="Revisions">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Rev</th>
                <th scope="col">Status</th>
                <th scope="col">Collected</th>
                <th scope="col">Submitted</th>
                <th scope="col">Temp</th>
                <th scope="col">Method / instrument</th>
                <th scope="col">Revision ID</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((revision) => (
                <tr key={revision.revision_id}>
                  <td>
                    {revision.revision_no ?? EMPTY}
                    {revision.revision_id === submission.current_revision_id ? (
                      <>
                        {' '}
                        <span className="badge badge-ok">current</span>
                      </>
                    ) : null}
                  </td>
                  <td>{formatText(revision.revision_status)}</td>
                  <td>{formatEastern(revision.collected_at)}</td>
                  <td>{formatEastern(revision.submitted_at)}</td>
                  <td>
                    {revision.temp_entered_value == null
                      ? EMPTY
                      : `${formatNumber(revision.temp_entered_value)}°${revision.temp_entered_unit ?? ''}`}
                  </td>
                  <td>
                    {formatText(revision.method_name)} / {formatText(revision.instrument_name)}
                  </td>
                  <td className="mono">{formatText(revision.revision_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="History (audit trail)">
        {audit.length === 0 ? (
          <p className="muted">No audit events recorded.</p>
        ) : (
          <ol className="timeline">
            {audit.map((event) => (
              <li key={event.audit_id}>
                <div className="timeline-head">{humanizeCode(event.event_type)}</div>
                <div className="timeline-meta">
                  {formatEastern(event.occurred_at)} · {formatText(event.actor_type)}
                  {event.actor_id ? ` (${event.actor_id})` : ''}
                  {event.previous_state || event.new_state
                    ? ` · ${event.previous_state ?? EMPTY} → ${event.new_state ?? EMPTY}`
                    : ''}
                  {event.revision_id ? ` · rev ${event.revision_id}` : ''}
                </div>
                {event.reason ? <div>{event.reason}</div> : null}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <ReviewActions
        user={session.user}
        submissionId={submission.submission_id}
        expectedRevisionId={submission.current_revision_id ?? null}
        reviewable={submission.status === 'PENDING_REVIEW'}
        currentStatus={submission.status}
      />
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

  if (state === 'loading') return <p className="muted">Loading submission…</p>;

  if (state === 'missing') {
    return (
      <div className="card centered-state">
        <h1>Not found</h1>
        <p className="muted">
          No submission with id <code className="mono">{submissionId}</code> is readable.
        </p>
        <p>
          <Link href="/review">Back to queue</Link>
        </p>
      </div>
    );
  }

  if (state === 'error' || !detail) {
    return (
      <>
        <div className="notice notice-error">{error ?? 'Could not load this submission.'}</div>
        <p>
          <Link href="/review">Back to queue</Link>
        </p>
      </>
    );
  }

  return <Detail detail={detail} session={session} />;
}

export default function SubmissionDetailPage() {
  return <AuthGate>{(session) => <DetailLoader session={session} />}</AuthGate>;
}
