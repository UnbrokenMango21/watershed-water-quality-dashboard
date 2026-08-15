'use client';

/**
 * Email/Password sign-in, the reviewer role gate, and the application chrome.
 *
 * There is deliberately NO signup form: reviewer accounts and the `role` custom
 * claim are provisioned server-side.
 *
 * IMPORTANT: this gate is a UX affordance, not the security boundary. Reads are
 * actually enforced by firebase/firestore.rules and writes by the API route's own
 * Admin-SDK token verification. Hiding the UI proves nothing on its own.
 */
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';

import { Icon } from '@/components/icons';
import { Notice } from '@/components/ui';
import { clientAuth, isFirebaseConfigured } from '@/lib/firebase-client';

const REVIEWER_ROLES = new Set(['QC_REVIEWER', 'ADMIN']);

type GateState =
  | { kind: 'loading' }
  | { kind: 'misconfigured'; message: string }
  | { kind: 'signed-out' }
  | { kind: 'unauthorized'; user: User; role: string }
  | { kind: 'ready'; user: User; role: string };

export interface ReviewerSession {
  user: User;
  role: string;
}

const SessionContext = createContext<ReviewerSession | null>(null);

/** Available to anything rendered inside a signed-in AuthGate. */
export function useSession(): ReviewerSession {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside a signed-in AuthGate.');
  }
  return session;
}

function friendlyAuthError(error: unknown): string {
  const code = typeof error === 'object' && error !== null ? String((error as { code?: unknown }).code ?? '') : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/user-disabled':
      return 'That account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Could not reach the sign-in service. Check your network connection.';
    default:
      return 'Sign-in failed. Try again or contact an administrator.';
  }
}

function initials(session: ReviewerSession): string {
  const source = session.user.email ?? session.user.uid;
  const name = source.split('@')[0] ?? source;
  const parts = name.split(/[.\-_]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

function AppBar({ session }: { session: ReviewerSession | null }) {
  return (
    <header className="appbar">
      <a className="brand" href="/review">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="waves" size={17} strokeWidth={2} />
        </span>
        <span className="brand-text">
          <strong>Watershed Watch QC Console</strong>
          <span>Central Pennsylvania · Scientific submission review</span>
        </span>
      </a>

      <div className="appbar-spacer" />

      {session ? (
        <div className="appbar-actions">
          <a
            className="icon-btn"
            href="https://docs.firebase.google.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Help and documentation"
            title="Help and documentation"
          >
            <Icon name="help" size={17} />
          </a>
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">
              {initials(session)}
            </span>
            <span className="user-chip-text">
              <strong>{session.user.email ?? session.user.uid}</strong>
              <span>
                <span className="sr-only">Role: </span>
                {session.role.replace(/_/g, ' ')}
              </span>
            </span>
          </div>
          <button type="button" className="signout" onClick={() => void signOut(clientAuth())}>
            <Icon name="logOut" size={14} />
            Sign out
          </button>
        </div>
      ) : null}
    </header>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setState({
        kind: 'misconfigured',
        message:
          'Firebase web configuration is missing. Copy web/.env.example to web/.env.local and set the NEXT_PUBLIC_FIREBASE_* values.',
      });
      return;
    }

    return onAuthStateChanged(clientAuth(), (user) => {
      if (!user) {
        setState({ kind: 'signed-out' });
        return;
      }
      // The role lives on the ID token's custom claims, not in the app.
      user
        .getIdTokenResult()
        .then((token) => {
          const role = typeof token.claims.role === 'string' ? token.claims.role : 'COLLECTOR';
          setState(REVIEWER_ROLES.has(role) ? { kind: 'ready', user, role } : { kind: 'unauthorized', user, role });
        })
        .catch(() => setState({ kind: 'unauthorized', user, role: 'UNKNOWN' }));
    });
  }, []);

  const handleSignIn = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setFormError(null);
      setSigningIn(true);
      try {
        await signInWithEmailAndPassword(clientAuth(), email.trim(), password);
        // onAuthStateChanged drives the transition from here.
      } catch (error) {
        setFormError(friendlyAuthError(error));
      } finally {
        setSigningIn(false);
      }
    },
    [email, password],
  );

  if (state.kind === 'loading') {
    return (
      <div className="app">
        <AppBar session={null} />
        <div className="loading-pane" role="status" aria-live="polite">
          Loading reviewer workspace…
        </div>
      </div>
    );
  }

  if (state.kind === 'misconfigured') {
    return (
      <div className="app">
        <AppBar session={null} />
        <div className="auth-wrap">
          <div className="state-card">
            <h1>Not configured</h1>
            <p className="muted">{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'signed-out') {
    return (
      <div className="app">
        <AppBar session={null} />
        <div className="auth-wrap">
          <div className="auth-card">
            <p className="auth-kicker">
              <Icon name="shield" size={13} strokeWidth={2} />
              Scientific review workspace
            </p>
            <h1>Reviewer sign-in</h1>
            <p className="muted">
              Review submitted watershed observations, validation results, and revision history. Access is limited to
              administrator-provisioned reviewers.
            </p>

            {formError ? (
              <Notice kind="error" role="alert">
                {formError}
              </Notice>
            ) : null}

            <form onSubmit={handleSignIn} aria-busy={signingIn}>
              <label className="field">
                <span className="field-label">Email</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Password</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button type="submit" className="btn btn-primary btn-lg" disabled={signingIn || !email.trim() || !password}>
                {signingIn ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="auth-foot">
              <Icon name="info" size={14} />
              <span>No public sign-up. Credentials are managed by the watershed program.</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'unauthorized') {
    return (
      <div className="app">
        <AppBar session={{ user: state.user, role: state.role }} />
        <div className="auth-wrap">
          <div className="state-card">
            <h1>Not authorized</h1>
            <p>Your account does not have reviewer access.</p>
            <p className="muted">
              Signed in as {state.user.email ?? state.user.uid}. Ask an administrator to verify your access, then sign
              out and back in.
            </p>
            <p style={{ marginTop: 18 }}>
              <button type="button" className="btn" onClick={() => void signOut(clientAuth())}>
                <Icon name="logOut" size={15} />
                Sign out
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const session: ReviewerSession = { user: state.user, role: state.role };
  return (
    <SessionContext.Provider value={session}>
      <div className="app">
        <AppBar session={session} />
        {children}
      </div>
    </SessionContext.Provider>
  );
}
