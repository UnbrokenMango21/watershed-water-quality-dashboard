"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DashboardLink } from "./DashboardLink";

const links = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.dataset.menuOpen = "true";
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    const desktop = window.matchMedia("(min-width: 761px)");
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      // Keep focus inside the open menu and its toggle.
      const items = [toggleRef.current, ...Array.from(menuRef.current?.querySelectorAll<HTMLElement>("a") ?? [])].filter(Boolean) as HTMLElement[];
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", close);
    return () => {
      delete root.dataset.menuOpen;
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", close);
    };
  }, [open]);

  const current = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <header className="ww-header">
      <div className="ww-wrap ww-header-row">
        <Link href="/" className="ww-logo" aria-current={current("/")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG lockup */}
          <img src="/brand/watershed-watch-horizontal.svg" alt="Watershed Watch home" width={157} height={32} />
        </Link>
        <nav className="ww-nav" aria-label="Main">
          {links.map((link) => <Link key={link.href} href={link.href} aria-current={current(link.href)}>{link.label}</Link>)}
          <DashboardLink className="ww-button">Open the dashboard</DashboardLink>
        </nav>
        <button
          ref={toggleRef}
          type="button"
          className="ww-menu-toggle"
          aria-expanded={open}
          aria-controls="ww-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <div id="ww-menu" ref={menuRef} className="ww-menu" hidden={!open}>
        <nav aria-label="Main" className="ww-wrap">
          <DashboardLink className="ww-menu-primary">Open the dashboard</DashboardLink>
          <Link href="/" aria-current={current("/")}>Home</Link>
          {links.map((link) => <Link key={link.href} href={link.href} aria-current={current(link.href)}>{link.label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
