# Store privacy evidence from the native source

Checked against the release integration branch on 2026-09-26. This records direct dependencies and declared permissions; it is not a completed Apple App Privacy or Google Play Data safety declaration.

| App | Direct SDKs relevant to privacy | Declared device access |
| --- | --- | --- |
| iOS | Firebase Core, Authentication, Firestore, App Check; Google Sign-In and Google Sign-In Swift | Location while using the app, for a sampling position and GPS accuracy |
| Android | Firebase Authentication, Firestore, App Check Play Integrity (debug provider in debug builds); Room and WorkManager for local records and sync | Fine and coarse location |

Neither native app directly declares Firebase Analytics, Crashlytics, Messaging, advertising, camera, microphone, or photo-library access. Android has no direct Google Sign-In dependency in this release; its provisioned-account sign-in uses Firebase email/password. The iOS Google Sign-In integration is included in Build 14.

Before submitting privacy answers, verify transitive SDK behavior and the final merged manifests, then confirm the actual data retention, deletion request path, support contact, and public ArcGIS field mapping with the owner. Do not infer that a data category is absent solely because a direct dependency is absent.
