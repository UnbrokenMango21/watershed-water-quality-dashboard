'use client';

/**
 * Email/Password sign-in plus the reviewer role gate.
 *
 * There is deliberately NO signup form: reviewer accounts and the `role` custom
 * claim are provisioned server-side.
 *
 * IMPORTANT: this gate is a UX affordance, not the security boundary. Reads are
 * actually enforced by firebase/firestore.rules and writes by the API route's own
 * Admin-SDK token verification. Hiding the UI proves nothing on its own.
 */
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';

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

function Topbar({ session }: { session: ReviewerSession | null }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <Link href="/review" style={{ color: 'inherit', textDecoration: 'none' }}>
            Watershed Watch QC Console
          </Link>
          <small>Central Pennsylvania · scientific submission review</small>
        </div>
        {session ? (
          <div className="topbar-user">
            <span>{session.user.email ?? session.user.uid}</span>
            <code>{session.role}</code>
            <button type="button" onClick={() => void signOut(clientAuth())}>
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default function AuthGate({ children }: { children: (session: ReviewerSession) => ReactNode }) {
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
      <>
        <Topbar session={null} />
        <main className="shell">
          <p className="muted" role="status" aria-live="polite">Loading reviewer workspace…</p>
        </main>
      </>
    );
  }

  if (state.kind === 'misconfigured') {
    return (
      <>
        <Topbar session={null} />
        <main className="shell">
          <div className="card centered-state">
            <h1>Not configured</h1>
            <p className="muted">{state.message}</p>
          </div>
        </main>
      </>
    );
  }

  if (state.kind === 'signed-out') {
    return (
      <>
        <Topbar session={null} />
        <main className="shell">
          <div className="card auth-panel">
            <div className="auth-kicker">Scientific review workspace</div>
            <h1>Reviewer sign-in</h1>
            <p className="muted" style={{ marginTop: 0 }}>
              Review submitted watershed observations, validation results, and revision history. Access is limited to
              administrator-provisioned reviewers.
            </p>
            {formError ? <div className="notice notice-error" role="alert">{formError}</div> : null}
            <form onSubmit={handleSignIn} aria-busy={signingIn}>
              <label className="field">
                <span>Email</span>
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
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button type="submit" className="primary" disabled={signingIn || !email.trim() || !password}>
                {signingIn ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="auth-footnote">No public sign-up. Credentials are managed by the watershed program.</p>
            </form>
          </div>
        </main>
      </>
    );
  }

  if (state.kind === 'unauthorized') {
    return (
      <>
        <Topbar session={{ user: state.user, role: state.role }} />
        <main className="shell">
          <div className="card centered-state">
            <h1>Not authorized</h1>
            <p>Your account does not have reviewer access.</p>
            <p className="muted">
              Signed in as {state.user.email ?? state.user.uid}. Ask an administrator to verify your access, then sign
              out and back in.
            </p>
            <button type="button" onClick={() => void signOut(clientAuth())}>
              Sign out
            </button>
          </div>
        </main>
      </>
    );
  }

  const session: ReviewerSession = { user: state.user, role: state.role };
  return (
    <>
      <Topbar session={session} />
      <main className="shell">{children(session)}</main>
    </>
  );
}
