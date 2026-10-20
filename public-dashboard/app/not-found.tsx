import Link from "next/link";
import { DashboardLink } from "@/components/site/DashboardLink";
import { SitePage } from "@/components/site/SitePage";

export default function NotFound() {
  return (
    <SitePage>
      <section className="ww-wrap ww-page-head" aria-labelledby="not-found-title">
        <h1 id="not-found-title">This page doesn’t exist</h1>
        <p className="ww-lead">The link may be out of date. You can go to the dashboard or start from the home page.</p>
        <div className="ww-actions">
          <DashboardLink className="ww-button">Open the dashboard</DashboardLink>
          <Link href="/" className="ww-text-link">Home</Link>
        </div>
      </section>
    </SitePage>
  );
}
