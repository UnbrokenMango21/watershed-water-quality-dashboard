# Deferred: Photo and Audio Capture

**Status: intentionally deferred, not implemented in this release.**

Photo capture, photo-library attachment, and audio-note recording are removed from
the production iOS and Android apps for the first Phase 11 release. There is no
camera UI, no photo picker, no microphone recording UI, and no camera/microphone
permission prompt anywhere in either app. The "Notes and Media" step is now just
"Notes." A new submission never creates an attachment record and never attempts a
Firebase Storage upload. Android's shipping sync path is Firestore-only: its
`FirebaseStorage` injection, upload/verification loops, media file-copy path, and
`firebase-storage` Gradle dependency are removed.

This is a scope decision, not a defect: media capture must be separately designed
and tested (UX for review, storage cost/retention, moderation, offline retry
behavior, and — since a prior pass already hardened this — how a Storage failure
should and should not affect an otherwise-valid scientific submission) before it is
reintroduced. Do not re-add camera/microphone capture to either app without that
design pass; the CI hygiene check in `.github/workflows/mobile-ci.yml` will fail the
build if active capture code reappears in production source without an accompanying,
intentional update to that check.

Firestore's historical `attachments` subcollection shape, Storage compatibility rules,
and the mobile Room/SwiftData attachment entities were left unchanged rather than
migrated. Removing those dormant shapes would create migration risk and would prevent
the reviewer from displaying historical metadata. They are compatibility-only: neither
shipping mobile sync path uploads media or writes attachment metadata in Phase 11.
