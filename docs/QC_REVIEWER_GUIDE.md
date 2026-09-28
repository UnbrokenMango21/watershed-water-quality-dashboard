# Reviewing observations in the QC Console

This guide describes how the console works today. It does not set scientific policy; the validation
rules and review decisions it describes are the ones already built into PA Watershed Watch. The same
text appears in the console at `/help`.

## Access

Reviewer accounts are created by a program administrator. There is no public sign-up. You need an
account with the QC reviewer or administrator role and an active reviewer profile. If you sign in and
see "Not authorized", ask an administrator to check your access.

## The queue

The queue lists submissions waiting for review, longest wait first. Search by site, collector or
identifier, and filter by records that need attention, have environmental alerts, or are clean.

## Reading a record

Each record opens with what the collector recorded: the site, who collected it and when, the method
and instrument, the measurements (the entered value and unit next to the stored canonical value), and
any field notes. Validation findings are grouped by severity:

- **Blocking errors** break a validation rule. Approval is unavailable until the collector files a
  corrected revision.
- **Plausibility warnings** mark values that are possible but unusual for the site. They do not block
  approval.
- **Environmental alerts** describe a notable condition in the water. They are findings about the
  watershed, not problems with the submission.
- **Information** is context from the validation service.

Identifiers and version details are kept under Technical provenance at the bottom of the record.

## Decisions

- **Approve** accepts the revision. It leaves the queue and moves on toward publication. Approval is
  not publication; the public release happens separately.
- **Request correction** sends it back to the collector for a new revision. A reason is required, and
  the collector sees it.
- **Reject** is permanent. A reason is required and recorded in the audit trail.

Every decision applies to the revision shown. If the collector files a newer revision first, your
decision is not applied; refresh to see the latest revision.

## Revisions

Submitted revisions never change. A correction creates the next revision and keeps every earlier one,
so the revision history shows exactly what was submitted each time and what the collector checked.
