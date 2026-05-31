"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionNav } from "./session-nav";

// Shared app header for app pages. Marketing routes ship their own header +
// footer, so this returns null there and dashboard/share/settings keep their
// product chrome.
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/pricing" || pathname === "/login") return null;

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Artifacts home">
        <img src="/brand/artifacts-logo.svg" alt="" className="size-[18px]" />
        <span className="font-mono text-[13px] font-semibold uppercase leading-none tracking-[0.045em] text-foreground/92">ARTIFACTS</span>
      </Link>
      <nav className="product-nav" aria-label="Product">
        <Link href="/#how">How it works</Link>
        <Link href="/#features">Features</Link>
        <Link href="/#create">Create</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/#quotes">Quotes</Link>
      </nav>
      <SessionNav />
    </header>
  );
}
