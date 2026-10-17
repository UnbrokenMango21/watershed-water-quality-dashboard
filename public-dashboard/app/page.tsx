import Link from "next/link";
import "./landing.css";

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link className={footer ? "ww-brand ww-brand-footer" : "ww-brand"} href="/" aria-label="Watershed Watch home">
      <picture>
        <source srcSet="/brand/pww-mark-on-dark.svg" media="(prefers-color-scheme: dark)" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/pww-mark-master.svg" alt="" width="30" height="36" />
      </picture>
      <span>Watershed Watch</span>
    </Link>
  );
}

function WaterLines() {
  return (
    <svg className="ww-water-illustration" viewBox="0 0 650 680" fill="none" role="img" aria-label="Abstract illustration of streams joining a watershed">
      <path className="ww-contour" d="M-55 92C75 13 226 23 326 107c87 74 149 57 252-1 44-25 88-23 124-9" />
      <path className="ww-contour" d="M-63 149C61 74 192 74 294 152c101 76 179 66 276 15 52-27 104-25 138-11" />
      <path className="ww-contour" d="M-65 211C67 127 179 134 279 211c102 77 186 76 286 27 62-30 117-21 148-3" />
      <path className="ww-contour" d="M-69 278C58 204 166 202 271 284c112 87 189 81 284 40 73-32 126-26 159-8" />
      <path className="ww-contour" d="M-70 349C57 270 162 279 266 355c120 88 190 93 295 42 75-38 120-28 154-9" />
      <path className="ww-contour" d="M-80 423C51 339 166 351 264 426c120 91 210 83 304 43 76-31 113-29 151-2" />
      <path className="ww-contour" d="M-83 494C50 425 170 423 270 493c110 78 194 81 304 38 58-22 104-25 150-4" />
      <path className="ww-contour" d="M-80 564C57 489 178 492 289 554c109 60 194 66 299 37 53-15 106-20 145-7" />
      <path className="ww-river-under" d="M260-30c-41 105-64 150-20 219 42 65 61 93 40 151-22 62-100 84-91 169 7 70 73 108 25 204" />
      <path className="ww-river" d="M260-30c-41 105-64 150-20 219 42 65 61 93 40 151-22 62-100 84-91 169 7 70 73 108 25 204" />
      <path className="ww-river-under" d="M565 35c-73 70-127 83-150 151-20 62-18 99-54 134-30 30-58 34-81 54" />
      <path className="ww-river" d="M565 35c-73 70-127 83-150 151-20 62-18 99-54 134-30 30-58 34-81 54" />
      <path className="ww-river-under" d="M602 619c-103-54-171-52-230-99-43-35-56-94-87-139" />
      <path className="ww-river" d="M602 619c-103-54-171-52-230-99-43-35-56-94-87-139" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="ww-site">
      <a className="ww-skip-link" href="#main">Skip to content</a>
      <header className="ww-header">
        <Brand />
        <nav className="ww-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#data">Public data</a>
          <a href="#about">About</a>
        </nav>
        <Link href="/dashboard" className="ww-header-link">Explore dashboard <span aria-hidden="true">↗</span></Link>
      </header>

      <main id="main">
        <section className="ww-hero" aria-labelledby="hero-title">
          <div className="ww-hero-copy">
            <p className="ww-kicker">FIELD OBSERVATIONS. SCIENTIFIC REVIEW. PUBLIC UNDERSTANDING.</p>
            <h1 id="hero-title">A clearer picture<br />of our water.</h1>
            <p className="ww-hero-lead">Water quality begins with observations in the field. Watershed Watch brings those observations through careful review and into a public view worth trusting.</p>
            <div className="ww-hero-actions">
              <Link className="ww-button ww-button-primary" href="/dashboard">Explore public data <span aria-hidden="true">↗</span></Link>
              <a className="ww-text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <p className="ww-hero-footnote">Built for Pennsylvania watershed monitoring.</p>
          </div>
          <div className="ww-hero-art">
            <WaterLines />
            <div className="ww-art-caption"><span>WATERSHED / FIELD NOTES</span><span>TRIBUTARIES TO MAINSTEM</span></div>
          </div>
        </section>

        <section className="ww-process ww-section" id="how-it-works" aria-labelledby="process-title">
          <div className="ww-section-intro">
            <p className="ww-kicker">THE PROCESS</p>
            <h2 id="process-title">From the field.<br />Into focus.</h2>
            <p>Public confidence starts with a process that keeps the original observation, the scientific review, and the published record distinct.</p>
          </div>
          <div className="ww-process-grid">
            <article className="ww-process-item"><span className="ww-step-index">01 / COLLECT</span><h3>Record what you see.</h3><p>Field teams capture site information, observations, methods, and measurements using native mobile tools.</p></article>
            <article className="ww-process-item"><span className="ww-step-index">02 / REVIEW</span><h3>Check the evidence.</h3><p>Validation and authorized human review preserve corrections and keep the original scientific history intact.</p></article>
            <article className="ww-process-item"><span className="ww-step-index">03 / EXPLORE</span><h3>Share what is approved.</h3><p>Only approved, public-safe records can appear in the map and measurement explorer. Private review data stays private.</p></article>
          </div>
        </section>

        <section className="ww-data ww-section" id="data" aria-labelledby="data-title">
          <div className="ww-data-heading">
            <div><p className="ww-kicker">THE PUBLIC EXPLORER</p><h2 id="data-title">The data, in context.</h2></div>
            <div><p>Explore monitoring sites, their watershed context, and approved observations. The dashboard below uses the actual public data source.</p><Link className="ww-text-link" href="/dashboard">Open full dashboard <span aria-hidden="true">↗</span></Link></div>
          </div>
          <div className="ww-embed" aria-label="Embedded Watershed Watch dashboard">
            <div className="ww-embed-bar"><span>WATERSHED WATCH / PUBLIC DASHBOARD</span><Link href="/dashboard">Expand ↗</Link></div>
            <iframe title="Interactive Watershed Watch public monitoring dashboard" src="/dashboard" loading="lazy" />
          </div>
          <p className="ww-data-note">Public monitoring records appear only after scientific review and authorized publication. An empty map does not mean that conditions were measured or assessed.</p>
        </section>

        <section className="ww-outro ww-section" id="about" aria-labelledby="about-title">
          <p className="ww-kicker">BUILT ON CAREFUL SCIENCE</p>
          <h2 id="about-title">Good data takes work.<br />We make that work visible.</h2>
          <div className="ww-outro-bottom"><p>Watershed Watch connects field collection, quality control, and public exploration without compromising the integrity of the record.</p><Link href="/dashboard" className="ww-button ww-button-light">View the dashboard <span aria-hidden="true">↗</span></Link></div>
        </section>
      </main>

      <footer className="ww-footer">
        <Brand footer />
        <p>Field data, scientific review, and public understanding.</p>
        <a href="#main">Back to top ↑</a>
      </footer>
    </div>
  );
}
