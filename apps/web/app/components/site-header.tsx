"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionNav } from "./session-nav";

// Top-level path segments that belong to app chrome rather than a user's
// `/username` namespace. Used to tell an immersive artifact render
// (`/user/project/slug`) apart from app routes that happen to be 3 deep.
const RESERVED_TOP_LEVEL = new Set([
  "dashboard",
  "settings",
  "pricing",
  "login",
  "workspaces",
  "share",
  "cli",
  "workspace-invite",
  "api"
]);

// The bare artifact render lives at `/username/project/slug`. Its sub-pages
// (history, settings, diff, audit) are 4+ segments and keep normal chrome.
function isImmersiveArtifactPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 3) return false;
  return !RESERVED_TOP_LEVEL.has(segments[0]);
}

// Shared app header for app pages. Marketing routes ship their own header +
// footer, the dashboard owns a sidebar shell, and the immersive artifact
// render relies on its own floating control, so the header steps aside there.
export function SiteHeader() {
  const pathname = usePathname();
  if (
    pathname === "/" ||
    pathname === "/pricing" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/dashboard") ||
    isImmersiveArtifactPath(pathname)
  ) {
    return null;
  }

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
