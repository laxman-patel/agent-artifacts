"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionNav } from "./session-nav";

// Shared app header for every page except the landing route. The landing ("/")
// ships its own marketing header + footer, so this returns null there and the
// app pages (dashboard, login, [username], share, settings) are left untouched.
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/") return null;

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
        <Link href="/#quotes">Quotes</Link>
      </nav>
      <SessionNav />
    </header>
  );
}
