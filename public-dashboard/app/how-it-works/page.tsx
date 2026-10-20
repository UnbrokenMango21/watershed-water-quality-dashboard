import type { Metadata } from "next";
import Image from "next/image";
import { DashboardLink } from "@/components/site/DashboardLink";
import { SitePage } from "@/components/site/SitePage";

export const metadata: Metadata = {
  title: "How it works",
  description: "How a water quality reading moves from a phone at the stream, through automatic checks and human review, to the public dashboard.",
};

export default function HowItWorksPage() {
  return (
    <SitePage>
      <header className="ww-wrap ww-page-head">
        <h1>How a reading becomes public</h1>
        <p className="ww-lead">Watershed Watch connects a phone app, automatic checks, a review console and a public dashboard. Each step has one job, and none of them can skip the step before it.</p>
      </header>

      <div className="ww-wrap ww-chapters">
        <section className="ww-chapter" aria-labelledby="at-the-stream">
          <div className="ww-chapter-copy">
            <h2 id="at-the-stream">At the stream</h2>
            <p>A collector opens the app at a monitoring site, confirms the site and their GPS position, and records the method and instrument they used.</p>
            <p>They enter only what they measured. No single measurement is required, but weather, water color and flow are always noted, even when the answer is Unknown.</p>
            <p>Each value keeps the unit the collector chose, alongside a standard unit for comparison. Chloride, sulfate, nitrate and phosphate also record where and when they were analyzed.</p>
            <p>Everything is saved on the phone first and sent when there is a connection.</p>
          </div>
          <div className="ww-chapter-figures ww-pair">
            <figure className="ww-figure ww-figure-phone">
              <Image src="/media/interface/phone-optional-measurements.webp" alt="Phone app measurement list with turbidity, salinity, total suspended solids and alkalinity, each with its own unit menu." width={640} height={1391} sizes="(min-width: 960px) 240px, 44vw" />
              <figcaption>Units are chosen per measurement. Interface illustration.</figcaption>
            </figure>
            <figure className="ww-figure ww-figure-phone">
              <Image src="/media/interface/phone-offline-sync.webp" alt="Phone app sync steps: saved on this phone and waiting to sync are checked; syncing and synced are not yet reached; a retry sync button below." width={640} height={480} sizes="(min-width: 960px) 240px, 44vw" />
              <figcaption>Saved on the phone, waiting for a connection. Interface illustration.</figcaption>
            </figure>
          </div>
        </section>

        <section className="ww-chapter" aria-labelledby="frozen">
          <div className="ww-chapter-copy">
            <h2 id="frozen">Submitted, then frozen</h2>
            <p>Submitting freezes that version of the record. Nobody can edit it afterwards, including the collector.</p>
            <p>If something needs fixing, the collector submits a correction as a new version. The original stays on file, unchanged, so the history of a reading is never lost.</p>
          </div>
          <div className="ww-chapter-figures">
            <figure className="ww-figure ww-figure-phone">
              <Image src="/media/interface/phone-correction-revision.webp" alt="Phone app correction screen: the submitted dissolved oxygen value of 91 mg/L is retained as revision 1 while 9 mg/L is resubmitted as revision 2 with a note about a calibration check." width={640} height={1391} sizes="(min-width: 960px) 240px, 60vw" />
              <figcaption>A mistyped value corrected as revision 2. Revision 1 is retained. Test values.</figcaption>
            </figure>
          </div>
        </section>

        <section className="ww-chapter" aria-labelledby="checked">
          <div className="ww-chapter-copy">
            <h2 id="checked">Checked automatically</h2>
            <p>A server process checks each submission for missing details, unit problems, timing and whether the recorded position matches the site. The results are attached for the reviewer.</p>
            <p>The checks can flag a submission but cannot approve it, and the phone cannot write check results or review decisions.</p>
          </div>
        </section>

        <section className="ww-chapter" aria-labelledby="reviewed">
          <div className="ww-chapter-copy">
            <h2 id="reviewed">Reviewed by a person</h2>
            <p>A reviewer opens the submission in the review console. They see the entered and standard values side by side, with the results of the checks.</p>
            <p>They make one decision: approve, request a correction with a reason the collector will see, or reject. Reviewers can’t change scientific values, and if a newer version arrives while they are deciding, the older decision is refused.</p>
          </div>
          <div className="ww-chapter-figures ww-stack">
            <figure className="ww-figure">
              <Image src="/media/interface/qc-entered-canonical.webp" alt="Review console: water temperature entered as 68 °F with a standard value of 20 °C, and a measurements table listing entered and standard values for conductivity, dissolved oxygen and pH." width={706} height={402} sizes="(min-width: 960px) 520px, calc(100vw - 40px)" />
              <figcaption>Entered and standard values. Test record in a local test environment.</figcaption>
            </figure>
          </div>
        </section>

        <section className="ww-chapter" aria-labelledby="published">
          <div className="ww-chapter-copy">
            <h2 id="published">Published as a separate step</h2>
            <p>Approval makes the current version eligible for publication. A server-side publisher then copies its public fields to the project’s map service.</p>
            <p>Approval and publication are kept apart. If publishing fails, the approval still stands and publishing is tried again. Only the latest approved version of a reading can be published.</p>
          </div>
        </section>

        <section className="ww-chapter" aria-labelledby="public">
          <div className="ww-chapter-copy">
            <h2 id="public">Open to everyone</h2>
            <p>The dashboard reads public views that contain only allowed fields. If a view ever returns a field that isn’t on that list, the dashboard shows nothing rather than risk showing it.</p>
            <p><DashboardLink className="ww-button">Open the dashboard</DashboardLink></p>
          </div>
        </section>
      </div>

      <section className="ww-band" aria-labelledby="privacy-title">
        <div className="ww-wrap">
          <h2 id="privacy-title">What is public and what stays private</h2>
          <div className="ww-columns">
            <div>
              <h3>On the public dashboard</h3>
              <ul className="ww-list">
                <li>Published monitoring sites and their locations</li>
                <li>When each sample was collected and approved</li>
                <li>Approved measurements with their units</li>
                <li>A quality score for each published sample</li>
              </ul>
            </div>
            <div>
              <h3>Never published</h3>
              <ul className="ww-list">
                <li>Collector and reviewer names or accounts</li>
                <li>Notes, comments and correction reasons</li>
                <li>Drafts, rejected and test submissions</li>
                <li>Private site labels and internal record IDs</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="ww-wrap ww-closing" aria-labelledby="empty-title">
        <h2 id="empty-title">Why the dashboard may be empty</h2>
        <p>The system is running, but no reading has been published yet. The first publication waits for an authorized, non-test sample and a reviewer’s decision. Until then the dashboard shows reference geography only.</p>
      </section>
    </SitePage>
  );
}
