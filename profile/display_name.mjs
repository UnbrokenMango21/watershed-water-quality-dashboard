// Self-service research identity: the one profile field a collector owns.
//
// `users/{uid}` stays closed to client writes (firebase/firestore.rules). This module is the
// narrow server path that lets a signed-in person change only their own `display_name`, and
// mirrors it onto the Firebase Auth profile so new observations carry the same name. It never
// touches `role`, `active`, claims, or any submission/revision/audit record: historical
// attribution (`data_collected_by`, `collector_user_id`) is immutable scientific provenance.

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 80;

export class DisplayNameError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DisplayNameError';
    this.code = code;
  }
}

/** Trims, collapses internal whitespace, and rejects control characters and out-of-range lengths. */
export function normalizeDisplayName(raw) {
  if (typeof raw !== 'string') throw new DisplayNameError('invalid-argument', 'Full name must be text.');
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(raw)) throw new DisplayNameError('invalid-argument', 'Full name cannot contain control characters.');
  const value = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  const length = [...value].length;
  if (length < DISPLAY_NAME_MIN) throw new DisplayNameError('invalid-argument', `Full name must be at least ${DISPLAY_NAME_MIN} characters.`);
  if (length > DISPLAY_NAME_MAX) throw new DisplayNameError('invalid-argument', `Full name must be ${DISPLAY_NAME_MAX} characters or fewer.`);
  return value;
}

/** The request body may carry only `displayName`; anything else (role, active, uid…) is refused. */
export function parseDisplayNameRequest(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new DisplayNameError('invalid-argument', 'Request must be an object.');
  }
  const extra = Object.keys(data).filter((key) => key !== 'displayName');
  if (extra.length) throw new DisplayNameError('invalid-argument', `Unsupported profile field(s): ${extra.join(', ')}.`);
  return normalizeDisplayName(data.displayName);
}

/**
 * Writes `display_name` for the caller's own profile. `uid` must come from the verified auth
 * context, never from the request body. A missing profile document is created with only the
 * owned fields; role and active state remain server-provisioned.
 */
export async function updateOwnDisplayName({ db, auth, uid, data, serverTimestamp }) {
  if (typeof uid !== 'string' || !uid) throw new DisplayNameError('unauthenticated', 'Sign in to update your name.');
  const displayName = parseDisplayNameRequest(data);
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    tx.set(ref, {
      display_name: displayName,
      updated_at: serverTimestamp(),
      ...(snapshot.exists ? {} : { created_at: serverTimestamp() }),
    }, { merge: true });
  });
  if (auth) await auth.updateUser(uid, { displayName });
  return { displayName };
}
