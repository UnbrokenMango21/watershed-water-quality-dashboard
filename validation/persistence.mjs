const nowIso = (value) => value instanceof Date ? value.toISOString() : String(value);

function countFlags(flags, severity) {
  return (flags || []).filter((f) => f.severity === severity).length;
}

function cleanFlag(flag, createdAt) {
  return {
    flag_id: flag.flag_id,
    severity: flag.severity,
    category: flag.category,
    parameter_code: flag.parameter_code ?? null,
    message: flag.message,
    rule_code: flag.rule_code,
    created_at: createdAt,
    resolved: Boolean(flag.resolved),
  };
}

export function buildValidationPersistencePlan({ submission, revision, result, now = new Date() }) {
  if (!submission?.submission_id) throw new Error('submission_id is required');
  if (!revision?.revision_id) throw new Error('revision_id is required');
  if (!result || !Array.isArray(result.flags) || !result.scores) throw new Error('validation result is incomplete');

  const createdAt = nowIso(now);
  const errorCount = result.counts?.error ?? countFlags(result.flags, 'ERROR');
  const warningCount = result.counts?.warning
    ?? countFlags(result.flags, 'PLAUSIBILITY_WARNING');
  const infoCount = result.counts?.info ?? countFlags(result.flags, 'INFO');
  const environmentalAlertCount = result.counts?.environmental_alert
    ?? countFlags(result.flags, 'ENVIRONMENTAL_ALERT');

  const blocking = Boolean(result.blocking || errorCount > 0);
  const nextStatus = blocking ? 'NEEDS_CORRECTION' : 'PENDING_REVIEW';
  const previousStatus = submission.status ?? null;

  const validationSummary = {
    validation_rules_version: result.validation_rules_version ?? result.versions?.validation_rules_version ?? null,
    quality_algorithm_version: result.quality_algorithm_version ?? result.versions?.quality_algorithm_version ?? null,
    blocking,
    error_flag_count: errorCount,
    warning_flag_count: warningCount,
    info_flag_count: infoCount,
    environmental_alert_count: environmentalAlertCount,
    completeness_score: result.scores.completeness_score ?? null,
    location_quality_score: result.scores.location_quality_score ?? null,
    method_quality_score: result.scores.method_quality_score ?? null,
    validation_quality_score: result.scores.validation_quality_score ?? null,
    temporal_quality_score: result.scores.temporal_quality_score ?? null,
    historical_quality_score: result.scores.historical_quality_score ?? null,
    historical_effective_weight: result.scores.historical_effective_weight ?? 0,
    overall_quality_score: result.scores.overall_quality_score ?? null,
    anomaly_score: result.scores.anomaly_score ?? null,
    validated_at: createdAt,
  };

  const submissionPatch = {
    status: nextStatus,
    updated_at: createdAt,
    validation_rules_version: validationSummary.validation_rules_version,
    quality_algorithm_version: validationSummary.quality_algorithm_version,
    overall_quality_score: validationSummary.overall_quality_score,
    anomaly_score: validationSummary.anomaly_score,
    error_flag_count: errorCount,
    warning_flag_count: warningCount,
    info_flag_count: infoCount,
  };

  // Validation failures are not supervisor decisions. Review fields remain untouched.
  const audit = {
    audit_id: `validation-${revision.revision_id}-${createdAt.replace(/[^0-9]/g, '')}`,
    event_type: blocking ? 'VALIDATION_BLOCKED' : 'VALIDATION_COMPLETED',
    actor_type: 'VALIDATION_SERVICE',
    actor_id: null,
    occurred_at: createdAt,
    previous_state: previousStatus,
    new_state: nextStatus,
    revision_id: revision.revision_id,
    reason: blocking
      ? `${errorCount} blocking validation error(s)`
      : 'Validation completed without blocking errors',
    metadata: {
      error_flag_count: errorCount,
      warning_flag_count: warningCount,
      info_flag_count: infoCount,
      environmental_alert_count: environmentalAlertCount,
      overall_quality_score: validationSummary.overall_quality_score,
      anomaly_score: validationSummary.anomaly_score,
    },
  };

  return {
    submission_id: submission.submission_id,
    revision_id: revision.revision_id,
    previous_status: previousStatus,
    next_status: nextStatus,
    blocking,
    submission_patch: submissionPatch,
    revision_patch: { validation: validationSummary },
    validation_flags: result.flags.map((f) => cleanFlag(f, createdAt)),
    audit_event: audit,
  };
}

export async function persistValidationResult({ submission, revision, result, now, commitPlan }) {
  if (typeof commitPlan !== 'function') throw new Error('commitPlan callback is required');
  const plan = buildValidationPersistencePlan({ submission, revision, result, now });
  await commitPlan(plan);
  return plan;
}
