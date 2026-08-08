function assertPlan(plan) {
  if (!plan?.submission_id) throw new Error('plan.submission_id is required');
  if (!plan?.revision_id) throw new Error('plan.revision_id is required');
  if (!plan?.submission_patch) throw new Error('plan.submission_patch is required');
  if (!plan?.revision_patch) throw new Error('plan.revision_patch is required');
  if (!Array.isArray(plan?.validation_flags)) throw new Error('plan.validation_flags must be an array');
  if (!plan?.audit_event?.audit_id) throw new Error('plan.audit_event.audit_id is required');
}

function isTimestampKey(key) {
  return typeof key === 'string' && key.endsWith('_at');
}

function toFirestoreValue(value, Timestamp, key = null) {
  if (value == null) return value;

  if (isTimestampKey(key) && typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return Timestamp.fromDate(parsed);
  }

  if (Array.isArray(value)) return value.map((v) => toFirestoreValue(v, Timestamp));

  if (typeof value === 'object') {
    // Preserve native Firestore/Admin SDK special values such as Timestamp/GeoPoint.
    if (typeof value.toDate === 'function' || value.constructor?.name === 'GeoPoint') return value;

    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toFirestoreValue(v, Timestamp, k)]),
    );
  }

  return value;
}

/**
 * Apply a validation persistence plan to Firestore atomically.
 *
 * Safety guarantees:
 * - current submission status must still match plan.previous_status;
 * - current_revision_id, when present, must match plan.revision_id;
 * - old validation flags are replaced rather than left stale;
 * - submission summary, revision validation map, flags and audit event commit together;
 * - ISO timestamps emitted by the pure persistence layer become native Firestore Timestamps.
 */
export async function commitValidationPlanToFirestore({ db, Timestamp, plan }) {
  if (!db || typeof db.runTransaction !== 'function') throw new Error('Firestore db with runTransaction() is required');
  if (!Timestamp || typeof Timestamp.fromDate !== 'function') throw new Error('Firestore Timestamp implementation is required');
  assertPlan(plan);

  const submissionRef = db.collection('submissions').doc(plan.submission_id);
  const revisionRef = submissionRef.collection('revisions').doc(plan.revision_id);
  const flagsQuery = revisionRef.collection('validationFlags');
  const auditRef = submissionRef.collection('audit').doc(plan.audit_event.audit_id);

  return db.runTransaction(async (tx) => {
    // All reads occur before writes, as required by Firestore transactions.
    const submissionSnap = await tx.get(submissionRef);
    const revisionSnap = await tx.get(revisionRef);
    const existingFlagsSnap = await tx.get(flagsQuery);

    if (!submissionSnap.exists) throw new Error(`Submission '${plan.submission_id}' does not exist`);
    if (!revisionSnap.exists) throw new Error(`Revision '${plan.revision_id}' does not exist`);

    const current = submissionSnap.data();
    if (current.status !== plan.previous_status) {
      throw new Error(
        `Submission status changed during validation: expected '${plan.previous_status}', found '${current.status}'`,
      );
    }

    if (current.current_revision_id && current.current_revision_id !== plan.revision_id) {
      throw new Error(
        `Submission current_revision_id '${current.current_revision_id}' does not match validated revision '${plan.revision_id}'`,
      );
    }

    const writeCount = existingFlagsSnap.size + plan.validation_flags.length + 3;
    if (writeCount > 450) {
      throw new Error(`Validation transaction would require ${writeCount} writes; refusing oversized transaction`);
    }

    // Replace the prior validation result so resolved/stale flags cannot survive revalidation.
    for (const doc of existingFlagsSnap.docs) tx.delete(doc.ref);

    tx.update(submissionRef, toFirestoreValue(plan.submission_patch, Timestamp));
    tx.update(revisionRef, toFirestoreValue(plan.revision_patch, Timestamp));

    for (const flag of plan.validation_flags) {
      const ref = flagsQuery.doc(flag.flag_id);
      tx.set(ref, toFirestoreValue(flag, Timestamp));
    }

    tx.set(auditRef, toFirestoreValue(plan.audit_event, Timestamp));

    return {
      submission_id: plan.submission_id,
      revision_id: plan.revision_id,
      next_status: plan.next_status,
      written_flag_count: plan.validation_flags.length,
      replaced_flag_count: existingFlagsSnap.size,
      audit_id: plan.audit_event.audit_id,
    };
  });
}
