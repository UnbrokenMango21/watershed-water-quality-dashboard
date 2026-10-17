import test from 'node:test';
import assert from 'node:assert/strict';

import { accessProblem, reviewerAccessReport } from '../../scripts/verify_reviewer_access.mjs';
import { reviewerAccessProblem } from '../../web/lib/reviewSubmission.mjs';

const cases = [
  { disabled: false, claimRole: 'QC_REVIEWER', profile: { active: true, role: 'QC_REVIEWER' } },
  { disabled: false, claimRole: 'ADMIN', profile: { active: true, role: 'ADMIN' } },
  { disabled: true, claimRole: 'QC_REVIEWER', profile: { active: true, role: 'QC_REVIEWER' } },
  { disabled: false, claimRole: 'COLLECTOR', profile: { active: true, role: 'QC_REVIEWER' } },
  { disabled: false, claimRole: 'QC_REVIEWER', profile: null },
  { disabled: false, claimRole: 'QC_REVIEWER', profile: { active: false, role: 'QC_REVIEWER' } },
  { disabled: false, claimRole: 'ADMIN', profile: { active: true, role: 'COLLECTOR' } },
];

test('preflight uses the same access decision as the QC review API', () => {
  for (const input of cases) {
    assert.equal(accessProblem(input) === null, reviewerAccessProblem(input) === null, JSON.stringify(input));
  }
});

function fakes(users, profiles) {
  return {
    auth: { listUsers: async () => ({ users, pageToken: undefined }) },
    db: { collection: () => ({ doc: (uid) => ({ get: async () => ({ exists: uid in profiles, data: () => profiles[uid] }) }) }) },
  };
}

test('preflight passes only when every reviewer/admin claim has an active reviewer profile, and prints no identities', async () => {
  const users = [
    { uid: 'u-admin', email: 'person@example.edu', disabled: false, customClaims: { role: 'ADMIN' } },
    { uid: 'u-reviewer', email: 'reviewer@example.edu', disabled: false, customClaims: { role: 'QC_REVIEWER' } },
    { uid: 'u-collector', email: 'collector@example.edu', disabled: false, customClaims: {} },
  ];
  const ok = await reviewerAccessReport(fakes(users, {
    'u-admin': { active: true, role: 'ADMIN' },
    'u-reviewer': { active: true, role: 'QC_REVIEWER' },
  }));
  assert.equal(ok.pass, true);
  assert.equal(ok.rows.length, 2, 'collectors are not listed');
  assert.ok(!JSON.stringify(ok).match(/person@|reviewer@|u-admin|u-reviewer/), 'no emails or UIDs in the report');

  const missing = await reviewerAccessReport(fakes(users, { 'u-admin': { active: true, role: 'ADMIN' } }));
  assert.equal(missing.pass, false);
  assert.equal(missing.lockedOut, 1);

  const none = await reviewerAccessReport(fakes([users[2]], {}));
  assert.equal(none.pass, false, 'no reviewer at all must not pass');
});
