import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldHandleApprovalEvent } from '../../publication/orchestrator.mjs';
test('publisher trigger only claims a newly APPROVED transition', () => {
  assert.equal(shouldHandleApprovalEvent({ status: 'PENDING_REVIEW' }, { status: 'APPROVED' }), true);
  assert.equal(shouldHandleApprovalEvent({ status: 'APPROVED' }, { status: 'APPROVED' }), false);
  assert.equal(shouldHandleApprovalEvent({ status: 'PENDING_REVIEW' }, { status: 'REJECTED' }), false);
  assert.equal(shouldHandleApprovalEvent({ status: 'NEEDS_CORRECTION' }, { status: 'RESUBMITTED' }), false);
  assert.equal(shouldHandleApprovalEvent(null, { status: 'DRAFT' }), false);
});
