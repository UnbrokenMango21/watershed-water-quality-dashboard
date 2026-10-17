import Link from "next/link";
import { PublicMapPreview } from "@/components/PublicMapPreview";
import "./landing.css";

function Brand() {
  return <Link href="/" className="ww-brand" aria-label="Watershed Watch home">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/brand/pww-mark-master.svg" width={28} height={34} alt="" />
    <span>Watershed Watch</span>
  </Link>;
}

export default function HomePage() {
  return <div className="ww-site">
    <a className="ww-skip" href="#main">Skip to content</a>
    <header className="ww-header">
      <Brand />
      <nav aria-label="Main navigation">
        <a href="#approach">How it works</a>
        <a href="#explore">Explore</a>
        <a href="#about">About</a>
      </nav>
      <Link className="ww-header-link" href="/dashboard">Open dashboard <span aria-hidden="true">↗</span></Link>
    </header>

    <main id="main">
      <section className="ww-intro" aria-labelledby="intro-title">
        <div className="ww-intro-main">
          <p className="ww-eyebrow">WATERSHED WATCH <span className="ww-separator">/</span> PENNSYLVANIA</p>
          <h1 id="intro-title">Water quality.<br />In context.</h1>
        </div>
        <div className="ww-intro-side">
          <p>Field observations, scientific review, and public information in one connected system.</p>
          <Link className="ww-cta" href="/dashboard">Explore the dashboard <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="ww-map-feature" aria-labelledby="map-title">
        <div className="ww-map-topbar">
          <div><span className="ww-map-kicker">EXPLORE THE LANDSCAPE</span><h2 id="map-title">Pennsylvania watersheds</h2></div>
          <Link href="/dashboard">Open full explorer <span aria-hidden="true">↗</span></Link>
        </div>
        <PublicMapPreview />
        <div className="ww-map-caption">
          <p><strong>Reference geography</strong> / USGS Watershed Boundary Dataset and Esri basemaps</p>
          <p>Monitoring observations are displayed only after review and authorized publication.</p>
        </div>
      </section>

      <section id="approach" className="ww-approach">
        <div className="ww-approach-head">
          <p className="ww-eyebrow">THE APPROACH</p>
          <h2>Good information<br />starts in the field.</h2>
          <p>Every published measurement has a process behind it. Watershed Watch makes the connection between collection, quality control, and public exploration easier to understand.</p>
        </div>
        <div className="ww-stages">
          <article><span>01 / COLLECT</span><h3>Observe carefully.</h3><p>Field teams record site locations, conditions, methods, and measurements using dedicated mobile tools.</p></article>
          <article><span>02 / REVIEW</span><h3>Protect the record.</h3><p>Authorized reviewers validate observations and preserve a transparent history of corrections.</p></article>
          <article><span>03 / SHARE</span><h3>Publish responsibly.</h3><p>Approved, public-safe records become available in the interactive monitoring dashboard.</p></article>
        </div>
      </section>

      <section className="ww-story" id="about" aria-labelledby="story-title">
        <div className="ww-story-picture">
          <span>THE LANDSCAPE / PENNS CREEK</span>
        </div>
        <div className="ww-story-copy">
          <p className="ww-eyebrow">WHY IT MATTERS</p>
          <h2 id="story-title">The water<br />we share.</h2>
          <p>Understanding local waterways requires more than numbers. Location, collection methods, scientific review, and time all matter.</p>
          <a className="ww-quiet-link" href="#explore">See the public explorer <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <section className="ww-explore" id="explore" aria-labelledby="explore-title">
        <div className="ww-explore-heading">
          <div><p className="ww-eyebrow">THE PUBLIC DASHBOARD</p><h2 id="explore-title">The full picture,<br />in one place.</h2></div>
          <div><p>Browse monitoring sites, watershed boundaries, and approved measurement history. The panel below is the real dashboard, not a design mockup.</p><Link className="ww-quiet-link" href="/dashboard">Open full screen <span aria-hidden="true">↗</span></Link></div>
        </div>
        <div className="ww-dashboard-window">
          <div className="ww-dashboard-window-bar"><span>WATERSHED WATCH / PUBLIC EXPLORER</span><Link href="/dashboard">FULL SCREEN ↗</Link></div>
          <iframe src="/dashboard" title="Interactive Watershed Watch public monitoring dashboard" loading="lazy" />
        </div>
        <p className="ww-accuracy">The map displays reference geography independently of observations. Only approved, public-safe monitoring records can appear in the dashboard.</p>
      </section>

      <section className="ww-end">
        <p className="ww-eyebrow">WATERSHED WATCH</p>
        <h2>Explore with context.</h2>
        <Link className="ww-cta" href="/dashboard">Open the dashboard <span aria-hidden="true">↗</span></Link>
      </section>
    </main>
    <footer className="ww-footer">
      <div className="ww-footer-main"><Brand /><span>Field data. Scientific review. Public understanding.</span></div>
      <div className="ww-footer-nav"><a href="#approach">How it works</a><a href="#explore">Explore</a><Link href="/dashboard">Dashboard</Link><a href="#main">Back to top ↑</a></div>
      <p className="ww-photo-credit">Penns Creek photography: <a href="https://commons.wikimedia.org/wiki/File:Flickr_-_Nicholas_T_-_Overseen.jpg" target="_blank" rel="noopener noreferrer">Nicholas A. Tonelli</a>, <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noopener noreferrer">CC BY 2.0</a>. Cropped for layout. The photograph illustrates a Pennsylvania waterway and is not a monitoring observation.</p>
    </footer>
  </div>;
}
