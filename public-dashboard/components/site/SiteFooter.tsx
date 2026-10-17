import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="ww-footer">
      <div className="ww-wrap ww-footer-grid">
        <div className="ww-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG lockup */}
          <img src="/brand/watershed-watch-horizontal.svg" alt="Watershed Watch" width={147} height={30} />
          <p>Water quality readings from Central Pennsylvania streams, reviewed before they are published.</p>
        </div>
        <nav aria-label="Footer" className="ww-footer-nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/about">About</Link>
        </nav>
        <div className="ww-footer-credits">
          <p>Watershed boundaries: <a href="https://www.usgs.gov/national-hydrography/watershed-boundary-dataset">USGS Watershed Boundary Dataset</a>. Basemaps and streams: Esri.</p>
          <p>Interface images on this site show test data, not published readings.</p>
        </div>
      </div>
    </footer>
  );
}
