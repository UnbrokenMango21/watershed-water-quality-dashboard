Review this repository as a scientific data-platform change, not only as a style review.

Prioritize findings in this order:

1. Data integrity/provenance: submitted science must not be silently overwritten; correction revisions and stable IDs must be preserved.
2. Privacy/security: no secrets, tokens, passwords, landowner/private property data, exact GPS, scientific values, notes, emails, or reviewer identities/comments may leak into Analytics, public output, logs, or committed config.
3. Ownership boundaries: collector client must not gain write access to server-owned validation, scoring, review, workflow, or publication fields; Firebase remains staging/unapproved and ArcGIS remains approved authoritative data.
4. Phase 9/10 contract drift: flag mobile changes that alter Firebase schema, Firestore rule assumptions, validation semantics, quality scoring, anomaly behavior, or ArcGIS contracts without an explicit cross-phase decision.
5. Offline/sync correctness: local persistence must not be represented as server acceptance; sync/retry states must be truthful.
6. Expo/EAS architecture: generated `mobile/ios` and `mobile/android` must remain untracked; cloud EAS builds are the normal native compilation path; flag unnecessary local CocoaPods/Xcode/Gradle workarounds.
7. Dependency safety: flag broad dependency churn, SDK-generation mixing, lockfile noise, or any use/effect equivalent to `npm audit fix --force`.
8. Cross-platform parity: changes should behave sensibly on both iOS and Android unless explicitly scoped.
9. UI/accessibility: preserve the established field-science design system, outdoor usability, touch targets, units, and clear status language.
10. Verification quality: do not accept claims that tests/builds passed unless the task output demonstrates they ran; flag missing relevant tests.

Do not recommend weakening Firestore rules, committing Firebase client files/secrets, enabling unrelated auth providers, or rewriting stable UI merely to simplify implementation.

Return concrete, actionable findings with file/line references when possible. Distinguish blockers from improvements and avoid inventing failures that were not observed.
