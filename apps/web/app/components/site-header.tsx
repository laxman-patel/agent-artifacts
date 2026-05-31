"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionNav } from "./session-nav";

// Shared app header for app pages. Marketing routes ship their own header +
// footer, so this returns null there and dashboard/login/share/settings keep
// their product chrome.
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/pricing") return null;

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <img src="/brand/artifacts-logo.svg" alt="" className="size-5" />
        <span>Artifacts</span>
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
