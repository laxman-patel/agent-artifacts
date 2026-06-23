import Link from "next/link";
import type { ReactNode } from "react";

import { docsUrl } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

export { MarketingNav } from "./marketing-nav";

export const marketingLogoPath = "/brand/artifacts-logo.svg";
const githubUrl = "https://github.com/laxman-patel/agent-artifacts";
const docsHref = docsUrl();

export function SectionShell({
  id,
  children,
  className,
  contentClassName,
  last = false
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  last?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative mx-auto w-[calc(100%-1rem)] max-w-[76rem] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full",
        className
      )}
    >
      <div className="pointer-events-none absolute left-0 top-0 z-30 h-full w-px bg-border" />
      <div className="pointer-events-none absolute right-0 top-0 z-30 h-full w-px bg-border" />
      {!last ? (
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-px w-screen -translate-x-1/2 bg-border" />
      ) : null}
      <div className={cn("relative z-10 px-5 py-10 sm:px-8 sm:py-12 lg:p-12", contentClassName)}>{children}</div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className="relative mx-auto flex w-[calc(100%-1rem)] max-w-[76rem] flex-col gap-4 border-x border-t border-border px-5 py-8 text-xs text-foreground/35 sm:w-[calc(100%-2rem)] sm:px-8 md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] lg:flex-row lg:items-center lg:justify-between xl:w-full">
      <div className="flex flex-wrap items-center gap-4">
        <img src={marketingLogoPath} alt="Artifacts" className="size-[18px] opacity-75" />
        <Link href="/pricing" className="transition-colors hover:text-foreground/70">
          Pricing
        </Link>
        <Link href={docsHref} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground/70">
          Docs
        </Link>
        <Link href="mailto:support@agent-artifacts.com" className="transition-colors hover:text-foreground/70">
          Support
        </Link>
        <Link href={githubUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground/70">
          GitHub
        </Link>
      </div>
      <div className="font-mono">© 2026 Artifacts</div>
    </footer>
  );
}
