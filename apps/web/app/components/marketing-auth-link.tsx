"use client";

import Link from "next/link";
import { useArtifactSession } from "../../lib/auth-client";

export function MarketingAuthLink() {
  const { data } = useArtifactSession();
  const isAuthenticated = Boolean(data?.user);
  const href = isAuthenticated ? "/dashboard" : "/login?mode=signup";
  const label = isAuthenticated ? "Dashboard" : "Start for free";

  return (
    <Link
      href={href}
      className="group flex h-full items-center px-4 sm:pr-8"
      aria-label={isAuthenticated ? "Open Artifacts dashboard" : "Start using Artifacts for free"}
    >
      <span className="inline-grid grid-cols-[auto_auto] items-center gap-2 rounded-none border border-foreground/30 bg-[oklch(0.96_0_0)] px-3 py-1.5 font-pixel text-[13px] font-normal uppercase leading-none tracking-[-0.035em] text-primary-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.42),0_1px_0_oklch(1_0_0_/_0.18),0_8px_18px_oklch(0.08_0_0_/_0.18)] transition-colors group-hover:bg-[oklch(0.92_0_0)]">
        <span className="leading-none">{label}</span>
        <span className="font-pixel text-[15px] leading-none text-[#FF570A]" aria-hidden>
          ↗
        </span>
      </span>
    </Link>
  );
}
