/**
 * Read-only TypeScript shapes for the Firestore documents defined in
 * config/firebase_schema.json. The reviewer web app never writes any of these
 * from the client; every field here is display-only.
 */
import type { GeoPoint, Timestamp } from 'firebase/firestore';

export type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VALIDATING'
  | 'PENDING_REVIEW'
  | 'NEEDS_CORRECTION'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PUBLISHING'
  | 'PUBLISH_FAILED'
  | 'PUBLISHED';

export type ReviewDecision = 'APPROVE' | 'NEEDS_CORRECTION' | 'REJECT';

export type FlagSeverity = 'ERROR' | 'PLAUSIBILITY_WARNING' | 'ENVIRONMENTAL_ALERT' | 'INFO';

export type AttachmentKind = 'SITE_PHOTO' | 'INSTRUMENT_PHOTO' | 'TEST_RESULT' | 'OTHER';

export type ActorType = 'COLLECTOR' | 'VALIDATION_SERVICE' | 'QC_REVIEWER' | 'PUBLISHING_SERVICE';

export type Nullable<T> = T | null | undefined;

export interface SubmissionDoc {
  submission_id: string;
  event_id: string;
  collector_user_id: string;
  site_id: string;
  status: SubmissionStatus;
  current_revision_id: string;
  current_revision_no: number;
  latest_collected_at: Nullable<Timestamp>;
  created_at: Nullable<Timestamp>;
  updated_at: Nullable<Timestamp>;
  submitted_at: Nullable<Timestamp>;
  schema_version: Nullable<string>;
  mobile_app_version: Nullable<string>;
  validation_rules_version: Nullable<string>;
  quality_algorithm_version: Nullable<string>;
  overall_quality_score: Nullable<number>;
  anomaly_score: Nullable<number>;
  error_flag_count: Nullable<number>;
  warning_flag_count: Nullable<number>;
  info_flag_count: Nullable<number>;
  review_decision: Nullable<ReviewDecision>;
  review_comment: Nullable<string>;
  reviewer_user_id: Nullable<string>;
  reviewed_at: Nullable<Timestamp>;
  reviewed_revision_id: Nullable<string>;
  published_at: Nullable<Timestamp>;
}

/** Server-written validation summary stored on the revision document. */
export interface ValidationMap {
  validation_rules_version: Nullable<string>;
  quality_algorithm_version: Nullable<string>;
  blocking: Nullable<boolean>;
  error_flag_count: Nullable<number>;
  warning_flag_count: Nullable<number>;
  info_flag_count: Nullable<number>;
  environmental_alert_count: Nullable<number>;
  completeness_score: Nullable<number>;
  location_quality_score: Nullable<number>;
  method_quality_score: Nullable<number>;
  validation_quality_score: Nullable<number>;
  temporal_quality_score: Nullable<number>;
  historical_quality_score: Nullable<number>;
  historical_effective_weight: Nullable<number>;
  overall_quality_score: Nullable<number>;
  anomaly_score: Nullable<number>;
  validated_at: Nullable<Timestamp>;
}

export interface RevisionDoc {
  revision_id: string;
  revision_no: number;
  submission_id: string;
  event_id: string;
  collector_user_id: string;
  site_id: string;
  revision_status: 'DRAFT' | 'SUBMITTED';
  created_at: Nullable<Timestamp>;
  submitted_at: Nullable<Timestamp>;
  collected_at: Nullable<Timestamp>;
  time_known: Nullable<boolean>;
  time_imputed: Nullable<boolean>;
  latitude: Nullable<number>;
  longitude: Nullable<number>;
  location: Nullable<GeoPoint>;
  gps_accuracy_m: Nullable<number>;
  site_distance_m: Nullable<number>;
  weather_condition: Nullable<string>;
  data_collected_by: Nullable<string>;
  test_type: Nullable<string>;
  test_type_other: Nullable<string>;
  method_name: Nullable<string>;
  instrument_name: Nullable<string>;
  instrument_other: Nullable<string>;
  temp_entered_value: Nullable<number>;
  temp_entered_unit: Nullable<'C' | 'F'>;
  temp_c: Nullable<number>;
  temp_f: Nullable<number>;
  field_notes_original: Nullable<string>;
  schema_version: Nullable<string>;
  mobile_app_version: Nullable<string>;
  validation: Nullable<ValidationMap>;
}

export interface MeasurementDoc {
  measurement_id: string;
  parameter_code: Nullable<string>;
  display_name: Nullable<string>;
  /** Canonical value used for validation/publication. */
  value: Nullable<number>;
  /** Canonical unit. */
  unit_code: Nullable<string>;
  /** Exactly what the collector typed. */
  entered_value: Nullable<number>;
  /** Exactly the unit the collector selected. */
  entered_unit_code: Nullable<string>;
  method_name: Nullable<string>;
  instrument_name: Nullable<string>;
  qualifier: Nullable<string>;
  notes: Nullable<string>;
  entered_at: Nullable<Timestamp>;
}

export interface ValidationFlagDoc {
  flag_id: string;
  severity: FlagSeverity;
  category: Nullable<string>;
  parameter_code: Nullable<string>;
  message: Nullable<string>;
  rule_code: Nullable<string>;
  created_at: Nullable<Timestamp>;
  resolved: Nullable<boolean>;
}

export interface AttachmentDoc {
  attachment_id: string;
  storage_path: Nullable<string>;
  content_type: Nullable<string>;
  size_bytes: Nullable<number>;
  kind: Nullable<AttachmentKind>;
  caption: Nullable<string>;
  created_at: Nullable<Timestamp>;
}

export interface AuditDoc {
  audit_id: string;
  event_type: Nullable<string>;
  actor_type: Nullable<ActorType>;
  actor_id: Nullable<string>;
  occurred_at: Nullable<Timestamp>;
  previous_state: Nullable<string>;
  new_state: Nullable<string>;
  revision_id: Nullable<string>;
  reason: Nullable<string>;
  metadata: Nullable<Record<string, unknown>>;
}

export interface SiteDoc {
  site_id: string;
  site_code: Nullable<string>;
  site_name_display: Nullable<string>;
  county: Nullable<string>;
  watershed_name: Nullable<string>;
  latitude: Nullable<number>;
  longitude: Nullable<number>;
  site_tolerance_m: Nullable<number>;
  active: Nullable<boolean>;
}

/** One row of the PENDING_REVIEW queue, joined with its site and current revision. */
export interface QueueRow {
  submission: SubmissionDoc;
  site: SiteDoc | null;
  currentRevision: RevisionDoc | null;
}

/** Everything the detail page renders for a single submission. */
export interface SubmissionDetail {
  submission: SubmissionDoc;
  site: SiteDoc | null;
  currentRevision: RevisionDoc | null;
  measurements: MeasurementDoc[];
  flags: ValidationFlagDoc[];
  attachments: AttachmentDoc[];
  revisions: RevisionDoc[];
  audit: AuditDoc[];
}

/** Success shape returned by review/reviewSubmission.mjs via the API route. */
export interface ReviewResult {
  idempotent: boolean;
  submission_id: string;
  revision_id: string;
  decision: ReviewDecision;
  status: SubmissionStatus;
  audit_id: string;
}
