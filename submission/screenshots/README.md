# Screenshot Checklist

Release-safe screenshots only:
- TestFlight Build 13 installed on physical iPhone.
- Sign-in/home with private account details obscured.
- QC review state with identities/private notes obscured.
- Anonymous public dashboard empty state before first real publication.
- Populated public dashboard after first provenance-cleared non-test publication.
- ArcGIS public view schema/capabilities without credentials.

Never include passwords, tokens, reset links, private IDs or OAuth material.

## Web polish evidence (see `../QC_DASHBOARD_POLISH.md`)

The hosted development surfaces were checked live after the polish pass. The
following image files are still outstanding and should be captured only after
redacting private identities and notes:
- `web/review` signed-out screen, showing the re-hued auth card and app bar.
- `web/review` record view with a reviewer session (identities/notes obscured
  per the rule above).
- `public-dashboard` with `NEXT_PUBLIC_DASHBOARD_DATA_MODE=demo` (needs no
  live credentials), showing the strengthened DEMO MODE banner and the
  re-hued site list/map/chart.

These are visual-polish evidence, not release screenshots, and are not
subject to the "never include..." constraints above beyond the general rule
of not exposing real reviewer identities if a live session is used.
