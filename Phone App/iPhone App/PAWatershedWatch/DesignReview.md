# PA Watershed Watch 5-Dimension Review

Review framework: `swiftui-design-skill/references/design-review.md`. Scores reflect the implemented iPhone prototype after simulator verification.

| Screen / flow | Philosophy | Hierarchy | Craft | Function | Originality | Average |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Sign In | 8 | 9 | 8 | 8 | 8 | 8.2 |
| Home | 9 | 10 | 8 | 9 | 9 | 9.0 |
| Site Selection | 8 | 9 | 8 | 9 | 8 | 8.4 |
| Measurements | 9 | 9 | 8 | 9 | 8 | 8.6 |
| Review and Submit | 8 | 9 | 8 | 9 | 8 | 8.4 |
| Recent and Detail | 8 | 8 | 8 | 9 | 8 | 8.2 |
| Correction Revision | 9 | 9 | 8 | 9 | 9 | 8.8 |
| Account | 8 | 8 | 8 | 8 | 7 | 7.8 |

## What is working

- The warm-functional field-notebook philosophy is consistent: limestone surfaces, hemlock green, water-blue information, and goldenrod attention states.
- Start New Observation is unmistakably primary without turning Home into a marketing hero.
- Workflow and sync state are separate everywhere; archive confirmation is never claimed before `Synced`.
- Numeric entry has large monospaced fields, tappable mathematical unit fractions, decimal keyboards, completion markers, format validation, safe conversion, and automatic temperature conversion.
- Required and optional measurements are both continuously visible; field, kit, sonde, and lab workflows still adapt which parameters are required.
- Corrections are framed as new revisions with the prior value visibly locked and revision history retained.
- Long Pennsylvania site and method names wrap instead of truncating critical scientific context.

## Issues found and fixed during review

1. The iOS 27 simulator did not visibly render a prefilled secure value even though accessibility reported it. Added a non-color check indicator and VoiceOver hint when the password is filled.
2. Revision rationale initially reused field notes. Split it into a required revision note so the original notes cannot be overwritten.
3. Numeric fields initially treated any non-empty string as complete. Completion now requires a parseable number and shows an inline format error.
4. Motion now respects Reduce Motion for the test-type disclosure transition.
5. Text editors were replaced by vertical native text fields to gain clear placeholders and better keyboard behavior.
6. Field-instrument reviews initially inherited pending lab analyses from the mock draft defaults. Lab content now appears only for Penn State Lab, External Lab, and Mixed workflows.
7. The Home action and long site names initially compressed at accessibility-extra-large sizes. Home uses an alternate large-text composition, and scientific site names expand vertically rather than truncate.
8. The correction rationale and Work Offline switch now expose reliable keyboard dismissal and true native control hit targets during simulator interaction.
9. Optional measurements previously required a one-at-a-time picker. The picker was removed; every supported measurement is now visible beneath a dedicated Optional Measurements heading.
10. Units now use real stacked fractions with a horizontal division bar. Native menus expose scientifically compatible alternatives; changing a compatible unit converts the value, while method-dependent changes such as NTU to FNU require confirmation and clear the old reading.
11. Native permission prompts were verified for GPS reacquisition, field photos, and audio notes, including denied-state recovery; the full measurement catalog also remains scrollable and operable at accessibility-extra-large.

## Deliberate frontend-only boundaries

- Camera, microphone, and location authorization use native on-demand permission requests; captured media, coordinates, authentication, archive availability, and sync behavior remain realistic interactive simulations.
- Mock media thumbnails are symbolic placeholders rather than fake environmental photography.
- No backend, persistence layer, instrument integration, or internal identifiers are exposed.
