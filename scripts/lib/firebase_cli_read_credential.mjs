// Optional, read-only inventory adapter for an already signed-in Firebase CLI operator.
// Read the CLI's existing session through its installed API. Refresh only in memory: never print,
// serialize or persist OAuth tokens, and never start a login or change granted scopes.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export function firebaseCliReadCredential(projectDirectory) {
  const { getProjectDefaultAccount } = require('firebase-tools/lib/auth.js');
  const { clientId, clientSecret } = require('firebase-tools/lib/api.js');
  const account = getProjectDefaultAccount(projectDirectory);
  if (!account?.tokens?.refresh_token) throw new Error('No existing Firebase CLI operator session.');
  let cached = account.tokens;
  return {
    async getAccessToken() {
      if (typeof cached.access_token === 'string' && Number(cached.expires_at) > Date.now() + 60_000) {
        return { access_token: cached.access_token, expires_in: Math.floor((cached.expires_at - Date.now()) / 1000) };
      }
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: account.tokens.refresh_token,
          client_id: clientId(), client_secret: clientSecret() }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error('Existing CLI session could not be refreshed.');
      const value = await response.json();
      if (typeof value.access_token !== 'string' || !Number.isFinite(value.expires_in) || value.expires_in <= 0) {
        throw new Error('Invalid OAuth response.');
      }
      cached = { access_token: value.access_token, expires_at: Date.now() + value.expires_in * 1000 };
      return { access_token: cached.access_token, expires_in: value.expires_in };
    },
  };
}
