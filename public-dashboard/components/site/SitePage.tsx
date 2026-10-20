import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function SitePage({ children }: { children: React.ReactNode }) {
  return (
    <div className="ww-site">
      <a className="ww-skip" href="#main">Skip to content</a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>{children}</main>
      <SiteFooter />
    </div>
  );
}
