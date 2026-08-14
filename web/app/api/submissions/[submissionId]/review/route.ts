/**
 * POST /api/submissions/{submissionId}/review
 *
 * The only privileged write path in this app. Reviewers have no client-side
 * write access at all (firebase/firestore.rules denies it), so every review
 * decision goes through here:
 *
 *   1. verify the caller's Firebase ID token with the Admin SDK,
 *   2. re-check the `role` custom claim server-side (the browser gate is UX only),
 *   3. hand off to the already-tested domain module review/reviewSubmission.mjs,
 *      which owns atomicity, idempotency, revision-awareness and auditing.
 *
 * Nothing about the decision logic is reimplemented here; this route only does
 * authentication, authorization, and HTTP mapping.
 */
import { NextResponse } from 'next/server';

// review/ lives above web/; next.config.ts widens the bundler + tracing root to
// the repository root so this resolves.
import {
  applyReviewDecision as applyReviewDecisionUntyped,
  ReviewConflictError,
  ReviewValidationError,
} from '../../../../../../review/reviewSubmission.mjs';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';
import type { ReviewResult } from '@/lib/types';

/**
 * The domain module is plain dependency-injected ESM with no type declarations,
 * and TypeScript infers `reason: null` from its `reason = null` default. This
 * restates the module's documented contract at the import boundary rather than
 * loosening the call site.
 */
type ApplyReviewDecision = (input: {
  db: unknown;
  Timestamp: unknown;
  submissionId: string;
  expectedRevisionId: string | null;
  decision: string | null;
  reviewerUid: string;
  reviewerRole: string;
  reason?: string | null;
  now?: Date;
}) => Promise<ReviewResult>;

const applyReviewDecision = applyReviewDecisionUntyped as unknown as ApplyReviewDecision;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVIEWER_ROLES = new Set(['QC_REVIEWER', 'ADMIN']);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await context.params;

  const authorization = request.headers.get('authorization') ?? '';
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!bearer) {
    return jsonError('Missing Authorization: Bearer <idToken> header.', 401);
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth().verifyIdToken(bearer[1]);
  } catch {
    // Deliberately opaque: never tell an unauthenticated caller why.
    return jsonError('Invalid or expired credentials.', 401);
  }

  const reviewerRole = typeof decodedToken.role === 'string' ? decodedToken.role : 'COLLECTOR';
  if (!REVIEWER_ROLES.has(reviewerRole)) {
    return jsonError('Your account is not authorized to review submissions.', 403);
  }

  let body: { decision?: unknown; expectedRevisionId?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('Request body must be JSON.', 400);
  }

  try {
    const result = await applyReviewDecision({
      db: adminDb(),
      Timestamp,
      submissionId,
      expectedRevisionId: typeof body.expectedRevisionId === 'string' ? body.expectedRevisionId : null,
      decision: typeof body.decision === 'string' ? body.decision : null,
      reviewerUid: decodedToken.uid,
      reviewerRole,
      reason: typeof body.reason === 'string' ? body.reason : null,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ReviewValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof ReviewConflictError) {
      return jsonError(error.message, 409);
    }
    // Log server-side; never leak internals (or stack traces) to the client.
    console.error('[review] decision failed', { submissionId, reviewerUid: decodedToken.uid, error });
    return jsonError('The review decision could not be applied. Please try again.', 500);
  }
}
