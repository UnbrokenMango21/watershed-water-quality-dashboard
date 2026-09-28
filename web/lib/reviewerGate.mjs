// Client-side reviewer gate for the QC console sign-in screen. It only shapes what the screen shows;
// the review API and the Firestore rules enforce access. Kept free of Firebase imports so it can be
// unit-tested with node --test.

const REVIEWER_ROLES = new Set(['QC_REVIEWER', 'ADMIN']);

/**
 * Tracks auth events so an async lookup started for one event cannot apply after a later event
 * (sign-out or a different user) has already been handled.
 */
export function createAuthSequence() {
  let generation = 0;
  return {
    /** Call on every auth event; the returned function reports whether that event is still the latest. */
    begin() {
      const mine = ++generation;
      return () => mine === generation;
    },
    /** Call when the listener is torn down so pending lookups never apply. */
    invalidate() {
      generation += 1;
    },
  };
}

/**
 * Decides the gate state for a signed-in user: reviewer claim first, then an active reviewer profile.
 * `apply` is called at most once, and never if `isCurrent()` has become false by the time a lookup
 * finishes.
 *
 * @param {{
 *   user: unknown,
 *   readRole: () => Promise<unknown>,
 *   readProfile: () => Promise<{ active?: unknown, role?: unknown } | null>,
 *   isCurrent: () => boolean,
 *   apply: (state: { kind: 'ready' | 'unauthorized', user: any, role: string }) => void,
 * }} input
 */
export async function resolveReviewerGate({ user, readRole, readProfile, isCurrent, apply }) {
  let role = 'UNKNOWN';
  try {
    const claim = await readRole();
    role = typeof claim === 'string' ? claim : 'COLLECTOR';
    if (!isCurrent()) return;
    if (!REVIEWER_ROLES.has(role)) {
      apply({ kind: 'unauthorized', user, role });
      return;
    }
    const profile = await readProfile();
    if (!isCurrent()) return;
    const active = profile != null && profile.active === true && REVIEWER_ROLES.has(/** @type {string} */ (profile.role));
    apply({ kind: active ? 'ready' : 'unauthorized', user, role });
  } catch {
    if (isCurrent()) apply({ kind: 'unauthorized', user, role });
  }
}
