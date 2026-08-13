# PA Watershed Watch

Native SwiftUI frontend prototype for Pennsylvania watershed researchers collecting water-quality observations in the field.

Open `PAWatershedWatch.xcodeproj`, choose an iPhone simulator, and run the `PAWatershedWatch` scheme. The prototype uses realistic local mock data only. No backend or external service is included.

The complete clickable path begins at the prefilled Sign In screen:

`Sign In -> Home -> New or Resume Observation -> Select Site -> Visit Details -> Test and Method -> Measurements -> Notes and Media -> Review -> Submit -> Submission Status`

Recent Observations includes a confirmed record, a correction request, and a sync failure. Account includes a Work Offline control so cached-site collection, local submission, retry, and confirmed synchronization can be exercised. Corrections always create a new revision and retain the submitted revision.

Measurements are always divided into Required Measurements and Optional Measurements for the selected test type. Every supported parameter remains visible in the scrolling instrument face, with tappable scientific-unit menus, stacked fraction notation, safe value conversion, large decimal entry, automatic temperature conversion, and no add-field step.

The prototype requests location access when GPS is reacquired, camera access when a field photo is taken, and microphone access when an audio note is recorded. Media, coordinates, authentication, persistence, and synchronization remain realistic frontend simulations backed by local mock data.

## Verification

- Swift 6 build and Xcode static analysis pass.
- Six model tests pass for field measurements, compatible-unit conversion, protected method-dependent changes, complete optional measurement availability, pending lab work, and revision preservation.
- The primary, correction, offline and retry, full measurement catalog, native permission, and accessibility-extra-large flows pass on an iPhone 17 Pro simulator.
