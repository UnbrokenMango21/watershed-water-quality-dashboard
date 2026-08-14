# Deferred: Photo and Audio Capture

**Status: intentionally deferred, not implemented in this release.**

Photo capture, photo-library attachment, and audio-note recording are removed from
the production iOS and Android apps for the first Phase 11 release. There is no
camera UI, no photo picker, no microphone recording UI, and no camera/microphone
permission prompt anywhere in either app. The "Notes and Media" step is now just
"Notes." A new submission never creates an attachment record and never attempts a
Firebase Storage upload.

This is a scope decision, not a defect: media capture must be separately designed
and tested (UX for review, storage cost/retention, moderation, offline retry
behavior, and — since a prior pass already hardened this — how a Storage failure
should and should not affect an otherwise-valid scientific submission) before it is
reintroduced. Do not re-add camera/microphone capture to either app without that
design pass; the CI hygiene check in `.github/workflows/mobile-ci.yml` will fail the
build if active capture code reappears in production source without an accompanying,
intentional update to that check.

Firestore's `measurements`/`attachments` subcollection shape and `firebase/storage.rules`
were left unchanged rather than migrated, since the schema already treats attachments
as optional (zero-or-more) and a rules/schema migration to actively forbid them would
be a riskier change than simply not writing any. Any attachment-related mapper/model
code left in either mobile codebase as dormant is documented at its definition as
unused in Phase 11.
