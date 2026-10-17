import Link from "next/link";
import "./landing.css";

function Brand() {
  return (
    <Link className="ww-brand" href="/" aria-label="Watershed Watch home">
      {/* eslint-disable-next-line @next/next/no-img-element -- repository-owned vector brand asset */}
      <img src="/brand/pww-mark-master.svg" width="27" height="32" alt="" />
      <span>Watershed Watch</span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="ww-site">
      <a href="#main" className="ww-skip">Skip to content</a>
      <header className="ww-header">
        <Brand />
        <nav aria-label="Main navigation" className="ww-nav">
          <a href="#purpose">Our purpose</a>
          <a href="#process">The process</a>
          <a href="#explore">Explore</a>
        </nav>
        <Link href="/dashboard" className="ww-header-action">Open dashboard <span aria-hidden="true">↗</span></Link>
      </header>

      <main id="main">
        <section className="ww-hero" aria-labelledby="hero-title">
          <div className="ww-hero-image" aria-hidden="true" />
          <div className="ww-hero-content">
            <p className="ww-overline ww-hero-overline">WATERSHED WATCH <span className="ww-overline-rule" /> PENNSYLVANIA</p>
            <h1 id="hero-title">Know the water.<br />See the whole picture.</h1>
            <p className="ww-hero-description">Real observations. Careful review. A clearer understanding of the waterways around us.</p>
            <div className="ww-hero-actions">
              <Link className="ww-action-primary" href="/dashboard">Explore the dashboard <span aria-hidden="true">↗</span></Link>
              <a className="ww-action-secondary" href="#purpose">Discover Watershed Watch <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="ww-hero-bottom">
            <span>01 / FROM THE FIELD TO THE PUBLIC</span>
            <span className="ww-photo-label">Riffle Run, Pennsylvania · <a href="https://commons.wikimedia.org/wiki/File:Riffle_Run_(3)_(13982015223).jpg" target="_blank" rel="noopener noreferrer">Photo: Nicholas A. Tonelli</a></span>
          </div>
        </section>

        <section className="ww-statement" id="purpose" aria-labelledby="purpose-title">
          <span className="ww-overline ww-overline-dark">WHY IT MATTERS</span>
          <h2 id="purpose-title">Every watershed has a story.<br /><span>We help you understand it.</span></h2>
          <div className="ww-statement-detail">
            <span className="ww-detail-index">01 / THE MISSION</span>
            <p>Watershed Watch connects field observations, scientific quality control, and public exploration. The result is a more transparent way to understand local water quality, without losing sight of how each observation was collected and reviewed.</p>
          </div>
        </section>

        <section className="ww-story" aria-labelledby="story-title">
          <div className="ww-story-photo">
            <span>PENNS CREEK / CENTRE COUNTY</span>
          </div>
          <div className="ww-story-content">
            <span className="ww-overline ww-overline-dark">MADE FOR REAL PLACES</span>
            <h2 id="story-title">Close to the water.<br />Connected to the science.</h2>
            <p>From a streamside measurement to a reviewed public record, every step has a purpose. The system keeps field work practical and scientific records accountable.</p>
            <a className="ww-inline-link" href="#process">See the process <span aria-hidden="true">↗</span></a>
          </div>
        </section>

        <section className="ww-process" id="process" aria-labelledby="process-title">
          <div className="ww-process-heading">
            <div>
              <span className="ww-overline ww-overline-dark">A TRUSTWORTHY RECORD</span>
              <h2 id="process-title">Three steps.<br />One connected system.</h2>
            </div>
            <p>The public view is only the final chapter. The work behind every approved observation matters just as much.</p>
          </div>
          <div className="ww-process-items">
            <article><span className="ww-process-number">01</span><div><h3>Collect</h3><p>Field teams capture observations, site details, methods, and measurements in native mobile apps.</p></div></article>
            <article><span className="ww-process-number">02</span><div><h3>Review</h3><p>Validation and authorized reviewers examine the record. Corrections preserve the original observation.</p></div></article>
            <article><span className="ww-process-number">03</span><div><h3>Publish</h3><p>Only approved public-safe records reach ArcGIS and become available in the public explorer.</p></div></article>
          </div>
        </section>

        <section className="ww-explore" id="explore" aria-labelledby="explore-title">
          <div className="ww-explore-heading">
            <div>
              <span className="ww-overline ww-overline-dark">THE PUBLIC EXPLORER</span>
              <h2 id="explore-title">See the data.<br />Explore the place.</h2>
            </div>
            <div className="ww-explore-aside">
              <p>Explore monitoring sites, watershed boundaries, and approved water-quality records in one interactive view.</p>
              <Link className="ww-inline-link" href="/dashboard">Open the full dashboard <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
          <div className="ww-explorer">
            <div className="ww-explorer-header">
              <span>WATERSHED WATCH / EXPLORER</span>
              <Link href="/dashboard">FULL SCREEN ↗</Link>
            </div>
            <iframe title="Watershed Watch public water quality dashboard" src="/dashboard" loading="lazy" />
          </div>
          <p className="ww-explorer-disclaimer">Public data appears only after scientific review and authorized publication. The absence of readings is not evidence of water quality conditions.</p>
        </section>

        <section className="ww-closer">
          <span className="ww-overline">WATERSHED WATCH</span>
          <h2>Our water deserves<br />a closer look.</h2>
          <Link href="/dashboard" className="ww-action-primary">Explore Watershed Watch <span aria-hidden="true">↗</span></Link>
        </section>
      </main>
      <footer className="ww-footer">
        <div><Brand /><p>Built for careful monitoring and public understanding.</p></div>
        <div className="ww-footer-links"><a href="#purpose">Purpose</a><a href="#process">Process</a><Link href="/dashboard">Public dashboard</Link><a href="#main">Back to top ↑</a></div>
        <p className="ww-credits">Pennsylvania photographs: <a href="https://commons.wikimedia.org/wiki/File:Riffle_Run_(3)_(13982015223).jpg" target="_blank" rel="noopener noreferrer">Riffle Run</a> and <a href="https://commons.wikimedia.org/wiki/File:Flickr_-_Nicholas_T_-_Overseen.jpg" target="_blank" rel="noopener noreferrer">Penns Creek</a> by Nicholas A. Tonelli, <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noopener noreferrer">CC BY 2.0</a>. Images cropped for layout. Photographs illustrate Pennsylvania waterways, not specific monitoring observations.</p>
      </footer>
    </div>
  );
}
