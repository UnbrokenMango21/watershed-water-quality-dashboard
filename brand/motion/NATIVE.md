# Using the identity reveal on each platform

One motion identity: the original mark, the same tracks and curves (`source/motion-spec.json`), Public
Sans lettering from the archived master, and the light and dark palettes from `config/brand_tokens.json`.
Each platform keeps its own loading rules. The reveal only ever accompanies real work; it is removed
the moment that work finishes, and it never delays a usable control.

| Rule | Value |
| --- | --- |
| Show only if the work is still pending after | 200 ms |
| Plays | once per session (web), once per cold launch (apps) |
| Mark settles | 1280 ms; lockup settles 1760 ms |
| Exit | 280 ms opacity fade, content interactive underneath |
| Reduced motion | settled mark, no animation |
| Slow message (web) | after 6 s |
| Hard limit (web) | 15 s, then the page continues with a retry |

## Website (implemented)

`public-dashboard/components/dashboard/MapLoadVeil.tsx` covers only the map region and reacts to real
ArcGIS readiness (`arcgisViewReadyChange`, first stationary frame, `arcgisViewReadyError`) and to the
approved-record request. Checks: `public-dashboard/scripts/loading-qa.mjs`.

## QC Console (implemented)

`web/components/AuthGate.tsx` shows the mark in its existing loading pane while Firebase Auth resolves
the reviewer session, and follows the reviewer's light or dark preference. Review behaviour is
unchanged. The console's header still reads "PA Watershed Watch"; renaming the internal tool is a
separate decision.

## iOS (drop-in source, not wired in)

`native/ios/WatershedWatchRevealGeometry.swift` (generated) and `native/ios/WatershedWatchReveal.swift`.
Add both to the app target. The view draws with `Canvas`, uses the same cubic-bezier solver as
browsers, stops redrawing once settled and honours Reduce Motion. `WatershedWatchReveal(.mark, frozenAt:)`
renders one frame for previews and snapshot tests. Checked with `swiftc -typecheck` against the iOS 17
simulator SDK and rendered on macOS at 0.24 s, 1.04 s and settled; the frames match the web stills
(`native/ios/swiftui-frames.png`).

The launch screen is static and is shown by the system before any app code runs. The app currently
uses the generated launch screen (`INFOPLIST_KEY_UILaunchScreen_Generation`). To hand off cleanly:

1. Give the launch screen a background colour asset of Limestone `#F6F3EC` with a Night `#0F1A17` dark
   appearance, optionally with the static mark (`brand/logo/watershed-watch-mark.svg`) centred.
2. In the first SwiftUI view, start the real work (restoring the signed-in session and local drafts).
   If it has not finished after 200 ms, show `WatershedWatchReveal(.mark)` on the same background, at the
   launch mark's size and position, so the transition is continuous.
3. When the work finishes, fade to the app over 0.28 s whether or not the reveal has settled.
4. Do not replay on returning from the background.

## Android (drop-in source, not wired in)

`native/android/WatershedWatchRevealGeometry.kt` (generated) and `native/android/WatershedWatchReveal.kt`,
package `org.watershed.pawatershedwatch.brand`. Compiled inside the app module with
`./gradlew :app:compileDebugKotlin` (temporarily copied in, then removed). It honours the system
animator duration scale, and `frozenAtMs` renders one frame for previews and screenshot tests.

Android 12 and later always show a system splash with the app icon; the app has no splash
configuration yet. To keep it consistent:

1. Add `androidx.core:core-splashscreen` and a splash theme with `windowSplashScreenBackground`
   Limestone (Night in `values-night`) and `windowSplashScreenAnimatedIcon` set to a static vector of the
   mark. An icon without a background must fit inside a 192 dp circle in a 288 dp canvas; the mark at
   about 128 dp tall fits with margin.
2. Use `setKeepOnScreenCondition` only for genuine readiness (session restore), and release it after
   at most 1.5 s regardless.
3. If work is still pending after the first frame, show `WatershedWatchReveal(layout = RevealLayout.Mark)`
   centred on the same background, then fade to content as soon as the work finishes.

## Portrait composition

`exports/watershed-watch-reveal-portrait-{light,dark}.{mp4,webm}` (1080 x 1920) place the stacked
lockup 48 px above centre, where native splash icons sit, with at least 280 px clear above and below for
system bars and the home indicator. Use it for store previews and app intros, not as a launch video.
