import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reviewer help | PA Watershed Watch' };

/**
 * Reviewer guidance for the existing interface and workflow. It mirrors docs/QC_REVIEWER_GUIDE.md and
 * sets no scientific policy. Public on purpose: it holds no data and helps before sign-in.
 */
export default function HelpPage() {
  return (
    <div className="app">
      <header className="appbar">
        <a className="brand" href="/review">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG mark */}
          <img className="brand-mark" src="/brand/pww-mark-master.svg" alt="" width={22} height={26} />
          <span className="brand-text">
            <strong>PA Watershed Watch</strong>
            <span>Reviewer help</span>
          </span>
        </a>
        <div className="appbar-spacer" />
        <a className="btn" href="/review">Back to review</a>
      </header>

      <main className="help">
        <h1>Reviewing observations</h1>
        <p className="help-lede">How the QC Console works. The rules it describes are the ones already built into PA Watershed Watch.</p>

        <section>
          <h2>Access</h2>
          <p>
            Reviewer accounts are created by a program administrator. There is no public sign-up. You need an account with
            the QC reviewer or administrator role and an active reviewer profile. If you sign in and see “Not authorized”,
            ask an administrator to check your access.
          </p>
        </section>

        <section>
          <h2>The queue</h2>
          <p>
            The queue lists submissions waiting for review, longest wait first. Search by site, collector or identifier, and
            filter by records that need attention, have environmental alerts, or are clean.
          </p>
        </section>

        <section>
          <h2>Reading a record</h2>
          <p>
            Each record opens with what the collector recorded: the site, who collected it and when, the method and
            instrument, the measurements (the entered value and unit next to the stored canonical value), and any field
            notes. Validation findings are grouped by severity.
          </p>
          <dl className="help-list">
            <dt>Blocking errors</dt>
            <dd>Break a validation rule. Approval is unavailable until the collector files a corrected revision.</dd>
            <dt>Plausibility warnings</dt>
            <dd>Values that are possible but unusual for the site. They do not block approval.</dd>
            <dt>Environmental alerts</dt>
            <dd>A notable condition in the water. These are findings about the watershed, not problems with the submission.</dd>
            <dt>Information</dt>
            <dd>Context from the validation service.</dd>
          </dl>
          <p>Identifiers and version details are kept under Technical provenance at the bottom of the record.</p>
        </section>

        <section>
          <h2>Decisions</h2>
          <dl className="help-list">
            <dt>Approve</dt>
            <dd>Accepts the revision. It leaves the queue and moves on toward publication. Approval is not publication; the public release happens separately.</dd>
            <dt>Request correction</dt>
            <dd>Sends it back to the collector for a new revision. A reason is required, and the collector sees it.</dd>
            <dt>Reject</dt>
            <dd>Permanent. A reason is required and recorded in the audit trail.</dd>
          </dl>
          <p>
            Every decision applies to the revision shown. If the collector files a newer revision first, your decision is
            not applied; refresh to see the latest revision.
          </p>
        </section>

        <section>
          <h2>Revisions</h2>
          <p>
            Submitted revisions never change. A correction creates the next revision and keeps every earlier one, so the
            revision history shows exactly what was submitted each time and what the collector checked.
          </p>
        </section>
      </main>
    </div>
  );
}
