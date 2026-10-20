"use client";

import Link from "next/link";
import { preloadMapModules } from "@/components/dashboard/mapModules";

/** A link to the dashboard that starts loading the map code on hover, focus or touch. */
export function DashboardLink({ children, ...props }: Omit<React.ComponentProps<typeof Link>, "href">) {
  return (
    <Link href="/dashboard" onPointerEnter={preloadMapModules} onFocus={preloadMapModules} onTouchStart={preloadMapModules} {...props}>
      {children}
    </Link>
  );
}
