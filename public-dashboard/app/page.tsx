import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { DashboardLink } from "@/components/site/DashboardLink";
import { SitePage } from "@/components/site/SitePage";

function DashboardPicture() {
  const alt = "The public dashboard: a terrain map of Pennsylvania with streams and watershed outlines, a site list, and a note that no readings are published yet.";
  const { props: { srcSet: wide } } = getImageProps({ alt, src: "/media/dashboard-today.webp", width: 2400, height: 1500, sizes: "(min-width: 1296px) 1200px, calc(100vw - 40px)" });
  const { props: { srcSet: narrow, ...rest } } = getImageProps({ alt, src: "/media/dashboard-today-phone.webp", width: 780, height: 1240, sizes: "calc(100vw - 40px)", priority: true });
  return (
    <picture>
      <source media="(min-width: 761px)" srcSet={wide} sizes="(min-width: 1296px) 1200px, calc(100vw - 40px)" width={2400} height={1500} />
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- art-directed next/image props, alt included */}
      <img {...rest} srcSet={narrow} />
    </picture>
  );
}

export default function HomePage() {
  return (
    <SitePage>
      <section className="ww-wrap ww-hero" aria-labelledby="hero-title">
        <p className="ww-kicker">Water quality in Central Pennsylvania</p>
        <h1 id="hero-title">Stream readings, reviewed before they reach the map.</h1>
        <p className="ww-lead">
          Field teams record water quality at monitoring sites with a phone app. Each submission is checked
          automatically, then a reviewer approves it or sends it back. Only approved records are published.
        </p>
        <div className="ww-actions">
          <DashboardLink className="ww-button ww-button-large">Open the dashboard</DashboardLink>
          <Link href="/how-it-works" className="ww-text-link">How it works</Link>
        </div>
      </section>

      <section className="ww-wrap ww-product" aria-labelledby="product-title">
        <DashboardLink className="ww-product-shot" aria-label="Open the public dashboard">
          <DashboardPicture />
        </DashboardLink>
        <div className="ww-product-notes">
          <div>
            <h2 id="product-title">The public dashboard</h2>
            <p>Find monitoring sites on a map of Pennsylvania’s streams and watersheds, open a site to see its approved readings over time, and download them as a spreadsheet.</p>
          </div>
          <div className="ww-status-note">
            <h3>Why the map has no readings yet</h3>
            <p>No reading has been published so far. The first records will appear after a reviewer approves an authorized sample. Test submissions are never published.</p>
          </div>
        </div>
      </section>

      <section className="ww-band" aria-labelledby="journey-title">
        <div className="ww-wrap ww-journey">
          <div className="ww-journey-copy">
            <h2 id="journey-title">From the stream to the map</h2>
            <p className="ww-section-lead">Every reading passes four steps before anyone outside the project can see it.</p>
            <dl className="ww-steps">
              <div>
                <dt>Recorded at the site</dt>
                <dd>A collector enters measurements, method and conditions in the phone app. It saves to the phone first, so a weak signal never loses a visit.</dd>
              </div>
              <div>
                <dt>Checked on the server</dt>
                <dd>Automatic checks look for missing details, unit problems and positions far from the site. They flag issues for the reviewer and never change what was entered.</dd>
              </div>
              <div>
                <dt>Reviewed by a person</dt>
                <dd>A reviewer approves the submission, sends it back with a reason, or rejects it. A correction arrives as a new version, and the original is kept.</dd>
              </div>
              <div>
                <dt>Published for everyone</dt>
                <dd>Approved records go to a public map service that carries only public fields. Names, notes and private site details stay in the project.</dd>
              </div>
            </dl>
            <Link href="/how-it-works" className="ww-text-link">See each step in detail</Link>
          </div>
          <div className="ww-journey-figures">
            <figure className="ww-figure ww-figure-phone">
              <Image src="/media/interface/phone-correction-revision.webp" alt="Phone app correction screen: the submitted dissolved oxygen value of 91 mg/L is retained as revision 1 while the corrected value of 9 mg/L is resubmitted as revision 2." width={640} height={1391} sizes="(min-width: 960px) 260px, 45vw" />
              <figcaption>Phone app. A correction becomes revision 2 and revision 1 is kept. Test values.</figcaption>
            </figure>
            <figure className="ww-figure ww-figure-console">
              <Image src="/media/interface/qc-review-decision.webp" alt="QC Console review panel with three choices: approve, request correction, or reject, and a note that reviewers cannot edit scientific data." width={362} height={722} sizes="(min-width: 960px) 260px, 45vw" />
              <figcaption>Review console. One decision per version. Test record.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="ww-wrap ww-place" aria-labelledby="place-title">
        <figure className="ww-photo">
          <Image src="/media/penns-creek.webp" alt="Penns Creek winding through forested ridges, seen from Penns View in Bald Eagle State Forest." width={1280} height={773} sizes="(min-width: 1296px) 720px, (min-width: 960px) 58vw, calc(100vw - 40px)" />
          <figcaption>Penns Creek from Penns View, Bald Eagle State Forest. Photo: <a href="https://commons.wikimedia.org/wiki/File:Flickr_-_Nicholas_T_-_Overseen.jpg">Nicholas A. Tonelli</a>, <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a>, cropped.</figcaption>
        </figure>
        <div className="ww-place-copy">
          <h2 id="place-title">Why it’s built this way</h2>
          <p>A reading is only useful if people can trust where it came from. Watershed Watch keeps the full history of every submission, so the project can always trace a published value back to what was recorded at the stream.</p>
          <Link href="/about" className="ww-text-link">About the project</Link>
        </div>
      </section>
    </SitePage>
  );
}
