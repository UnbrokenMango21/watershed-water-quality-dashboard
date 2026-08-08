import test from 'node:test';
import assert from 'node:assert/strict';
import { buildValidationPersistencePlan, persistValidationResult } from '../../validation/persistence.mjs';

const submission = {
  submission_id: 'sub-001',
  status: 'VALIDATING',
};

const revision = {
  revision_id: 'rev-001',
};

const baseScores = {
  completeness_score: 100,
  location_quality_score: 95,
  method_quality_score: 100,
  validation_quality_score: 90,
  temporal_quality_score: 100,
  historical_quality_score: null,
  historical_effective_weight: 0,
  overall_quality_score: 96,
  anomaly_score: null,
};

function result(overrides = {}) {
  return {
    blocking: false,
    validation_rules_version: '1.0.0',
    quality_algorithm_version: '1.0.0',
    counts: { error: 0, warning: 1, info: 0, environmental_alert: 0 },
    scores: { ...baseScores },
    flags: [{
      flag_id: 'GPS_ACCURACY_POOR',
      severity: 'PLAUSIBILITY_WARNING',
      category: 'LOCATION',
      parameter_code: null,
      message: 'Synthetic warning',
      rule_code: 'GPS_ACCURACY_POOR',
      resolved: false,
    }],
    ...overrides,
  };
}

test('nonblocking validation advances to PENDING_REVIEW', () => {
  const plan = buildValidationPersistencePlan({
    submission,
    revision,
    result: result(),
    now: '2026-08-08T17:30:00-04:00',
  });
  assert.equal(plan.blocking, false);
  assert.equal(plan.next_status, 'PENDING_REVIEW');
  assert.equal(plan.submission_patch.status, 'PENDING_REVIEW');
  assert.equal(plan.submission_patch.overall_quality_score, 96);
  assert.equal(plan.audit_event.event_type, 'VALIDATION_COMPLETED');
});

test('blocking validation routes to NEEDS_CORRECTION, never PENDING_REVIEW', () => {
  const blocking = result({
    blocking: true,
    counts: { error: 1, warning: 0, info: 0, environmental_alert: 0 },
    scores: { ...baseScores, overall_quality_score: null },
    flags: [{
      flag_id: 'VALUE_OUTSIDE_HARD_RANGE__PH',
      severity: 'ERROR',
      category: 'VALUE_VALIDITY',
      parameter_code: 'PH',
      message: 'pH impossible',
      rule_code: 'VALUE_OUTSIDE_HARD_RANGE',
      resolved: false,
    }],
  });
  const plan = buildValidationPersistencePlan({
    submission,
    revision,
    result: blocking,
    now: '2026-08-08T17:30:00-04:00',
  });
  assert.equal(plan.blocking, true);
  assert.equal(plan.next_status, 'NEEDS_CORRECTION');
  assert.equal(plan.submission_patch.status, 'NEEDS_CORRECTION');
  assert.equal(plan.submission_patch.overall_quality_score, null);
  assert.equal(plan.audit_event.event_type, 'VALIDATION_BLOCKED');
});

test('environmental alerts do not imply blocking', () => {
  const environmental = result({
    counts: { error: 0, warning: 0, info: 0, environmental_alert: 1 },
    flags: [{
      flag_id: 'ENV_DO_BELOW_3__DO_MG_L',
      severity: 'ENVIRONMENTAL_ALERT',
      category: 'ENVIRONMENTAL',
      parameter_code: 'DO_MG_L',
      message: 'Very low dissolved oxygen',
      rule_code: 'ENV_DO_BELOW_3',
      resolved: false,
    }],
    scores: { ...baseScores, validation_quality_score: 100, overall_quality_score: 98 },
  });
  const plan = buildValidationPersistencePlan({ submission, revision, result: environmental });
  assert.equal(plan.next_status, 'PENDING_REVIEW');
  assert.equal(plan.revision_patch.validation.environmental_alert_count, 1);
  assert.equal(plan.submission_patch.error_flag_count, 0);
});

test('persistence strips internal engine-only flag fields before Firestore write', () => {
  const withInternals = result({
    flags: [{
      flag_id: 'X',
      severity: 'INFO',
      category: 'TEST',
      parameter_code: null,
      message: 'hello',
      rule_code: 'X',
      resolved: false,
      affects_quality_component: 'validation',
      context_only: true,
    }],
  });
  const plan = buildValidationPersistencePlan({ submission, revision, result: withInternals });
  assert.equal('affects_quality_component' in plan.validation_flags[0], false);
  assert.equal('context_only' in plan.validation_flags[0], false);
});

test('validation failure does not write supervisor review decision fields', () => {
  const blocking = result({ blocking: true, counts: { error: 1, warning: 0, info: 0, environmental_alert: 0 } });
  const plan = buildValidationPersistencePlan({ submission, revision, result: blocking });
  assert.equal('review_decision' in plan.submission_patch, false);
  assert.equal('review_comment' in plan.submission_patch, false);
  assert.equal('reviewed_at' in plan.submission_patch, false);
});

test('persistValidationResult commits exactly one complete plan', async () => {
  let committed = null;
  const plan = await persistValidationResult({
    submission,
    revision,
    result: result(),
    now: '2026-08-08T17:30:00-04:00',
    commitPlan: async (p) => { committed = p; },
  });
  assert.deepEqual(committed, plan);
  assert.equal(committed.validation_flags.length, 1);
  assert.equal(committed.audit_event.actor_type, 'VALIDATION_SERVICE');
});

test('invalid input fails before any persistence attempt', () => {
  assert.throws(() => buildValidationPersistencePlan({ submission: {}, revision, result: result() }), /submission_id/);
  assert.throws(() => buildValidationPersistencePlan({ submission, revision: {}, result: result() }), /revision_id/);
});
