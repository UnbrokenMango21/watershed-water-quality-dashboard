# Authentication provider readiness — 2026-10-16

Read-only live configuration was retrieved with the Identity Platform Admin `getConfig` and `defaultSupportedIdpConfigs.list` APIs, using the operator's existing Firebase CLI session in memory. Only allowlisted readiness fields were displayed. No token, OAuth secret, raw authenticated configuration or account inventory belongs in Git. No provider or authorized domain was changed.

## Verified configuration

| Method | Live configuration | Application readiness |
| --- | --- | --- |
| Email/password | Enabled; password required | Existing registration, password reset, verification and sign-out flows; local-emulator browser evidence in the implementation ledger |
| Google | Enabled, OAuth client configured | Existing iOS flow retained. Native callback and Firebase project bindings inspected separately; real provider consent/collision/linking still needs a provider workflow test |
| Microsoft/Outlook | No configured provider returned | Keep its button hidden; enablement and callbacks require an approved cloud configuration change |
| Apple | No configured provider returned | Keep its button hidden; requires Apple capability/entitlement, service identifier, callbacks and configured Firebase provider |
| Phone | Not enabled in the live sign-in configuration | Keep its button hidden; requires provider enablement, app verification and real phone/SMS verification |
| Passwordless email | Email/password is configured; passwordless/deep-link readiness is not established | Keep passwordless entry hidden until action handling and cross-platform links are configured and tested |

The live project does not authorize the QC or public-dashboard App Hosting domain for OAuth. Do not expose Google popup/redirect buttons on those domains until that authorization is explicitly approved and tested. Anonymous public dashboard access remains independent of authentication.

Native binding inspection confirmed the iOS Firebase project and bundle identifier, a present Google client identifier, and the matching reversed-client callback URL scheme. Android's Firebase project matches, but its tracked client configuration has no OAuth clients; native Google enablement there needs the correct package/signing-certificate configuration first. Client identifiers and certificate fingerprints are not copied into this report.

MFA is currently disabled. This is a verified configuration fact, not a claim that MFA has been enabled or tested. Duplicate-account policy and collision behavior must be verified in a controlled provider workflow before calling linking complete.

## Remaining implementation and verification

- Use Firebase-supported linking from an already authenticated account, preserving its UID. Never merge accounts or scientific attribution merely because two email strings match.
- Cover existing-account collisions, cancellation, `credential-already-in-use`, expired credentials and reauthentication. No automated test should impersonate either designated person or create persistent live test users.
- Existing emulator signup/verification tests prove those application states; they do not establish delivery by an external email provider or a successful Google/Microsoft/Apple/phone login.
- Privileged grants remain gated on verified ownership and explicit operator approval. Readiness inspection performs no grant, account deletion, migration or publication.

API references: [project configuration](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects/getConfig), [supported provider configuration](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects.defaultSupportedIdpConfigs).
