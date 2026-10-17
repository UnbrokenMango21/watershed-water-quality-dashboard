import { currentAccount, AccessError } from './access.mjs';

const invalid = message => { throw new AccessError('invalid-argument', message); };
export async function postSubmissionMessage({ db, auth, uid, data, serverTimestamp }) {
  if (!data || Array.isArray(data) || typeof data !== 'object' || Object.keys(data).some(key => !['submissionId', 'revisionId', 'messageId', 'kind', 'text'].includes(key))) invalid('Unsupported message fields.');
  for (const key of ['submissionId', 'revisionId', 'messageId']) {
    if (typeof data[key] !== 'string' || !data[key] || data[key].length > 128 || /[\/\u0000-\u001f]/.test(data[key])) invalid('Invalid message context.');
  }
  // Client message IDs are UUIDs, so they can never collide with the review transaction's
  // deterministic decision-message IDs (review-<revision>-<decision>).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.messageId)) invalid('Use a UUID message ID.');
  if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(data.text)) invalid('Messages must contain 1 to 4000 characters.');
  if (!['COLLECTOR_COMMENT', 'REVIEWER_QUESTION', 'ADMINISTRATIVE_NOTE'].includes(data.kind)) invalid('This message type is reserved for trusted review decisions.');
  const account = await currentAccount(auth, uid);
  const submissionRef = db.collection('submissions').doc(data.submissionId);
  const messageRef = submissionRef.collection(data.kind === 'ADMINISTRATIVE_NOTE' ? 'internalNotes' : 'messages').doc(data.messageId);
  return db.runTransaction(async tx => {
    const [submissionSnapshot, revisionSnapshot, profileSnapshot, existing] = await Promise.all([
      tx.get(submissionRef), tx.get(submissionRef.collection('revisions').doc(data.revisionId)),
      tx.get(db.collection('users').doc(uid)), tx.get(messageRef),
    ]);
    const submission = submissionSnapshot.data(), profile = profileSnapshot.data();
    const claimRole = account.customClaims?.role ?? 'COLLECTOR';
    const reviewer = ['QC_REVIEWER', 'ADMIN'].includes(claimRole) && profile?.active === true && profile.role === claimRole
      && (!profile.access_version || profile.access_version === account.customClaims?.access_version);
    const owner = submission?.collector_user_id === uid;
    if (!submission || !revisionSnapshot.exists || (!owner && !reviewer)) throw new AccessError('permission-denied', 'This submission discussion is not available to your account.');
    if (!profile?.display_name || profile.active !== true) throw new AccessError('failed-precondition', 'Complete your account profile before sending a message.');
    if (data.kind === 'COLLECTOR_COMMENT' ? !owner : !reviewer) throw new AccessError('permission-denied', 'Your account cannot send this message type.');
    if (data.kind === 'ADMINISTRATIVE_NOTE' && claimRole !== 'ADMIN') throw new AccessError('permission-denied', 'Administrative notes require administrator authorization.');
    const message = {
      message_id: data.messageId, submission_id: data.submissionId, revision_id: data.revisionId,
      sender_uid: uid, sender_display_name: profile.display_name,
      sender_role: data.kind === 'COLLECTOR_COMMENT' || !reviewer ? 'COLLECTOR' : claimRole,
      kind: data.kind, text: data.text.trim(), created_at: serverTimestamp(),
    };
    if (existing.exists) {
      const stored = existing.data();
      if (['sender_uid', 'revision_id', 'kind', 'text'].some(key => stored[key] !== message[key])) throw new AccessError('already-exists', 'This message ID was already used for different content.');
      return { messageId: data.messageId, idempotent: true };
    }
    if (submission.current_revision_id !== data.revisionId) throw new AccessError('aborted', 'The submission revision changed. Refresh before sending your message.');
    tx.create(messageRef, message);
    return { messageId: data.messageId, idempotent: false };
  });
}
