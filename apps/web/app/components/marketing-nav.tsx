"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { docsUrl } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";
import { MarketingAuthLink } from "./marketing-auth-link";

const marketingNavLogoPath = "/brand/artifacts-logo.svg";
const githubUrl = "https://github.com/laxman-patel/agent-artifacts";
const docsHref = docsUrl();

// Past this scroll offset the full-width hero bar collapses into the floating pill.
const SCROLL_THRESHOLD = 24;

type MarketingNavItem = {
  label: string;
  href: string;
};

const navItems: MarketingNavItem[] = [
  { label: "pricing", href: "/pricing" },
  { label: "docs", href: docsHref },
  { label: "support", href: "mailto:support@agent-artifacts.com" }
];

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.9c-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.97c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.95.68 1.92v2.8c0 .27.18.59.69.49A10.15 10.15 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}

export function MarketingNav({ active }: { active?: "pricing" }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-transparent transition-[padding,background-color,border-color] duration-300 ease-out",
        scrolled ? "bg-transparent pt-2.5 sm:pt-3" : "bg-background/90 backdrop-blur-xl"
      )}
    >
      <div
        className={cn(
          "relative mx-auto box-border flex items-stretch justify-between border-border transition-all duration-300 ease-out",
          scrolled
            ? "h-[42px] w-[calc(100%-1.5rem)] max-w-[48rem] rounded-sm border bg-background/70 shadow-[0_18px_50px_oklch(0.02_0_0/0.6)] backdrop-blur-xl"
            : "h-[45px] w-[calc(100%-1rem)] max-w-[76rem] border-x sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full"
        )}
      >
        <Link href="/" className="flex items-center gap-2 px-4 text-foreground sm:px-8" aria-label="Artifacts home">
          <img src={marketingNavLogoPath} alt="" className="size-[18px] opacity-95" />
          <span className="font-mono text-[13px] font-semibold uppercase leading-none tracking-[0.045em] text-foreground/92">ARTIFACTS</span>
        </Link>
        <nav className="hidden items-stretch border-x border-border md:flex" aria-label="Marketing sections">
          {navItems.map((item) => {
            const isActive = active === item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center border-r border-border px-[1.375rem] text-xs font-medium uppercase tracking-wider transition-colors last:border-r-0",
                  isActive
                    ? "border-b-2 border-b-[#FF570A] bg-background text-foreground"
                    : "text-foreground/40 hover:bg-foreground/[0.03] hover:text-foreground/70"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-stretch">
          <Link
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Artifacts on GitHub"
            className="flex h-full items-center justify-center px-4 text-foreground/42 transition-colors hover:bg-foreground/[0.03] hover:text-foreground/72"
          >
            <GithubIcon className="size-[18px]" />
          </Link>
          <MarketingAuthLink />
        </div>
      </div>
    </header>
  );
}
